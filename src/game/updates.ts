import { BASE_MODIFIERS } from './types';
import type { ShiftModifiers, UpdateDef } from './types';

const CHOICES = 3;
const SPONSORED_AD_INCOME = 15;

export const UPDATES: UpdateDef[] = [
  {
    id: 'reverse_lr',
    name: { en: 'Reverse Left-Right v2', tr: 'Ters Sol-Sağ v2' },
    desc: { en: 'Left and right are swapped. ×2 tips', tr: 'Sol ve sağ yer değiştirdi. ×2 bahşiş' },
    card: 'ui/cards/reverse_lr.png',
    line: 'upd_reverse',
    mods: { swapLeftRight: true, tipMul: 2 },
  },
  {
    id: 'sponsored',
    name: { en: 'Sponsored Route', tr: 'Sponsorlu Rota' },
    desc: { en: `Ads on every pickup. +₺${SPONSORED_AD_INCOME} per delivery`, tr: `Her alımda reklam. Teslimat başı +₺${SPONSORED_AD_INCOME}` },
    card: 'ui/cards/sponsored.png',
    line: 'upd_sponsored',
    mods: { adIncome: SPONSORED_AD_INCOME },
  },
  {
    id: 'silent',
    name: { en: 'Silent Mode', tr: 'Sessiz Mod' },
    desc: { en: 'YOLDAŞ speaks only in emoji. ×1.3 tips', tr: 'YOLDAŞ sadece emojiyle konuşur. ×1.3 bahşiş' },
    card: 'ui/cards/silent.png',
    line: 'upd_silent',
    mods: { silent: true, tipMul: 1.3 },
  },
  {
    id: 'honesty',
    name: { en: 'Honesty Patch v1.2', tr: 'Dürüstlük Yaması v1.2' },
    desc: { en: 'Never lies. Extremely rude. Half multiplier gain', tr: 'Asla yalan söylemez. Aşırı kaba. Yarım çarpan' },
    card: 'ui/cards/honesty.png',
    line: 'upd_honesty',
    mods: { lieChanceMul: 0, rude: true, multiplierGainMul: 0.5 },
  },
  {
    id: 'rhyme',
    name: { en: 'Rhyme Engine v1', tr: 'Kafiye Motoru v1' },
    desc: { en: 'Directions rhyme. And come late. ×1.25 tips', tr: 'Tarifler kafiyeli. Ve geç gelir. ×1.25 bahşiş' },
    card: 'ui/cards/rhyme.png',
    line: 'upd_rhyme',
    mods: { rhyme: true, callDistance: 18, tipMul: 1.25 },
  },
  {
    id: 'beta_voice',
    name: { en: 'Beta Voice', tr: 'Beta Ses' },
    desc: { en: 'New voice. Sometimes wrong language. ×1.2 tips', tr: 'Yeni ses. Bazen yanlış dil. ×1.2 bahşiş' },
    card: 'ui/cards/beta_voice.png',
    line: 'upd_beta',
    mods: { betaVoice: true, tipMul: 1.2 },
  },
  {
    id: 'ai',
    name: { en: 'AI Integration v2.0', tr: 'Yapay Zekâ Entegrasyonu v2.0' },
    desc: { en: 'Twice the lies, subtler tells. ×1.5 tips', tr: 'İki kat yalan, daha sinsi ipuçları. ×1.5 bahşiş' },
    card: 'ui/cards/ai.png',
    line: 'upd_ai',
    mods: { lieChanceMul: 2, tellChanceMul: 0.6, tipMul: 1.5 },
  },
  {
    id: 'speedrun',
    name: { en: 'Speedrun Patch v1.2', tr: 'Speedrun Yaması v1.2' },
    desc: { en: '30% less time per order. ×1.5 tips', tr: 'Sipariş başı %30 daha az süre. ×1.5 bahşiş' },
    card: 'ui/cards/speedrun.png',
    line: 'upd_speedrun',
    mods: { timeBudgetMul: 0.7, tipMul: 1.5 },
  },
  {
    id: 'offline',
    name: { en: 'Offline Map 1987', tr: 'Çevrimdışı Harita 1987' },
    desc: { en: 'No distances shown. ×1.2 tips', tr: 'Mesafe gösterilmez. ×1.2 bahşiş' },
    card: 'ui/cards/offline.png',
    line: 'upd_offline',
    mods: { hideDistance: true, tipMul: 1.2 },
  },
];

// Tip bonuses add up (1 + sum of bonuses) instead of multiplying: stacked ×1.x bonuses on top of the
// compliance multiplier would otherwise explode payouts.
export function combineUpdates(list: UpdateDef[]): ShiftModifiers {
  const m: ShiftModifiers = { ...BASE_MODIFIERS };
  for (const u of list) {
    const d = u.mods;
    if (d.tipMul !== undefined) m.tipMul += d.tipMul - 1;
    if (d.lieChanceMul !== undefined) m.lieChanceMul *= d.lieChanceMul;
    if (d.tellChanceMul !== undefined) m.tellChanceMul *= d.tellChanceMul;
    if (d.multiplierGainMul !== undefined) m.multiplierGainMul *= d.multiplierGainMul;
    if (d.timeBudgetMul !== undefined) m.timeBudgetMul *= d.timeBudgetMul;
    if (d.adIncome !== undefined) m.adIncome += d.adIncome;
    if (d.callDistance !== undefined) m.callDistance = Math.min(m.callDistance, d.callDistance);
    m.swapLeftRight ||= d.swapLeftRight ?? false;
    m.silent ||= d.silent ?? false;
    m.rhyme ||= d.rhyme ?? false;
    m.rude ||= d.rude ?? false;
    m.betaVoice ||= d.betaVoice ?? false;
    m.hideDistance ||= d.hideDistance ?? false;
  }
  return m;
}

export function updateChoices(active: UpdateDef[], rand: () => number): UpdateDef[] {
  const pool = UPDATES.filter((u) => !active.includes(u));
  const out: UpdateDef[] = [];
  while (out.length < CHOICES && pool.length > 0) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}
