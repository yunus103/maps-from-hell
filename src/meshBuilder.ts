import * as THREE from 'three';
import { swatchUV, type Swatch } from './palette';

// Unit-cube faces: outward normal and 4 corners (±1), wound counter-clockwise seen from outside.
const FACES: { n: THREE.Vector3; corners: THREE.Vector3[] }[] = [];
for (let axis = 0; axis < 3; axis++) {
  for (const s of [-1, 1]) {
    const n = new THREE.Vector3().setComponent(axis, s);
    const b = (axis + 1) % 3;
    const c = (axis + 2) % 3;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([pb, pc]) => new THREE.Vector3().setComponent(axis, s).setComponent(b, pb).setComponent(c, pc));
    const e1 = corners[1].clone().sub(corners[0]);
    const e2 = corners[2].clone().sub(corners[0]);
    if (e1.cross(e2).dot(n) < 0) corners.reverse();
    FACES.push({ n, corners });
  }
}

const tmp = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();
const local = new THREE.Matrix4();
const IDENTITY = new THREE.Matrix4();

// Collects boxes (and loose geometry) into one indexed geometry; every face is painted with one palette swatch.
export class MeshBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];

  // Box of size (sx, sy, sz) centred at the origin of `m`.
  box(m: THREE.Matrix4, sx: number, sy: number, sz: number, swatch: Swatch) {
    const [u, v] = swatchUV(swatch);
    normalMatrix.getNormalMatrix(m);
    for (const f of FACES) {
      const base = this.pos.length / 3;
      tmp.copy(f.n).applyMatrix3(normalMatrix).normalize();
      const [nx, ny, nz] = [tmp.x, tmp.y, tmp.z];
      for (const c of f.corners) {
        tmp.set((c.x * sx) / 2, (c.y * sy) / 2, (c.z * sz) / 2).applyMatrix4(m);
        this.pos.push(tmp.x, tmp.y, tmp.z);
        this.nor.push(nx, ny, nz);
        this.uv.push(u, v);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // Box from min/max extents in the space of `frame`.
  boxIn(frame: THREE.Matrix4, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, swatch: Swatch) {
    local.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).premultiply(frame);
    this.box(local, x1 - x0, y1 - y0, z1 - z0, swatch);
  }

  // Axis-aligned world box.
  boxWorld(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, swatch: Swatch) {
    this.boxIn(IDENTITY, x0, x1, y0, y1, z0, z1, swatch);
  }

  // Non-indexed geometry that already has position, normal and uv.
  add(g: THREE.BufferGeometry) {
    const base = this.pos.length / 3;
    this.pos.push(...g.attributes.position.array);
    this.nor.push(...g.attributes.normal.array);
    this.uv.push(...g.attributes.uv.array);
    for (let i = 0; i < g.attributes.position.count; i++) this.idx.push(base + i);
  }

  // Any three.js geometry (cylinder, sphere...), placed by `m` and painted with one swatch.
  shape(g: THREE.BufferGeometry, m: THREE.Matrix4, swatch: Swatch) {
    const s = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
    const [u, v] = swatchUV(swatch);
    const base = this.pos.length / 3;
    this.pos.push(...s.attributes.position.array);
    this.nor.push(...s.attributes.normal.array);
    for (let i = 0; i < s.attributes.position.count; i++) {
      this.uv.push(u, v);
      this.idx.push(base + i);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

