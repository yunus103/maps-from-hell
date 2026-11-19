import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { RoadGraph } from '../game/types';
import { QUALITY } from '../quality';
import { AGENT_GROUPS, SEDAN, createInstanced, sedanGeometry } from './agentMesh';
import { isHorizontal, isRampEdge, nodeHalfAlong } from './roadGraph';

// Static cars along the curbs: one InstancedMesh, fixed colliders the player can hit (camera ignores them).

const CURB_OFFSET = 1.1; // car centre from the road edge
const JUNCTION_CLEAR = 7; // m from the junction box to the nearest bumper: just past the zebra crossing
const PLACE_CLEAR = 9; // from any place's delivery zone
const BLOCKER_CLEAR = 15; // from a fake street's blocker
const SPAWN_CLEAR = 10; // from the shift / FTUE start spots
const GAP = 7; // min centre spacing along one curb
const SEED = 1903; // layout is identical on every load; the mobile tier gets the first QUALITY.parked of it
const MAX_TRIES = 4000;
const COLORS = [0xf2f2f2, 0xb8bcc2, 0x4a4e55, 0x26282c, 0xb3302b, 0x2f5d9a, 0xf2c12e, 0x2f5a44, 0xd8c7a0, 0x8a2f3c];

type Slot = { edge: number; side: 1 | -1; sA: number; color: number }; // side: +1 = left of a→b travel; sA: metres from node a

export interface Parked {
  // No parked car overlaps [sA0, sA1] (metres from node a) on that curb of the edge.
  curbFree(edge: number, side: 1 | -1, sA0: number, sA1: number): boolean;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParked(scene: THREE.Scene, world: RAPIER.World, graph: RoadGraph, material: THREE.Material): Parked {
  const rand = mulberry32(SEED);
  const slots: Slot[] = [];
  const spots = [graph.spawn, graph.ftue.spawn];
  const pos = (s: Slot) => {
    const e = graph.edges[s.edge];
    const a = graph.nodes[e.a];
    const off = s.side * (e.width / 2 - CURB_OFFSET);
    // Same side convention as places: left of +X travel is -Z, left of +Z travel is +X.
    return isHorizontal(graph, e) ? { x: a.x + s.sA, z: a.z - off } : { x: a.x + off, z: a.z + s.sA };
  };

  for (let tries = 0; tries < MAX_TRIES && slots.length < QUALITY.parked; tries++) {
    const e = graph.edges[Math.floor(rand() * graph.edges.length)];
    const side: 1 | -1 = rand() < 0.5 ? 1 : -1;
    const r = rand();
    const color = COLORS[Math.floor(rand() * COLORS.length)]; // drawn every try so both tiers share one sequence
    if (isRampEdge(graph, e)) continue;
    const s0 = nodeHalfAlong(graph, e, e.a) + JUNCTION_CLEAR + SEDAN.halfL;
    const s1 = e.length - nodeHalfAlong(graph, e, e.b) - JUNCTION_CLEAR - SEDAN.halfL;
    const sA = s0 + r * (s1 - s0);
    if (e.fake && Math.abs(sA - e.length / 2) < BLOCKER_CLEAR) continue;
    const slot: Slot = { edge: e.id, side, sA, color };
    const p = pos(slot);
    if (graph.places.some((pl) => Math.hypot(pl.x - p.x, pl.z - p.z) < PLACE_CLEAR)) continue;
    if (spots.some((sp) => Math.hypot(sp.x - p.x, sp.z - p.z) < SPAWN_CLEAR)) continue;
    if (slots.some((o) => o.edge === e.id && o.side === side && Math.abs(o.sA - sA) < GAP)) continue;
    slots.push(slot);
  }

  const mesh = createInstanced(sedanGeometry(false), material, slots.length, true);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  slots.forEach((s, i) => {
    const e = graph.edges[s.edge];
    const p = pos(s);
    const h = isHorizontal(graph, e);
    // Parked with the traffic of its side: the right-hand curb of a→b travel (side -1) faces a→b.
    const heading = (h ? Math.PI / 2 : 0) + (s.side > 0 ? Math.PI : 0);
    mesh.setMatrixAt(i, m.makeRotationY(heading).setPosition(p.x, 0, p.z));
    mesh.setColorAt(i, color.setHex(s.color));
    const [hx, hz] = h ? [SEDAN.halfL, SEDAN.halfW] : [SEDAN.halfW, SEDAN.halfL];
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, SEDAN.halfH, hz)
        .setTranslation(p.x, SEDAN.halfH, p.z)
        .setFriction(0.2)
        .setCollisionGroups(AGENT_GROUPS),
    );
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return {
    curbFree(edge, side, sA0, sA1) {
      const [lo, hi] = [Math.min(sA0, sA1) - SEDAN.halfL, Math.max(sA0, sA1) + SEDAN.halfL];
      return !slots.some((s) => s.edge === edge && s.side === side && s.sA > lo && s.sA < hi);
    },
  };
}
