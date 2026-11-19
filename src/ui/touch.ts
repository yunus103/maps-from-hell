import type { L10n } from '../game/types';
import { onLangChange, tx } from '../game/lang';
import { queueReset, touchInput } from '../input';
import { S } from './strings';
import { el } from './hud';
import { enterFullscreen, fullscreenSupported } from './fullscreen';

type Key = keyof typeof touchInput;

const ARROW_LEFT = '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" /></svg>';
const ARROW_RIGHT = '<svg viewBox="0 0 24 24"><path d="m9 4 8 8-8 8" /></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" /></svg>';
const RESET = '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" /></svg>';

const root = document.documentElement;
export const isTouch = () => root.classList.contains('is-touch');

// Touch UI turns on for coarse pointers, or on the first real touch (touch laptops report a fine primary pointer).
// ?mobile forces it for desktop testing.
if (matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('mobile')) root.classList.add('is-touch');
addEventListener('touchstart', () => root.classList.add('is-touch'), { once: true, passive: true });
// Long-press would open the context menu / text callout over a held button.
addEventListener('contextmenu', (e) => {
  if (isTouch()) e.preventDefault();
});

const portrait = matchMedia('(orientation: portrait)');

export function createTouchControls(ui: HTMLElement, pause: () => void) {
  const pad = el('div', 'touch', ui);
  const corner = el('div', 'corner', ui);
  const releases: (() => void)[] = [];

  function hold(parent: HTMLElement, key: Key, cls: string, label: L10n) {
    const b = el('div', `tbtn ${cls}`, parent);
    const span = el('span', 'tbtn-label', b);
    const relabel = () => (span.textContent = tx(label));
    relabel();
    onLangChange(relabel);
    // Tracked per pointer so a second finger lifting off doesn't release a button the first still holds.
    const ids = new Set<number>();
    const sync = () => {
      touchInput[key] = ids.size > 0;
      b.classList.toggle('on', ids.size > 0);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-ended pointers can't be captured; the press still counts.
      }
      ids.add(e.pointerId);
      sync();
    });
    const up = (e: PointerEvent) => {
      ids.delete(e.pointerId);
      sync();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    releases.push(() => {
      ids.clear();
      sync();
    });
  }

  function tap(cls: string, label: L10n, svg: string, onTap: () => void) {
    const b = el('button', `cbtn ctl-touch ${cls}`, corner);
    b.type = 'button';
    b.innerHTML = svg;
    b.setAttribute('aria-label', tx(label));
    b.onclick = onTap;
  }

  // Left thumb owns one zone: side comes from x vs the zone centre, the top row adds the handbrake, and both are
  // re-read on every move, so the thumb can rock left/right or slide up into a handbrake without lifting.
  const steer = el('div', 'touch-steer', pad);
  const hand = el('div', 'tbtn tbtn-hand', steer);
  const handLabel = el('span', 'tbtn-label', hand);
  const relabelHand = () => (handLabel.textContent = tx(S.touch_handbrake));
  relabelHand();
  onLangChange(relabelHand);
  const left = el('div', 'tbtn tbtn-left', steer);
  left.innerHTML = ARROW_LEFT;
  const right = el('div', 'tbtn tbtn-right', steer);
  right.innerHTML = ARROW_RIGHT;
  const presses = new Map<number, { side: number; hand: boolean }>();
  const syncSteer = () => {
    const all = [...presses.values()];
    touchInput.left = all.some((p) => p.side < 0);
    touchInput.right = all.some((p) => p.side > 0);
    touchInput.handbrake = all.some((p) => p.hand);
    left.classList.toggle('on', touchInput.left);
    right.classList.toggle('on', touchInput.right);
    hand.classList.toggle('on', touchInput.handbrake);
  };
  const readSteer = (e: PointerEvent) => {
    const r = steer.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dead = r.width * 0.06;
    presses.set(e.pointerId, {
      side: Math.abs(dx) < dead ? 0 : Math.sign(dx),
      hand: e.clientY < hand.getBoundingClientRect().bottom,
    });
    syncSteer();
  };
  steer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      steer.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-ended pointers can't be captured; the press still counts.
    }
    readSteer(e);
  });
  steer.addEventListener('pointermove', (e) => {
    if (presses.has(e.pointerId)) readSteer(e);
  });
  const liftSteer = (e: PointerEvent) => {
    presses.delete(e.pointerId);
    syncSteer();
  };
  steer.addEventListener('pointerup', liftSteer);
  steer.addEventListener('pointercancel', liftSteer);
  steer.addEventListener('lostpointercapture', liftSteer);
  releases.push(() => {
    presses.clear();
    syncSteer();
  });

  const pedals = el('div', 'touch-pedals', pad);
  hold(pedals, 'brake', 'tbtn-brake', S.touch_brake);
  hold(pedals, 'gas', 'tbtn-gas', S.touch_gas);
  tap('cbtn-reset', S.touch_reset, RESET, queueReset);
  tap('cbtn-pause', S.touch_pause, PAUSE, pause);

  const releaseAll = () => releases.forEach((r) => r());
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', releaseAll);

  let shown: boolean | null = null;
  function setVisible(v: boolean) {
    if (v === shown) return;
    shown = v;
    pad.classList.toggle('show', v);
    corner.classList.toggle('drive', v);
    if (!v) releaseAll();
  }

  const rotate = el('div', 'rotate', ui);
  el('div', 'rotate-ico', rotate, '⟳');
  const rotTitle = el('div', 'rotate-title', rotate);
  const rotBody = el('div', 'rotate-body', rotate);
  // Android: fullscreen also locks landscape, the quickest way out for a phone with rotation lock on.
  const rotTap = fullscreenSupported ? el('div', 'rotate-tap', rotate) : null;
  if (rotTap) rotate.addEventListener('click', enterFullscreen);
  const relabelRotate = () => {
    rotTitle.textContent = tx(S.rotate_title);
    rotBody.textContent = tx(S.rotate_body);
    if (rotTap) rotTap.textContent = tx(S.rotate_tap);
  };
  relabelRotate();
  onLangChange(relabelRotate);

  return { corner, setVisible, isPortrait: () => portrait.matches && isTouch() };
}
