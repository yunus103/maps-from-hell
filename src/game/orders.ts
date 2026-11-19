import type {
  ActiveOrder, CarSample, DeliveryResult, ItemDef, L10n, NodeId, OrderOffer, PackageKind, PassengerId, Place, RoadGraph,
  ShiftModifiers, ShopTag,
} from './types';
import { CUSTOMER_NAMES, ITEM_NOTES, NOTES } from './customers';

// Budget for an average driver who takes one wrong turn per order: ~8.5 m/s incl. turns and stops, plus
// slack for the pickup stop and a crash/reverse.
const EXPECTED_SPEED = 8.5; // m/s
const EXPECTED_SLACK = 15; // s
const URGENT_TIME = 0.75;
const HEAVY_TIME = 1.2;
const MIN_DROPOFF_DIST = 100; // m route from pickup
const PASSENGER_MIN_DIST = 150;
const FARE_BASE = 15;
const FARE_PER_M = 0.05;
const HEAVY_FARE = 1.4;
const PASSENGER_FARE = 1.3;
const TIP_SHARE = 0.8;
const TIP_BY_KIND: Record<PackageKind, number> = { normal: 1, fragile: 1.3, urgent: 1.4, heavy: 1.2, passenger: 1 };
const TIP_LONG = 1.3;
const TIP_FULL_UNTIL = 1.0; // × expected time
const TIP_ZERO_AT = 2.0;
const CANCEL_AT = 2.5;
const STARS_4_UNTIL = 1.4; // × expected time
const FRAGILE_MIN_IMPACT = 3; // m/s
const FRAGILE_HIT_FREE = 2;
const FRAGILE_HIT_MUL = 6;
const FRAGILE_DRIFT_BETA = (20 * Math.PI) / 180;
const FRAGILE_DRIFT_PER_S = 8;
const FRAGILE_STAR_CAP_HEALTH = 50;
const HEAVY_MIN_IMPACT = 6;
const HEAVY_HIT_FREE = 5;
const HEAVY_HIT_MUL = 4;
const HEAVY_FLOOR = 1; // a heavy box is never ruined
const HEAVY_STAR_CAP_HEALTH = 50;
const PASSENGER_MIN_IMPACT = 4;
const PASSENGER_HIT_FREE = 3;
const PASSENGER_HIT_MUL = 5;
const PASSENGER_STAR_CAP_HEALTH = 40;
// Board variety
const FRAGILE_SLOT_CHANCE = 0.6; // slot B: fragile, else heavy
const PASSENGER_SLOT_CHANCE = 0.5; // slot C: passenger, else urgent
const PASSENGER_SLOT_CHANCE_BOOSTED = 0.75; // with mods.passengerMul > 1
const RECENT_ITEMS = 6; // items skipped on the next board (two boards' worth)
const RECENT_FLAVOUR = 10; // customer names / generic notes not reused this soon
const NOTE_CHANCE = 0.7;
const ITEM_NOTE_CHANCE = 0.65; // share of notes taken from the item's own list when it has one

type Extra = Pick<ItemDef, 'fragility' | 'alarm'>;
const item = (
  id: string, pkg: PackageKind, shop: ShopTag, icon: string, en: string, tr: string, extra?: Extra,
): ItemDef => ({ id, name: { en, tr }, icon, package: pkg, shop, ...extra });
const alarm = (en: string, tr: string): Extra['alarm'] => ({ en, tr });
const passenger = (id: PassengerId, icon: string, en: string, tr: string): ItemDef => ({
  id: `p_${id}`, name: { en, tr }, icon, package: 'passenger', shop: null, passenger: id,
});

// Heavy items reuse `alarm` as their "it shifted" toast.
export const ITEMS: ItemDef[] = [
  // normal
  item('doner', 'normal', 'kebab', 'ui/orders/doner.png', 'Döner', 'Döner'),
  item('adana', 'normal', 'kebab', '🌯', 'Adana dürüm', 'Adana dürüm'),
  item('lahmacun', 'normal', 'lahmacun', 'ui/orders/lahmacun.png', 'Lahmacun', 'Lahmacun'),
  item('pide', 'normal', 'lahmacun', '🫓', 'Pide', 'Pide'),
  item('simit', 'normal', 'bakery', '🥯', 'Simit (5 pcs)', 'Simit (5 adet)'),
  item('pogaca', 'normal', 'bakery', '🥐', 'Poğaça', 'Poğaça'),
  item('groceries', 'normal', 'grocer', '🛍️', 'Grocery bag', 'Bakkal poşeti'),
  item('bouquet', 'normal', 'florist', '💐', 'Bouquet', 'Buket'),
  item('catfood', 'normal', 'petshop', '🐟', 'Cat food', 'Kedi maması'),
  item('birdseed', 'normal', 'petshop', '🐦', 'Budgie seed', 'Muhabbet kuşu yemi'),
  item('charger', 'normal', 'electronics', '🔌', 'Phone charger', 'Telefon şarjı'),
  item('phone_case', 'normal', 'electronics', '📱', 'Glitter phone case', 'Simli telefon kılıfı'),
  item('school_supplies', 'normal', 'stationery', '✏️', 'School supplies', 'Okul malzemesi'),
  // fragile
  item('cake', 'fragile', 'bakery', 'ui/orders/cake.png', 'Birthday cake', 'Doğum günü pastası', { alarm: alarm('The cake!', 'Pasta!') }),
  item('wedding_cake', 'fragile', 'bakery', '💒', 'Wedding cake (4 tiers)', 'Düğün pastası (4 kat)', {
    fragility: 1.6, alarm: alarm('The wedding cake!', 'Düğün pastası!'),
  }),
  item('baklava', 'fragile', 'bakery', '🍯', 'Baklava tray', 'Tepsi baklava', { fragility: 0.8, alarm: alarm('The baklava!', 'Baklava!') }),
  item('eggs', 'fragile', 'grocer', '🥚', 'Eggs (30 pack)', "Yumurta (30'lu)", { fragility: 1.3, alarm: alarm('The eggs!', 'Yumurtalar!') }),
  item('tea_glasses', 'fragile', 'grocer', '🍵', 'Tea glass set', 'Çay bardağı takımı', {
    fragility: 1.2, alarm: alarm('The tea glasses!', 'Çay bardakları!'),
  }),
  item('fish', 'fragile', 'petshop', '🐠', 'Goldfish in a bag', 'Poşette japon balığı', { fragility: 1.4, alarm: alarm('The fish!', 'Balık!') }),
  item('cat', 'fragile', 'petshop', '🐈', 'Angry cat (carrier)', 'Sinirli kedi (kafeste)', { fragility: 1.0, alarm: alarm('The cat!', 'Kedi!') }),
  item('phone', 'fragile', 'electronics', '📲', 'New phone', 'Yeni telefon', { fragility: 1.1, alarm: alarm('The phone!', 'Telefon!') }),
  item('tv', 'fragile', 'electronics', '📺', 'Flat-screen TV', 'Düz ekran TV', { fragility: 1.2, alarm: alarm('The TV!', 'Televizyon!') }),
  item('vase_flowers', 'fragile', 'florist', '🏺', 'Flowers in a crystal vase', 'Kristal vazoda çiçek', {
    fragility: 1.2, alarm: alarm('The vase!', 'Vazo!'),
  }),
  // urgent
  item('icecream', 'urgent', 'icecream', '🍦', 'Ice cream', 'Dondurma'),
  item('maras', 'urgent', 'icecream', '🍨', 'Maraş ice cream cone', 'Maraş dondurması'),
  item('medicine', 'urgent', 'pharmacy', '💊', 'Medicine', 'İlaç'),
  item('formula', 'urgent', 'pharmacy', '🍼', 'Baby formula', 'Bebek maması'),
  item('documents', 'urgent', 'stationery', '📜', 'Signed documents', 'İmzalı evrak'),
  item('iskender', 'urgent', 'kebab', '🍖', 'Hot İskender', 'Sıcak İskender'),
  item('kunefe', 'urgent', 'kebab', '🧀', 'Hot künefe', 'Sıcak künefe'),
  // heavy
  item('watermelon', 'heavy', 'grocer', '🍉', 'Giant watermelon', 'Dev karpuz', { alarm: alarm('The watermelon is rolling around!', 'Karpuz yuvarlanıyor!') }),
  item('water_jug', 'heavy', 'grocer', '💧', '19 L water jug', '19 litre damacana', { alarm: alarm('The water jug is sloshing!', 'Damacana çalkalanıyor!') }),
  item('rice', 'heavy', 'grocer', '🌾', '25 kg rice sack', '25 kg pirinç çuvalı', { alarm: alarm('The rice sack slid!', 'Pirinç çuvalı kaydı!') }),
  item('washing_machine', 'heavy', 'electronics', '🧺', 'Washing machine', 'Çamaşır makinesi', {
    alarm: alarm('The washing machine shifted!', 'Çamaşır makinesi kaydı!'),
  }),
  item('cat_litter', 'heavy', 'petshop', '🪣', '20 kg cat litter', '20 kg kedi kumu', { alarm: alarm('Cat litter everywhere!', 'Her yer kedi kumu!') }),
  item('printer', 'heavy', 'stationery', '🖨️', 'Office printer', 'Ofis yazıcısı', {
    alarm: alarm('The printer is printing by itself!', 'Yazıcı kendi kendine çıktı alıyor!'),
  }),
  item('ficus', 'heavy', 'florist', '🪴', 'Potted ficus', 'Saksıda ficus', { alarm: alarm('The ficus lost some leaves!', 'Ficus yaprak döktü!') }),
  // passengers (picked up at a home)
  passenger('teyze', '👵', 'Auntie (ride)', 'Teyze (yolcu)'),
  passenger('abi', '😎', 'Party abi (ride)', 'Abi (yolcu)'),
  passenger('plaza', '💼', 'Plaza guy (ride)', 'Plazacı (yolcu)'),
  passenger('tourist', '📸', 'Tourist (ride)', 'Turist (yolcu)'),
  passenger('grandpa', '👴', 'Grandpa (ride)', 'Dede (yolcu)'),
  passenger('bride', '👰', 'Bride (ride)', 'Gelin (yolcu)'),
  passenger('student', '🎧', 'Student (ride)', 'Öğrenci (yolcu)'),
];

// Shown on the ticket as the customer; must match the names in passengers.ts PASSENGERS.
export const PASSENGER_NAMES: Record<PassengerId, L10n> = {
  teyze: { en: 'Auntie Ayşe', tr: 'Ayşe Teyze' },
  abi: { en: 'Emre Abi', tr: 'Emre Abi' },
  plaza: { en: 'Office Guy Kerem', tr: 'Plazacı Kerem' },
  tourist: { en: 'Tourist Steve', tr: 'Turist Steve' },
  grandpa: { en: 'Grandpa Nuri', tr: 'Nuri Dede' },
  bride: { en: 'Bride Selin', tr: 'Gelin Selin' },
  student: { en: 'Student Deniz', tr: 'Öğrenci Deniz' },
};

// Emoji for items whose icon is an image path (toasts take an emoji or a ui/icons file).
const ART_EMOJI: Record<string, string> = { doner: '🥙', lahmacun: '🫓', cake: '🎂' };
export const itemEmoji = (i: ItemDef): string => (i.icon.includes('/') ? ART_EMOJI[i.id] ?? '📦' : i.icon);

let nextOfferId = 1;
// Module-level so variety carries across boards and shifts.
const recentItems: string[] = [];
const recentNames: L10n[] = [];
const recentNotes: L10n[] = [];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function remember<T>(ring: T[], v: T, max: number) {
  ring.push(v);
  if (ring.length > max) ring.shift();
}

function pickFresh(list: L10n[], recent: L10n[], rand: () => number): L10n {
  const fresh = list.filter((v) => !recent.includes(v));
  const v = pick(fresh.length > 0 ? fresh : list, rand);
  remember(recent, v, RECENT_FLAVOUR);
  return v;
}

function shopsFor(graph: RoadGraph, item: ItemDef): Place[] {
  return graph.places.filter((p) => p.kind === 'shop' && p.shop === item.shop);
}

function flavour(item: ItemDef, rand: () => number): Pick<OrderOffer, 'customer' | 'note'> {
  const own = ITEM_NOTES[item.id];
  if (item.passenger) return { customer: PASSENGER_NAMES[item.passenger], note: own ? pick(own, rand) : undefined };
  const customer = pickFresh(CUSTOMER_NAMES, recentNames, rand);
  if (rand() >= NOTE_CHANCE) return { customer };
  return { customer, note: own && rand() < ITEM_NOTE_CHANCE ? pick(own, rand) : pickFresh(NOTES, recentNotes, rand) };
}

export function buildOffer(
  graph: RoadGraph, carNode: NodeId, item: ItemDef, pickup: Place, dropoff: Place, long: boolean, mods: ShiftModifiers,
): OrderOffer {
  const kind = item.package;
  const routeLength = graph.distToPlace(carNode, pickup) + graph.placeDist(pickup, dropoff);
  const timeMul = kind === 'urgent' ? URGENT_TIME : kind === 'heavy' ? HEAVY_TIME : 1;
  const expectedTime = (routeLength / EXPECTED_SPEED + EXPECTED_SLACK) * timeMul * mods.timeBudgetMul;
  const fare = Math.round(FARE_BASE + FARE_PER_M * routeLength);
  const fareMul = kind === 'heavy' ? HEAVY_FARE : kind === 'passenger' ? PASSENGER_FARE : 1;
  return {
    id: nextOfferId++,
    item,
    pickup,
    dropoff,
    package: kind,
    long,
    routeLength,
    expectedTime,
    baseFare: Math.round(fare * fareMul),
    // The tip is a share of the distance fare, so heavy/passenger fare bonuses don't compound into it.
    tipMax: Math.round(TIP_SHARE * fare * (long ? TIP_LONG : 1) * TIP_BY_KIND[kind]),
  };
}

// Three slots: A normal food (far dropoff), B fragile or heavy, C urgent or passenger. A slot first tries items not
// offered on the last two boards, its other kind next, then normal; a slot with nothing on the map stays empty.
// "Long haul" goes to whichever offer has the longest full route afterwards: distance from the pickup alone says
// little on a small map.
export function makeOffers(graph: RoadGraph, carNode: NodeId, rand: () => number, mods: ShiftModifiers): OrderOffer[] {
  const homes = graph.places.filter((p) => p.kind === 'home');
  if (homes.length === 0) return [];
  const onBoard = new Set<string>();
  const offers: OrderOffer[] = [];

  const usable = (i: ItemDef) =>
    !onBoard.has(i.id) && (i.package === 'passenger' ? homes.length > 1 : shopsFor(graph, i).length > 0);

  const choose = (kinds: PackageKind[]): ItemDef | null => {
    for (const fresh of [true, false]) {
      for (const k of kinds) {
        const pool = ITEMS.filter((i) => i.package === k && usable(i) && (!fresh || !recentItems.includes(i.id)));
        if (pool.length > 0) return pick(pool, rand);
      }
    }
    return null;
  };

  const slot = (kinds: PackageKind[], far: boolean) => {
    const item = choose(kinds);
    if (!item) return;
    onBoard.add(item.id);
    const ride = item.package === 'passenger';
    const pickup = pick(ride ? homes : shopsFor(graph, item), rand);
    const targets = ride ? graph.places.filter((p) => p.kind !== 'mechanic' && p !== pickup) : homes;
    const minDist = ride ? PASSENGER_MIN_DIST : MIN_DROPOFF_DIST;
    let candidates = targets
      .map((h) => ({ h, d: graph.placeDist(pickup, h) }))
      .filter((c) => c.d >= minDist && c.d < Infinity)
      .sort((a, b) => a.d - b.d);
    if (candidates.length === 0) return;
    if (far) candidates = candidates.slice(Math.floor((candidates.length * 2) / 3));
    offers.push({ ...buildOffer(graph, carNode, item, pickup, pick(candidates, rand).h, false, mods), ...flavour(item, rand) });
  };

  const passengerChance = mods.passengerMul > 1 ? PASSENGER_SLOT_CHANCE_BOOSTED : PASSENGER_SLOT_CHANCE;
  slot(['normal'], true);
  slot(rand() < FRAGILE_SLOT_CHANCE ? ['fragile', 'heavy', 'normal'] : ['heavy', 'fragile', 'normal'], false);
  slot(rand() < passengerChance ? ['passenger', 'urgent', 'normal'] : ['urgent', 'passenger', 'normal'], false);
  for (const o of offers) remember(recentItems, o.item.id, RECENT_ITEMS);

  if (offers.length < 2) return offers;
  const longest = offers.reduce((a, b) => (b.routeLength > a.routeLength ? b : a));
  return offers.map((o) =>
    o === longest ? { ...o, ...buildOffer(graph, carNode, o.item, o.pickup, o.dropoff, true, mods), id: o.id } : o,
  );
}

export function startOrder(offer: OrderOffer): ActiveOrder {
  return { offer, phase: 'toPickup', elapsed: 0, tipNow: offer.tipMax, packageHealth: 100, tipBonus: 0 };
}

export function tipAt(order: ActiveOrder): number {
  const T = order.offer.expectedTime;
  const k = (order.elapsed - TIP_FULL_UNTIL * T) / ((TIP_ZERO_AT - TIP_FULL_UNTIL) * T);
  return order.offer.tipMax * Math.min(1, Math.max(0, 1 - k));
}

export function isLate(order: ActiveOrder): boolean {
  return order.elapsed > order.offer.expectedTime;
}

export function shouldCancel(order: ActiveOrder): boolean {
  return order.elapsed >= CANCEL_AT * order.offer.expectedTime;
}

// Condition while the package is aboard: fragile health, heavy box condition, passenger comfort.
// Returns true only on the frame a fragile package becomes ruined (comfort 0 is handled by the shift).
export function updatePackage(order: ActiveOrder, car: CarSample, dt: number): boolean {
  if (order.packageHealth <= 0) return false;
  const impact = car.impact;
  switch (order.offer.package) {
    case 'fragile': {
      const f = order.offer.item.fragility ?? 1;
      let loss = 0;
      if (impact >= FRAGILE_MIN_IMPACT) loss += (impact - FRAGILE_HIT_FREE) * FRAGILE_HIT_MUL * f;
      if (car.drifting && Math.abs(car.beta) > FRAGILE_DRIFT_BETA) loss += FRAGILE_DRIFT_PER_S * f * dt;
      order.packageHealth = Math.max(0, order.packageHealth - loss);
      return order.packageHealth <= 0;
    }
    case 'heavy':
      if (impact >= HEAVY_MIN_IMPACT) {
        order.packageHealth = Math.max(HEAVY_FLOOR, order.packageHealth - (impact - HEAVY_HIT_FREE) * HEAVY_HIT_MUL);
      }
      return false;
    case 'passenger':
      if (impact >= PASSENGER_MIN_IMPACT) {
        order.packageHealth = Math.max(0, order.packageHealth - (impact - PASSENGER_HIT_FREE) * PASSENGER_HIT_MUL);
      }
      return false;
    default:
      return false;
  }
}

export function deliver(order: ActiveOrder, multiplier: number, mods: ShiftModifiers): DeliveryResult {
  const T = order.offer.expectedTime;
  const e = order.elapsed;
  const kind = order.offer.package;
  const health = order.packageHealth;
  const ruined = kind === 'fragile' && health <= 0;
  let stars = ruined ? 1 : e <= T ? 5 : e <= STARS_4_UNTIL * T ? 4 : e <= TIP_ZERO_AT * T ? 3 : 2;
  if (!ruined && kind === 'fragile' && health < FRAGILE_STAR_CAP_HEALTH) stars = Math.min(stars, 3);
  if (kind === 'heavy' && health < HEAVY_STAR_CAP_HEALTH) stars = Math.min(stars, 4);
  if (kind === 'passenger' && health < PASSENGER_STAR_CAP_HEALTH) stars = Math.min(stars, 3);
  return {
    offer: order.offer,
    stars,
    fare: ruined ? 0 : order.offer.baseFare,
    tip: ruined ? 0 : Math.max(0, Math.round(order.tipNow * multiplier * mods.tipMul + order.tipBonus)),
    ruined,
    late: e > T,
  };
}
