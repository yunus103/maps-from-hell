import type {
  ActiveOrder, CarSample, DeliveryResult, ItemDef, NodeId, OrderOffer, PackageKind, Place, RoadGraph,
  ShiftModifiers,
} from './types';

// Budget for an average driver who takes one wrong turn per order: ~8.5 m/s incl. turns and stops, plus
// slack for the pickup stop and a crash/reverse.
const EXPECTED_SPEED = 8.5; // m/s
const EXPECTED_SLACK = 15; // s
const URGENT_TIME = 0.75;
const MIN_DROPOFF_DIST = 100; // m route from pickup
const FARE_BASE = 15;
const FARE_PER_M = 0.05;
const TIP_SHARE = 0.8;
const TIP_FRAGILE = 1.3;
const TIP_URGENT = 1.4;
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

export const ITEMS: ItemDef[] = [
  { id: 'doner', name: { en: 'Döner', tr: 'Döner' }, icon: 'ui/orders/doner.png', package: 'normal', shop: 'kebab' },
  { id: 'lahmacun', name: { en: 'Lahmacun', tr: 'Lahmacun' }, icon: 'ui/orders/lahmacun.png', package: 'normal', shop: 'lahmacun' },
  { id: 'cake', name: { en: 'Birthday cake', tr: 'Doğum günü pastası' }, icon: 'ui/orders/cake.png', package: 'fragile', shop: 'bakery' },
  { id: 'eggs', name: { en: 'Eggs (30 pack)', tr: 'Yumurta (30\'lu)' }, icon: '🥚', package: 'fragile', shop: 'grocer' },
  { id: 'icecream', name: { en: 'Ice cream', tr: 'Dondurma' }, icon: '🍦', package: 'urgent', shop: 'icecream' },
  { id: 'medicine', name: { en: 'Medicine', tr: 'İlaç' }, icon: '💊', package: 'urgent', shop: 'pharmacy' },
];

let nextOfferId = 1;

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

function shopsFor(graph: RoadGraph, item: ItemDef): Place[] {
  return graph.places.filter((p) => p.kind === 'shop' && p.shop === item.shop);
}

export function buildOffer(
  graph: RoadGraph, carNode: NodeId, item: ItemDef, pickup: Place, dropoff: Place, long: boolean, mods: ShiftModifiers,
): OrderOffer {
  const routeLength = graph.distToPlace(carNode, pickup) + graph.placeDist(pickup, dropoff);
  const urgent = item.package === 'urgent';
  const expectedTime = (routeLength / EXPECTED_SPEED + EXPECTED_SLACK) * (urgent ? URGENT_TIME : 1) * mods.timeBudgetMul;
  const baseFare = Math.round(FARE_BASE + FARE_PER_M * routeLength);
  const tipFactor = (long ? TIP_LONG : 1) * (item.package === 'fragile' ? TIP_FRAGILE : urgent ? TIP_URGENT : 1);
  return {
    id: nextOfferId++,
    item,
    pickup,
    dropoff,
    package: item.package,
    long,
    routeLength,
    expectedTime,
    baseFare,
    tipMax: Math.round(TIP_SHARE * baseFare * tipFactor),
  };
}

// One offer per slot: normal food (far dropoff), fragile, urgent. A slot whose items have no shop on the map
// falls back to a normal offer. "Long haul" goes to whichever offer has the longest full route afterwards:
// distance from the pickup alone says little on a small map.
export function makeOffers(graph: RoadGraph, carNode: NodeId, rand: () => number, mods: ShiftModifiers): OrderOffer[] {
  const homes = graph.places.filter((p) => p.kind === 'home');
  const byKind = (k: PackageKind) => ITEMS.filter((i) => i.package === k && shopsFor(graph, i).length > 0);
  const normals = byKind('normal');
  const offers: OrderOffer[] = [];

  const slot = (kind: PackageKind, far: boolean) => {
    const items = byKind(kind).length > 0 ? byKind(kind) : normals;
    if (items.length === 0 || homes.length === 0) return;
    const item = pick(items, rand);
    const pickup = pick(shopsFor(graph, item), rand);
    let candidates = homes
      .map((h) => ({ h, d: graph.placeDist(pickup, h) }))
      .filter((c) => c.d >= MIN_DROPOFF_DIST && c.d < Infinity)
      .sort((a, b) => a.d - b.d);
    if (candidates.length === 0) return;
    if (far) candidates = candidates.slice(Math.floor((candidates.length * 2) / 3));
    offers.push(buildOffer(graph, carNode, item, pickup, pick(candidates, rand).h, false, mods));
  };

  slot('normal', true);
  slot('fragile', false);
  slot('urgent', false);
  if (offers.length < 2) return offers;
  const longest = offers.reduce((a, b) => (b.routeLength > a.routeLength ? b : a));
  return offers.map((o) =>
    o === longest ? { ...buildOffer(graph, carNode, o.item, o.pickup, o.dropoff, true, mods), id: o.id } : o,
  );
}

export function startOrder(offer: OrderOffer): ActiveOrder {
  return { offer, phase: 'toPickup', elapsed: 0, tipNow: offer.tipMax, packageHealth: 100 };
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

// Returns true on the frame the package becomes ruined.
export function updatePackage(order: ActiveOrder, car: CarSample, dt: number): boolean {
  if (order.offer.package !== 'fragile' || order.packageHealth <= 0) return false;
  let loss = 0;
  if (car.impact >= FRAGILE_MIN_IMPACT) loss += (car.impact - FRAGILE_HIT_FREE) * FRAGILE_HIT_MUL;
  if (car.drifting && Math.abs(car.beta) > FRAGILE_DRIFT_BETA) loss += FRAGILE_DRIFT_PER_S * dt;
  order.packageHealth = Math.max(0, order.packageHealth - loss);
  return order.packageHealth <= 0;
}

export function deliver(order: ActiveOrder, multiplier: number, mods: ShiftModifiers): DeliveryResult {
  const T = order.offer.expectedTime;
  const e = order.elapsed;
  const ruined = order.offer.package === 'fragile' && order.packageHealth <= 0;
  let stars = ruined ? 1 : e <= T ? 5 : e <= STARS_4_UNTIL * T ? 4 : e <= TIP_ZERO_AT * T ? 3 : 2;
  if (!ruined && order.offer.package === 'fragile' && order.packageHealth < FRAGILE_STAR_CAP_HEALTH) stars = Math.min(stars, 3);
  return {
    offer: order.offer,
    stars,
    fare: ruined ? 0 : order.offer.baseFare,
    tip: ruined ? 0 : Math.round(order.tipNow * multiplier * mods.tipMul),
    ruined,
    late: e > T,
  };
}
