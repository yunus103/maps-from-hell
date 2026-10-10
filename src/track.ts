import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROAD_WIDTH = 14;
const SAMPLE_STEP = 2; // metres between centreline samples
const BARRIER_GAP = 2.5; // from road edge to barrier face
const BARRIER = { height: 0.9, thickness: 0.6 };
const CURB_WIDTH = 1.2;
const CURB_MIN_CURVATURE = 1 / 70; // only corners tighter than this get curbs
const GROUND_SIZE = 800;
// Outside the loop beside the main straight; the barrier opens toward it.
const SKIDPAD = { x: -60, z: -20, radius: 30 };
const SKIDPAD_OPENING = 35; // barrier is left out within radius + this of the skidpad centre

type Section = { straight: number } | { radius: number; angle: number; turn: 'left' | 'right' };

// Built from the start line heading +Z. Turns are from the driver's point of view.
const START = { x: 0, z: -170 };
const SECTIONS: Section[] = [
  { straight: 280 }, // main straight: top speed and braking
  { radius: 80, angle: 90, turn: 'left' }, // fast sweeper: should stay a grip corner
  { straight: 90 },
  { radius: 35, angle: 180, turn: 'left' }, // carousel: long drift, boost
  { straight: 20 },
  { radius: 28, angle: 90, turn: 'right' },
  { straight: 15 },
  { radius: 32, angle: 50, turn: 'left' }, // S: drift transitions
  { radius: 32, angle: 100, turn: 'right' },
  { radius: 32, angle: 50, turn: 'left' },
  { straight: 20 },
  { radius: 30, angle: 90, turn: 'left' },
  { straight: 15 },
  { radius: 16, angle: 180, turn: 'right' }, // hairpin: sharp handbrake drift
  { straight: 30 },
  { radius: 40, angle: 90, turn: 'left' },
  { straight: 67 },
  { radius: 40, angle: 90, turn: 'left' },
  { straight: 67 },
  { radius: 40, angle: 90, turn: 'left' },
  { straight: 40 }, // back to the start line
];

const COLORS = {
  grass: 0x6d8a4a,
  asphalt: 0x4b4b52,
  line: 0xe8e4d8,
  curbRed: 0xc7372f,
  curbWhite: 0xeeeae0,
  barrierRed: 0xb8443a,
  barrierWhite: 0xe2ddd2,
};

// side: which `normal` side is the inside of the bend here (+1 / -1), 0 on straights.
type Sample = { p: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3; side: number };

function tint(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // Ribbons have no UVs; merging needs matching attributes and nothing here is textured.
  g.deleteAttribute('uv');
  return g;
}

// Walks the sections in small steps; heading 0 = +Z, positive turns toward +X (driver's left).
function centreline(): THREE.Vector3[] {
  const STEP = 0.5;
  const KEEP_EVERY = 8;
  const points: THREE.Vector3[] = [];
  let { x, z } = START;
  let heading = 0;
  let i = 0;
  for (const sec of SECTIONS) {
    const length = 'straight' in sec ? sec.straight : (sec.radius * sec.angle * Math.PI) / 180;
    const turnRate = 'straight' in sec ? 0 : (sec.turn === 'left' ? 1 : -1) / sec.radius;
    // Whole steps per section so lengths and angles land exactly and the loop closes.
    const steps = Math.max(1, Math.round(length / STEP));
    const step = length / steps;
    for (let k = 0; k < steps; k++) {
      if (i++ % KEEP_EVERY === 0) points.push(new THREE.Vector3(x, 0, z));
      const mid = heading + (turnRate * step) / 2;
      x += Math.sin(mid) * step;
      z += Math.cos(mid) * step;
      heading += turnRate * step;
    }
  }
  return points;
}

function sampleCurve(): Sample[] {
  const curve = new THREE.CatmullRomCurve3(centreline(), true, 'centripetal');
  const count = Math.round(curve.getLength() / SAMPLE_STEP);
  const points = curve.getSpacedPoints(count).slice(0, count);
  return points.map((p, i) => {
    const prev = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    const tangent = next.clone().sub(prev).normalize();
    // Driver's left in the XZ plane.
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x);
    const a = p.clone().sub(prev).normalize();
    const b = next.clone().sub(p).normalize();
    const curvature = Math.acos(Math.min(a.dot(b), 1)) / SAMPLE_STEP;
    // A left bend has a negative XZ cross product; its inside is the +normal side.
    const side = curvature > CURB_MIN_CURVATURE ? (a.x * b.z - a.z * b.x < 0 ? 1 : -1) : 0;
    return { p, tangent, normal, side };
  });
}

// Flat ribbon between two offsets from the centreline (positive = driver's left).
// `color` returning null leaves that segment out.
function ribbon(samples: Sample[], inner: number, outer: number, y: number, color: (i: number) => number | null) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const s0 = samples[i];
    const s1 = samples[(i + 1) % n];
    const quad = [
      s0.p.clone().addScaledVector(s0.normal, inner),
      s0.p.clone().addScaledVector(s0.normal, outer),
      s1.p.clone().addScaledVector(s1.normal, inner),
      s1.p.clone().addScaledVector(s1.normal, outer),
    ];
    // Wind so the face points up whichever side of the centreline the strip is on.
    const order = outer > inner ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2];
    const hex = color(i);
    if (hex === null) continue;
    c.set(hex);
    for (const k of order) {
      pos.push(quad[k].x, y, quad[k].z);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export type Track = {
  // Nearest point on the centreline and the heading (0 = +Z) to drive along it.
  nearest(x: number, z: number): { x: number; z: number; heading: number };
  syncProps(): void;
  lamps: THREE.Vector3[]; // street-lamp lens positions, lit at night
};

export function createTrack(scene: THREE.Scene, world: RAPIER.World): Track {
  const samples = sampleCurve();
  const n = samples.length;

  // A loop that mostly turns one way has its infield on that side; the barrier goes on the other.
  const netSide = samples.reduce((sum, s) => sum + s.side, 0);
  const outside = netSide > 0 ? -1 : 1; // multiplier on `normal` pointing away from the infield

  const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }),
  );
  ground.receiveShadow = true;
  scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(GROUND_SIZE / 2, 0.1, GROUND_SIZE / 2).setTranslation(0, -0.1, 0));

  const half = ROAD_WIDTH / 2;
  const curbColor = (i: number) => (i % 2 ? COLORS.curbRed : COLORS.curbWhite);
  const surface: THREE.BufferGeometry[] = [
    ribbon(samples, -half, half, 0.01, () => COLORS.asphalt),
    // Dashed centre line: every other 2 m sample.
    ribbon(samples, -0.15, 0.15, 0.02, (i) => (i % 4 < 2 ? COLORS.line : COLORS.asphalt)),
    // Edge lines.
    ribbon(samples, half - 0.5, half - 0.3, 0.02, () => COLORS.line),
    ribbon(samples, -half + 0.3, -half + 0.5, 0.02, () => COLORS.line),
    // Curbs on the inside of each bend, whichever way it turns.
    ribbon(samples, half, half + CURB_WIDTH, 0.03, (i) => (samples[i].side === 1 ? curbColor(i) : null)),
    ribbon(samples, -half, -half - CURB_WIDTH, 0.03, (i) => (samples[i].side === -1 ? curbColor(i) : null)),
  ];

  // Start line.
  const s0 = samples[0];
  const start = tint(new THREE.BoxGeometry(ROAD_WIDTH, 0.02, 1.2), COLORS.line);
  start.rotateY(Math.atan2(s0.tangent.x, s0.tangent.z)).translate(s0.p.x, 0.02, s0.p.z);
  surface.push(start);

  const skidpad = tint(new THREE.CircleGeometry(SKIDPAD.radius, 48).rotateX(-Math.PI / 2), COLORS.asphalt);
  surface.push(skidpad.translate(SKIDPAD.x, 0.01, SKIDPAD.z));
  const ring = tint(new THREE.RingGeometry(SKIDPAD.radius * 0.45, SKIDPAD.radius * 0.45 + 0.3, 48).rotateX(-Math.PI / 2), COLORS.line);
  surface.push(ring.translate(SKIDPAD.x, 0.02, SKIDPAD.z));

  const surfaceMesh = new THREE.Mesh(mergeGeometries(surface.map((g) => (g.index ? g.toNonIndexed() : g))), flat);
  surfaceMesh.receiveShadow = true;
  scene.add(surfaceMesh);

  // Barrier on the outside of the loop, one static box per segment, coloured in alternating blocks.
  const barrierParts: THREE.BufferGeometry[] = [];
  const offset = half + BARRIER_GAP + BARRIER.thickness / 2;
  for (let i = 0; i < n; i++) {
    const a = samples[i].p.clone().addScaledVector(samples[i].normal, outside * offset);
    const b = samples[(i + 1) % n].p.clone().addScaledVector(samples[(i + 1) % n].normal, outside * offset);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    if (Math.hypot(mid.x - SKIDPAD.x, mid.z - SKIDPAD.z) < SKIDPAD.radius + SKIDPAD_OPENING) continue;
    const len = a.distanceTo(b) + 0.3; // overlap hides seams on curves
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const color = Math.floor(i / 2) % 2 ? COLORS.barrierRed : COLORS.barrierWhite;
    barrierParts.push(
      tint(new THREE.BoxGeometry(BARRIER.thickness, BARRIER.height, len), color)
        .rotateY(yaw)
        .translate(mid.x, BARRIER.height / 2, mid.z),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(BARRIER.thickness / 2, BARRIER.height / 2, len / 2)
        .setTranslation(mid.x, BARRIER.height / 2, mid.z)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw))
        .setFriction(0.2),
    );
  }
  const barrierMesh = new THREE.Mesh(mergeGeometries(barrierParts), flat);
  barrierMesh.castShadow = true;
  barrierMesh.receiveShadow = true;
  scene.add(barrierMesh);

  // Knock-over props on the skidpad: a cone ring and a box stack in the middle.
  const props: { mesh: THREE.Mesh; body: RAPIER.RigidBody }[] = [];
  const addProp = (mesh: THREE.Mesh, collider: RAPIER.ColliderDesc, x: number, y: number, z: number) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z));
    world.createCollider(collider, body);
    mesh.castShadow = true;
    scene.add(mesh);
    props.push({ mesh, body });
  };
  const coneGeo = new THREE.ConeGeometry(0.2, 0.7, 12);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = SKIDPAD.radius * 0.45 - 1;
    addProp(
      new THREE.Mesh(coneGeo, coneMat),
      RAPIER.ColliderDesc.cone(0.35, 0.2).setDensity(100),
      SKIDPAD.x + Math.sin(a) * r,
      0.35,
      SKIDPAD.z + Math.cos(a) * r,
    );
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xc9a46a });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      addProp(
        new THREE.Mesh(boxGeo, boxMat),
        RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setDensity(60),
        SKIDPAD.x + col - 1,
        0.5 + row,
        SKIDPAD.z,
      );
    }
  }

  return {
    nearest(x, z) {
      let best = samples[0];
      let bestD = Infinity;
      for (const s of samples) {
        const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return { x: best.p.x, z: best.p.z, heading: Math.atan2(best.tangent.x, best.tangent.z) };
    },
    syncProps() {
      for (const { mesh, body } of props) {
        const t = body.translation();
        const r = body.rotation();
        mesh.position.set(t.x, t.y, t.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    },
    lamps: [],
  };
}
