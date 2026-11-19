import './passenger.css';
import type { GamePhase, L10n, PassengerId, PassengerView, Turn } from '../game/types';
import { getLang, tx } from '../game/lang';
import { PASSENGERS } from '../game/passengers';
import { el, money, pic } from './hud';

const ICON = 'ui/icons/';
const S = {
  waiting: { en: 'Waiting at pickup', tr: 'Alım noktasında bekliyor' } as L10n,
};
const WANT_SRC: Partial<Record<Turn, string>> = { left: 'turn_left.svg', right: 'turn_right.svg', straight: 'straight.svg' };
const WANT_FB: Partial<Record<Turn, string>> = { left: '↰', right: '↱', straight: '↑' };
const MOOD_DROP_SHAKE = 0.08; // a mood fall this big in one frame (a crash) shakes the portrait

function moodFace(m: number): string {
  return m >= 0.75 ? '😄' : m >= 0.5 ? '🙂' : m >= 0.3 ? '😐' : m >= 0.15 ? '😠' : '🤬';
}

// Restart a one-shot CSS animation class.
function kick(e: HTMLElement, cls: string) {
  e.classList.remove(cls);
  void e.offsetWidth;
  e.classList.add(cls);
}

export function createPassengerCard(root: HTMLElement): { update(v: PassengerView | null, phase: GamePhase): void } {
  const card = el('div', 'pcard', root);
  const wait = el('div', 'pcard-wait', root);
  const waitIco = el('span', 'pcard-wait-ico', wait);
  const waitText = el('span', 'pcard-wait-text', wait);

  const top = el('div', 'pcard-top', card);
  const faceBox = el('div', 'pcard-face-box', top);
  const info = el('div', 'pcard-info', top);
  const name = el('div', 'pcard-name', info);
  const tag = el('div', 'pcard-tag', info);
  const row = el('div', 'pcard-row', card);
  const moodIco = el('span', 'pcard-mood-ico', row);
  const moodBar = el('div', 'pcard-mood', row);
  const moodFill = el('div', 'pcard-mood-fill', moodBar);
  const tipText = el('span', 'pcard-tip num', row);
  const bubble = el('div', 'pcard-bubble', card);
  const wantImg = el('img', 'pcard-want', bubble);
  wantImg.alt = '';
  wantImg.onerror = () => wantImg.classList.add('missing');
  const wantFb = el('span', 'pcard-want-fb', bubble);

  let face: HTMLElement | null = null;
  let id: PassengerId | null = null;
  let lang = getLang();
  let shown = false;
  let waiting = false;
  let mood = -1;
  let face01 = '';
  let tip = NaN;
  let want: Turn | null = null;

  function setShown(s: boolean) {
    if (s !== shown) card.classList.toggle('show', (shown = s));
  }
  function setWaiting(w: boolean) {
    if (w !== waiting) wait.classList.toggle('show', (waiting = w));
  }

  function build(v: PassengerView) {
    id = v.id;
    lang = getLang();
    const def = PASSENGERS[v.id];
    face?.remove();
    face = pic(v.icon, def.emoji, 'pcard-face', faceBox);
    name.textContent = tx(def.name);
    tag.textContent = tx(def.tagline);
    waitIco.textContent = def.emoji;
    waitText.textContent = tx(S.waiting);
    mood = -1;
    tip = NaN;
    want = null;
    bubble.classList.remove('show');
  }

  return {
    update(v, phase) {
      const on = phase === 'driving' && v !== null;
      setShown(on && v.aboard);
      setWaiting(on && !v.aboard);
      if (!on) return;
      if (v.id !== id || getLang() !== lang) build(v);

      if (v.mood !== mood) {
        if (mood >= 0 && mood - v.mood > MOOD_DROP_SHAKE && face) kick(face, 'shake');
        mood = v.mood;
        moodFill.style.setProperty('--v', mood.toFixed(3));
        const f = moodFace(mood);
        if (f !== face01) moodIco.textContent = face01 = f;
      }
      if (v.tipDelta !== tip) {
        if (!Number.isNaN(tip) && face) kick(face, v.tipDelta > tip ? 'bounce' : 'shake');
        tip = v.tipDelta;
        tipText.textContent = tip === 0 ? money(0) : `${tip > 0 ? '+' : '−'}${money(Math.abs(tip))}`;
        tipText.classList.toggle('up', tip > 0);
        tipText.classList.toggle('down', tip < 0);
      }
      if (v.wants !== want) {
        want = v.wants;
        bubble.classList.toggle('show', want !== null);
        if (want) {
          wantImg.classList.remove('missing');
          wantImg.src = ICON + (WANT_SRC[want] ?? 'straight.svg');
          wantFb.textContent = WANT_FB[want] ?? '↑';
          kick(bubble, 'pop');
        }
      }
    },
  };
}
