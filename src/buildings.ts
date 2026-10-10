import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder';
import { swatchUV, AWNINGS, FACADES, type Swatch } from './palette';
import { SAT_DIR, acUnit, chimney, dish, hangingSign, laundry, solarHeater, wallBracket } from './props';

// Modular Istanbul buildings. A facade is assembled per bay and floor from window, balcony,
// shop front and entrance modules; details stick out a few cm so AO and shadows catch them.
// Two kinds: apartments (often with a cantilevered "çıkma" over the sidewalk) and old houses with a "cumba".

export type Side = 'n' | 's' | 'e' | 'w'; // outward normal +Z, -Z, +X, -X

type Rect = { x0: number; x1: number; z0: number; z1: number };

export type BuildingSpec = Rect & {
  base: number; // ground level (sidewalk top)
  floors: number; // including the ground floor; old houses pick their own
  front: Side; // street side: shops and entrance
  exposed: Side[]; // other visible sides (corner ends): windows only
};

export type Aabb = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

const DEG = Math.PI / 180;
const FLOOR_H = 3;
const PARAPET_H = 0.7;
const SLAB = 0.25; // çıkma floor slab thickness
const AWNING = { pivotY: 2.88, depth: 1.3, tilt: 22 * DEG, stripe: 0.45, valance: 0.25 };
const CUMBA = { depth: 0.7, bracketDrop: 0.8 };
const ROOF_PITCH = 28 * DEG;

const UP = new THREE.Vector3(0, 1, 0);
const NORMALS: Record<Side, THREE.Vector3> = {
  n: new THREE.Vector3(0, 0, 1),
  s: new THREE.Vector3(0, 0, -1),
  e: new THREE.Vector3(1, 0, 0),
  w: new THREE.Vector3(-1, 0, 0),
};

type Style = {
  kind: 'apartment' | 'old';
  facade: Swatch;
  groundH: number; // ground floor height
  bay: number; // target bay width
  cikma: number; // how far the upper floors overhang the sidewalk, 0 for none
  roof: 'flat' | 'hip';
  frame: Swatch; // window frame colour
  sove: boolean; // trim surround around windows
  shutterBoxes: boolean; // roller-shutter boxes over windows
  kepenk: boolean; // open timber shutters beside windows (old houses)
  bands: boolean; // trim line at every floor
  balcony: 'none' | 'solid' | 'rail';
  balconyDepth: number;
  balconyBay: (bay: number, bays: number) => boolean;
  curtains: number; // chance a window shows a curtain
  shutters: number; // chance a roller shutter is part-way down
  shops: boolean;
};

type Rand = () => number;
type Box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, s: Swatch) => void;
type WindowOpts = {
  glass: Swatch;
  frame: Swatch;
  shutter: number;
  sove: boolean;
  shutterBox: boolean;
  kepenk: boolean;
  sill: boolean;
};

const pick = <T>(rand: Rand, list: readonly T[]): T => list[Math.floor(rand() * list.length)];

function makeStyle(rand: Rand, kind: Style['kind']): Style {
  const pattern = Math.floor(rand() * 3);
  const balconyBay: Style['balconyBay'] =
    pattern === 0 ? () => true : pattern === 1 ? (b) => b % 2 === 1 : (b, n) => b === 0 || b === n - 1;
  if (kind === 'old') {
    return {
      kind,
      facade: pick(rand, ['okra', 'kiremit', 'yesil', 'krem', 'griMavi', 'kahve', 'pembe'] as const),
      groundH: 3.2,
      bay: 2.2,
      cikma: 0,
      roof: 'hip',
      frame: rand() < 0.5 ? 'ahsap' : 'frame',
      sove: true,
      shutterBoxes: false,
      kepenk: rand() < 0.6,
      bands: rand() < 0.5,
      balcony: 'none',
      balconyDepth: 0,
      balconyBay,
      curtains: 0.3 + rand() * 0.3,
      shutters: 0,
      shops: false,
    };
  }
  const cikma = rand() < 0.6 ? 0.8 + rand() * 0.3 : 0;
  return {
    kind,
    facade: pick(rand, FACADES),
    groundH: 3.6,
    bay: 2.9,
    cikma,
    roof: rand() < 0.3 ? 'hip' : 'flat',
    frame: 'frame',
    sove: rand() < 0.45,
    shutterBoxes: rand() < 0.65,
    kepenk: false,
    bands: rand() < 0.5,
    balcony: rand() < 0.25 ? 'none' : rand() < 0.5 ? 'solid' : 'rail',
    // With a çıkma the balcony already starts over the sidewalk.
    balconyDepth: cikma > 0 ? 0.9 : 1.2,
    balconyBay,
    curtains: 0.15 + rand() * 0.35,
    shutters: 0.2 + rand() * 0.4,
    shops: rand() < 0.8,
  };
}

function windowOpts(rand: Rand, style: Style): WindowOpts {
  return {
    glass: rand() < style.curtains ? 'curtain' : 'glass',
    frame: style.frame,
    shutter: style.shutterBoxes && rand() < style.shutters ? 0.3 + rand() * 0.6 : 0,
    sove: style.sove,
    shutterBox: style.shutterBoxes,
    kepenk: style.kepenk,
    sill: true,
  };
}

// Glass set back behind a protruding frame, with sill, optional trim surround, shutter box and open shutters.
function windowAt(b: Box, uc: number, y0: number, w: number, h: number, o: WindowOpts) {
  const hw = w / 2;
  const t = 0.07; // frame bar width
  const d = 0.09; // frame depth
  if (o.sove) b(uc - hw - 0.16, uc + hw + 0.16, y0 - 0.16, y0 + h + 0.16, 0, 0.03, 'trim');
  b(uc - hw, uc + hw, y0, y0 + h, 0, 0.05, o.glass);
  b(uc - hw - t, uc - hw, y0 - t, y0 + h + t, 0, d, o.frame);
  b(uc + hw, uc + hw + t, y0 - t, y0 + h + t, 0, d, o.frame);
  b(uc - hw, uc + hw, y0 + h, y0 + h + t, 0, d, o.frame);
  b(uc - hw, uc + hw, y0 - t, y0, 0, d, o.frame);
  if (w > 1.1) b(uc - 0.035, uc + 0.035, y0, y0 + h, 0, d * 0.8, o.frame);
  if (o.sill) b(uc - hw - 0.12, uc + hw + 0.12, y0 - t - 0.06, y0 - t, 0, 0.17, 'trim');
  if (o.shutterBox) b(uc - hw - t, uc + hw + t, y0 + h + t, y0 + h + t + 0.22, 0, 0.14, 'frame');
  if (o.shutter > 0) b(uc - hw, uc + hw, y0 + h * (1 - o.shutter), y0 + h, 0.05, 0.07, 'shutter');
  if (o.kepenk) {
    const kw = hw + 0.02;
    b(uc - hw - t - kw, uc - hw - t, y0 - 0.02, y0 + h + 0.02, 0.02, 0.06, 'ahsap');
    b(uc + hw + t, uc + hw + t + kw, y0 - 0.02, y0 + h + 0.02, 0.02, 0.06, 'ahsap');
  }
}

// Striped awning tilted down from the wall, with a hanging valance at its edge.
function awning(mb: MeshBuilder, frame: THREE.Matrix4, u0: number, u1: number, color: Swatch) {
  const { pivotY, depth, tilt, valance } = AWNING;
  const n = Math.max(2, Math.round((u1 - u0) / AWNING.stripe));
  const sw = (u1 - u0) / n;
  const tipY = pivotY - depth * Math.sin(tilt);
  const tipZ = depth * Math.cos(tilt);
  const rot = new THREE.Matrix4().makeRotationX(tilt);
  const half = new THREE.Matrix4().makeTranslation(0, 0, depth / 2);
  for (let i = 0; i < n; i++) {
    const s: Swatch = i % 2 ? 'white' : color;
    const uc = u0 + (i + 0.5) * sw;
    const m = new THREE.Matrix4().makeTranslation(uc, pivotY, 0).multiply(rot).multiply(half).premultiply(frame);
    mb.box(m, sw, 0.04, depth, s);
    mb.boxIn(frame, uc - sw / 2, uc + sw / 2, tipY - valance, tipY, tipZ - 0.03, tipZ, s);
  }
}

function shopFront(mb: MeshBuilder, frame: THREE.Matrix4, b: Box, rand: Rand, u0: number, u1: number) {
  const color = pick(rand, AWNINGS);
  const g0 = 0.45;
  const g1 = 2.7;
  const ua = u0 + 0.15;
  const ub = u1 - 0.15;
  b(ua, ub, g0, g1, 0, 0.04, 'glass');
  b(ua - 0.08, ua, g0, g1 + 0.08, 0, 0.08, 'shopFrame');
  b(ub, ub + 0.08, g0, g1 + 0.08, 0, 0.08, 'shopFrame');
  b(ua, ub, g1, g1 + 0.08, 0, 0.08, 'shopFrame');
  b(ua, ub, g0 - 0.06, g0, 0, 0.1, 'shopFrame');
  const panes = Math.max(1, Math.round((ub - ua) / 1.6));
  for (let i = 1; i < panes; i++) {
    const u = ua + ((ub - ua) * i) / panes;
    b(u - 0.04, u + 0.04, g0, g1, 0, 0.07, 'shopFrame');
  }
  b(u0 + 0.1, u1 - 0.1, 2.95, 3.3, 0, 0.12, rand() < 0.5 ? 'white' : color);
  if (rand() < 0.75) awning(mb, frame, ua, ub, color);
}

function entrance(b: Box, uc: number, door: Swatch) {
  b(uc - 0.95, uc + 0.95, 0, 2.75, 0, 0.04, 'trim');
  b(uc - 0.75, uc + 0.75, 0, 2.5, 0, 0.07, door);
  b(uc - 0.65, uc + 0.65, 2.1, 2.42, 0, 0.08, 'glass');
  b(uc - 1.1, uc + 1.1, 2.8, 2.92, 0, 1.0, 'trim'); // canopy
  b(uc - 1.0, uc + 1.0, 0, 0.12, 0, 0.45, 'plinth'); // step
}

function balcony(b: Box, u0: number, u1: number, fy: number, style: Style, door: WindowOpts) {
  const a = u0 + 0.12;
  const c = u1 - 0.12;
  const D = style.balconyDepth;
  b(a, c, fy - 0.16, fy + 0.02, 0, D, 'trim');
  if (style.balcony === 'solid') {
    b(a, c, fy + 0.02, fy + 1.0, D - 0.12, D, style.facade);
    b(a, a + 0.12, fy + 0.02, fy + 1.0, 0, D - 0.12, style.facade);
    b(c - 0.12, c, fy + 0.02, fy + 1.0, 0, D - 0.12, style.facade);
    b(a - 0.02, c + 0.02, fy + 1.0, fy + 1.06, D - 0.14, D + 0.02, 'trim');
  } else {
    b(a, c, fy + 0.95, fy + 1.0, D - 0.06, D, 'metal');
    b(a, c, fy + 0.12, fy + 0.16, D - 0.06, D, 'metal');
    const step = (c - a) / Math.max(1, Math.round((c - a) / 0.28));
    for (let u = a; u <= c + 0.01; u += step) b(u - 0.015, u + 0.015, fy + 0.02, fy + 0.95, D - 0.05, D - 0.01, 'metal');
    b(a, a + 0.05, fy + 0.95, fy + 1.0, 0, D, 'metal');
    b(c - 0.05, c, fy + 0.95, fy + 1.0, 0, D, 'metal');
  }
  windowAt(b, (u0 + u1) / 2, fy + 0.1, Math.min(1.9, c - a - 0.5), 2.1, { ...door, sill: false, kepenk: false });
}

// Facade plane of one side of `r`: x along the wall (left to right seen from outside), y up from `base`, z outward.
function facadeFrame(r: Rect, base: number, side: Side): { frame: THREE.Matrix4; width: number } {
  const n = NORMALS[side];
  const u = new THREE.Vector3().crossVectors(UP, n);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const centre = {
    n: new THREE.Vector3(cx, base, r.z1),
    s: new THREE.Vector3(cx, base, r.z0),
    e: new THREE.Vector3(r.x1, base, cz),
    w: new THREE.Vector3(r.x0, base, cz),
  }[side];
  const width = side === 'n' || side === 's' ? r.x1 - r.x0 : r.z1 - r.z0;
  const origin = centre.addScaledVector(u, -width / 2);
  return { frame: new THREE.Matrix4().makeBasis(u, UP, n).setPosition(origin), width };
}

function grow(r: Rect, sides: Side[], d: number): Rect {
  return {
    x0: r.x0 - (sides.includes('w') ? d : 0),
    x1: r.x1 + (sides.includes('e') ? d : 0),
    z0: r.z0 - (sides.includes('s') ? d : 0),
    z1: r.z1 + (sides.includes('n') ? d : 0),
  };
}

const boxFn = (mb: MeshBuilder, frame: THREE.Matrix4): Box => (x0, x1, y0, y1, z0, z1, s) =>
  mb.boxIn(frame, x0, x1, y0, y1, z0, z1, s);

function groundFloor(mb: MeshBuilder, rand: Rand, r: Rect, base: number, side: Side, style: Style, front: boolean) {
  const { frame, width: W } = facadeFrame(r, base, side);
  const b = boxFn(mb, frame);
  const bays = Math.max(1, Math.round(W / style.bay));
  const bw = W / bays;
  const gh = style.groundH;

  b(0, W, 0, style.kind === 'old' ? 0.9 : 0.45, 0, 0.04, 'plinth');
  if (style.cikma === 0) b(0, W, gh - 0.26, gh, 0, 0.15, 'trim');

  // On the front, one bay is the building entrance; the rest are shops or windows.
  const shops = front && style.shops;
  const door = !front ? -1 : bays >= 3 ? 1 + Math.floor(rand() * (bays - 2)) : bays === 2 ? 0 : -1;
  let bay = 0;
  while (bay < bays) {
    if (bay === door) {
      entrance(b, (bay + 0.5) * bw, style.kind === 'old' ? 'ahsap' : 'door');
      bay++;
    } else if (shops) {
      let span = rand() < 0.5 ? 2 : 1;
      if (bay + span > bays || (door > bay && door < bay + span)) span = 1;
      shopFront(mb, frame, b, rand, bay * bw, (bay + span) * bw);
      if (bay > 0 && rand() < 0.4) hangingSign(b, bay * bw, 2.55, pick(rand, AWNINGS));
      bay += span;
    } else {
      const ww = Math.min(style.kind === 'old' ? 0.9 : 1.4, bw - 1.0);
      windowAt(b, (bay + 0.5) * bw, 1.2, ww, style.kind === 'old' ? 1.5 : 1.4, windowOpts(rand, style));
      bay++;
    }
  }
}

// Upper floors of one side. `skip` marks bays covered by a cumba. On the front it also mounts a bracket
// for a service wire and returns its world attachment point.
function upperFloors(mb: MeshBuilder, rand: Rand, r: Rect, base: number, side: Side, style: Style, floors: number, front: boolean, skip?: (bay: number) => boolean): THREE.Vector3 | null {
  const { frame, width: W } = facadeFrame(r, base, side);
  const b = boxFn(mb, frame);
  const bays = Math.max(1, Math.round(W / style.bay));
  const bw = W / bays;
  const old = style.kind === 'old';
  const ww = Math.min(old ? 0.9 : 1.4, bw - 1.0);
  if (style.cikma > 0) b(0, W, style.groundH - SLAB, style.groundH, 0, 0.04, 'trim'); // slab edge
  // People only hang dishes on walls that can see the satellite.
  const facesSat = new THREE.Vector3().setFromMatrixColumn(frame, 2).dot(SAT_DIR) > 0.3;
  const worldAt = (u: number, y: number, z: number) => new THREE.Vector3(u, y, z).applyMatrix4(frame);

  for (let floor = 1; floor < floors; floor++) {
    const fy = style.groundH + (floor - 1) * FLOOR_H;
    if (style.bands && floor >= 2) b(0, W, fy - 0.07, fy + 0.07, 0, 0.05, 'trim');
    for (let bay = 0; bay < bays; bay++) {
      if (skip?.(bay)) continue;
      const opts = windowOpts(rand, style);
      const [u0, u1] = [bay * bw, (bay + 1) * bw];
      if (style.balcony !== 'none' && style.balconyBay(bay, bays)) {
        balcony(b, u0, u1, fy, style, opts);
        const D = style.balconyDepth;
        // Posts sit just inside the balcony's side walls so the rack reads as standing on the floor.
        if (rand() < 0.3) laundry(b, rand, u0 + 0.3, u1 - 0.3, fy + 0.02, fy + 1.8, D - 0.35);
        if (facesSat && rand() < 0.15) dish(mb, worldAt(u1 - 0.45, fy + 1.0, D - 0.1));
        continue;
      }
      const uc = (u0 + u1) / 2;
      windowAt(b, uc, fy + (old ? 0.7 : 0.9), ww, old ? 1.7 : 1.5, opts);
      // AC beside the window, on the side facing the middle of the facade so it never hangs past the corner.
      const dir = bay < bays / 2 ? 1 : -1;
      if (!old && bays > 1 && rand() < 0.2) acUnit(b, uc + dir * (ww / 2 + 0.55), fy + 0.95);
      else if (facesSat && rand() < 0.05) dish(mb, worldAt(uc + dir * (ww / 2 + 0.5), fy + 1.9, 0.05));
    }
  }
  // Plain wall at the facade's left edge, above the first-floor windows and below the next slab.
  if (!front || floors < 2) return null;
  const [u, y, z] = wallBracket(b, 0.08, style.groundH + 2.5);
  return worldAt(u, y, z);
}

// Closed timber bay window over the upper floors, held up by diagonal brackets. `top` is in facade space.
// Returns its world AABB.
function cumba(mb: MeshBuilder, rand: Rand, frame: THREE.Matrix4, u0: number, u1: number, style: Style, top: number): Aabb {
  const b = boxFn(mb, frame);
  const D = CUMBA.depth;
  const y0 = style.groundH - 0.1;
  const y1 = top - 0.25;
  b(u0, u1, y0, y1, 0, D, style.facade);
  b(u0 - 0.06, u1 + 0.06, y0 - 0.12, y0, 0, D + 0.06, 'trim');
  b(u0 - 0.08, u1 + 0.08, y1, y1 + 0.1, 0, D + 0.08, 'trim');

  // Brackets from the wall up to the cumba's underside.
  const len = Math.hypot(CUMBA.bracketDrop, D - 0.05);
  const tilt = new THREE.Matrix4().makeRotationX(-Math.atan2(CUMBA.bracketDrop, D - 0.05));
  for (const u of [u0 + 0.15, (u0 + u1) / 2, u1 - 0.15]) {
    const m = new THREE.Matrix4()
      .makeTranslation(u, y0 - 0.12 - CUMBA.bracketDrop / 2, (D - 0.05) / 2)
      .multiply(tilt)
      .premultiply(frame);
    mb.box(m, 0.1, 0.1, len, 'ahsap');
  }

  // Windows on the front and on both short sides of every floor it spans.
  const front = new THREE.Matrix4().makeTranslation(0, 0, D).premultiply(frame);
  const fb = boxFn(mb, front);
  const wall = new THREE.Vector3().setFromMatrixColumn(frame, 0); // along the facade
  const out = new THREE.Vector3().setFromMatrixColumn(frame, 2);
  const at = (u: number, w: number) => new THREE.Vector3(u, 0, w).applyMatrix4(frame);
  const left = new THREE.Matrix4().makeBasis(out, UP, wall.clone().negate()).setPosition(at(u0, 0));
  const right = new THREE.Matrix4().makeBasis(out.clone().negate(), UP, wall).setPosition(at(u1, D));
  const lb = boxFn(mb, left);
  const rb = boxFn(mb, right);
  const W = u1 - u0;
  for (let fy = style.groundH; fy + 2 < y1; fy += FLOOR_H) {
    for (const k of [0.25, 0.75]) windowAt(fb, u0 + W * k, fy + 0.7, Math.min(0.9, W / 2 - 0.5), 1.6, { ...windowOpts(rand, style), kepenk: false });
    const side = { ...windowOpts(rand, style), kepenk: false, sove: false };
    windowAt(lb, D / 2, fy + 0.8, 0.35, 1.4, side);
    windowAt(rb, D / 2, fy + 0.8, 0.35, 1.4, side);
  }

  const a = at(u0, 0);
  const c = at(u1, D);
  return { x0: Math.min(a.x, c.x), x1: Math.max(a.x, c.x), y0: a.y + y0, y1: a.y + y1, z0: Math.min(a.z, c.z), z1: Math.max(a.z, c.z) };
}

function flatRoof(mb: MeshBuilder, r: Rect, top: number, facade: Swatch) {
  const { x0, x1, z0, z1 } = r;
  const t = 0.25;
  const h = top + PARAPET_H;
  mb.boxWorld(x0 + t, x1 - t, top, top + 0.04, z0 + t, z1 - t, 'roof');
  mb.boxWorld(x0, x1, top, h, z0, z0 + t, facade);
  mb.boxWorld(x0, x1, top, h, z1 - t, z1, facade);
  mb.boxWorld(x0, x0 + t, top, h, z0 + t, z1 - t, facade);
  mb.boxWorld(x1 - t, x1, top, h, z0 + t, z1 - t, facade);
  const c = 0.05; // cap overhang
  mb.boxWorld(x0 - c, x1 + c, h, h + 0.07, z0 - c, z0 + t, 'trim');
  mb.boxWorld(x0 - c, x1 + c, h, h + 0.07, z1 - t, z1 + c, 'trim');
  mb.boxWorld(x0 - c, x0 + t, h, h + 0.07, z0 + t, z1 - t, 'trim');
  mb.boxWorld(x1 - t, x1 + c, h, h + 0.07, z0 + t, z1 - t, 'trim');
}

// Four-sided tiled roof with eaves; the ridge runs along the longer side.
// Returns the ridge end points.
function hipRoof(mb: MeshBuilder, r: Rect, top: number, overhang: number): [THREE.Vector3, THREE.Vector3] {
  const X0 = r.x0 - overhang;
  const X1 = r.x1 + overhang;
  const Z0 = r.z0 - overhang;
  const Z1 = r.z1 + overhang;
  mb.boxWorld(X0, X1, top, top + 0.12, Z0, Z1, 'trim'); // eave board
  const y = top + 0.12;
  const alongX = X1 - X0 >= Z1 - Z0;
  const half = (alongX ? Z1 - Z0 : X1 - X0) / 2;
  const h = half * Math.tan(ROOF_PITCH);
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  const ridgeA = alongX ? new THREE.Vector3(X0 + half, y + h, cz) : new THREE.Vector3(cx, y + h, Z0 + half);
  const ridgeB = alongX ? new THREE.Vector3(X1 - half, y + h, cz) : new THREE.Vector3(cx, y + h, Z1 - half);
  const c00 = new THREE.Vector3(X0, y, Z0);
  const c10 = new THREE.Vector3(X1, y, Z0);
  const c11 = new THREE.Vector3(X1, y, Z1);
  const c01 = new THREE.Vector3(X0, y, Z1);
  const tris: THREE.Vector3[][] = alongX
    ? [[c00, c10, ridgeB], [c00, ridgeB, ridgeA], [c11, c01, ridgeA], [c11, ridgeA, ridgeB], [c01, c00, ridgeA], [c10, c11, ridgeB]]
    : [[c10, c11, ridgeB], [c10, ridgeB, ridgeA], [c01, c00, ridgeA], [c01, ridgeA, ridgeB], [c00, c10, ridgeA], [c11, c01, ridgeB]];
  const pos: number[] = [];
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    // Every roof face looks up; fix the winding instead of hand-checking each triangle.
    const flip = e1.subVectors(b, a).cross(e2.subVectors(c, a)).y < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const [u, v] = swatchUV('kiremitCati');
  const uv: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) uv.push(u, v);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  mb.add(g);
  return [ridgeA, ridgeB];
}

// Chimneys near the ridge and maybe a dish on it.
function hipRoofProps(mb: MeshBuilder, rand: Rand, ridge: [THREE.Vector3, THREE.Vector3], top: number, style: Style) {
  const [a, b] = ridge;
  const across = new THREE.Vector3(-(b.z - a.z), 0, b.x - a.x).normalize();
  if (across.lengthSq() === 0) across.set(1, 0, 0); // pyramid roof: any side will do
  const count = 1 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const p = a.clone().lerp(b, count === 1 ? 0.5 : i === 0 ? 0.15 : 0.85).addScaledVector(across, rand() < 0.5 ? 0.7 : -0.7);
    chimney(mb, p.x, p.z, top, a.y + 0.5, style.kind === 'old' ? 'kiremit' : style.facade);
  }
  if (rand() < 0.5) dish(mb, a.clone().lerp(b, 0.35));
}

// Clutter on a flat roof: solar water heaters and a forest of dishes, kept apart from each other.
function flatRoofProps(mb: MeshBuilder, rand: Rand, r: Rect, top: number) {
  const taken: Rect[] = [];
  const place = (hx: number, hz: number): { x: number; z: number } | null => {
    for (let tries = 0; tries < 12; tries++) {
      const x = r.x0 + 0.8 + hx + rand() * (r.x1 - r.x0 - 1.6 - 2 * hx);
      const z = r.z0 + 0.8 + hz + rand() * (r.z1 - r.z0 - 1.6 - 2 * hz);
      const box = { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
      if (taken.some((t) => box.x0 < t.x1 && box.x1 > t.x0 && box.z0 < t.z1 && box.z1 > t.z0)) continue;
      taken.push(box);
      return { x, z };
    }
    return null;
  };
  const y = top + 0.04;
  const heaters = Math.floor(rand() * 3);
  // Panels face the satellite's side of the sky, which is close enough to the sun's for looks.
  const yaw = Math.atan2(SAT_DIR.x, SAT_DIR.z) + Math.PI;
  for (let i = 0; i < heaters; i++) {
    const p = place(1.3, 1.3);
    if (p) solarHeater(mb, p.x, y, p.z, yaw);
  }
  const dishes = 1 + Math.floor(rand() * 4);
  for (let i = 0; i < dishes; i++) {
    const p = place(0.5, 0.5);
    if (p) dish(mb, new THREE.Vector3(p.x, y, p.z));
  }
}

// Adds the building's visuals; returns the boxes to collide with and where a service wire can attach.
export function addBuilding(mb: MeshBuilder, rand: Rand, spec: BuildingSpec): { solids: Aabb[]; anchor: THREE.Vector3 | null } {
  const style = makeStyle(rand, rand() < 0.25 ? 'old' : 'apartment');
  const floors = style.kind === 'old' ? 2 + (rand() < 0.5 ? 1 : 0) : spec.floors;
  const { base } = spec;
  const gh = base + style.groundH;
  const top = gh + (floors - 1) * FLOOR_H;
  const sides = [spec.front, ...spec.exposed];
  const upper = style.cikma > 0 ? grow(spec, sides, style.cikma) : spec;
  const solids: Aabb[] = [];
  let anchor: THREE.Vector3 | null = null;

  if (style.cikma > 0) {
    mb.boxWorld(spec.x0, spec.x1, base, gh, spec.z0, spec.z1, style.facade);
    mb.boxWorld(upper.x0, upper.x1, gh - SLAB, top, upper.z0, upper.z1, style.facade);
    solids.push({ ...upper, y0: gh - SLAB, y1: top });
    solids.push({ x0: spec.x0, x1: spec.x1, y0: base, y1: gh - SLAB, z0: spec.z0, z1: spec.z1 });
  } else {
    mb.boxWorld(spec.x0, spec.x1, base, top, spec.z0, spec.z1, style.facade);
    solids.push({ x0: spec.x0, x1: spec.x1, y0: base, y1: top, z0: spec.z0, z1: spec.z1 });
  }

  for (const side of sides) {
    groundFloor(mb, rand, spec, base, side, style, side === spec.front);
    let skip: ((bay: number) => boolean) | undefined;
    if (style.kind === 'old' && side === spec.front && floors > 1) {
      // The cumba covers the middle bays of the upper floors.
      const { frame, width } = facadeFrame(spec, base, side);
      const bays = Math.max(1, Math.round(width / style.bay));
      const bw = width / bays;
      const span = bays >= 4 ? 2 : 1;
      const first = Math.floor((bays - span) / 2);
      solids.push(cumba(mb, rand, frame, first * bw + 0.1, (first + span) * bw - 0.1, style, top - base));
      skip = (bay) => bay >= first && bay < first + span;
    }
    const front = side === spec.front;
    const a = upperFloors(mb, rand, upper, base, side, style, floors, front, skip);
    if (front) anchor = a;
  }

  if (style.roof === 'hip') {
    hipRoofProps(mb, rand, hipRoof(mb, upper, top, style.kind === 'old' ? 0.5 : 0.35), top, style);
  } else {
    flatRoof(mb, upper, top, style.facade);
    flatRoofProps(mb, rand, upper, top);
    solids[0].y1 = top + PARAPET_H;
  }
  return { solids, anchor };
}
