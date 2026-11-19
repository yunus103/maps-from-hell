import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Track } from './track';
import { MeshBuilder } from './meshBuilder';
import { swatchUV, worldMaterial, type Swatch } from './palette';
import { addBuilding, type Side } from './buildings';
import { LAMP_POST_HEIGHT, POLE_HEIGHT, cable, lampPost, utilityPole } from './props';
import type { RoadGraph } from './game/types';
import { CLOSED, CURB_H, SIDEWALK, XS, ZS, fakeBlocker, isOpen, streetWidth } from './world/district';
import { createRoadGraph } from './world/roadGraph';
import { BLOCKER_CLEAR, buildBlockers } from './world/blockers';
import { buildSigns } from './world/signs';

// Mahalle district: a 5x5 street grid (district.ts) closed in by a ring of buildings.
const OUTER = XS[XS.length - 1] + streetWidth(XS[XS.length - 1]) / 2; // outer road edge
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
// World mesh tile size. Tile edges fall on street centre lines, so every block lands in a single tile.
const CHUNK = 50;
// A facade tile stays drawn until the camera is this far behind its front plane, so detail (and its shadows)
// near a corner is already there when the camera comes round it.
const FACADE_MARGIN = 6;

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

// Blocks as rectangles of grid cells (cell (ci, cj) lies between XS[ci]..XS[ci+1] and ZS[cj]..ZS[cj+1]);
// a closed street merges its two neighbouring cells.
type Cells = { ci0: number; ci1: number; cj0: number; cj1: number };
function blockCells(): Cells[] {
  const owner = XS.slice(1).map((_, ci) => ZS.slice(1).map((_, cj): Cells => ({ ci0: ci, ci1: ci, cj0: cj, cj1: cj })));
  for (const s of CLOSED) {
    const a = s.dir === 'v' ? owner[s.i - 1][s.j] : owner[s.i][s.j - 1];
    const b = owner[s.i][s.j];
    const m = { ci0: Math.min(a.ci0, b.ci0), ci1: Math.max(a.ci1, b.ci1), cj0: Math.min(a.cj0, b.cj0), cj1: Math.max(a.cj1, b.cj1) };
    for (let ci = m.ci0; ci <= m.ci1; ci++) for (let cj = m.cj0; cj <= m.cj1; cj++) owner[ci][cj] = m;
  }
  return [...new Set(owner.flat())];
}

// Index k of the grid interval arr[k]..arr[k+1] containing s.
function interval(arr: number[], s: number): number {
  let k = 0;
  while (k < arr.length - 2 && s > arr[k + 1]) k++;
  return k;
}

// A single merged mesh can never be culled, so the main camera and the sun's small shadow box both drew the
// whole district every frame. Splitting it into tiles (by triangle centroid) lets three.js frustum-cull them.
function chunks(g: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const pos = g.attributes.position.array;
  const nor = g.attributes.normal.array;
  const uv = g.attributes.uv.array;
  const idx = g.index!.array;
  const tiles = new Map<string, number[]>();
  for (let t = 0; t < idx.length; t += 3) {
    let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k] * 3;
      x0 = Math.min(x0, pos[v]);
      x1 = Math.max(x1, pos[v]);
      z0 = Math.min(z0, pos[v + 2]);
      z1 = Math.max(z1, pos[v + 2]);
    }
    // Huge triangles (ground, ring slabs) get their own tile so they don't inflate a small tile's bounds.
    const key = x1 - x0 > CHUNK || z1 - z0 > CHUNK ? 'big' : `${Math.floor((x0 + x1) / 2 / CHUNK)},${Math.floor((z0 + z1) / 2 / CHUNK)}`;
    let list = tiles.get(key);
    if (!list) tiles.set(key, (list = []));
    list.push(t);
  }
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const out: THREE.BufferGeometry[] = [];
  for (const list of tiles.values()) {
    const [p, n, u, ix, used] = [[], [], [], [], []] as number[][];
    for (const t of list) {
      for (let k = 0; k < 3; k++) {
        const v = idx[t + k];
        if (remap[v] < 0) {
          remap[v] = used.length;
          used.push(v);
          p.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
          n.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]);
          u.push(uv[v * 2], uv[v * 2 + 1]);
        }
        ix.push(remap[v]);
      }
    }
    for (const v of used) remap[v] = -1;
    const c = new THREE.BufferGeometry();
    c.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    c.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    c.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    c.setIndex(ix);
    out.push(c);
  }
  return out;
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

export function createBlock(scene: THREE.Scene, world: RAPIER.World): Track & { graph: RoadGraph } {
  const graph = createRoadGraph();
  const rand = mulberry32(7);
  const mb = new MeshBuilder();
  const facades: Record<Side, MeshBuilder> = { n: new MeshBuilder(), s: new MeshBuilder(), e: new MeshBuilder(), w: new MeshBuilder() };

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
  const lamps: THREE.Vector3[] = [];
  const building = (x0: number, x1: number, z0: number, z1: number, floors: number[], front: Side, exposed: Side[]) => {
    const n = floors[0] + Math.floor(rand() * (floors[1] - floors[0] + 1));
    const { solids, anchor } = addBuilding(mb, facades, rand, { x0, x1, z0, z1, base: CURB_H, floors: n, front, exposed });
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

  // The blocks between the streets. North/south rows run the full width, so their ends are street corners.
  const blockFloors = [3, 6];
  for (const c of blockCells()) {
    const x0 = XS[c.ci0] + streetWidth(XS[c.ci0]) / 2;
    const x1 = XS[c.ci1 + 1] - streetWidth(XS[c.ci1 + 1]) / 2;
    const z0 = ZS[c.cj0] + streetWidth(ZS[c.cj0]) / 2;
    const z1 = ZS[c.cj1 + 1] - streetWidth(ZS[c.cj1 + 1]) / 2;
    slab(x0, x1, z0, z1);
    const [bx0, bx1, bz0, bz1] = [x0 + SIDEWALK, x1 - SIDEWALK, z0 + SIDEWALK, z1 - SIDEWALK];
    const d = BLOCK_DEPTH;
    row(bx0, bx1, (a, b, f, l) => building(a, b, bz0, bz0 + d, blockFloors, 's', ends(f, l)));
    row(bx0, bx1, (a, b, f, l) => building(a, b, bz1 - d, bz1, blockFloors, 'n', ends(f, l)));
    row(bz0 + d, bz1 - d, (a, b) => building(bx0, bx0 + d, a, b, blockFloors, 'w', []));
    row(bz0 + d, bz1 - d, (a, b) => building(bx1 - d, bx1, a, b, blockFloors, 'e', []));
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

  // Dashed centre lines on every paved segment (fake ones too: they must look like streets), left out of
  // intersections (with their crossings) and the ramp.
  const near = (o: number, s: number) => Math.abs(s - o) < streetWidth(o) / 2 + ZEBRA.offset + ZEBRA.length + 1.5;
  const [dh, dw] = [DASH.length / 2, DASH.width / 2];
  for (let i = 0; i < XS.length; i++) {
    const c = XS[i];
    for (let s = -OUTER + DASH.length / 2; s < OUTER; s += DASH.length + DASH.gap) {
      const onRamp = c === RAMP.x && s > RAMP.z0 - DASH.length && s < RAMP.z0 + RAMP_LENGTH + DASH.length;
      if (!onRamp && !ZS.some((o) => near(o, s)) && isOpen('v', i, interval(ZS, s))) line(c - dw, c + dw, s - dh, s + dh);
    }
  }
  for (let j = 0; j < ZS.length; j++) {
    const c = ZS[j];
    for (let s = -OUTER + DASH.length / 2; s < OUTER; s += DASH.length + DASH.gap) {
      if (!XS.some((o) => near(o, s)) && isOpen('h', interval(XS, s), j)) line(s - dh, s + dh, c - dw, c + dw);
    }
  }

  // Zebra crossings on every approach that has a street.
  XS.forEach((cx, i) =>
    ZS.forEach((cz, j) => {
      const [hx, hz] = [streetWidth(cx) / 2, streetWidth(cz) / 2];
      for (const dir of [-1, 1]) {
        if (isOpen('v', i, dir > 0 ? j : j - 1)) {
          // Across the N-S street, north or south of the intersection.
          const near = cz + dir * (hz + ZEBRA.offset);
          const far = near + dir * ZEBRA.length;
          for (let x = cx - hx + 0.6; x + ZEBRA.stripe <= cx + hx - 0.5; x += ZEBRA.stripe * 2) {
            line(x, x + ZEBRA.stripe, Math.min(near, far), Math.max(near, far));
          }
        }
        if (isOpen('h', dir > 0 ? i : i - 1, j)) {
          // Across the E-W street, east or west of the intersection.
          const near = cx + dir * (hx + ZEBRA.offset);
          const far = near + dir * ZEBRA.length;
          for (let z = cz - hz + 0.6; z + ZEBRA.stripe <= cz + hz - 0.5; z += ZEBRA.stripe * 2) {
            line(Math.min(near, far), Math.max(near, far), z, z + ZEBRA.stripe);
          }
        }
      }
    }),
  );

  // One utility pole per block-length stretch, on one sidewalk of every street (alternating sides), wired pole
  // to pole across intersections, sometimes feeding a nearby building's wall bracket. The ramp's stretch and
  // closed streets are skipped; on a fake street the pole moves off the blocker in the middle.
  const crossingClear = ZEBRA.offset + ZEBRA.length + 1;
  XS.forEach((c, i) => {
    const hw = streetWidth(c) / 2;
    for (const ns of [true, false]) {
      const side = (i + (ns ? 0 : 1)) % 2 ? 1 : -1;
      const toRoad = ns ? new THREE.Vector3(-side, 0, 0) : new THREE.Vector3(0, 0, -side);
      const cross = ns ? ZS : XS;
      let prev: { along: number; wires: THREE.Vector3[] } | null = null;
      for (let k = 0; k < cross.length - 1; k++) {
        const seg = ns ? ({ dir: 'v', i, j: k } as const) : ({ dir: 'h', i: k, j: i } as const);
        if (!isOpen(seg.dir, seg.i, seg.j)) continue;
        const a0 = cross[k] + streetWidth(cross[k]) / 2 + crossingClear;
        const a1 = cross[k + 1] - streetWidth(cross[k + 1]) / 2 - crossingClear;
        if (ns && c === RAMP.x && a0 < RAMP.z0 + RAMP_LENGTH && a1 > RAMP.z0) continue;
        const along = a0 + (a1 - a0) * (fakeBlocker(seg) ? 0.25 : 0.5);
        const off = c + side * (hw + POLE_CURB_GAP);
        const foot = ns ? new THREE.Vector3(off, CURB_H, along) : new THREE.Vector3(along, CURB_H, off);
        const { wires, lamp } = utilityPole(mb, foot, toRoad);
        lamps.push(lamp);
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

  // A lamp post on one corner of every intersection, where the drifting happens, rotating round the corners
  // so the light doesn't always come from the same side.
  XS.forEach((cx, i) =>
    ZS.forEach((cz, j) => {
      const q = (i + 2 * j) % 4;
      const [sx, sz] = [q < 2 ? 1 : -1, q % 2 ? 1 : -1];
      const foot = new THREE.Vector3(cx + sx * (streetWidth(cx) / 2 + 0.6), CURB_H, cz + sz * (streetWidth(cz) / 2 + 0.6));
      lamps.push(lampPost(mb, foot, new THREE.Vector3(-sx, 0, 0)));
      solid(foot.x - 0.13, foot.x + 0.13, CURB_H, CURB_H + LAMP_POST_HEIGHT, foot.z - 0.13, foot.z + 0.13, THIN_GROUPS);
    }),
  );

  buildBlockers(mb, solid, graph);
  buildSigns(scene, mb, (x0, x1, y0, y1, z0, z1) => solid(x0, x1, y0, y1, z0, z1, THIN_GROUPS), graph);

  const ramp = rampGeometry();
  world.createCollider(RAPIER.ColliderDesc.trimesh(ramp.vertices, ramp.indices));
  mb.add(ramp.visual);

  const addMesh = (g: THREE.BufferGeometry) => {
    const mesh = new THREE.Mesh(g, worldMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };
  for (const g of chunks(mb.build())) addMesh(g);

  // Most triangles are facade detail. A facade can only be seen (or matter for shadows the camera can see) from
  // in front of it, so each facade tile is hidden while the camera is behind its front plane. This also skips
  // those tiles in the shadow pass, which runs after scene.onBeforeRender.
  const facadeTiles: { mesh: THREE.Mesh; test: (p: THREE.Vector3) => boolean }[] = [];
  for (const side of ['n', 's', 'e', 'w'] as const) {
    for (const g of chunks(facades[side].build())) {
      g.computeBoundingBox();
      const { min, max } = g.boundingBox!;
      const m = FACADE_MARGIN;
      const test = {
        n: (p: THREE.Vector3) => p.z > min.z - m,
        s: (p: THREE.Vector3) => p.z < max.z + m,
        e: (p: THREE.Vector3) => p.x > min.x - m,
        w: (p: THREE.Vector3) => p.x < max.x + m,
      }[side];
      facadeTiles.push({ mesh: addMesh(g), test });
    }
  }
  scene.onBeforeRender = (_r, _s, camera) => {
    for (const t of facadeTiles) t.mesh.visible = t.test(camera.position);
  };

  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  return {
    // Nearest point on any paved street's centre line, moved away from blockers and off the ramp so the car
    // isn't placed inside them.
    nearest(x, z) {
      let best = { x: 0, z: 0, heading: 0 };
      let bestD = Infinity;
      for (const e of graph.edges) {
        const [a, b] = [graph.nodes[e.a], graph.nodes[e.b]];
        const ns = a.x === b.x;
        let along = ns ? clamp(z, a.z, b.z) : clamp(x, a.x, b.x);
        const mid = ns ? e.blockerZ : e.blockerX;
        if (e.fake && Math.abs(along - mid) < BLOCKER_CLEAR) along = mid + (along < mid ? -BLOCKER_CLEAR : BLOCKER_CLEAR);
        if (ns && a.x === RAMP.x && along > RAMP.z0 - 3 && along < RAMP.z0 + RAMP_LENGTH + 3) {
          along = along < RAMP.z0 + RAMP_LENGTH / 2 ? RAMP.z0 - 3 : RAMP.z0 + RAMP_LENGTH + 3;
        }
        const spot = ns ? { x: a.x, z: along, heading: 0 } : { x: along, z: a.z, heading: Math.PI / 2 };
        const d = (spot.x - x) ** 2 + (spot.z - z) ** 2;
        if (d < bestD) [best, bestD] = [spot, d];
      }
      return best;
    },
    syncProps() {},
    lamps,
    graph,
  };
}
