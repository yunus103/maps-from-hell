import * as THREE from 'three';
import { MeshBuilder } from './meshBuilder';
import type { Swatch } from './palette';

// Placeholder Istanbul clutter built from boxes and cylinders, all in the shared palette.
// Facade props work in facade space (x along the wall, y up, z out of the wall).

const DEG = Math.PI / 180;
// Every dish in town points at the same satellite (Türksat sits south-south-east of Istanbul).
const SAT_AZIMUTH = 160 * DEG; // same convention as the sun: 0 = +Z
const SAT_ELEVATION = 35 * DEG;
export const SAT_DIR = new THREE.Vector3(Math.sin(SAT_AZIMUTH), 0, Math.cos(SAT_AZIMUTH));

const LAUNDRY: Swatch[] = ['white', 'pembe', 'blue', 'yellow', 'red', 'griMavi', 'green', 'sari', 'white'];

const dishGeo = new THREE.CylinderGeometry(0.42, 0.3, 0.06, 14);
const tankGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.7, 12);
const dishTurn = new THREE.Matrix4().makeRotationY(SAT_AZIMUTH);
const dishTilt = new THREE.Matrix4().makeRotationX(Math.PI / 2 - SAT_ELEVATION);

type Rand = () => number;
type Box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, s: Swatch) => void;

// Split AC unit: cream box with a dark fan grille, standing on two wall brackets. `y0` is its bottom.
export function acUnit(b: Box, uc: number, y0: number) {
  const hw = 0.4;
  b(uc - hw, uc + hw, y0, y0 + 0.55, 0.06, 0.36, 'acUnit');
  b(uc - hw + 0.08, uc + 0.1, y0 + 0.08, y0 + 0.47, 0.36, 0.37, 'metal');
  for (const u of [uc - hw + 0.1, uc + hw - 0.1]) b(u - 0.02, u + 0.02, y0 - 0.05, y0, 0, 0.4, 'metal');
}

// Dish on a short arm, aimed at the satellite. `at` is the world point the arm starts from.
export function dish(mb: MeshBuilder, at: THREE.Vector3) {
  const head = at.clone().add(new THREE.Vector3(0, 0.25, 0)).addScaledVector(SAT_DIR, 0.3);
  mb.boxWorld(at.x - 0.03, at.x + 0.03, at.y, head.y, at.z - 0.03, at.z + 0.03, 'metal');
  const m = new THREE.Matrix4().makeTranslation(head.x, head.y, head.z).multiply(dishTurn).multiply(dishTilt);
  mb.shape(dishGeo, m, 'white');
  // Feed arm sticking out of the dish's face.
  const arm = new THREE.Matrix4().makeTranslation(0, 0.25, 0).premultiply(m);
  mb.box(arm, 0.03, 0.5, 0.03, 'metal');
}

// Blade sign sticking out of the wall at `u`, bottom at `y0`.
export function hangingSign(b: Box, u: number, y0: number, color: Swatch) {
  b(u - 0.03, u + 0.03, y0 + 0.62, y0 + 0.67, 0, 0.95, 'metal');
  b(u - 0.04, u + 0.04, y0 - 0.03, y0 + 0.63, 0.17, 0.93, 'white');
  b(u - 0.05, u + 0.05, y0, y0 + 0.6, 0.2, 0.9, color);
}

// Balcony drying rack: two posts standing on the floor at `floorY` with a line between them at height y,
// `z` out from the wall, hung with a few clothes.
export function laundry(b: Box, rand: Rand, u0: number, u1: number, floorY: number, y: number, z: number) {
  for (const u of [u0, u1]) b(u - 0.02, u + 0.02, floorY, y + 0.04, z - 0.02, z + 0.02, 'metal');
  b(u0, u1, y - 0.01, y + 0.01, z - 0.01, z + 0.01, 'white');
  let u = u0 + 0.15 + rand() * 0.2;
  while (u < u1 - 0.4) {
    const w = 0.25 + rand() * 0.35;
    if (u + w > u1 - 0.1) break;
    const h = 0.35 + rand() * 0.45;
    b(u, u + w, y - h, y, z - 0.015, z + 0.015, LAUNDRY[Math.floor(rand() * LAUNDRY.length)]);
    u += w + 0.08 + rand() * 0.25;
  }
}

// Solar water heater: tilted panel on a frame with the white tank along its top edge.
// The panel faces local -Z turned by `yaw`; its high edge is at +Z.
export function solarHeater(mb: MeshBuilder, x: number, y: number, z: number, yaw: number) {
  const base = new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(yaw));
  const tilt = 40 * DEG;
  const len = 1.9;
  const panel = new THREE.Matrix4()
    .makeTranslation(0, 0.3 + (len / 2) * Math.sin(tilt), 0)
    .multiply(new THREE.Matrix4().makeRotationX(-tilt))
    .premultiply(base);
  mb.box(panel, 1.0, 0.06, len, 'solar');
  const back = (len / 2) * Math.cos(tilt);
  const top = 0.3 + len * Math.sin(tilt);
  for (const sx of [-0.45, 0.45]) {
    mb.box(new THREE.Matrix4().makeTranslation(sx, top / 2, back).premultiply(base), 0.05, top, 0.05, 'metal');
    mb.box(new THREE.Matrix4().makeTranslation(sx, 0.15, -back).premultiply(base), 0.05, 0.3, 0.05, 'metal');
  }
  const tank = new THREE.Matrix4()
    .makeTranslation(0, top + 0.25, back + 0.1)
    .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
    .premultiply(base);
  mb.shape(tankGeo, tank, 'white');
}

// Wall bracket for a service wire: short iron arm out of the wall with an insulator on its tip.
// Returns the wire attachment point in facade space.
export function wallBracket(b: Box, u: number, y: number): [number, number, number] {
  b(u - 0.025, u + 0.025, y - 0.025, y + 0.025, 0, 0.3, 'metal');
  b(u - 0.04, u + 0.04, y + 0.025, y + 0.13, 0.22, 0.3, 'white');
  return [u, y + 0.15, 0.26];
}

export const POLE_HEIGHT = 9;
const LAMP_ARM = { y: 7.2, reach: 1.8 };
const CROSSARM = { y: 8.5, half: 0.6 };

// World box given sizes along `toRoad` (an axis direction), up, and across it.
function axisBox(mb: MeshBuilder, c: THREE.Vector3, along: number, up: number, across: number, toRoad: THREE.Vector3, s: Swatch) {
  const [sx, sz] = toRoad.x !== 0 ? [along, across] : [across, along];
  mb.boxWorld(c.x - sx / 2, c.x + sx / 2, c.y - up / 2, c.y + up / 2, c.z - sz / 2, c.z + sz / 2, s);
}

// Tapered concrete utility pole with a street lamp reaching over the road and a crossarm for the wires.
// `foot` is the base on the sidewalk; returns the two wire attachment points (insulator tops).
export function utilityPole(mb: MeshBuilder, foot: THREE.Vector3, toRoad: THREE.Vector3): THREE.Vector3[] {
  const { x, y, z } = foot;
  const H = POLE_HEIGHT;
  mb.boxWorld(x - 0.15, x + 0.15, y, y + H * 0.5, z - 0.15, z + 0.15, 'concrete');
  mb.boxWorld(x - 0.11, x + 0.11, y + H * 0.5, y + H, z - 0.11, z + 0.11, 'concrete');

  const arm = foot.clone().setY(y + LAMP_ARM.y).addScaledVector(toRoad, LAMP_ARM.reach / 2);
  axisBox(mb, arm, LAMP_ARM.reach, 0.07, 0.07, toRoad, 'metal');
  const head = foot.clone().setY(y + LAMP_ARM.y - 0.05).addScaledVector(toRoad, LAMP_ARM.reach - 0.1);
  axisBox(mb, head, 0.6, 0.14, 0.28, toRoad, 'metal');
  axisBox(mb, head.clone().setY(head.y - 0.09), 0.5, 0.04, 0.22, toRoad, 'lamp');

  const cross = foot.clone().setY(y + CROSSARM.y);
  axisBox(mb, cross, CROSSARM.half * 2 + 0.1, 0.08, 0.08, toRoad, 'metal');
  return [-1, 1].map((s) => {
    const p = cross.clone().addScaledVector(toRoad, s * CROSSARM.half);
    axisBox(mb, p.clone().setY(p.y + 0.1), 0.06, 0.12, 0.06, toRoad, 'white');
    return p.setY(p.y + 0.16);
  });
}

const cableTmp = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

// Sagging wire from a to b, drawn as short straight pieces along a parabola.
export function cable(mb: MeshBuilder, a: THREE.Vector3, b: THREE.Vector3) {
  const span = a.distanceTo(b);
  const sag = 0.2 + span * 0.025;
  const n = Math.max(4, Math.ceil(span / 2));
  let prev = a.clone();
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    const dir = p.clone().sub(prev);
    const len = dir.length();
    const m = new THREE.Matrix4().compose(
      prev.clone().add(p).multiplyScalar(0.5),
      cableTmp.setFromUnitVectors(Z, dir.normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    mb.box(m, 0.035, 0.035, len + 0.02, 'metal');
    prev = p;
  }
}

// Plastered chimney with a cap, from `y0` up to `y1`.
export function chimney(mb: MeshBuilder, x: number, z: number, y0: number, y1: number, color: Swatch) {
  mb.boxWorld(x - 0.3, x + 0.3, y0, y1, z - 0.3, z + 0.3, color);
  mb.boxWorld(x - 0.38, x + 0.38, y1, y1 + 0.08, z - 0.38, z + 0.38, 'trim');
  mb.boxWorld(x - 0.12, x + 0.12, y1 + 0.08, y1 + 0.3, z - 0.12, z + 0.12, 'metal');
}
