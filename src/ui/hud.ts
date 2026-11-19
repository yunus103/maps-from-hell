import './ui.css';
import type {
  DeliveryResult, GamePhase, Hud, HudFx, HudView, NavEvent, NavView, PackageKind, ShiftEvent, ShiftState, TellKind,
} from '../game/types';
import { onLangChange, tx } from '../game/lang';
import { S } from './strings';

// ---------- tiny DOM helpers (shared with screens.ts) ----------

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

// An image that turns into an emoji/text badge if the file is missing, instead of a broken-image icon.
export function pic(src: string, fallback: string, cls: string, parent?: HTMLElement): HTMLElement {
  const img = el('img', cls, parent);
  img.alt = '';
  img.draggable = false;
  img.src = src;
  img.onerror = () => {
    const fb = el('span', `${cls} fb`, undefined, fallback);
    img.replaceWith(fb);
  };
  return img;
}

export const money = (n: number) => `₺${Math.round(n)}`;
const signedMoney = (n: number) => `${n < 0 ? '−' : '+'}${money(Math.abs(n))}`;

// ---------- HUD ----------

const ICON = 'ui/icons/';
const FACE = 'ui/yoldas/';
const TOAST_MS = 1600;
const HINT_MS = 10000;
const HINT_HIDE_KMH = 8;
const RESULT_MS = 2600; // ≈ shift RESULT_HOLD
const FTUE_RESULT_MS = 4000;
const TELL_TOAST_MS = 4500;
const HIT_TOAST_MIN = 3; // HP; smaller hits only flash
const RATING_WARN = 3.5;
const SHAKE_MS = 300;
const WOBBLE_MS = 450;
const TIP_FLOAT_MS = 1100;
// Package cell bar turns red below this condition (heavy: the 4-star cap, passenger: the 3-star cap).
const PKG_DANGER: Record<PackageKind, number> = { normal: 0, fragile: 35, urgent: 0, heavy: 50, passenger: 40 };

type Part = 'status' | 'order' | 'phone' | 'speed' | 'hint';
const VISIBLE: Record<GamePhase, Part[]> = {
  title: [],
  board: [],
  update: [],
  shiftEnd: [],
  paused: [], // replaced by the phase it was paused from
  continue: [],
  ftue: ['phone', 'speed', 'hint'],
  driving: ['status', 'order', 'phone', 'speed'],
  free: ['speed'],
};

const TURN_SRC: Record<string, string> = {
  left: 'turn_left.svg',
  right: 'turn_right.svg',
  straight: 'straight.svg',
  uturn: 'uturn.svg',
  arrive_left: 'destination.svg',
  arrive_right: 'destination.svg',
};
const TURN_FB: Record<string, string> = {
  left: '↰', right: '↱', straight: '↑', uturn: '↶', arrive_left: '📍', arrive_right: '📍',
};

export function createHud(root: HTMLElement): Hud & { hit(points: number): void } {
  const hud = el('div', 'hud', root);
  const flash = el('div', 'hud-flash', hud);

  // Status (top-left)
  const status = el('div', 'hud-part hud-status', hud);
  const clockChip = el('div', 'chip chip-clock', status);
  pic(ICON + 'timer.svg', '⏱', 'chip-ico', clockChip);
  const clockText = el('span', 'chip-val num', clockChip);
  const moneyChip = el('div', 'chip chip-money', status);
  pic(ICON + 'cash.svg', '💵', 'chip-ico', moneyChip);
  const moneyText = el('span', 'chip-val num', moneyChip);
  const ratingChip = el('div', 'chip chip-rating', status);
  const stars = el('div', 'stars', ratingChip);
  const starEls: HTMLImageElement[] = [];
  for (let i = 0; i < 5; i++) {
    const s = el('img', 'star', stars);
    s.alt = '';
    s.src = ICON + 'star.svg';
    s.onerror = () => s.classList.add('missing');
    starEls.push(s);
  }
  const ratingText = el('span', 'chip-val num', ratingChip);
  const healthChip = el('div', 'chip chip-health', status);
  pic(ICON + 'health.svg', '🔧', 'chip-ico', healthChip);
  const healthBar = el('div', 'bar', healthChip);
  const healthFill = el('div', 'bar-fill', healthBar);

  // Order strip (top-centre)
  const order = el('div', 'hud-part hud-order', hud);
  const orderItem = el('div', 'order-item', order);
  const orderRoute = el('div', 'order-route', order);
  const legPick = el('span', 'leg leg-pick', orderRoute);
  el('span', 'leg-arrow', orderRoute, '→');
  const legDrop = el('span', 'leg leg-drop', orderRoute);
  const tipBox = el('div', 'order-cell order-tip', order);
  pic(ICON + 'coin.svg', '🪙', 'cell-ico', tipBox);
  const tipText = el('span', 'cell-val num', tipBox);
  const tipBar = el('div', 'bar bar-thin', tipBox);
  const tipFill = el('div', 'bar-fill', tipBar);
  const multBox = el('div', 'order-cell order-mult', order);
  pic(ICON + 'multiplier.svg', '🔥', 'cell-ico', multBox);
  const multText = el('span', 'cell-val num', multBox);
  const pkgBox = el('div', 'order-cell order-pkg', order);
  const pkgFragile = pic(ICON + 'fragile.svg', '🥚', 'cell-ico pkg-fragile', pkgBox);
  const pkgUrgent = pic(ICON + 'urgent.svg', '⏰', 'cell-ico pkg-urgent', pkgBox);
  const pkgHeavy = pic(ICON + 'heavy.svg', '📦', 'cell-ico pkg-heavy', pkgBox);
  const pkgPassenger = pic(ICON + 'passenger.svg', '🧍', 'cell-ico pkg-passenger', pkgBox);
  const pkgBar = el('div', 'bar bar-thin', pkgBox);
  const pkgFill = el('div', 'bar-fill', pkgBar);

  // YOLDAŞ phone (right)
  const phone = el('div', 'hud-part hud-phone', hud);
  el('div', 'phone-clamp', phone);
  const screen = el('div', 'phone-screen', phone);
  const bar = el('div', 'phone-bar', screen);
  pic('ui/brand/app_icon.png', '📍', 'phone-appicon', bar);
  el('span', 'phone-brand', bar, 'YOLDAŞ');
  const barClock = el('span', 'phone-barclock num', bar);
  const signal = el('span', 'phone-signal', bar);
  for (let i = 0; i < 4; i++) el('i', '', signal);
  const turn = el('div', 'phone-turn', screen);
  const turnImg = el('img', 'turn-img', turn);
  turnImg.alt = '';
  turnImg.onerror = () => turnImg.classList.add('missing');
  const turnFb = el('span', 'turn-fb', turn);
  const turnSide = el('span', 'turn-side', turn);
  const dist = el('div', 'phone-dist num', screen);
  const targetRow = el('div', 'phone-target', screen);
  const targetIco = el('img', 'target-ico', targetRow);
  targetIco.alt = '';
  targetIco.onerror = () => targetIco.classList.add('missing');
  const targetText = el('div', 'target-text', targetRow);
  const targetLabel = el('span', 'target-label', targetText);
  const targetName = el('span', 'target-name', targetText);
  const face = el('div', 'phone-face', screen);
  const faceImg = el('img', 'face-img', face);
  faceImg.alt = '';
  faceImg.onerror = () => faceImg.classList.add('missing');

  // Subtitles, speed, hint, toasts
  const sub = el('div', 'hud-sub', hud);
  const subWho = el('span', 'sub-who', sub);
  const subText = el('span', 'sub-text', sub);
  const speed = el('div', 'hud-part hud-speed', hud);
  const speedVal = el('span', 'speed-val num', speed);
  el('span', 'speed-unit', speed, 'km/h');
  const hint = el('div', 'hud-part hud-hint', hud);
  pic(ICON + 'wasd.svg', '⌨', 'hint-ico', hint);
  const hintText = el('span', 'hint-text', hint);
  const toasts = el('div', 'hud-toasts', hud);
  const result = el('div', 'hud-result', hud);

  const parts: Record<Part, HTMLElement> = { status, order, phone, speed, hint };

  function relabel() {
    hintText.textContent = tx(S.hint_drive);
  }
  relabel();
  onLangChange(relabel);

  // ---- change-tracked writes: update() runs every frame, so touch the DOM only when a value changed ----
  const last = new Map<object, string | number | boolean>();
  function setText(e: HTMLElement, s: string) {
    if (last.get(e) !== s) {
      last.set(e, s);
      e.textContent = s;
    }
  }
  function setFrac(e: HTMLElement, f: number) {
    const v = Math.round(Math.max(0, Math.min(1, f)) * 200) / 200; // 0.5 % steps
    if (last.get(e) !== v) {
      last.set(e, v);
      e.style.setProperty('--v', String(v));
    }
  }
  function setClass(e: Element, cls: string, on: boolean) {
    if (e.classList.contains(cls) !== on) e.classList.toggle(cls, on);
  }
  function setSrc(img: HTMLImageElement, src: string) {
    if (last.get(img) !== src) {
      last.set(img, src);
      img.classList.remove('missing');
      img.src = src;
    }
  }

  // Previous frame's values: events are drained after the shift changed them, so these are the "before".
  let cur: ShiftState | null = null;
  let prevRating = 5;
  let prevMult = 1;
  let prevPkg = 100;
  let prevTipBonus = 0;
  let subKind = '';
  let wobble: Animation | null = null;
  let resultTimer = 0;
  let toldTells = new Set<TellKind>();

  let shownPhase: string = '';
  let ftueStart = 0;
  let hintDone = false;

  function applyPhase(s: ShiftState) {
    const effective = s.phase === 'paused' ? s.pausedFrom ?? 'driving' : s.phase;
    const key = `${effective}|${s.phase === 'paused'}`;
    if (key === shownPhase) return;
    if (effective === 'ftue' && !shownPhase.startsWith('ftue')) {
      ftueStart = performance.now();
      hintDone = false;
    }
    shownPhase = key;
    const vis = VISIBLE[effective];
    for (const p of Object.keys(parts) as Part[]) parts[p].classList.toggle('show', vis.includes(p));
    hud.classList.toggle('is-paused', s.phase === 'paused');
    hud.dataset.phase = effective;
  }

  function updateStatus(s: ShiftState) {
    setText(clockText, s.clockText);
    setText(moneyText, money(s.money));
    setText(ratingText, s.rating.toFixed(1));
    for (let i = 0; i < 5; i++) {
      const state = s.rating >= i + 0.75 ? 'full' : s.rating >= i + 0.25 ? 'half' : 'empty';
      const st = starEls[i];
      if (last.get(st) !== state) {
        last.set(st, state);
        st.src = ICON + (state === 'half' ? 'star_half.png' : 'star.svg');
        st.dataset.state = state;
      }
    }
    setFrac(healthFill, s.health / 100);
    setClass(healthChip, 'warn', s.health < 40);
    setClass(ratingChip, 'warn', s.rating < RATING_WARN);
  }

  function updateOrder(s: ShiftState) {
    const o = s.order;
    setClass(order, 'has-order', o !== null);
    if (!o) return;
    const offer = o.offer;
    if (last.get(orderItem) !== offer.id) {
      last.set(orderItem, offer.id);
      orderItem.textContent = '';
      if (offer.item.icon.includes('/')) pic(offer.item.icon, '📦', 'item-img', orderItem);
      else el('span', 'item-img fb', orderItem, offer.item.icon);
      setClass(pkgBox, 'show', offer.package !== 'normal');
      setClass(pkgFragile, 'show', offer.package === 'fragile');
      setClass(pkgUrgent, 'show', offer.package === 'urgent');
      setClass(pkgHeavy, 'show', offer.package === 'heavy');
      setClass(pkgPassenger, 'show', offer.package === 'passenger');
    }
    setText(legPick, tx(offer.pickup.name));
    setText(legDrop, tx(offer.dropoff.name));
    setClass(legPick, 'active', o.phase === 'toPickup');
    setClass(legDrop, 'active', o.phase === 'toDropoff');

    const r = o.elapsed / Math.max(1, offer.expectedTime);
    setText(tipText, money(Math.max(0, o.tipNow * s.multiplier * s.mods.tipMul + o.tipBonus)));
    setFrac(tipFill, offer.tipMax > 0 ? o.tipNow / offer.tipMax : 0);
    setClass(tipBox, 'danger', r > 1.5);
    setText(multText, `×${s.multiplier.toFixed(1).replace(/\.0$/, '')}`);
    setClass(multBox, 'hot', s.multiplier >= 3);
    if (offer.package === 'fragile' || offer.package === 'heavy' || offer.package === 'passenger') {
      setFrac(pkgFill, o.packageHealth / 100);
      setClass(pkgBox, 'danger', o.packageHealth < PKG_DANGER[offer.package]);
    } else if (offer.package === 'urgent') {
      setFrac(pkgFill, 1 - o.elapsed / (2 * offer.expectedTime));
      setClass(pkgBox, 'danger', r > 1.5);
    }
  }

  function updatePhone(v: HudView) {
    const nav: NavView = v.nav;
    const s = v.shift;
    setText(barClock, s.phase === 'free' ? '' : s.clockText);

    const icon = nav.icon;
    const hasTurn = icon in TURN_SRC;
    setClass(turn, 'empty', !hasTurn);
    if (hasTurn) {
      setSrc(turnImg, ICON + TURN_SRC[icon]);
      setText(turnFb, TURN_FB[icon]);
    }
    const sideText = icon === 'arrive_left' ? `◀ ${tx(S.side_left)}` : icon === 'arrive_right' ? `${tx(S.side_right)} ▶` : '';
    setText(turnSide, sideText);
    setClass(turn, 'arrive', sideText !== '');
    setClass(phone, 'glitch', nav.glitch);
    setClass(phone, 'recalc', icon === 'recalc');

    let distText = nav.distanceText ?? '';
    if (icon === 'recalc') distText = tx(S.recalculating);
    else if (icon === 'none' && !distText) distText = s.order ? '' : tx(S.no_route);
    setText(dist, distText);
    setClass(dist, 'small', icon === 'recalc' || icon === 'none');

    const o = s.order;
    const kind = nav.target ?? (o ? (o.phase === 'toPickup' ? 'pickup' : 'dropoff') : null);
    setClass(targetRow, 'show', kind !== null && o !== null);
    if (kind && o) {
      setSrc(targetIco, ICON + (kind === 'pickup' ? 'pickup.svg' : 'destination.svg'));
      setText(targetLabel, tx(kind === 'pickup' ? S.pickup : S.dropoff));
      setText(targetName, tx(kind === 'pickup' ? o.offer.pickup.name : o.offer.dropoff.name));
      setClass(targetRow, 'is-pickup', kind === 'pickup');
    }

    let faceSrc = 'idle.gif';
    if (nav.glitch) faceSrc = 'glitch.gif';
    else if (icon === 'recalc') faceSrc = 'recalc.gif';
    else if (v.subtitle && !v.subtitle.speaker) faceSrc = v.subtitle.mood === 'neutral' ? 'talking.gif' : `${v.subtitle.mood}.png`;
    setSrc(faceImg, FACE + faceSrc);
  }

  function update(v: HudView) {
    const s = v.shift;
    applyPhase(s);
    const ph = hud.dataset.phase;

    setClass(sub, 'show', v.subtitle !== null);
    if (v.subtitle) {
      const who = v.subtitle.speaker;
      setText(subWho, who ? who.label : tx(S.yoldas_prefix));
      const kind = who ? who.kind : 'yoldas';
      if (kind !== subKind) {
        subKind = kind;
        subWho.className = `sub-who sub-who--${kind}`;
      }
      setRich(subText, v.subtitle.text);
    }

    setText(speedVal, String(Math.round(v.speedKmh)));

    if (ph === 'ftue') {
      if (!hintDone && (v.speedKmh > HINT_HIDE_KMH || performance.now() - ftueStart > HINT_MS)) hintDone = true;
      setClass(hint, 'show', !hintDone);
    }
    if (ph === 'driving') {
      updateStatus(s);
      updateOrder(s);
    }
    if (ph === 'driving' || ph === 'ftue') updatePhone(v);

    if (ph === 'driving' && s.rating < RATING_WARN && prevRating >= RATING_WARN) {
      toast(tx(S.toast_rating_low), { kind: 'bad', ms: TELL_TOAST_MS });
    }
    cur = s;
    prevRating = s.rating;
    prevMult = s.multiplier;
    if (s.order) {
      prevPkg = s.order.packageHealth;
      prevTipBonus = s.order.tipBonus;
    }
  }

  // Lines mark emphasis with *asterisks*: render those words as <em> (text nodes only, no HTML parsing).
  function setRich(e: HTMLElement, s: string) {
    if (last.get(e) === s) return;
    last.set(e, s);
    e.textContent = '';
    s.split(/\*([^*]+)\*/).forEach((part, i) => {
      if (i % 2) el('em', '', e, part);
      else if (part) e.appendChild(document.createTextNode(part));
    });
  }

  // ---- result banner (delivery / cancel), shown while the shift holds on the road ----

  function showResult(kind: 'good' | 'bad' | 'info', title: string, big: string, lines: string[], ms: number) {
    result.textContent = '';
    result.className = `hud-result show result-${kind}`;
    el('div', 'result-title', result, title);
    if (big) el('div', 'result-big num', result, big);
    for (const l of lines) el('div', 'result-line', result, l);
    hud.classList.add('has-result');
    clearTimeout(resultTimer);
    resultTimer = window.setTimeout(hideResult, ms);
  }

  function hideResult() {
    clearTimeout(resultTimer);
    result.classList.remove('show');
    hud.classList.remove('has-result');
  }

  const ratingLine = (after: number) => `${tx(S.res_rating)} ${prevRating.toFixed(1)} → ${after.toFixed(1)}`;

  function deliveredBanner(r: DeliveryResult) {
    const ftue = cur?.phase === 'ftue';
    const starsText = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const mult = prevMult > 1 ? ` (×${prevMult.toFixed(1).replace(/\.0$/, '')})` : '';
    const lines = [`${tx(S.fare)} ${money(r.fare)} · ${tx(S.res_tip)} ${money(r.tip)}${mult}`, starsText];
    if (r.offer.package === 'fragile') {
      lines.push(r.ruined ? tx(S.res_pkg_ruined) : `${tx(S.res_pkg)} ${Math.round(prevPkg)}%`);
    } else if (r.offer.package === 'heavy') {
      lines.push(`${tx(S.res_condition)} ${Math.round(prevPkg)}%`);
    } else if (r.offer.package === 'passenger') {
      lines.push(`${tx(S.res_comfort)} ${Math.round(prevPkg)}%`);
    }
    if (Math.round(prevTipBonus) !== 0) lines.push(`${tx(S.res_tip_bonus)} ${signedMoney(prevTipBonus)}`);
    if (ftue) lines.push(tx(S.res_ftue));
    else if (cur) lines.push(ratingLine(cur.rating));
    const title = ftue ? tx(S.hired_title) : r.ruined ? tx(S.toast_ruined) : r.late ? tx(S.res_late) : tx(S.res_delivered);
    const kind = r.ruined || r.stars <= 2 ? 'bad' : r.stars >= 4 ? 'good' : 'info';
    showResult(kind, title, `+${money(r.fare + r.tip)}`, lines, ftue ? FTUE_RESULT_MS : RESULT_MS);
  }

  function cancelledBanner() {
    const lines = [tx(S.res_cancel_body)];
    if (cur) lines.push(ratingLine(cur.rating));
    if (prevMult > 1) lines.push(tx(S.toast_mult_lost));
    showResult('bad', tx(S.toast_cancelled), money(0), lines, RESULT_MS);
  }

  function hit(points: number) {
    flash.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
    pulse(healthChip, [{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], 400);
    if (points >= HIT_TOAST_MIN) toast(tx(S.toast_hit, { n: Math.round(points) }), { icon: 'health.svg', kind: 'bad' });
  }

  // ---- events: toasts and one-shot animations ----

  // icon: a file under ui/icons/ (has a '.') or an emoji.
  function toast(main: string, opts: { sub?: string; icon?: string; kind?: 'good' | 'bad' | 'info'; ms?: number } = {}) {
    while (toasts.children.length >= 3) toasts.firstElementChild?.remove();
    const t = el('div', `toast toast-${opts.kind ?? 'info'}`, toasts);
    const ms = opts.ms ?? TOAST_MS;
    t.style.animationDuration = `${ms}ms`;
    if (opts.icon?.includes('.')) pic(ICON + opts.icon, '', 'toast-ico', t);
    else if (opts.icon) el('span', 'toast-ico fb', t, opts.icon);
    const body = el('div', 'toast-body', t);
    el('div', 'toast-main', body, main);
    if (opts.sub) el('div', 'toast-sub', body, opts.sub);
    setTimeout(() => t.remove(), ms);
  }

  function pulse(e: HTMLElement, frames: Keyframe[], ms: number) {
    e.animate(frames, { duration: ms, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  }

  function shake(strength: number) {
    const k = Math.max(0, Math.min(1, strength));
    if (k <= 0) return;
    const d = 0.15 + 0.6 * k; // em
    hud.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-d}em, ${d * 0.5}em)` },
        { transform: `translate(${d}em, ${-d * 0.4}em)` },
        { transform: `translate(${-d * 0.6}em, ${-d * 0.3}em)` },
        { transform: `translate(${d * 0.4}em, ${d * 0.2}em)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: SHAKE_MS, easing: 'linear' },
    );
    flash.animate([{ opacity: 0.2 + 0.5 * k }, { opacity: 0 }], { duration: 300 + 300 * k, easing: 'ease-out' });
  }

  function pkgWobble(strength: number) {
    const a = 6 + 14 * Math.max(0, Math.min(1, strength)); // deg
    wobble?.cancel();
    wobble = pkgBox.animate(
      [
        { transform: 'rotate(0) scale(1)' },
        { transform: `rotate(${-a}deg) scale(1.12)` },
        { transform: `rotate(${a * 0.7}deg) scale(1.06)` },
        { transform: `rotate(${-a * 0.35}deg) scale(1.02)` },
        { transform: 'rotate(0) scale(1)' },
      ],
      { duration: WOBBLE_MS, easing: 'ease-out' },
    );
  }

  function urgentTick(level: 1 | 2) {
    const bg = level === 2 ? '#e8826f' : '#ffd9a0';
    const frames: Keyframe[] = [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', background: bg }, { transform: 'scale(1)' }];
    pulse(tipBox, frames, 500);
    if (pkgBox.classList.contains('show')) pulse(pkgBox, frames, 500);
  }

  function tipFloat(delta: number) {
    const f = el('span', `tip-float num ${delta > 0 ? 'up' : 'down'}`, tipBox, signedMoney(delta));
    f.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 0.4em) scale(0.8)' },
        { opacity: 1, transform: 'translate(-50%, -0.6em) scale(1.1)', offset: 0.2 },
        { opacity: 1, transform: 'translate(-50%, -1.6em) scale(1)', offset: 0.75 },
        { opacity: 0, transform: 'translate(-50%, -2.4em) scale(1)' },
      ],
      { duration: TIP_FLOAT_MS, easing: 'ease-out' },
    ).onfinish = () => f.remove();
    pulse(tipBox, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], 350);
  }

  function event(e: NavEvent | ShiftEvent | HudFx) {
    switch (e.type) {
      case 'toast':
        toast(tx(e.text, e.params), { sub: e.sub ? tx(e.sub, e.params) : undefined, icon: e.icon, kind: e.tone });
        break;
      case 'shake':
        shake(e.strength);
        break;
      case 'pkgWobble':
        pkgWobble(e.strength);
        break;
      case 'urgentTick':
        urgentTick(e.level);
        break;
      case 'tipAdjust':
        if (cur?.phase === 'driving') tipFloat(e.delta);
        break;
      case 'penalty':
        toast(tx(S.toast_ped, { n: e.amount.toFixed(1) }), { icon: '🚶', kind: 'bad' });
        flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
        break;
      case 'delivered':
        deliveredBanner(e.result);
        break;
      case 'pickedUp':
        toast(tx(S.toast_picked), { icon: 'pickup.svg', kind: 'good' });
        break;
      case 'cancelled':
        cancelledBanner();
        break;
      case 'told': {
        const tell = e.command.tell;
        if (tell && cur?.phase === 'driving' && !toldTells.has(tell)) {
          toldTells.add(tell);
          toast(tx(S.tell_spotted), { sub: tx(S[`tell_${tell}`]), kind: 'info', ms: TELL_TOAST_MS });
        }
        break;
      }
      case 'packageRuined':
        toast(tx(S.toast_ruined), { icon: 'fragile.svg', kind: 'bad' });
        break;
      case 'multiplier':
        if (e.delta > 0) {
          pulse(multBox, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], 450);
          if (Number.isInteger(e.value) && e.value >= 2) toast(`×${e.value}!`, { icon: 'multiplier.svg', kind: 'good' });
        } else if (e.delta < 0) {
          pulse(
            multBox,
            [
              { transform: 'translateX(0)', filter: 'grayscale(1)' },
              { transform: 'translateX(-6px)', filter: 'grayscale(1)' },
              { transform: 'translateX(6px)', filter: 'grayscale(1)' },
              { transform: 'translateX(-4px)', filter: 'grayscale(1)' },
              { transform: 'translateX(0)', filter: 'grayscale(0)' },
            ],
            700,
          );
          toast(tx(S.toast_mult_lost), { kind: 'bad' });
        }
        break;
      case 'money':
        if (e.reason === 'discovery') toast(tx(S.toast_report, { n: Math.round(e.amount) }), { icon: 'report.svg', kind: 'good' });
        else if (e.reason === 'ad') toast(tx(S.toast_ad, { n: Math.round(e.amount) }), { kind: 'info' });
        else if (e.reason === 'drift' && e.amount >= 1) toast(tx(S.toast_drift_cash, { n: Math.round(e.amount) }), { icon: 'drift.svg', kind: 'good' });
        break; // 'repair': the mechanic prompt shows the spending
      case 'fakeRoadHit':
        flash.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
        break;
      case 'phase':
        if (e.phase === 'shiftEnd' || e.phase === 'continue' || e.phase === 'title' || e.phase === 'free') {
          toasts.textContent = '';
          hideResult();
        }
        if (e.phase === 'shiftEnd') toldTells = new Set();
        break;
      default:
        break;
    }
  }

  return { update, event, hit };
}
