import './mechanic.css';
import type { GamePhase, L10n, MechanicState, MechanicView } from '../game/types';
import { getLang, tx } from '../game/lang';
import { el, money, pic } from './hud';

const STATE_TEXT: Record<MechanicState, L10n> = {
  stop: { en: 'Stop to repair · ₺{p}/hp', tr: 'Tamir için dur · can başı ₺{p}' },
  repairing: { en: 'Repairing… −{spent}', tr: 'Tamir ediliyor… −{spent}' },
  broke: { en: 'No money', tr: 'Para yok' },
  full: { en: 'Already fine', tr: 'Zaten sağlam' },
};

// No buttons: stopping in the ring is the whole interaction, so it works the same on touch.
export function createMechanicPrompt(root: HTMLElement): { update(v: MechanicView | null, phase: GamePhase): void } {
  const wrap = el('div', 'mech', root);
  const icoBox = el('div', 'mech-ico-box', wrap);
  pic('ui/icons/mechanic.svg', '🔧', 'mech-ico', icoBox);
  const body = el('div', 'mech-body', wrap);
  const name = el('div', 'mech-name', body);
  const stateText = el('div', 'mech-state num', body);
  const bar = el('div', 'bar mech-bar', body);
  const fill = el('div', 'bar-fill', bar);

  const last = new Map<object, string | number>();
  function setText(e: HTMLElement, s: string) {
    if (last.get(e) !== s) {
      last.set(e, s);
      e.textContent = s;
    }
  }
  function setClass(e: Element, cls: string, on: boolean) {
    if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
  }

  function update(v: MechanicView | null, phase: GamePhase) {
    const show = v !== null && phase === 'driving';
    setClass(wrap, 'show', show);
    if (!v || !show) return;
    setText(name, tx(v.name));
    const p = getLang() === 'tr' ? String(v.pricePerPoint).replace('.', ',') : String(v.pricePerPoint);
    setText(stateText, tx(STATE_TEXT[v.state], { p, spent: money(v.spent) }));
    for (const s of ['stop', 'repairing', 'broke', 'full'] as const) setClass(wrap, `is-${s}`, v.state === s);
    const f = Math.round(Math.max(0, Math.min(1, v.health / 100)) * 200) / 200;
    if (last.get(fill) !== f) {
      last.set(fill, f);
      fill.style.setProperty('--v', String(f));
    }
  }

  return { update };
}
