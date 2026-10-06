import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Prototype "sedan" proportions. Car faces +Z, wheels touch y = 0.
export const CAR_DIMS = { L: 4.5, W: 1.85, H: 0.72, cabL: 2.1, cabH: 0.62, cabZ: -0.25, wheelR: 0.38 };

const { L, W, H, cabL, cabH, cabZ, wheelR } = CAR_DIMS;
const Y0 = wheelR * 0.9;
const WHEEL_Z = L / 2 - Math.max(0.75, wheelR * 2.1);
const SKIRT_Y = Y0 - 0.12;
const ARCH_TOP = wheelR * 2 + 0.1;
const ARCH_HALF = wheelR + 0.08;

// Visual wheel-centre height range that stays inside the arch.
export const WHEEL_TRAVEL = { min: wheelR - 0.12, max: ARCH_TOP - wheelR - 0.02 };

export const WHEEL_LAYOUT = [
  { x: W / 2 - 0.1, z: WHEEL_Z, front: true },
  { x: -W / 2 + 0.1, z: WHEEL_Z, front: true },
  { x: W / 2 - 0.1, z: -WHEEL_Z, front: false },
  { x: -W / 2 + 0.1, z: -WHEEL_Z, front: false },
];

export const modelParams = { paint: '#3f78c9' };

const GLASS = 0x2b3350;
const DARK = 0x22202b;
const HUB = 0xb8bcc4;
const HEAD = 0xfff2c4;
const TAIL = 0xff3048;
// Paint parts are tinted by the material colour, so their vertex colour is a brightness.
const PAINT = 0xffffff;
const PAINT_SHADE = 0x999999;

export type CarModel = {
  group: THREE.Group;
  wheels: { pivot: THREE.Group; spin: THREE.Mesh }[];
  paint: THREE.MeshStandardMaterial;
};

function tint(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// y is the bottom of the box.
function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
  return tint(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);
}

function cabin(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(W - 0.14, cabH, cabL);
  const p = g.attributes.position;
  // Pull the top face in to slope the windscreen and rear glass.
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) p.setZ(i, p.getZ(i) * 0.72 + (p.getZ(i) > 0 ? -0.05 : 0.08));
  }
  g.computeVertexNormals();
  return tint(g.translate(0, Y0 + H + cabH / 2, cabZ), GLASS);
}

function wheelGeometry(): THREE.BufferGeometry {
  const g = mergeGeometries([
    tint(new THREE.CylinderGeometry(wheelR, wheelR, 0.3, 12), DARK),
    tint(new THREE.CylinderGeometry(wheelR * 0.5, wheelR * 0.5, 0.32, 8), HUB),
    // Spoke bar so the spin reads.
    tint(new THREE.BoxGeometry(wheelR * 0.9, 0.33, 0.07), DARK),
  ]);
  return g.rotateZ(Math.PI / 2);
}

// Lower body split into three z-segments, leaving open arches around the wheels.
function lowerBody(): THREE.BufferGeometry[] {
  const segments = [
    [-L / 2, -WHEEL_Z - ARCH_HALF],
    [-WHEEL_Z + ARCH_HALF, WHEEL_Z - ARCH_HALF],
    [WHEEL_Z + ARCH_HALF, L / 2],
  ];
  const parts = segments.flatMap(([z0, z1]) => [
    box(W, Y0 + 0.08 - SKIRT_Y, z1 - z0, 0, SKIRT_Y, (z0 + z1) / 2, PAINT_SHADE),
    box(W, ARCH_TOP - Y0 - 0.08, z1 - z0, 0, Y0 + 0.08, (z0 + z1) / 2, PAINT),
  ]);
  // Inner wall between the arches so you can't see through the car.
  parts.push(box(W - 0.7, ARCH_TOP - SKIRT_Y, L - 0.1, 0, SKIRT_Y, 0, PAINT_SHADE));
  return parts;
}

export function createCarModel(): CarModel {
  const pillarZ = cabZ + cabL * 0.36 * 0.72;
  const paintGeo = mergeGeometries([
    ...lowerBody(),
    box(W, Y0 + H - ARCH_TOP, L, 0, ARCH_TOP, 0, PAINT),
    box(W - 0.24, 0.08, cabL * 0.66, 0, Y0 + H + cabH - 0.02, cabZ, PAINT),
    box(0.06, cabH, 0.12, W / 2 - 0.08, Y0 + H, pillarZ, PAINT),
    box(0.06, cabH, 0.12, -W / 2 + 0.08, Y0 + H, pillarZ, PAINT),
  ]);
  const trimGeo = mergeGeometries([
    cabin(),
    box(W + 0.04, 0.22, 0.2, 0, Y0 - 0.02, L / 2, DARK),
    box(W + 0.04, 0.22, 0.2, 0, Y0 - 0.02, -L / 2, DARK),
  ]);
  const ly = Y0 + H * 0.55 - 0.09;
  const lx = W / 2 - 0.3;
  const lampGeo = mergeGeometries([
    box(0.42, 0.18, 0.02, lx, ly, L / 2 + 0.005, HEAD),
    box(0.42, 0.18, 0.02, -lx, ly, L / 2 + 0.005, HEAD),
    box(0.4, 0.18, 0.02, lx, ly, -L / 2 - 0.02, TAIL),
    box(0.4, 0.18, 0.02, -lx, ly, -L / 2 - 0.02, TAIL),
  ]);

  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, color: modelParams.paint });
  const trim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const lamps = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xd8d0c0 });

  const group = new THREE.Group();
  const body = new THREE.Mesh(paintGeo, paint);
  const trimMesh = new THREE.Mesh(trimGeo, trim);
  for (const m of [body, trimMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  group.add(body, trimMesh, new THREE.Mesh(lampGeo, lamps));

  const wheelGeo = wheelGeometry();
  const wheels = WHEEL_LAYOUT.map(({ x, z }) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, wheelR, z);
    const spin = new THREE.Mesh(wheelGeo, trim);
    spin.castShadow = true;
    pivot.add(spin);
    group.add(pivot);
    return { pivot, spin };
  });

  return { group, wheels, paint };
}
