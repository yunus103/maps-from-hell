import './drift.css';
import type { DriftEvent, DriftView, GamePhase, L10n } from '../game/types';
import { getLang, tx } from '../game/lang';
import { el, pic } from './hud';

const HOLD_MS = 1000; // the banked / lost total stays on screen this long after the chain ends
const ROLL_RATE = 14; // 1/s: how fast the shown number catches up with the real one
const GAUGE_MAX_DEG = 70; // slip angle at full needle
const LINK_URGENT = 0.35; // link bar blinks below this
const HOT_CHAIN = 5;
const POPUPS = 3;
const POP_MS = 1300;
const BIG_POP = 20000; // bank popup reaches full size at this total

const T: Record<string, L10n> = {
  drift: { en: 'DRIFT', tr: 'DRİFT' },
  banked: { en: 'BANKED', tr: 'KASADA' },
  lost: { en: 'LOST', tr: 'GİTTİ' },
  chainLost: { en: 'CHAIN LOST', tr: 'ZİNCİR GİTTİ' },
  nearMiss: { en: 'NEAR MISS', tr: 'KIL PAYI' },
  park: { en: 'DRIFT PARK', tr: 'DRİFT PARK' },
  routeStyle: { en: 'ROUTE STYLE', tr: 'ROTA STİLİ' },
  chainUp: { en: 'CHAIN', tr: 'ZİNCİR' },
};

const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, getLang() === 'tr' ? '.' : ',');
const fmtMul = (m: number) => (getLang() === 'tr' ? m.toString().replace('.', ',') : m.toString());

export function createDriftMeter(root: HTMLElement): { update(v: DriftView, phase: GamePhase): void; event(e: DriftEvent): void } {
  const wrap = el('div', 'drift', root);
  const box = el('div', 'drift-box', wrap);
  const top = el('div', 'drift-top', box);
  pic('ui/icons/drift.svg', '💨', 'drift-ico', top);
  const nums = el('div', 'drift-nums', top);
  const label = el('span', 'drift-label', nums);
  const pts = el('span', 'drift-pts num', nums);
  const chainEl = el('span', 'drift-chain num', top);
  const row = el('div', 'drift-row', box);
  const link = el('div', 'drift-link', row);
  const linkFill = el('div', 'drift-link-fill', link);
  const gauge = el('div', 'drift-gauge', row);
  el('div', 'drift-needle', gauge);
  const angle = el('span', 'drift-angle num', row);
  const risk = el('span', 'drift-risk num', row);
  const pops = el('div', 'drift-pops', wrap);
  const pool: HTMLElement[] = [];
  for (let i = 0; i < POPUPS; i++) {
    const p = el('div', 'drift-pop', pops);
    p.style.display = 'none';
    pool.push(p);
  }
  let nextPop = 0;

  const last = new Map<object, string | number>();
  function setText(e: HTMLElement, s: string) {
    if (last.get(e) !== s) {
      last.set(e, s);
      e.textContent = s;
    }
  }
  function setVar(e: HTMLElement, name: string, val: number) {
    if (last.get(e) !== val) {
      last.set(e, val);
      e.style.setProperty(name, String(val));
    }
  }
  function setClass(e: Element, cls: string, on: boolean) {
    if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
  }

  let mode: 'run' | 'bank' | 'lost' = 'run';
  let holdUntil = 0;
  let target = 0;
  let shown = 0;
  let lastMs = performance.now();
  let tick = 0; // update() count: a standalone bonus and its bank arrive in the same tick
  let bonusTick = -1;
  let bonusPts = -1;

  function popup(text: string, tone: 'bank' | 'lost' | 'bonus' | 'chain', scale = 1) {
    const p = pool[nextPop];
    nextPop = (nextPop + 1) % POPUPS;
    p.getAnimations().forEach((a) => a.cancel());
    p.textContent = text;
    p.className = `drift-pop pop-${tone}`;
    p.style.display = '';
    p.style.fontSize = `${scale}em`;
    pops.appendChild(p); // newest at the bottom; older ones float above it
    const frames: Keyframe[] =
      tone === 'lost'
        ? [
            { opacity: 0, transform: 'translateX(0) scale(1.4)' },
            { opacity: 1, transform: 'translateX(-0.3em) scale(1)', offset: 0.1 },
            { transform: 'translateX(0.3em)', offset: 0.18 },
            { transform: 'translateX(-0.2em)', offset: 0.26 },
            { opacity: 1, transform: 'translateX(0)', offset: 0.75 },
            { opacity: 0, transform: 'translateY(0.6em)' },
          ]
        : [
            { opacity: 0, transform: 'translateY(0.6em) scale(0.6)' },
            { opacity: 1, transform: 'translateY(0) scale(1.15)', offset: 0.12 },
            { transform: 'scale(1)', offset: 0.22 },
            { opacity: 1, transform: 'translateY(-0.6em)', offset: 0.75 },
            { opacity: 0, transform: 'translateY(-1.4em)' },
          ];
    const a = p.animate(frames, { duration: tone === 'bank' ? POP_MS + 300 : POP_MS, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
    a.onfinish = () => (p.style.display = 'none');
  }

  function bump(e: HTMLElement, frames: Keyframe[], ms: number) {
    e.animate(frames, { duration: ms, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  }

  function event(e: DriftEvent) {
    const now = performance.now();
    switch (e.type) {
      case 'driftChain':
        bump(chainEl, [{ transform: 'rotate(-4deg) scale(1)' }, { transform: 'rotate(-4deg) scale(1.6)' }, { transform: 'rotate(-4deg) scale(1)' }], 380);
        if (e.chain >= 3) popup(`${tx(T.chainUp)} ×${e.chain}`, 'chain', 0.9);
        break;
      case 'driftBank':
        mode = 'bank';
        holdUntil = now + HOLD_MS;
        target = e.total;
        // A standalone bonus already has its own popup; don't show the same number twice.
        if (!(bonusTick === tick && bonusPts === e.points && e.chain === 1)) {
          popup(`+${fmt(e.total)}`, 'bank', 1 + 0.9 * Math.min(1, e.total / BIG_POP));
        }
        bump(box, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 320);
        break;
      case 'driftLost':
        mode = 'lost';
        holdUntil = now + HOLD_MS;
        target = shown = e.points;
        popup(tx(T.chainLost), 'lost', 1.15);
        bump(
          box,
          [
            { transform: 'translateX(0)' }, { transform: 'translateX(-0.5em) rotate(-2deg)' }, { transform: 'translateX(0.5em) rotate(2deg)' },
            { transform: 'translateX(-0.3em)' }, { transform: 'translateX(0)' },
          ],
          420,
        );
        break;
      case 'driftBonus':
        bonusTick = tick;
        bonusPts = e.points;
        popup(`${tx(T[e.kind])} +${fmt(e.points)}`, 'bonus', 1);
        break;
    }
  }

  function update(v: DriftView, phase: GamePhase) {
    tick++;
    const nowMs = performance.now();
    const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    const live = phase === 'driving' || phase === 'free';
    if (v.active) {
      if (mode !== 'run') shown = 0; // a new chain started during the hold
      mode = 'run';
      holdUntil = 0;
      target = v.points;
    }
    const show = live && (v.active || nowMs < holdUntil);
    setClass(wrap, 'show', show);
    if (!show) {
      if (!v.active) shown = 0;
      return;
    }

    shown += (target - shown) * Math.min(1, dt * ROLL_RATE);
    if (Math.abs(target - shown) < 1) shown = target;
    setText(pts, fmt(shown));
    setText(label, tx(mode === 'bank' ? T.banked : mode === 'lost' ? T.lost : T.drift));
    setClass(box, 'is-bank', mode === 'bank');
    setClass(box, 'is-lost', mode === 'lost');

    setText(chainEl, `×${v.chain}`);
    setClass(chainEl, 'one', v.chain <= 1);
    setClass(chainEl, 'hot', v.chain >= HOT_CHAIN);

    const link01 = mode === 'run' ? v.link01 : 0;
    setVar(linkFill, '--v', Math.round(link01 * 100) / 100);
    setClass(link, 'urgent', mode === 'run' && link01 < LINK_URGENT);

    const deg = Math.round(v.angleDeg);
    setVar(gauge, '--a', Math.round((Math.min(deg, GAUGE_MAX_DEG) / GAUGE_MAX_DEG) * 180 - 90));
    setText(angle, `${deg}°`);

    setClass(risk, 'show', v.bonusMul > 1);
    if (v.bonusMul > 1) setText(risk, `${v.bonusMul >= 1.5 ? '🎂' : '📦'} ×${fmtMul(v.bonusMul)}`);
  }

  return { update, event };
}
