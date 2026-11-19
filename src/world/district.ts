import type { BlockerKind, L10n, NodeId, ShopTag, Spawn } from '../game/types';

// Layout data of the playable district: a 5x5 street grid (x = 0 and z = 0 are the main avenues) with one
// street closed (merged block) and several fake streets that are paved but blocked half-way.
export const XS = [-100, -50, 0, 50, 100]; // N-S street centre lines
export const ZS = [-100, -50, 0, 50, 100]; // E-W street centre lines
export const streetWidth = (c: number) => (c === 0 ? 12 : 10);
export const SIDEWALK = 2.5;
export const CURB_H = 0.15;

export const nodeId = (i: number, j: number): NodeId => j * XS.length + i;

// v(i, j): N-S street x = XS[i] from ZS[j] to ZS[j + 1]. h(i, j): E-W street z = ZS[j] from XS[i] to XS[i + 1].
export type Seg = { dir: 'v' | 'h'; i: number; j: number };
const v = (i: number, j: number): Seg => ({ dir: 'v', i, j });
const h = (i: number, j: number): Seg => ({ dir: 'h', i, j });
const same = (a: Seg, b: Seg) => a.dir === b.dir && a.i === b.i && a.j === b.j;

// No street: the two neighbouring cells merge into one block.
export const CLOSED: Seg[] = [h(3, 1)];

// Spread so 15 of the 25 intersections have a fake exit (lies prefer those) and no real node becomes a dead end.
export const FAKE: { seg: Seg; blocker: BlockerKind }[] = [
  { seg: h(1, 2), blocker: 'wall' }, // FTUE lie
  { seg: v(3, 1), blocker: 'stairs' },
  { seg: h(0, 1), blocker: 'bollards' },
  { seg: v(1, 3), blocker: 'wall' },
  { seg: h(3, 3), blocker: 'stairs' },
  { seg: h(3, 2), blocker: 'bollards' },
  { seg: v(0, 2), blocker: 'wall' },
  { seg: v(1, 0), blocker: 'stairs' },
  { seg: v(3, 3), blocker: 'bollards' },
];

// Segment exists inside the grid and is paved (open or fake).
export function isOpen(dir: Seg['dir'], i: number, j: number): boolean {
  const [ni, nj] = dir === 'v' ? [XS.length, ZS.length - 1] : [XS.length - 1, ZS.length];
  if (i < 0 || j < 0 || i >= ni || j >= nj) return false;
  return !CLOSED.some((c) => same(c, { dir, i, j }));
}

export const fakeBlocker = (s: Seg): BlockerKind | null => FAKE.find((f) => same(f.seg, s))?.blocker ?? null;

export type PlaceDef = {
  seg: Seg;
  t: number; // 0 at the west/south end
  side: 1 | -1; // +1 = left when driving west→east / south→north
  kind: 'shop' | 'home';
  shop: ShopTag | null;
  name: L10n;
};

const shop = (seg: Seg, t: number, side: 1 | -1, tag: ShopTag, en: string, tr: string): PlaceDef => ({
  seg, t, side, kind: 'shop', shop: tag, name: { en, tr },
});
const home = (seg: Seg, t: number, side: 1 | -1, en: string, tr = en): PlaceDef => ({
  seg, t, side, kind: 'home', shop: null, name: { en, tr },
});

// Index = Place id. Sides face a block (perimeter streets: the inner curb); 0 and 10 are in the right lane of
// the FTUE route.
export const PLACES: PlaceDef[] = [
  shop(v(2, 1), 0.3, -1, 'kebab', 'Usta Kebap', 'Usta Kebap'),
  shop(h(2, 3), 0.5, 1, 'lahmacun', 'Lahmacun Palace', 'Lahmacun Sarayı'),
  shop(v(4, 1), 0.5, -1, 'bakery', 'Sweet Corner Bakery', 'Köşe Pastanesi'),
  shop(h(0, 3), 0.5, -1, 'grocer', 'Bakkal Remzi', 'Bakkal Remzi'),
  shop(v(0, 1), 0.5, 1, 'icecream', 'Maraş Ice Cream', 'Maraş Dondurma'),
  shop(h(1, 0), 0.5, -1, 'pharmacy', 'Night Pharmacy', 'Nöbetçi Eczane'),
  home(v(2, 3), 0.5, 1, 'Ayşe Teyze'),
  home(h(2, 0), 0.5, -1, 'Mehmet Bey'),
  home(v(4, 3), 0.5, -1, 'Student Flat', 'Öğrenci Evi'),
  home(h(0, 2), 0.5, 1, 'Dentist Kemal', 'Dişçi Kemal'),
  home(v(1, 2), 0.5, 1, 'Hayriye Hanım'),
  home(h(2, 2), 0.6, 1, 'Plaza Guy', 'Plazacı Bey'),
  home(v(3, 0), 0.5, -1, 'Kardeşler Apt.'),
  home(h(1, 4), 0.5, 1, 'The Muhtar', 'Muhtar'),
  home(h(3, 4), 0.5, 1, 'Cat Lady', 'Kedici Teyze'),
  home(v(0, 3), 0.5, 1, 'Night Shift Nurse', 'Nöbetçi Hemşire'),
];

// Right lane of the x = 0 avenue, heading north, past the FTUE junction so a shift never opens on its lie.
export const SPAWN: Spawn = { x: -3, z: 15, heading: 0 };

export const FTUE = {
  spawn: { x: -3, z: -85, heading: 0 } as Spawn,
  pickup: 0,
  dropoff: 10,
  lieNode: nodeId(2, 2),
  lieExit: h(1, 2), // west from the centre: the wall
};
