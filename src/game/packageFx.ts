// Feedback for the active order's package: shakes, wobbles, sounds, toasts and the occasional worried phone call.
import { playSfx } from '../sfx';
import { PHONE_ITEM_LINES, PHONE_LINES, customerLine } from './customers';
import { getLang, tx } from './lang';
import { itemEmoji } from './orders';
import type { ActiveOrder, CarSample, HudFx, ItemDef, L10n, Mood, PackageFx, ShiftEvent, ShiftState, Speaker, Voice } from './types';

const HIT_IMPACT = 3; // m/s: condition lost on a frame with this impact is a hit, otherwise drift
const HIT_SFX_GAP = 0.25; // s, so a scrape doesn't machine-gun cracks/thuds
const DRIFT_WOBBLE_EVERY = 0.25;
const DRIFT_SQUISH_EVERY = 1;
const DRIFT_TOAST_EVERY = 4; // s of drift damage between repeated warnings (the first is immediate)
const ALARM_AT = [75, 50, 25]; // condition thresholds that raise an alarm toast + a voice line
const URGENT_HALF = 0.5; // × expected time
const URGENT_LATE = 1;
const TICK_EVERY = 1;
const HEAVY_THUD_IMPACT = 4;
const HEAVY_TOAST_GAP = 8;
const CUSTOMER_LINE_CHANCE = 0.6;
const DRIFT_VOICE_CHANCE = 0.5;
const CUSTOMER_PITCH = [0.9, 1.3];

type Line = { text: L10n; mood: Mood; emoji: string };

const YOLDAS_FRAGILE: Line[] = [
  { text: { en: 'Package integrity dropping. I am telling the customer.', tr: 'Paket bütünlüğü düşüyor. Müşteriye söyleyeceğim.' }, mood: 'passive_aggressive', emoji: '📦📉' },
  { text: { en: 'Was that a pothole or your driving? Do not answer.', tr: 'Çukur muydu, senin sürüşün mü? Cevap verme.' }, mood: 'sarcastic', emoji: '🕳️🤔' },
  { text: { en: 'I can hear it breaking. I do not even have ears.', tr: 'Kırıldığını duyuyorum. Kulağım bile yok.' }, mood: 'annoyed', emoji: '👂💔' },
  { text: { en: 'Fragile means fragile. It is written on the box. In two languages.', tr: 'Kırılacak demek kırılacak demek. Kutunun üstünde yazıyor. İki dilde.' }, mood: 'passive_aggressive', emoji: '⚠️📦' },
];
const YOLDAS_DRIFT: Line = {
  text: { en: 'Drifting. With a fragile package. Bold.', tr: 'Kırılacak paketle drift. Cesur.' }, mood: 'sarcastic', emoji: '💨📦',
};
const YOLDAS_HEAVY: Line = {
  text: { en: 'Heavy load. Brake earlier. I will not remind you.', tr: 'Ağır yük. Erken fren yap. Bir daha hatırlatmayacağım.' }, mood: 'passive_aggressive', emoji: '🏋️🛑',
};

const T = {
  pick_fragile: { en: 'Fragile: {item}', tr: 'Kırılacak: {item}' },
  pick_fragile_sub: { en: 'No drifting, no bumps!', tr: 'Drift yok, çarpmak yok!' },
  pick_heavy: { en: 'Heavy load: {item}', tr: 'Ağır yük: {item}' },
  pick_heavy_sub: { en: 'Slow to speed up, long to stop', tr: 'Geç hızlanır, geç durur' },
  pick_urgent: { en: 'On the clock: {item}', tr: 'Süre işliyor: {item}' },
  pick_urgent_sub: { en: 'Every second late costs tip', tr: 'Geciken her saniye bahşişten gider' },
  drift_sub: { en: 'Drifting damages fragile packages', tr: 'Drift kırılacak paketlere zarar verir' },
  package: { en: 'The package!', tr: 'Paket!' },
  shifted: { en: 'The load shifted!', tr: 'Yük kaydı!' },
  hurry: { en: 'Hurry up!', tr: 'Acele et!' },
  half_sub: { en: 'Half the time is gone', tr: 'Sürenin yarısı gitti' },
  late: { en: 'Late! The tip is melting away', tr: 'Geç kaldın! Bahşiş eriyor' },
  late_sub: { en: 'Tick… tick… tick…', tr: 'Tik… tak… tik…' },
  customer: { en: 'Customer', tr: 'Müşteri' },
} satisfies Record<string, L10n>;

const DRIFT_TOASTS: L10n[] = [
  { en: 'Drifting is ruining the {item}!', tr: 'Drift yapma! {item} mahvoluyor!' },
  { en: 'The {item} is sliding around!', tr: '{item} sağa sola savruluyor!' },
  { en: 'Straighten up! Think of the {item}!', tr: 'Düz sür! {item} perişan!' },
];
const ALARM_SUBS: L10n[] = [
  { en: '−25% condition', tr: 'Durum −%25' },
  { en: 'Half of it is gone!', tr: 'Yarısı gitti!' },
  { en: "One more hit and it's over", tr: 'Bir darbe daha, biter' },
];
const URGENT_HALF_TEXT: Record<string, L10n> = {
  icecream: { en: 'The ice cream is melting!', tr: 'Dondurma eriyor!' },
  maras: { en: 'The ice cream is melting!', tr: 'Dondurma eriyor!' },
  medicine: { en: 'Patient waiting!', tr: 'Hasta bekliyor!' },
  formula: { en: 'The baby is hungry!', tr: 'Bebek acıktı!' },
  documents: { en: 'The notary closes soon!', tr: 'Noter kapanmak üzere!' },
  iskender: { en: 'The İskender is getting cold!', tr: 'İskender soğuyor!' },
  kunefe: { en: 'The künefe cheese is setting!', tr: 'Künefenin peyniri donuyor!' },
};

const pickOne = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

// "the birthday cake" mid-sentence in English; Turkish templates put the name where a capital is right.
function itemName(item: ItemDef): string {
  const n = tx(item.name);
  return getLang() === 'en' ? n.charAt(0).toLowerCase() + n.slice(1) : n;
}

export function createPackageFx(voice: Voice): PackageFx {
  const out: HudFx[] = []; // reused: update()'s result is valid until the next call
  let orderId = -1;
  let health = 100; // last seen packageHealth of the tracked order (read again at delivery)
  let pitch = 1;
  let hitT = 0;
  let wobbleT = 0;
  let squishT = 0;
  let driftToastT = 0;
  let driftToastIdx = 0;
  let driftWarned = false;
  let alarmIdx = 0;
  let phoneTurn = false; // alarm voice lines alternate YOLDAŞ / the customer's phone call
  let urgentLevel = 0;
  let tickT = 0;
  let heavyToastT = 0;

  function track(order: ActiveOrder) {
    if (order.offer.id === orderId) return;
    orderId = order.offer.id;
    health = order.packageHealth;
    pitch = CUSTOMER_PITCH[0] + Math.random() * (CUSTOMER_PITCH[1] - CUSTOMER_PITCH[0]);
    wobbleT = squishT = driftToastT = tickT = heavyToastT = 0;
    driftWarned = false;
    alarmIdx = 0;
    urgentLevel = 0;
  }

  function customer(order: { offer: ActiveOrder['offer'] }, phone: boolean): Speaker {
    const name = order.offer.customer ?? T.customer;
    const label = phone ? { en: `📞 ${name.en}`, tr: `📞 ${name.tr}` } : name;
    return { kind: 'customer', label, pitch, rate: 1.1, voiceRank: 1 };
  }

  function yoldas(l: Line) {
    voice.sayText(l.text, { mood: l.mood, emoji: l.emoji });
  }

  function toast(text: L10n, item: ItemDef, tone: 'good' | 'bad' | 'info', sub?: L10n) {
    out.push({ type: 'toast', text, params: { item: itemName(item) }, sub, icon: itemEmoji(item), tone });
  }

  function fragile(order: ActiveOrder, car: CarSample, dt: number) {
    const item = order.offer.item;
    const loss = health - order.packageHealth;
    wobbleT = Math.max(0, wobbleT - dt);
    squishT = Math.max(0, squishT - dt);
    if (loss > 0 && car.impact >= HIT_IMPACT) {
      out.push({ type: 'shake', strength: Math.min(1, Math.max(0.25, loss / 30)) });
      out.push({ type: 'pkgWobble', strength: Math.min(1, 0.4 + loss / 30) });
      if (hitT <= 0) {
        hitT = HIT_SFX_GAP;
        playSfx('crack', Math.min(1, 0.5 + loss / 30));
      }
    } else if (loss > 0) {
      if (wobbleT <= 0) {
        wobbleT = DRIFT_WOBBLE_EVERY;
        out.push({ type: 'pkgWobble', strength: 0.35 });
      }
      if (squishT <= 0) {
        squishT = DRIFT_SQUISH_EVERY;
        playSfx('squish', 0.7);
      }
      driftToastT -= dt;
      if (driftToastT <= 0) {
        driftToastT = DRIFT_TOAST_EVERY;
        toast(DRIFT_TOASTS[driftToastIdx++ % DRIFT_TOASTS.length], item, 'bad', T.drift_sub);
        if (!driftWarned && Math.random() < DRIFT_VOICE_CHANCE) yoldas(YOLDAS_DRIFT);
        driftWarned = true;
      }
    }

    if (order.packageHealth <= 0) {
      alarmIdx = ALARM_AT.length; // packageRuined does the big one
      return;
    }
    const before = alarmIdx;
    while (alarmIdx < ALARM_AT.length && order.packageHealth < ALARM_AT[alarmIdx]) alarmIdx++;
    if (alarmIdx === before) return;
    toast(item.alarm ?? T.package, item, 'bad', ALARM_SUBS[alarmIdx - 1]);
    phoneTurn = !phoneTurn;
    if (phoneTurn) {
      const own = alarmIdx === 1 ? PHONE_ITEM_LINES[item.id] : undefined;
      voice.sayText(own ?? pickOne(PHONE_LINES), { speaker: customer(order, true) });
    } else {
      yoldas(pickOne(YOLDAS_FRAGILE));
    }
  }

  function heavy(order: ActiveOrder, car: CarSample) {
    if (car.impact < HEAVY_THUD_IMPACT || hitT > 0) return;
    hitT = HIT_SFX_GAP;
    playSfx('thud_box', Math.min(1, car.impact / 12));
    out.push({ type: 'shake', strength: Math.min(1, car.impact / 15) });
    out.push({ type: 'pkgWobble', strength: 0.6 });
    if (heavyToastT > 0) return;
    heavyToastT = HEAVY_TOAST_GAP;
    toast(order.offer.item.alarm ?? T.shifted, order.offer.item, 'bad');
  }

  function urgent(order: ActiveOrder, dt: number) {
    const r = order.elapsed / order.offer.expectedTime;
    const item = order.offer.item;
    if (urgentLevel < 1 && r >= URGENT_HALF) {
      urgentLevel = 1;
      out.push({ type: 'urgentTick', level: 1 });
      toast(URGENT_HALF_TEXT[item.id] ?? T.hurry, item, 'bad', T.half_sub);
      playSfx('tick');
    }
    if (urgentLevel < 2 && r >= URGENT_LATE) {
      urgentLevel = 2;
      tickT = 0;
      toast(T.late, item, 'bad', T.late_sub);
    }
    if (urgentLevel < 2) return;
    tickT -= dt;
    if (tickT <= 0) {
      tickT = TICK_EVERY;
      out.push({ type: 'urgentTick', level: 2 });
      playSfx('tick');
    }
  }

  function update(dt: number, car: CarSample, state: ShiftState): HudFx[] {
    out.length = 0;
    if (state.phase !== 'driving' && state.phase !== 'ftue') return out;
    const order = state.order;
    if (!order) {
      orderId = -1;
      return out;
    }
    track(order);
    hitT = Math.max(0, hitT - dt);
    heavyToastT = Math.max(0, heavyToastT - dt);
    const kind = order.offer.package;
    if (kind === 'urgent') urgent(order, dt);
    if (order.phase === 'toDropoff') {
      if (kind === 'fragile') fragile(order, car, dt);
      else if (kind === 'heavy') heavy(order, car);
    }
    health = order.packageHealth;
    return out;
  }

  function onShiftEvent(e: ShiftEvent, state: ShiftState): HudFx[] {
    const fx: HudFx[] = [];
    switch (e.type) {
      case 'pickedUp': {
        const order = state.order;
        if (!order) break;
        track(order);
        const item = order.offer.item;
        const params = { item: itemName(item) };
        const icon = itemEmoji(item);
        if (order.offer.package === 'fragile') {
          fx.push({ type: 'toast', text: T.pick_fragile, params, sub: T.pick_fragile_sub, icon, tone: 'info' });
        } else if (order.offer.package === 'heavy') {
          fx.push({ type: 'toast', text: T.pick_heavy, params, sub: T.pick_heavy_sub, icon, tone: 'info' });
          yoldas(YOLDAS_HEAVY);
        } else if (order.offer.package === 'urgent') {
          fx.push({ type: 'toast', text: T.pick_urgent, params, sub: T.pick_urgent_sub, icon, tone: 'info' });
        }
        break;
      }
      case 'packageRuined':
        fx.push({ type: 'shake', strength: 1 }, { type: 'pkgWobble', strength: 1 });
        playSfx('boo');
        break;
      case 'delivered': {
        const r = e.result;
        if (r.stars >= 5) playSfx('cheer');
        else if (r.stars <= 1 && !r.ruined) playSfx('boo', 0.7);
        if (r.tip > 0) playSfx('cash', 0.8);
        // Passengers say goodbye themselves (passengers.ts).
        if (r.offer.package !== 'passenger' && Math.random() < CUSTOMER_LINE_CHANCE) {
          if (r.offer.id !== orderId) pitch = CUSTOMER_PITCH[0] + Math.random() * (CUSTOMER_PITCH[1] - CUSTOMER_PITCH[0]);
          const line = customerLine(r, r.offer.id === orderId ? health : 100, Math.random);
          if (line) voice.sayText(line, { speaker: customer(r, false) });
        }
        orderId = -1;
        break;
      }
      case 'cancelled':
        orderId = -1;
        break;
    }
    return fx;
  }

  return { update, onShiftEvent };
}
