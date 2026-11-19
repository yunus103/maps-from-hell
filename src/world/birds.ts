import * as THREE from 'three';
import type { CarSample, RoadGraph } from '../game/types';
import { QUALITY } from '../quality';
import { playSfx } from '../sfx';
import { CURB_H, XS } from './district';
import { createInstanced, pigeonGeometry } from './agentMesh';

// Pigeon flocks pecking on junction corners; a car coming past scatters them into the sky. One InstancedMesh.

const FLOCK = 6;
const FLOCK_NODES = [12, 6, 16, 8, 17, 7]; // inner junctions, in the order flocks are added (12 = the centre)
const CORNER_IN = 1.2; // flock centre from both road edges
const SPREAD = 1.0; // pecking radius round the centre
const PECK_WALK = 0.15; // m/s
const SCATTER_RANGE = 12;
const SCATTER_SPEED = 4; // car speed that scares them
const FLY_SPEED = [3, 5];
const FLY_UP = [2.5, 4];
const FLY_LIFT = 1.5; // m/s² climbing
const FLY_TIME = 5; // then gone until respawn
const RESPAWN = 25; // s
const RESPAWN_DIST = 35; // ... and the car at least this far away (out of view)
const FOLDED = 0.45; // instance X scale on the ground (wings folded)
const FLAP_RATE = 26; // rad/s

const GROUND = 0;
const FLY = 1;
const GONE = 2;

type Bird = { x: number; y: number; z: number; vx: number; vy: number; vz: number; heading: number; phase: number };
type Flock = { x: number; z: number; state: number; t: number; birds: Bird[] };

export interface Birds {
  update(dt: number, car: CarSample, live: boolean): void;
  reset(): void;
}

export function createBirds(scene: THREE.Scene, graph: RoadGraph, material: THREE.Material): Birds {
  const flockCount = Math.min(Math.floor(QUALITY.birds / FLOCK), FLOCK_NODES.length);
  const mesh = createInstanced(pigeonGeometry(), material, flockCount * FLOCK, false);
  scene.add(mesh);

  // Fixed junction corners; the corner opposite the junction's lamp post (block.ts rotates those).
  const flocks: Flock[] = [];
  for (let f = 0; f < flockCount; f++) {
    const id = FLOCK_NODES[f];
    const nd = graph.nodes[id];
    const [i, j] = [id % XS.length, Math.floor(id / XS.length)];
    const q = (i + 2 * j) % 4;
    const [sx, sz] = [q < 2 ? -1 : 1, q % 2 ? -1 : 1];
    const birds: Bird[] = [];
    for (let b = 0; b < FLOCK; b++) birds.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, phase: 0 });
    flocks.push({ x: nd.x + sx * (nd.halfX + CORNER_IN), z: nd.z + sz * (nd.halfZ + CORNER_IN), state: GROUND, t: 0, birds });
  }

  function land(f: Flock) {
    f.state = GROUND;
    f.t = 0;
    for (const b of f.birds) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * SPREAD;
      b.x = f.x + Math.cos(a) * r;
      b.z = f.z + Math.sin(a) * r;
      b.y = CURB_H;
      b.heading = Math.random() * Math.PI * 2;
      b.phase = Math.random() * 6;
    }
  }
  flocks.forEach(land);

  const m = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const scale = new THREE.Vector3(1, 1, 1);

  function step(f: Flock, k: number, dt: number, car: CarSample, live: boolean) {
    f.t += dt;
    const cd = Math.hypot(car.x - f.x, car.z - f.z);
    if (f.state === GROUND && car.speed > SCATTER_SPEED && cd < SCATTER_RANGE) {
      f.state = FLY;
      f.t = 0;
      for (const b of f.birds) {
        let dx = b.x - car.x + (Math.random() - 0.5) * 3;
        let dz = b.z - car.z + (Math.random() - 0.5) * 3;
        const l = Math.hypot(dx, dz) || 1;
        const v = FLY_SPEED[0] + Math.random() * (FLY_SPEED[1] - FLY_SPEED[0]);
        dx /= l;
        dz /= l;
        b.vx = dx * v;
        b.vz = dz * v;
        b.vy = FLY_UP[0] + Math.random() * (FLY_UP[1] - FLY_UP[0]);
        b.heading = Math.atan2(dx, dz);
      }
      if (live) playSfx('pigeons', Math.max(0.3, 1 - cd / SCATTER_RANGE));
    } else if (f.state === FLY && f.t > FLY_TIME) {
      f.state = GONE;
      f.t = 0;
    } else if (f.state === GONE && f.t > RESPAWN && cd > RESPAWN_DIST) {
      land(f);
    }

    for (let n = 0; n < FLOCK; n++) {
      const b = f.birds[n];
      const slot = k * FLOCK + n;
      if (f.state === GONE) {
        mesh.setMatrixAt(slot, hidden);
        continue;
      }
      let pitch = 0;
      if (f.state === GROUND) {
        b.phase += dt * 6;
        b.heading += Math.sin(b.phase * 0.37) * dt; // meander
        b.x += Math.sin(b.heading) * PECK_WALK * dt;
        b.z += Math.cos(b.heading) * PECK_WALK * dt;
        if (Math.hypot(b.x - f.x, b.z - f.z) > SPREAD) b.heading = Math.atan2(f.x - b.x, f.z - b.z);
        pitch = Math.max(0, Math.sin(b.phase)) * 0.6; // pecking
        scale.x = FOLDED;
      } else {
        b.vy += FLY_LIFT * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.phase += dt * FLAP_RATE;
        pitch = -0.25;
        scale.x = 0.7 + 0.5 * Math.sin(b.phase);
      }
      euler.set(pitch, b.heading, 0);
      quat.setFromEuler(euler);
      pos.set(b.x, b.y, b.z);
      mesh.setMatrixAt(slot, m.compose(pos, quat, scale));
    }
  }

  return {
    update(dt, car, live) {
      for (let k = 0; k < flocks.length; k++) step(flocks[k], k, dt, car, live);
      mesh.instanceMatrix.needsUpdate = true;
    },
    reset() {
      flocks.forEach(land);
    },
  };
}
