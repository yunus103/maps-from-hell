import type { EndReason, L10n, OrderOffer, ScreenActions, Screens, ShiftState, ShiftSummary, UpdateDef } from '../game/types';
import { getLang, tx } from '../game/lang';
import { S } from './strings';
import { el, money, pic } from './hud';

const ICON = 'ui/icons/';
// A new screen ignores input this long, so a key mashed for the previous screen can't pick blind here.
const INPUT_GRACE_MS = 600;

// Read-only peek at the records for the title screen; the shift module owns these keys.
function readRecord(key: 'mfh.best' | 'mfh.bestDrift'): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

// Drift points with a thousands separator ("12,345" / "12.345").
const pts = (n: number) => Math.round(n).toLocaleString(getLang() === 'tr' ? 'tr-TR' : 'en-US');

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function createScreens(root: HTMLElement, actions: ScreenActions): Screens {
  const layer = el('div', 'screens', root);

  let state: ShiftState | null = null;
  let builtKey = '';
  let prevPhase = '';
  let hired = false;
  let locked = false; // one action per built screen, so a double click/keypress can't pick twice
  let builtAt = 0;

  function act(f: () => void) {
    if (locked || performance.now() - builtAt < INPUT_GRACE_MS) return;
    locked = true;
    setTimeout(() => (locked = false), 400); // in case the action didn't change the screen
    f();
  }

  function button(parent: HTMLElement, label: L10n, key: string, onClick: () => void, cls = '') {
    const b = el('button', `btn ${cls}`, parent);
    b.type = 'button';
    el('span', 'btn-label', b, tx(label));
    if (key) el('kbd', 'kbd', b, key);
    b.onclick = () => act(onClick);
    return b;
  }

  function langToggle(parent: HTMLElement) {
    const wrap = el('div', 'lang', parent);
    pic(ICON + 'language.svg', '🌐', 'lang-ico', wrap);
    for (const l of ['tr', 'en'] as const) {
      const b = el('button', 'lang-btn', wrap, l.toUpperCase());
      b.type = 'button';
      b.setAttribute('aria-pressed', String(getLang() === l));
      b.onclick = () => actions.setLang(l); // not locked: changing language keeps the screen
    }
    el('kbd', 'kbd kbd-ghost', wrap, 'L');
  }

  function toggleLang() {
    actions.setLang(getLang() === 'tr' ? 'en' : 'tr');
  }

  function screen(cls: string): HTMLElement {
    return el('div', `screen ${cls}`, layer);
  }

  // ---------- title ----------
  function buildTitle() {
    const sc = screen('scr-home');
    const col = el('div', 'title-col', sc);
    const lang = getLang();
    const logoWrap = el('div', `title-logo logo-${lang}`, col);
    const logo = el('img', 'logo-img', logoWrap);
    logo.alt = 'Maps From Hell';
    logo.src = `ui/brand/logo_${lang}.png`;
    logo.onerror = () => logo.replaceWith(el('h1', 'logo-fb', undefined, lang === 'tr' ? 'Cehennem Haritası' : 'Maps From Hell'));

    const btns = el('div', 'title-btns', col);
    button(btns, S.start_shift, 'Enter', actions.startShift, 'btn-primary btn-big');
    button(btns, S.free_drive, 'F', actions.freeDrive, 'btn-secondary');
    const row = el('div', 'title-row', col);
    langToggle(row);
    const best = readRecord('mfh.best');
    const bestDrift = readRecord('mfh.bestDrift');
    const bests = el('div', 'best-chips', row); // the two records wrap together, never one by one
    if (best > 0) {
      const b = el('div', 'best-chip', bests);
      pic(ICON + 'cash.svg', '💵', 'chip-ico', b);
      el('span', 'best-label', b, tx(S.best_payout));
      el('span', 'best-val num', b, money(best));
    }
    if (bestDrift > 0) {
      const b = el('div', 'best-chip best-drift', bests);
      pic(ICON + 'drift.svg', '💨', 'chip-ico', b);
      el('span', 'best-label', b, tx(S.best_drift));
      el('span', 'best-val num', b, pts(bestDrift));
    }
    el('p', 'controls', col, tx(S.controls));

    const side = el('div', 'title-side', sc);
    if (hired) {
      const c = el('div', 'contract', side);
      pic('ui/brand/app_icon.png', '📍', 'contract-ico', c);
      el('h2', 'contract-title', c, tx(S.hired_title));
      el('p', 'contract-body', c, tx(S.hired_body));
      el('div', 'stamp stamp-green', c, tx(S.hired_stamp));
    } else {
      const m = el('div', 'mascot', side);
      el('div', 'bubble', m, tx(S.app_tagline));
      pic('ui/yoldas/idle.gif', '📍', 'mascot-img', m);
    }
  }

  // ---------- order board ----------
  function offerCard(parent: HTMLElement, o: OrderOffer, i: number) {
    const card = el('button', 'ticket', parent);
    card.type = 'button';
    card.style.setProperty('--i', String(i));
    card.onclick = () => act(() => actions.pickOffer(i));
    el('kbd', 'kbd ticket-key', card, String(i + 1));

    const badges = el('div', 'badges', card);
    if (o.long) el('span', 'badge badge-long', badges, tx(S.badge_long));
    if (o.package === 'fragile') {
      const b = el('span', 'badge badge-fragile', badges);
      pic(ICON + 'fragile.svg', '🥚', 'badge-ico', b);
      el('span', '', b, tx(S.badge_fragile));
    }
    if (o.package === 'urgent') {
      const b = el('span', 'badge badge-urgent', badges);
      pic(ICON + 'urgent.svg', '⏰', 'badge-ico', b);
      el('span', '', b, tx(S.badge_urgent));
    }
    if (o.package === 'heavy') {
      const b = el('span', 'badge badge-heavy', badges);
      pic(ICON + 'heavy.svg', '📦', 'badge-ico', b);
      el('span', '', b, tx(S.badge_heavy));
    }
    if (o.package === 'passenger') {
      const b = el('span', 'badge badge-passenger', badges);
      pic(ICON + 'passenger.svg', '🧍', 'badge-ico', b);
      el('span', '', b, tx(S.badge_passenger));
    }

    const art = el('div', 'ticket-art', card);
    if (o.item.icon.includes('/')) pic(o.item.icon, '📦', 'ticket-img', art);
    else el('span', 'ticket-img fb', art, o.item.icon);
    el('div', 'ticket-item', card, tx(o.item.name));
    // Passenger items may already be named after the passenger: don't print the name twice.
    if (o.customer && tx(o.customer) !== tx(o.item.name)) {
      const c = el('div', 'ticket-cust', card);
      el('span', 'ticket-cust-label', c, tx(o.package === 'passenger' ? S.ticket_passenger : S.ticket_customer));
      el('span', 'ticket-cust-name', c, tx(o.customer));
    }
    if (o.note) el('div', 'ticket-note', card, `“${tx(o.note)}”`);

    const route = el('div', 'ticket-route', card);
    const a = el('div', 'stop stop-pick', route);
    pic(ICON + 'pickup.svg', '🏪', 'stop-ico', a);
    el('span', 'stop-name', a, tx(o.pickup.name));
    const b = el('div', 'stop stop-drop', route);
    pic(ICON + 'destination.svg', '🏠', 'stop-ico', b);
    el('span', 'stop-name', b, tx(o.dropoff.name));

    const stats = el('div', 'ticket-stats', card);
    const st = (label: L10n, val: string) => {
      const s = el('div', 'stat', stats);
      el('span', 'stat-label', s, tx(label));
      el('span', 'stat-val num', s, val);
    };
    st(S.route, `${(o.routeLength / 1000).toFixed(1)} km`);
    st(S.eta, mmss(o.expectedTime));

    const pay = el('div', 'ticket-pay', card);
    const f = el('div', 'pay-cell', pay);
    el('span', 'stat-label', f, tx(S.fare));
    el('span', 'pay-val num', f, money(o.baseFare));
    const t = el('div', 'pay-cell pay-tip', pay);
    el('span', 'stat-label', t, tx(S.max_tip));
    const tv = el('span', 'pay-val num', t);
    pic(ICON + 'coin.svg', '', 'pay-ico', tv);
    el('span', '', tv, `+${money(o.tipMax)}`);
  }

  function buildBoard(s: ShiftState) {
    const sc = screen('scr-board');
    const head = el('div', 'scr-head', sc);
    pic('ui/brand/app_icon.png', '📍', 'head-ico', head);
    const ht = el('div', 'head-text', head);
    el('h2', 'scr-title', ht, tx(S.board_title));
    el('p', 'scr-sub', ht, tx(S.board_sub));
    const meta = el('div', 'head-meta num', head);
    el('span', '', meta, s.clockText);
    el('span', '', meta, money(s.money));
    el('span', '', meta, `★ ${s.rating.toFixed(1)}`);
    const row = el('div', 'tickets', sc);
    s.offers.slice(0, 3).forEach((o, i) => offerCard(row, o, i));
  }

  // ---------- YOLDAŞ update ----------
  function buildUpdate(s: ShiftState) {
    const sc = screen('scr-update');
    const head = el('div', 'scr-head', sc);
    pic('ui/yoldas/installing.gif', '⏳', 'head-ico head-gif', head);
    const ht = el('div', 'head-text', head);
    el('h2', 'scr-title', ht, tx(S.update_title));
    el('p', 'scr-sub', ht, tx(S.update_sub));

    const row = el('div', 'upd-cards', sc);
    s.updateChoices.slice(0, 3).forEach((u: UpdateDef, i) => {
      const c = el('button', 'upd', row);
      c.type = 'button';
      c.style.setProperty('--i', String(i));
      c.onclick = () => act(() => actions.pickUpdate(i));
      const flip = el('div', 'upd-flip', c);
      const front = el('div', 'upd-face upd-front', flip);
      const img = el('img', 'upd-img', front);
      img.alt = tx(u.name);
      img.src = u.card;
      img.onerror = () => img.replaceWith(el('div', 'upd-img fb', undefined, tx(u.name)));
      // The card art has its English title baked in: cover it with a localised label.
      if (getLang() !== 'en') el('div', 'upd-label', front, tx(u.name));
      const info = el('div', 'upd-info', c);
      el('kbd', 'kbd', info, String(i + 1));
      el('div', 'upd-name', info, tx(u.name));
      el('div', 'upd-desc', info, tx(u.desc));
    });

    const act2 = el('div', 'upd-active', sc);
    el('span', 'upd-active-label', act2, `${tx(S.update_installed)}:`);
    if (s.activeUpdates.length === 0) el('span', 'upd-chip upd-chip-none', act2, tx(S.update_none));
    for (const u of s.activeUpdates) el('span', 'upd-chip', act2, tx(u.name));
  }

  // ---------- pause ----------
  function buildPause() {
    const sc = screen('scr-pause');
    const p = el('div', 'panel', sc);
    pic(ICON + 'pause.svg', '⏸', 'panel-ico', p);
    el('h2', 'scr-title', p, tx(S.paused));
    el('p', 'scr-sub', p, tx(S.paused_sub));
    const btns = el('div', 'panel-btns', p);
    button(btns, S.resume, 'Enter', actions.resume, 'btn-primary');
    button(btns, S.quit_title, 'Q', actions.quitToTitle, 'btn-secondary');
    const tells = el('div', 'tells', p);
    el('div', 'tells-title', tells, tx(S.tells_title));
    const list = el('ul', 'tells-list', tells);
    for (const t of [S.tell_hesitate, S.tell_suggest, S.tell_precise, S.tell_glitch]) el('li', '', list, tx(t));
    langToggle(p);
    el('p', 'controls', p, tx(S.controls));
  }

  // ---------- continue (one per shift, after towed / fired) ----------
  function buildContinue(reason: EndReason) {
    const towed = reason === 'towed';
    const sc = screen(`scr-continue end-${reason}`);
    const card = el('div', 'cont', sc);
    const info = el('div', 'cont-info', card);
    const head = el('div', 'cont-head', info);
    pic(ICON + (towed ? 'wrecked.svg' : 'suspended.svg'), towed ? '🚗' : '🚫', 'cont-ico', head);
    const ht = el('div', 'cont-head-text', head);
    el('div', 'cont-kicker', ht, `YOLDAŞ · ${tx(S.cont_kicker)}`);
    el('h2', 'cont-title', ht, tx(towed ? S.end_towed : S.end_fired));
    el('p', 'cont-body', info, tx(S.cont_body));

    const perks = el('ul', 'cont-perks', info);
    const good = el('li', 'perk perk-good', perks);
    pic(ICON + (towed ? 'health.svg' : 'star.svg'), towed ? '🔧' : '★', 'perk-ico', good);
    el('span', '', good, tx(towed ? S.cont_perk_towed : S.cont_perk_fired));
    const warn = el('li', 'perk perk-warn', perks);
    el('span', 'perk-ico fb', warn, '🏁');
    el('span', '', warn, tx(S.cont_perk_unranked));

    const btns = el('div', 'cont-btns', card);
    const yes = button(btns, S.cont_yes, 'Enter', actions.continueShift, 'btn-primary btn-big btn-cont');
    yes.prepend(pic(ICON + 'continue.svg', '▶', 'btn-ico'));
    yes.querySelector('.btn-label')?.append(el('small', 'btn-sub', undefined, tx(S.cont_yes_sub)));
    button(btns, S.cont_no, 'Esc', actions.declineContinue, 'btn-secondary');
    // Where the rewarded ad will go (game/ads.ts); for now the continue is free.
    const ad = el('div', 'ad-chip', btns);
    pic(ICON + 'watch_ad.svg', '📺', 'ad-chip-ico', ad);
    el('span', '', ad, tx(S.cont_ad_chip));
  }

  // ---------- shift end ----------
  function buildEnd(sum: ShiftSummary, rating: number) {
    const sc = screen(`scr-end end-${sum.reason}`);
    const slip = el('div', 'slip', sc);
    const head = el('div', 'slip-head', slip);
    const icon = sum.reason === 'fired' ? 'suspended.svg' : sum.reason === 'towed' ? 'wrecked.svg' : 'timer.svg';
    pic(ICON + icon, sum.reason === 'towed' ? '🚗' : sum.reason === 'fired' ? '🚫' : '🌇', 'slip-ico', head);
    el('div', 'slip-kicker', head, `YOLDAŞ · ${tx(S.slip_title)}`);
    const title = sum.reason === 'fired' ? S.end_fired : sum.reason === 'towed' ? S.end_towed : S.end_time;
    const subT = sum.reason === 'fired' ? S.end_fired_sub : sum.reason === 'towed' ? S.end_towed_sub : S.end_time_sub;
    el('h2', 'slip-title', head, tx(title));
    el('p', 'slip-sub', head, tx(subT));

    const rows = el('div', 'slip-rows', slip);
    const row = (label: string, val: string, cls = '') => {
      const r = el('div', `slip-row ${cls}`, rows);
      el('span', 'slip-label', r, label);
      el('span', 'slip-dots', r);
      el('span', 'slip-val num', r, val);
    };
    row(tx(S.row_deliveries), String(sum.deliveries));
    row(tx(S.row_cancelled), String(sum.cancelled));
    row(tx(S.row_fares), money(sum.fares));
    row(tx(S.row_tips), money(sum.tips));
    if (sum.adIncome > 0) row(tx(S.row_ads), money(sum.adIncome));
    row(tx(S.row_reports, { n: sum.discoveries }), money(sum.discoveryBonus));
    if (sum.driftCash > 0) row(tx(S.row_drift_cash), money(sum.driftCash));
    if (sum.repairs > 0) row(tx(S.row_mechanic), `−${money(sum.repairs)}`, 'neg');
    row(tx(S.row_repair), `−${money(sum.repairBill)}`, sum.repairBill > 0 ? 'neg' : '');
    row(tx(S.row_total), money(sum.total), 'total');
    row(tx(S.row_rating), `★ ${rating.toFixed(1)}`, rating < 3 ? 'neg' : '');
    // Unranked shifts never set records: the stored best is shown as is.
    const record = !sum.unranked && sum.total > 0 && sum.total >= sum.best;
    row(record ? tx(S.row_new_best) : tx(S.row_best), money(record ? sum.total : sum.best), record ? 'record' : 'muted');
    el('div', 'slip-cut', rows);
    row(tx(S.row_drift_score), pts(sum.driftScore), 'muted');
    if (sum.bestChain > 1) row(tx(S.row_best_chain), `×${sum.bestChain}`, 'muted');
    const driftRecord = !sum.unranked && sum.driftScore > 0 && sum.driftScore >= sum.bestDrift;
    if (sum.bestDrift > 0 || driftRecord) {
      row(driftRecord ? tx(S.row_new_best_drift) : tx(S.row_best_drift), pts(driftRecord ? sum.driftScore : sum.bestDrift), driftRecord ? 'record' : 'muted');
    }
    row(tx(S.row_mult), `×${sum.bestMultiplier.toFixed(1).replace(/\.0$/, '')}`, 'muted');
    row(tx(S.row_trusted), String(sum.trusted), 'muted');
    row(tx(S.row_dodged), String(sum.liesDodged), 'muted');
    row(tx(S.row_followed), String(sum.liesFollowed), 'muted');
    if (sum.pedsHit > 0) row(tx(S.row_peds), String(sum.pedsHit), 'muted');
    el('p', 'slip-foot', slip, tx(S.slip_footer));

    if (sum.reason !== 'time') {
      el('div', 'stamp stamp-red', slip, tx(sum.reason === 'fired' ? S.stamp_fired : S.stamp_towed));
    }
    if (sum.unranked) el('div', 'stamp stamp-unranked', slip, tx(S.stamp_unranked));

    const btns = el('div', 'end-btns', sc);
    button(btns, S.new_shift, 'Enter', actions.startShift, 'btn-primary btn-big');
    button(btns, S.to_title, 'Esc', actions.quitToTitle, 'btn-secondary');
  }

  // ---------- render / keys ----------

  function keyOf(s: ShiftState): string {
    const parts: (string | number)[] = [s.phase, getLang()];
    if (s.phase === 'title') parts.push(hired ? 'hired' : '');
    if (s.phase === 'board') parts.push(s.offers.map((o) => o.id).join(','));
    if (s.phase === 'update') parts.push(s.updateChoices.map((u) => u.id).join(','), s.activeUpdates.length);
    if (s.phase === 'continue') parts.push(s.pendingEnd ?? '-');
    if (s.phase === 'shiftEnd') parts.push(s.summary ? `${s.summary.reason}:${s.summary.total}` : '-');
    return parts.join('|');
  }

  function build(s: ShiftState) {
    layer.textContent = '';
    locked = false;
    builtAt = performance.now();
    layer.dataset.phase = s.phase;
    switch (s.phase) {
      case 'title':
        buildTitle();
        break;
      case 'board':
        buildBoard(s);
        break;
      case 'update':
        buildUpdate(s);
        break;
      case 'paused':
        buildPause();
        break;
      case 'continue':
        if (s.pendingEnd) buildContinue(s.pendingEnd);
        break;
      case 'shiftEnd':
        if (s.summary) buildEnd(s.summary, s.rating);
        break;
      default:
        break;
    }
    layer.classList.toggle('show', layer.childElementCount > 0);
  }

  function render(s: ShiftState) {
    state = s;
    if (s.phase !== prevPhase) {
      // The FTUE delivery drops straight to the title: greet the new "partner" there once.
      hired = prevPhase === 'ftue' && s.phase === 'title' ? true : s.phase === 'title' ? hired : false;
      prevPhase = s.phase;
    }
    const key = keyOf(s);
    if (key !== builtKey) {
      builtKey = key;
      build(s);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (!state || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const s = state;
    const k = e.key;
    const n = k === '1' || k === '2' || k === '3' ? Number(k) - 1 : -1;
    const lower = k.toLowerCase();
    let handled = true;
    switch (s.phase) {
      case 'title':
        if (k === 'Enter') act(actions.startShift);
        else if (lower === 'f') act(actions.freeDrive);
        else if (lower === 'l') toggleLang();
        else handled = false;
        break;
      case 'board':
        if (n >= 0 && n < s.offers.length) act(() => actions.pickOffer(n));
        else handled = false;
        break;
      case 'update':
        if (n >= 0 && n < s.updateChoices.length) act(() => actions.pickUpdate(n));
        else handled = false;
        break;
      case 'paused':
        if (k === 'Enter') act(actions.resume);
        else if (lower === 'q') act(actions.quitToTitle);
        else if (lower === 'l') toggleLang();
        else handled = false;
        break;
      case 'continue':
        if (k === 'Enter') act(actions.continueShift);
        else if (k === 'Escape') act(actions.declineContinue);
        else handled = false;
        break;
      case 'shiftEnd':
        if (k === 'Enter') act(actions.startShift);
        else if (k === 'Escape') act(actions.quitToTitle);
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  });

  return { render };
}
