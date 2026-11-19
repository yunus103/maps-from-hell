import type { EdgeId, NodeId, Place, RoadEdge, RoadGraph, RoadNode, RoadPos, Turn } from '../game/types';
import { FTUE, PLACES, SIDEWALK, SPAWN, XS, ZS, fakeBlocker, isOpen, nodeId, streetWidth, type Seg } from './district';

export function createRoadGraph(): RoadGraph {
  const nodes: RoadNode[] = [];
  for (let j = 0; j < ZS.length; j++) {
    for (let i = 0; i < XS.length; i++) {
      nodes.push({ id: nodeId(i, j), x: XS[i], z: ZS[j], halfX: streetWidth(XS[i]) / 2, halfZ: streetWidth(ZS[j]) / 2, edges: [] });
    }
  }

  const edges: RoadEdge[] = [];
  const segEdge = new Map<string, EdgeId>();
  const addEdge = (seg: Seg) => {
    if (!isOpen(seg.dir, seg.i, seg.j)) return;
    const [ai, aj, bi, bj] = seg.dir === 'h' ? [seg.i, seg.j, seg.i + 1, seg.j] : [seg.i, seg.j, seg.i, seg.j + 1];
    const a = nodes[nodeId(ai, aj)];
    const b = nodes[nodeId(bi, bj)];
    const blocker = fakeBlocker(seg);
    const e: RoadEdge = {
      id: edges.length,
      a: a.id,
      b: b.id,
      fake: blocker !== null,
      blocker,
      blockerX: (a.x + b.x) / 2,
      blockerZ: (a.z + b.z) / 2,
      width: streetWidth(seg.dir === 'h' ? a.z : a.x),
      length: Math.hypot(b.x - a.x, b.z - a.z),
    };
    edges.push(e);
    a.edges.push(e.id);
    b.edges.push(e.id);
    segEdge.set(`${seg.dir}${seg.i},${seg.j}`, e.id);
  };
  for (let j = 0; j < ZS.length; j++) for (let i = 0; i < XS.length - 1; i++) addEdge({ dir: 'h', i, j });
  for (let i = 0; i < XS.length; i++) for (let j = 0; j < ZS.length - 1; j++) addEdge({ dir: 'v', i, j });
  const edgeOf = (s: Seg) => segEdge.get(`${s.dir}${s.i},${s.j}`)!;

  const other = (edge: EdgeId, node: NodeId) => (edges[edge].a === node ? edges[edge].b : edges[edge].a);
  const horizontal = (e: RoadEdge) => nodes[e.a].z === nodes[e.b].z;

  // All-pairs shortest paths over true (non-fake) edges; 25 nodes, so Floyd-Warshall at build time is trivial.
  const n = nodes.length;
  const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => (i === k ? 0 : Infinity)));
  for (const e of edges) if (!e.fake) D[e.a][e.b] = D[e.b][e.a] = e.length;
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) D[i][j] = D[i][k] + D[k][j];

  const places: Place[] = PLACES.map((p, id) => {
    const edge = edges[edgeOf(p.seg)];
    const a = nodes[edge.a];
    const off = p.side * (edge.width / 2 - 2);
    // Left of +X travel is -Z, left of +Z travel is +X.
    const [x, z] = horizontal(edge) ? [a.x + p.t * edge.length, a.z - off] : [a.x + off, a.z + p.t * edge.length];
    return { id, edge: edge.id, t: p.t, side: p.side, x, z, kind: p.kind, shop: p.shop, name: p.name };
  });

  const dist = (a: NodeId, b: NodeId) => D[a][b];
  function distToPlace(node: NodeId, place: Place) {
    const e = edges[place.edge];
    return Math.min(D[node][e.a] + place.t * e.length, D[node][e.b] + (1 - place.t) * e.length);
  }

  return {
    nodes,
    edges,
    places,
    spawn: SPAWN,
    ftue: { spawn: FTUE.spawn, pickup: FTUE.pickup, dropoff: FTUE.dropoff, lieNode: FTUE.lieNode, lieExit: edgeOf(FTUE.lieExit) },

    locate(x, z): RoadPos {
      // The junction box includes the sidewalk corners: a car hugging the curb straight through must not land in
      // the cross street's rectangle (those reach out to the sidewalk too).
      for (const nd of nodes) {
        if (Math.abs(x - nd.x) <= nd.halfX + SIDEWALK && Math.abs(z - nd.z) <= nd.halfZ + SIDEWALK) return { kind: 'node', node: nd.id };
      }
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const half = e.width / 2 + SIDEWALK; // curb hopping still counts as being on the street
        if (horizontal(e)) {
          if (x > a.x + a.halfX && x < b.x - b.halfX && Math.abs(z - a.z) <= half) return { kind: 'edge', edge: e.id, t: (x - a.x) / e.length };
        } else if (z > a.z + a.halfZ && z < b.z - b.halfZ && Math.abs(x - a.x) <= half) {
          return { kind: 'edge', edge: e.id, t: (z - a.z) / e.length };
        }
      }
      return { kind: 'off' };
    },

    nearestNode(x, z) {
      let best = 0;
      let bestD = Infinity;
      for (const nd of nodes) {
        const d = (nd.x - x) ** 2 + (nd.z - z) ** 2;
        if (d < bestD) [best, bestD] = [nd.id, d];
      }
      return best;
    },

    other,
    dist,
    distToPlace,

    placeDist(from, to) {
      const e = edges[from.edge];
      if (from.edge === to.edge) return Math.abs(from.t - to.t) * e.length;
      return Math.min(from.t * e.length + distToPlace(e.a, to), (1 - from.t) * e.length + distToPlace(e.b, to));
    },

    turn(from, via, to): Turn {
      const [f, v, t] = [nodes[from], nodes[via], nodes[to]];
      let [ix, iz] = [v.x - f.x, v.z - f.z];
      let [ox, oz] = [t.x - v.x, t.z - v.z];
      const li = Math.hypot(ix, iz) || 1;
      const lo = Math.hypot(ox, oz) || 1;
      [ix, iz, ox, oz] = [ix / li, iz / li, ox / lo, oz / lo];
      const dot = ix * ox + iz * oz;
      if (dot > 0.7) return 'straight';
      if (dot < -0.7) return 'uturn';
      // Left is +X when facing +Z.
      return iz * ox - ix * oz > 0 ? 'left' : 'right';
    },
  };
}
