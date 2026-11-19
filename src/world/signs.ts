import * as THREE from 'three';
import type { MeshBuilder } from '../meshBuilder';
import type { Place, RoadGraph, ShopTag } from '../game/types';
import { getLang, onLangChange } from '../game/lang';
import { CURB_H } from './district';

// A blade sign on a post at the curb next to every place, perpendicular to the street so it reads while
// driving towards it. All boards share one canvas atlas and one mesh (one draw call); posts go into the world mesh.

type Solid = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => void;

const STYLE: Record<ShopTag | 'home' | 'mechanic', { bg: string; icon: string }> = {
  kebab: { bg: '#b83224', icon: '🥙' },
  lahmacun: { bg: '#d9731a', icon: '🫓' },
  bakery: { bg: '#c2577f', icon: '🎂' },
  grocer: { bg: '#2f7d3b', icon: '🥚' },
  icecream: { bg: '#2a86b8', icon: '🍦' },
  pharmacy: { bg: '#c8102e', icon: '💊' },
  florist: { bg: '#c2407a', icon: '💐' },
  electronics: { bg: '#3b4a9e', icon: '🔌' },
  petshop: { bg: '#8a5a2b', icon: '🐾' },
  stationery: { bg: '#6b4fa0', icon: '✏️' },
  home: { bg: '#2e4057', icon: '🏠' },
  mechanic: { bg: '#4a4f57', icon: '🔧' },
};
const CELL_W = 256;
const CELL_H = 128;
const COLS = 4;
// Board size and height (m); `inner` is its road-side edge measured from the road edge (negative = over the
// road), keeping it clear of shop awnings and çıkma overhangs on the building side.
const BOARD = { w: 2.2, h: 1.0, y: 2.9, inner: -1.0 };
const POST_OFF = 0.5; // post centre from the road edge
const ALONG = 3.5; // m along the street from the place, beside its delivery zone

function drawAtlas(ctx: CanvasRenderingContext2D, places: Place[]) {
  const lang = getLang();
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  places.forEach((p, k) => {
    const s = STYLE[p.kind === 'mechanic' ? 'mechanic' : p.shop ?? 'home'];
    const x = (k % COLS) * CELL_W;
    const y = Math.floor(k / COLS) * CELL_H;
    ctx.fillStyle = s.bg;
    ctx.fillRect(x, y, CELL_W, CELL_H);
    ctx.strokeStyle = '#f4efe4';
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 6, y + 6, CELL_W - 12, CELL_H - 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '54px sans-serif';
    ctx.fillText(s.icon, x + 50, y + CELL_H / 2 + 2);

    const name = p.name[lang];
    const maxW = CELL_W - 112;
    const words = name.split(' ');
    let size = 34;
    ctx.font = `bold ${size}px sans-serif`;
    let lines = [name];
    if (ctx.measureText(name).width > maxW && words.length > 1) {
      const cut = Math.ceil(words.length / 2);
      lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    }
    const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
    while (size > 14 && widest() > maxW) {
      size -= 2;
      ctx.font = `bold ${size}px sans-serif`;
    }
    ctx.fillStyle = '#ffffff';
    lines.forEach((l, i) => ctx.fillText(l, x + 98 + maxW / 2, y + CELL_H / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
  });
}

export function buildSigns(scene: THREE.Scene, mb: MeshBuilder, solid: Solid, graph: RoadGraph) {
  const places = graph.places;
  const rows = Math.ceil(places.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * COLS;
  canvas.height = CELL_H * rows;
  const ctx = canvas.getContext('2d')!;
  drawAtlas(ctx, places);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  onLangChange(() => {
    drawAtlas(ctx, places);
    tex.needsUpdate = true;
  });

  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();

  places.forEach((p, k) => {
    const e = graph.edges[p.edge];
    const a = graph.nodes[e.a];
    const horizontal = a.z === graph.nodes[e.b].z;
    const along = horizontal ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    // Same side convention as the place: left of +X travel is -Z, left of +Z travel is +X.
    const lat = horizontal ? new THREE.Vector3(0, 0, -p.side) : new THREE.Vector3(p.side, 0, 0);
    const centre = horizontal ? new THREE.Vector3(p.x + ALONG, 0, a.z) : new THREE.Vector3(a.x, 0, p.z + ALONG);
    const edge = e.width / 2;
    const y0 = CURB_H + BOARD.y;
    const y1 = y0 + BOARD.h;

    const foot = centre.clone().addScaledVector(lat, edge + POST_OFF);
    const ph = 0.05;
    mb.boxWorld(foot.x - ph, foot.x + ph, CURB_H, y1 + 0.05, foot.z - ph, foot.z + ph, 'metal');
    solid(foot.x - ph, foot.x + ph, CURB_H, y1, foot.z - ph, foot.z + ph);
    // Backing plate between the two printed faces.
    p0.copy(centre).addScaledVector(lat, edge + BOARD.inner - 0.05);
    p1.copy(centre).addScaledVector(lat, edge + BOARD.inner + BOARD.w + 0.05);
    const t = horizontal ? [0.025, 0] : [0, 0.025];
    mb.boxWorld(
      Math.min(p0.x, p1.x) - t[0], Math.max(p0.x, p1.x) + t[0], y0 - 0.05, y1 + 0.05,
      Math.min(p0.z, p1.z) - t[1], Math.max(p0.z, p1.z) + t[1], 'metal',
    );

    const u0 = (k % COLS) / COLS;
    const u1 = u0 + 1 / COLS;
    const v1 = 1 - Math.floor(k / COLS) / rows;
    const v0 = v1 - 1 / rows;
    for (const s of [-1, 1]) {
      const n = along.clone().multiplyScalar(s);
      right.crossVectors(n.clone().negate(), up);
      p0.copy(centre).addScaledVector(lat, edge + BOARD.inner).addScaledVector(n, 0.03);
      p1.copy(centre).addScaledVector(lat, edge + BOARD.inner + BOARD.w).addScaledVector(n, 0.03);
      const [l, r] = p0.dot(right) < p1.dot(right) ? [p0, p1] : [p1, p0];
      const base = pos.length / 3;
      pos.push(l.x, y0, l.z, r.x, y0, r.z, r.x, y1, r.z, l.x, y1, l.z);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
      for (let i = 0; i < 4; i++) nor.push(n.x, n.y, n.z);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // Unlit so the boards read like backlit shop signs, also at night.
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: 0xe0e0e0 })));
}
