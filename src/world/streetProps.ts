import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { RoadEdge, RoadGraph } from '../game/types';
import { MeshBuilder } from '../meshBuilder';
import { worldMaterial, type Swatch } from '../palette';
import { QUALITY } from '../quality';
import { CURB_H, SIDEWALK, type Seg } from './district';
import { AGENT_GROUPS } from './agentMesh';
import { findEdge, isHorizontal } from './roadGraph';

// Static street dressing in the world palette, merged into one mesh: simit carts at the curb and sanayi
// clutter (open garage, tyre stacks, oil drums) at the mechanic places. The 🔧 blade sign comes from signs.ts.

// Simit carts stand at the curb edge of the sidewalk (clear of the pedestrian path), away from poles and lamps.
const CARTS: { seg: Seg; t: number; side: 1 | -1 }[] = [
  { seg: { dir: 'v', i: 2, j: 2 }, t: 0.24, side: -1 }, // beside the shift start on the main avenue
  { seg: { dir: 'h', i: 2, j: 2 }, t: 0.76, side: -1 }, // main east-west avenue, before the ramp junction
];
const CART_LAT = 0.75; // cart centre from the road edge
const GARAGE = { w: 3.6, h: 2.45, along: -2 }; // opening width / height, centre relative to the place
const PROP_LAT = 2.15; // tyres and drums: centre from the road edge, against the building line

const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10);

// Box/cylinder/collider helpers in edge coordinates: `sA` metres from node a, `lat` metres from the centre
// line towards `side` (same convention as places). Streets are axis-aligned, so world boxes stay axis-aligned.
function edgeKit(graph: RoadGraph, mb: MeshBuilder, world: RAPIER.World, e: RoadEdge, side: 1 | -1) {
  const a = graph.nodes[e.a];
  const h = isHorizontal(graph, e);
  const toWorld = (sA: number, lat: number): [number, number] => (h ? [a.x + sA, a.z - side * lat] : [a.x + side * lat, a.z + sA]);
  const extent = (s0: number, s1: number, l0: number, l1: number) => {
    const [x0, z0] = toWorld(s0, l0);
    const [x1, z1] = toWorld(s1, l1);
    return [Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)];
  };
  const m = new THREE.Matrix4();
  return {
    box(s0: number, s1: number, l0: number, l1: number, y0: number, y1: number, sw: Swatch) {
      const [x0, x1, z0, z1] = extent(s0, s1, l0, l1);
      mb.boxWorld(x0, x1, y0, y1, z0, z1, sw);
    },
    cyl(sA: number, lat: number, r: number, y0: number, height: number, sw: Swatch) {
      const [x, z] = toWorld(sA, lat);
      mb.shape(unitCyl, m.makeScale(r, height, r).setPosition(x, y0 + height / 2, z), sw);
    },
    solid(s0: number, s1: number, l0: number, l1: number, y0: number, y1: number) {
      const [x0, x1, z0, z1] = extent(s0, s1, l0, l1);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
          .setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
          .setFriction(0.2)
          .setCollisionGroups(AGENT_GROUPS),
      );
    },
  };
}

type Kit = ReturnType<typeof edgeKit>;

// Red-glass simit cart with a striped canopy; `s` along the street, `l` its centre from the street centre line.
function simitCart(k: Kit, s: number, l: number) {
  const y = CURB_H;
  k.box(s - 0.6, s + 0.6, l - 0.35, l + 0.35, y + 0.5, y + 0.66, 'red'); // chassis
  k.box(s - 0.55, s + 0.55, l - 0.3, l + 0.3, y + 0.66, y + 1.16, 'glass'); // display case
  k.box(s - 0.58, s + 0.58, l - 0.33, l + 0.33, y + 1.16, y + 1.22, 'red');
  for (let i = 0; i < 3; i++) k.box(s - 0.45 + i * 0.3, s - 0.25 + i * 0.3, l - 0.15, l + 0.15, y + 0.7, y + 0.78, 'okra'); // simits
  for (const ds of [-0.45, 0.45]) k.cyl(s + ds, l, 0.25, y, 0.08, 'metal'); // wheels (flat discs read fine)
  for (const ds of [-0.25, 0.25]) k.box(s + ds - 0.03, s + ds + 0.03, l - 0.03, l + 0.03, y, y + 0.5, 'metal'); // legs
  k.box(s + 0.6, s + 0.95, l - 0.25, l + 0.25, y + 0.85, y + 0.88, 'metal'); // handle
  for (const ds of [-0.55, 0.55]) for (const dl of [-0.3, 0.3]) k.box(s + ds - 0.02, s + ds + 0.02, l + dl - 0.02, l + dl + 0.02, y + 1.22, y + 2.0, 'metal');
  for (let i = 0; i < 5; i++) k.box(s - 0.75 + i * 0.3, s - 0.45 + i * 0.3, l - 0.5, l + 0.5, y + 2.0, y + 2.06, i % 2 ? 'white' : 'red'); // canopy
  k.solid(s - 0.65, s + 0.65, l - 0.4, l + 0.4, y, y + 1.2);
}

// Open roller-shutter garage in the facade plus tyres, drums and a toolbox on the sidewalk.
function sanayi(k: Kit, s: number, edgeLat: number) {
  const front = edgeLat + SIDEWALK; // building line
  const y = CURB_H;
  const g0 = s + GARAGE.along - GARAGE.w / 2;
  const g1 = s + GARAGE.along + GARAGE.w / 2;
  k.box(g0, g1, front - 0.12, front - 0.09, y, y + GARAGE.h, 'metal'); // dark workshop interior
  for (const gs of [g0 - 0.15, g1]) k.box(gs, gs + 0.15, front - 0.18, front, y, y + GARAGE.h + 0.3, 'shopFrame');
  k.box(g0 - 0.15, g1 + 0.15, front - 0.32, front - 0.02, y + GARAGE.h, y + GARAGE.h + 0.3, 'shutter'); // rolled-up shutter
  k.box(g0 + 0.3, g0 + 0.9, front - 0.55, front - 0.15, y, y + 0.55, 'red'); // toolbox by the door

  const lat = edgeLat + PROP_LAT;
  const tyres = [{ s: s + 1.2, n: 4 }, { s: s + 1.95, n: 3 }];
  for (const t of tyres) {
    for (let i = 0; i < t.n; i++) k.cyl(t.s, lat, 0.32, y + i * 0.23, 0.21, 'metal');
    k.solid(t.s - 0.32, t.s + 0.32, lat - 0.32, lat + 0.32, y, y + t.n * 0.23);
  }
  const drums: { s: number; sw: Swatch }[] = [{ s: s + 2.75, sw: 'blue' }, { s: s + 3.4, sw: 'red' }];
  for (const d of drums) {
    k.cyl(d.s, lat, 0.29, y, 0.88, d.sw);
    k.cyl(d.s, lat, 0.3, y + 0.86, 0.03, 'metal');
  }
  k.solid(s + 2.45, s + 3.7, lat - 0.3, lat + 0.3, y, y + 0.9);
}

export function buildStreetProps(scene: THREE.Scene, world: RAPIER.World, graph: RoadGraph): THREE.Mesh {
  const mb = new MeshBuilder();
  for (const c of CARTS) {
    const e = findEdge(graph, c.seg);
    simitCart(edgeKit(graph, mb, world, e, c.side), c.t * e.length, e.width / 2 + CART_LAT);
  }
  for (const p of graph.places) {
    if (p.kind !== 'mechanic') continue;
    const e = graph.edges[p.edge];
    sanayi(edgeKit(graph, mb, world, e, p.side), p.t * e.length, e.width / 2);
  }
  const mesh = new THREE.Mesh(mb.build(), worldMaterial);
  mesh.castShadow = QUALITY.agentShadows;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
