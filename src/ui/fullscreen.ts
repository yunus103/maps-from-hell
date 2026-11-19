import { getLang, onLangChange, tx } from '../game/lang';
import { unlockAudio } from '../audio';
import { S } from './strings';
import { el } from './hud';

const ENTER = '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></svg>';
const EXIT = '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" /></svg>';

// Safari (iPad, older macOS) only has the webkit-prefixed API; iPhone Safari has neither.
type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void };
const doc = document as WebkitDoc;
const target = document.documentElement as WebkitEl;

// Launched from the home screen via the manifest: already fullscreen, nothing to toggle.
const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
export const fullscreenSupported = !standalone && !!(target.requestFullscreen || target.webkitRequestFullscreen);

const isFullscreen = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

export async function enterFullscreen() {
  if (!fullscreenSupported || isFullscreen()) return;
  try {
    if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
    else target.webkitRequestFullscreen?.();
    await screen.orientation?.lock('landscape');
  } catch {
    // Denied, or orientation lock unsupported (desktop, iPad): the rotate overlay covers portrait.
  }
}

function exit() {
  if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

export function createFullscreenButton(parent: HTMLElement) {
  if (!fullscreenSupported) return;
  const b = el('button', 'cbtn cbtn-fs', parent);
  b.type = 'button';
  const sync = () => {
    b.innerHTML = isFullscreen() ? EXIT : ENTER;
    b.setAttribute('aria-label', tx(S.fullscreen));
  };
  sync();
  onLangChange(sync);
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  b.onclick = () => (isFullscreen() ? exit() : enterFullscreen());
}

// Touch only: one tap before the game starts, so going fullscreen (and the viewport jump that comes with it)
// happens before the FTUE puts the player in a moving car. click, not pointerdown: a touch only grants user
// activation on release, and fullscreen, AudioContext.resume and iOS speech all need it.
export function createStartGate(parent: HTMLElement, onStart: () => void) {
  const gate = el('div', 'gate', parent);
  const lang = getLang();
  const logo = el('img', `gate-logo logo-${lang}`, gate);
  logo.alt = 'Maps From Hell';
  logo.src = `ui/brand/logo_${lang}.png`;
  logo.onerror = () => logo.replaceWith(el('h1', 'logo-fb', undefined, lang === 'tr' ? 'Cehennem Haritası' : 'Maps From Hell'));
  const pill = el('div', 'gate-pill', gate);
  const icon = el('img', 'gate-ico', pill);
  icon.alt = '';
  icon.src = 'ui/brand/app_icon.png';
  icon.onerror = () => icon.remove();
  el('span', 'gate-text', pill, tx(S.gate_tap));
  gate.addEventListener(
    'click',
    async () => {
      unlockAudio();
      // iOS only lets speech start from inside a gesture; an empty utterance unlocks it for later lines.
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      // Wait out the resize so it lands before the car is live, but never hang on a request that doesn't settle.
      await Promise.race([enterFullscreen(), new Promise((r) => setTimeout(r, 800))]);
      onStart();
      gate.classList.add('out');
      setTimeout(() => gate.remove(), 300);
    },
    { once: true },
  );
}
