import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Track } from './track';
import { MeshBuilder } from './meshBuilder';
import { swatchUV, worldMaterial, type Swatch } from './palette';
import { addBuilding, type Side } from './buildings';
import { POLE_HEIGHT, cable, utilityPole } from './props';

// Mahalle test block: a 3x3 street grid (4 blocks) closed in by a ring of buildings.
const STREETS = [-50, 0, 50]; // centre lines of both the N-S and the E-W streets
const streetWidth = (c: number) => (c === 0 ? 12 : 10);
const OUTER = STREETS[2] + streetWidth(STREETS[2]) / 2; // outer road edge
const SIDEWALK = 2.5;
const CURB_H = 0.15;
const CURB_W = 0.25; // lighter curb stones along the sidewalk edge
const BLOCK_DEPTH = 11; // building depth inside a block
const RING = OUTER + SIDEWALK + 14; // outer edge of the enclosing building ring
const GROUND_SIZE = 400;
// Tabletop ramp on the east street: steep kicker with a sharp lip, flat top, long landing slope.
const RAMP = { x: 50, z0: 13, up: 8, top: 6, down: 12, height: 1.5 };
const RAMP_LENGTH = RAMP.up + RAMP.top + RAMP.down;
const DASH = { length: 3, gap: 3, width: 0.15 };
// Zebra crossing on every approach to an intersection: gap from the crossing road's edge, length, stripe width.
const ZEBRA = { offset: 1, length: 3, stripe: 0.5 };
const MAX_WIRE_SPAN = 60; // longer gaps (a skipped stretch) get no wire
const DROP_CHANCE = 0.2; // chance a pole feeds a building
const DROP_REACH = 22; // max horizontal length of a service wire
const POLE_CURB_GAP = 0.45; // pole centre from the road edge

// Collision groups (memberships << 16 | filter). Thin street furniture is in its own group so the
// chase camera can ignore it instead of zooming in every time a pole passes behind the car.
const THIN_GROUPS = 0x0002ffff;
export const CAMERA_QUERY_GROUPS = 0xffff0001;

// Seeded so the layout is the same on every load.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rampHeight(z: number): number {
  const t = z - RAMP.z0;
  if (t <= 0 || t >= RAMP_LENGTH) return 0;
  if (t < RAMP.up) return RAMP.height * (t / RAMP.up) ** 2;
  if (t < RAMP.up + RAMP.top) return RAMP.height;
  return RAMP.height * (1 - (t - RAMP.up - RAMP.top) / RAMP.down);
}

// Road plus both sidewalks raised over the ramp; the ends meet the flat road and slabs exactly.
// Returns an indexed grid for the collider and flat-shaded triangles (one swatch per strip) for the visual.
function rampGeometry() {
  const hw = streetWidth(RAMP.x) / 2;
  const xs = [-hw - SIDEWALK, -hw, -hw, hw, hw, hw + SIDEWALK];
  const ys = [CURB_H, CURB_H, 0, 0, CURB_H, CURB_H];
  const strips: Swatch[] = ['sidewalk', 'curb', 'asphalt', 'curb', 'sidewalk'];
  // 0.5 m steps land exactly on the lip and top edges, keeping them sharp.
  const steps = RAMP_LENGTH / 0.5;
  const n = xs.length;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uv: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const z = RAMP.z0 + (k / steps) * RAMP_LENGTH;
    for (let p = 0; p < n; p++) vertices.push(RAMP.x + xs[p], ys[p] + rampHeight(z), z);
  }
  for (let k = 0; k < steps; k++) {
    for (let p = 0; p < n - 1; p++) {
      const a = k * n + p;
      const b = a + n;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
      const [u, v] = swatchUV(strips[p]);
      for (let i = 0; i < 6; i++) uv.push(u, v);
    }
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  grid.setIndex(indices);
  const visual = grid.toNonIndexed();
  visual.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  visual.computeVertexNormals();
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices), visual };
}

export function createBlock(scene: THREE.Scene, world: RAPIER.World): Track {
  const rand = mulberry32(7);
  const mb = new MeshBuilder();

  const g = GROUND_SIZE / 2;
  mb.boxWorld(-g, g, -0.1, 0, -g, g, 'asphalt');
  world.createCollider(RAPIER.ColliderDesc.cuboid(g, 0.1, g).setTranslation(0, -0.1, 0));

  // Low friction so the car slides along walls instead of sticking to them.
  const solid = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, groups = 0xffffffff) =>
    world.createCollider(
      RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
        .setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        .setFriction(0.2)
        .setCollisionGroups(groups),
    );
  // Sidewalk slab: its raised edge is the curb, ringed with lighter curb stones.
  const slab = (x0: number, x1: number, z0: number, z1: number) => {
    const h = CURB_H + 0.01;
    mb.boxWorld(x0, x1, 0, CURB_H, z0, z1, 'sidewalk');
    mb.boxWorld(x0, x1, 0, h, z0, z0 + CURB_W, 'curb');
    mb.boxWorld(x0, x1, 0, h, z1 - CURB_W, z1, 'curb');
    mb.boxWorld(x0, x0 + CURB_W, 0, h, z0 + CURB_W, z1 - CURB_W, 'curb');
    mb.boxWorld(x1 - CURB_W, x1, 0, h, z0 + CURB_W, z1 - CURB_W, 'curb');
    solid(x0, x1, 0, CURB_H, z0, z1);
  };
  const anchors: { at: THREE.Vector3; ns: boolean }[] = []; // free wall brackets for service wires
  const building = (x0: number, x1: number, z0: number, z1: number, floors: number[], front: Side, exposed: Side[]) => {
    const n = floors[0] + Math.floor(rand() * (floors[1] - floors[0] + 1));
    const { solids, anchor } = addBuilding(mb, rand, { x0, x1, z0, z1, base: CURB_H, floors: n, front, exposed });
    for (const s of solids) solid(s.x0, s.x1, s.y0, s.y1, s.z0, s.z1);
    // Only brackets facing an east-west or north-south street line can take a wire from that street's poles.
    if (anchor) anchors.push({ at: anchor, ns: front === 'e' || front === 'w' });
  };
  // Splits [a0, a1] into building widths of 8-14 m; the last one absorbs the remainder.
  const row = (a0: number, a1: number, place: (a: number, b: number, first: boolean, last: boolean) => void) => {
    let a = a0;
    while (a1 - a > 0.01) {
      let w = 8 + rand() * 6;
      if (a1 - a - w < 8) w = a1 - a;
      place(a, a + w, a === a0, a + w >= a1 - 0.01);
      a += w;
    }
  };
  const ends = (first: boolean, last: boolean): Side[] => {
    const sides: Side[] = [];
    if (first) sides.push('w');
    if (last) sides.push('e');
    return sides;
  };

  // The four blocks between the streets. North/south rows run the full width, so their ends are street corners.
  const blockFloors = [3, 6];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x0 = STREETS[i] + streetWidth(STREETS[i]) / 2;
      const x1 = STREETS[i + 1] - streetWidth(STREETS[i + 1]) / 2;
      const z0 = STREETS[j] + streetWidth(STREETS[j]) / 2;
      const z1 = STREETS[j + 1] - streetWidth(STREETS[j + 1]) / 2;
      slab(x0, x1, z0, z1);
      const [bx0, bx1, bz0, bz1] = [x0 + SIDEWALK, x1 - SIDEWALK, z0 + SIDEWALK, z1 - SIDEWALK];
      const d = BLOCK_DEPTH;
      row(bx0, bx1, (a, b, f, l) => building(a, b, bz0, bz0 + d, blockFloors, 's', ends(f, l)));
      row(bx0, bx1, (a, b, f, l) => building(a, b, bz1 - d, bz1, blockFloors, 'n', ends(f, l)));
      row(bz0 + d, bz1 - d, (a, b) => building(bx0, bx0 + d, a, b, blockFloors, 'w', []));
      row(bz0 + d, bz1 - d, (a, b) => building(bx1 - d, bx1, a, b, blockFloors, 'e', []));
    }
  }

  // Enclosing ring, facing inward: north/south rows run the full width, east/west rows fill in between.
  const front = OUTER + SIDEWALK;
  const ringFloors = [4, 6];
  for (const s of [-1, 1]) {
    slab(-RING, RING, s > 0 ? OUTER : -RING, s > 0 ? RING : -OUTER);
    slab(s > 0 ? OUTER : -RING, s > 0 ? RING : -OUTER, -OUTER, OUTER);
    row(-RING, RING, (a, b) => building(a, b, s > 0 ? front : -RING, s > 0 ? RING : -front, ringFloors, s > 0 ? 's' : 'n', []));
    row(-front, front, (a, b) => building(s > 0 ? front : -RING, s > 0 ? RING : -front, a, b, ringFloors, s > 0 ? 'w' : 'e', []));
  }

  const line = (x0: number, x1: number, z0: number, z1: number) => mb.boxWorld(x0, x1, 0, 0.02, z0, z1, 'line');

  // Dashed centre lines, left out of intersections (with their crossings) and the ramp.
  for (const c of STREETS) {
    for (let s = -OUTER + DASH.length / 2; s < OUTER; s += DASH.length + DASH.gap) {
      if (STREETS.some((o) => Math.abs(s - o) < streetWidth(o) / 2 + ZEBRA.offset + ZEBRA.length + 1.5)) continue;
      const onRamp = c === RAMP.x && s > RAMP.z0 - DASH.length && s < RAMP.z0 + RAMP_LENGTH + DASH.length;
      const [h, w] = [DASH.length / 2, DASH.width / 2];
      if (!onRamp) line(c - w, c + w, s - h, s + h);
      line(s - h, s + h, c - w, c + w);
    }
  }

  // Zebra crossings on every approach where the street continues past the intersection.
  for (const cx of STREETS) {
    for (const cz of STREETS) {
      const [hx, hz] = [streetWidth(cx) / 2, streetWidth(cz) / 2];
      for (const dir of [-1, 1]) {
        if (STREETS.includes(cz + dir * 50)) {
          // Across the N-S street, north or south of the intersection.
          const near = cz + dir * (hz + ZEBRA.offset);
          const far = near + dir * ZEBRA.length;
          for (let x = cx - hx + 0.6; x + ZEBRA.stripe <= cx + hx - 0.5; x += ZEBRA.stripe * 2) {
            line(x, x + ZEBRA.stripe, Math.min(near, far), Math.max(near, far));
          }
        }
        if (STREETS.includes(cx + dir * 50)) {
          // Across the E-W street, east or west of the intersection.
          const near = cx + dir * (hx + ZEBRA.offset);
          const far = near + dir * ZEBRA.length;
          for (let z = cz - hz + 0.6; z + ZEBRA.stripe <= cz + hz - 0.5; z += ZEBRA.stripe * 2) {
            line(Math.min(near, far), Math.max(near, far), z, z + ZEBRA.stripe);
          }
        }
      }
    }
  }

  // One utility pole per block-length stretch, on one sidewalk of every street (alternating sides), wired pole
  // to pole across intersections, sometimes feeding a nearby building's wall bracket. The ramp's stretch is
  // skipped: its sidewalks rise.
  const crossingClear = ZEBRA.offset + ZEBRA.length + 1;
  STREETS.forEach((c, i) => {
    const hw = streetWidth(c) / 2;
    for (const ns of [true, false]) {
      const side = (i + (ns ? 0 : 1)) % 2 ? 1 : -1;
      const toRoad = ns ? new THREE.Vector3(-side, 0, 0) : new THREE.Vector3(0, 0, -side);
      let prev: { along: number; wires: THREE.Vector3[] } | null = null;
      for (let k = 0; k < STREETS.length - 1; k++) {
        const a0 = STREETS[k] + streetWidth(STREETS[k]) / 2 + crossingClear;
        const a1 = STREETS[k + 1] - streetWidth(STREETS[k + 1]) / 2 - crossingClear;
        if (ns && c === RAMP.x && a0 < RAMP.z0 + RAMP_LENGTH && a1 > RAMP.z0) continue;
        const along = (a0 + a1) / 2;
        const off = c + side * (hw + POLE_CURB_GAP);
        const foot = ns ? new THREE.Vector3(off, CURB_H, along) : new THREE.Vector3(along, CURB_H, off);
        const wires = utilityPole(mb, foot, toRoad);
        solid(foot.x - 0.15, foot.x + 0.15, CURB_H, CURB_H + POLE_HEIGHT, foot.z - 0.15, foot.z + 0.15, THIN_GROUPS);
        if (prev && along - prev.along < MAX_WIRE_SPAN) wires.forEach((w, j) => cable(mb, prev!.wires[j], w));
        prev = { along, wires };

        if (rand() < DROP_CHANCE) {
          // Nearest free bracket in reach; no bracket close enough means no wire.
          let best = -1;
          let bestD = DROP_REACH;
          anchors.forEach((a, j) => {
            // Same street only: facing it and standing on one of its two building lines.
            const across = ns ? Math.abs(a.at.x - c) : Math.abs(a.at.z - c);
            if (a.ns !== ns || across > hw + SIDEWALK + 0.5) return;
            const d = Math.hypot(a.at.x - foot.x, a.at.z - foot.z);
            if (d < bestD) [best, bestD] = [j, d];
          });
          if (best >= 0) cable(mb, wires[1], anchors.splice(best, 1)[0].at);
        }
      }
    }
  });

  const ramp = rampGeometry();
  world.createCollider(RAPIER.ColliderDesc.trimesh(ramp.vertices, ramp.indices));
  mb.add(ramp.visual);

  const mesh = new THREE.Mesh(mb.build(), worldMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const clamp = (v: number) => Math.min(Math.max(v, -OUTER), OUTER);
  return {
    // Nearest point on any street centre line, moved off the ramp so the car isn't placed inside it.
    nearest(x, z) {
      let best = { x: 0, z: 0, heading: 0 };
      let bestD = Infinity;
      for (const c of STREETS) {
        for (const spot of [
          { x: c, z: clamp(z), heading: 0 },
          { x: clamp(x), z: c, heading: Math.PI / 2 },
        ]) {
          const d = (spot.x - x) ** 2 + (spot.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = spot;
          }
        }
      }
      if (best.x === RAMP.x && best.z > RAMP.z0 - 3 && best.z < RAMP.z0 + RAMP_LENGTH + 3) {
        best.z = best.z < RAMP.z0 + RAMP_LENGTH / 2 ? RAMP.z0 - 3 : RAMP.z0 + RAMP_LENGTH + 3;
      }
      return best;
    },
    syncProps() {},
  };
}
