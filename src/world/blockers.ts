import * as THREE from 'three';
import type { MeshBuilder } from '../meshBuilder';
import type { Swatch } from '../palette';
import type { BlockerKind, RoadEdge, RoadGraph } from '../game/types';
import { CURB_H, SIDEWALK } from './district';

// Fake-road blockers: whatever ends the "street" YOLDAŞ swears is there. Each spans building line to building
// line at the edge midpoint, looks the same from both ends and has one solid collider the car can't climb.

export type SolidFn = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => void;

// Spots for placing the car stay this far from a blocker centre (deepest blocker, the stairs, + 6 m).
export const BLOCKER_CLEAR = 10;

const STEP = { count: 7, rise: 0.3, tread: 0.35 }; // + the final rise onto the landing = 8 steps, 2.4 m
const LANDING_HALF = 1;
const STAIRS_HALF = LANDING_HALF + STEP.count * STEP.tread;
const STAIRS_TOP = (STEP.count + 1) * STEP.rise;

// Builders work in a local frame: x across the street (±half), y up, z along it. They return the collider's
// half depth along z and its height.
type Builder = (mb: MeshBuilder, f: THREE.Matrix4, half: number, road: number, rand: () => number) => { depth: number; height: number };

const tmp = new THREE.Matrix4();
const rot = new THREE.Matrix4();

// Box of length `len` along local z, tilted up by `angle` around x, centred at (x, y, z).
function tilted(mb: MeshBuilder, f: THREE.Matrix4, x: number, y: number, z: number, angle: number, sx: number, sy: number, len: number, s: Swatch) {
  tmp.makeTranslation(x, y, z).premultiply(f).multiply(rot.makeRotationX(angle));
  mb.box(tmp, sx, sy, len, s);
}

const wall: Builder = (mb, f, half, _road, rand) => {
  const H = 2.6;
  mb.boxIn(f, -half, half, 0, 0.35, -0.5, 0.5, 'concrete'); // footing
  mb.boxIn(f, -half, half, 0, H, -0.4, 0.4, 'kiremit');
  mb.boxIn(f, -half - 0.05, half + 0.05, H, H + 0.16, -0.48, 0.48, 'concrete');
  // Concrete piers every few metres break up the long brick face.
  const piers = Math.round((half * 2) / 3.5);
  for (let k = 0; k <= piers; k++) {
    const x = -half + 0.25 + (k / piers) * (half * 2 - 0.5);
    mb.boxIn(f, x - 0.25, x + 0.25, 0, H + 0.1, -0.47, 0.47, 'concrete');
  }
  // Paint stripes on both faces, graffiti-ish.
  const paint: Swatch[] = ['trim', 'yellow', 'blue', 'red', 'white', 'green'];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const len = 0.8 + rand() * 2.2;
      const x = -half + 0.6 + rand() * (half * 2 - 1.2 - len);
      const y = 0.5 + rand() * 1.6;
      const z = s * 0.41;
      mb.boxIn(f, x, x + len, y, y + 0.12 + rand() * 0.25, z - 0.01, z + 0.01, paint[Math.floor(rand() * paint.length)]);
    }
  }
  return { depth: 0.5, height: H };
};

// The street "continues" as a public stairway: steps rise from both approaches to a landing.
const stairs: Builder = (mb, f, half, road) => {
  mb.boxIn(f, -half, half, 0, STAIRS_TOP, -LANDING_HALF, LANDING_HALF, 'concrete');
  const angle = Math.atan2(STAIRS_TOP, STEP.count * STEP.tread);
  const slope = Math.hypot(STAIRS_TOP, STEP.count * STEP.tread);
  const mid = LANDING_HALF + (STEP.count * STEP.tread) / 2;
  const rails = [-half + 0.35, -road / 4, road / 4, half - 0.35];
  for (const s of [-1, 1]) {
    for (let k = 0; k < STEP.count; k++) {
      const top = (k + 1) * STEP.rise;
      const z0 = LANDING_HALF + (STEP.count - 1 - k) * STEP.tread;
      const [a, b] = s > 0 ? [z0, z0 + STEP.tread] : [-z0 - STEP.tread, -z0];
      mb.boxIn(f, -half, half, 0, top, a, b, 'sidewalk');
      // Lighter nosing on the outer edge of each tread.
      const [n0, n1] = s > 0 ? [b - 0.06, b + 0.01] : [a - 0.01, a + 0.06];
      mb.boxIn(f, -half, half, top - 0.04, top + 0.01, n0, n1, 'curb');
    }
    // Sloped concrete cheek walls on both sides, and handrails on posts.
    for (const x of [-half + 0.15, half - 0.15]) {
      tilted(mb, f, x, STAIRS_TOP / 2 + 0.2, s * mid, s * angle, 0.3, 0.5, slope + 0.2, 'concrete');
    }
    for (const x of rails) {
      tilted(mb, f, x, STAIRS_TOP / 2 + 1, s * mid, s * angle, 0.06, 0.06, slope, 'metal');
      for (const [z, y] of [[s * (STAIRS_HALF - 0.15), STEP.rise], [s * (LANDING_HALF + 0.1), STAIRS_TOP]]) {
        mb.boxIn(f, x - 0.03, x + 0.03, y, y + 1, z - 0.03, z + 0.03, 'metal');
      }
    }
  }
  return { depth: STAIRS_HALF, height: 1.5 };
};

const bollardGeo = new THREE.CylinderGeometry(0.09, 0.11, 1, 8);
const bandGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.1, 8);

// Jersey barriers across the road, a striped plank barricade over them, steel bollards across the sidewalks.
const bollards: Builder = (mb, f, half, road) => {
  const segs = Math.round(road / 2);
  const w = road / segs;
  for (let k = 0; k < segs; k++) {
    const x0 = -road / 2 + k * w + 0.03;
    const x1 = x0 + w - 0.06;
    const s: Swatch = k % 2 ? 'white' : 'orange';
    mb.boxIn(f, x0, x1, 0, 0.3, -0.32, 0.32, s);
    mb.boxIn(f, x0, x1, 0.3, 0.6, -0.2, 0.2, s);
    mb.boxIn(f, x0, x1, 0.6, 0.95, -0.13, 0.13, s);
  }
  for (const x of [-road / 2 + 0.4, 0, road / 2 - 0.4]) mb.boxIn(f, x - 0.04, x + 0.04, 0.95, 1.5, -0.04, 0.04, 'metal');
  const stripes = Math.round(road / 0.8);
  for (let k = 0; k < stripes; k++) {
    const x0 = -road / 2 + (k * road) / stripes;
    mb.boxIn(f, x0, x0 + road / stripes, 1.2, 1.45, -0.07, -0.03, k % 2 ? 'white' : 'red');
  }
  for (const side of [-1, 1]) {
    for (let x = road / 2 + 0.5; x < half - 0.2; x += 0.9) {
      tmp.makeTranslation(side * x, CURB_H + 0.5, 0).premultiply(f);
      mb.shape(bollardGeo, tmp, 'metal');
      tmp.makeTranslation(side * x, CURB_H + 0.82, 0).premultiply(f);
      mb.shape(bandGeo, tmp, 'white');
    }
  }
  return { depth: 0.5, height: 1.5 };
};

const BUILDERS: Record<BlockerKind, Builder> = { wall, stairs, bollards };

export function buildBlockers(mb: MeshBuilder, solid: SolidFn, graph: RoadGraph) {
  for (const e of graph.edges) if (e.fake && e.blocker) buildBlocker(mb, solid, graph, e, e.blocker);
}

function buildBlocker(mb: MeshBuilder, solid: SolidFn, graph: RoadGraph, e: RoadEdge, kind: BlockerKind) {
  const horizontal = graph.nodes[e.a].z === graph.nodes[e.b].z;
  const half = e.width / 2 + SIDEWALK;
  const frame = new THREE.Matrix4().makeTranslation(e.blockerX, 0, e.blockerZ);
  // Local z along the street: for an E-W street that is world +X.
  if (horizontal) frame.multiply(rot.makeRotationY(Math.PI / 2));
  let seed = e.id * 7919 + 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const { depth, height } = BUILDERS[kind](mb, frame, half, e.width, rand);
  const [ax, az] = horizontal ? [depth, half] : [half, depth];
  solid(e.blockerX - ax, e.blockerX + ax, 0, height, e.blockerZ - az, e.blockerZ + az);
}
