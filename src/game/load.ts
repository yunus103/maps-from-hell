// Heavy-package handling: extra forces along the car's forward axis after car.step() and before world.step().
// Car code, tuning and saved params stay untouched. Every force ramps to 0 while drifting so drifts feel the same,
// and the per-step Δv stays far below IMPACT_MIN so the car never reads it as a collision.
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { carParams, type CarStats } from '../car';
import { CAR_DIMS } from '../carModel';
import type { DriveInput } from '../input';
import type { PackageKind } from './types';

const HEAVY_DRAG = 900; // N × throttle, against forward motion (slower acceleration)
const HEAVY_BRAKE_PUSH = 0.18; // × carParams.brakeForce × brake, pushing forward (longer stops)
const BRAKE_PUSH_MIN_V = 1; // m/s; below this the brake input is reverse
const HEAVY_MAX_SPEED = 30; // m/s soft top speed
const HEAVY_TOP_DRAG = 1500; // N above it
const RAMP_TIME = 0.4; // s for the forces to fade out (drift, unload) or back in
// Roof crate
const CRATE = { w: 1.25, h: 0.5, d: 1.0 };
const ROOF_Y = CAR_DIMS.wheelR * 0.9 + CAR_DIMS.H + CAR_DIMS.cabH + 0.06;
const WOBBLE_MIN_IMPACT = 2.5;
const WOBBLE_KICK = 0.12; // rad/s per m/s of impact
const WOBBLE_K = 160; // spring
const WOBBLE_D = 7; // damping

export interface Load {
  setLoad(kind: PackageKind | null): void;
  step(body: RAPIER.RigidBody, stats: CarStats, input: DriveInput, dt: number): void;
  update(dt: number, impact: number): void;
}

function crateMesh(): THREE.Mesh {
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, color: number) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const { w, h, d } = CRATE;
  const geo = mergeGeometries([
    part(0.06, 0.05, d + 0.3, w / 2 - 0.1, -0.05, 0, 0x2a2a30), // roof rails
    part(0.06, 0.05, d + 0.3, -w / 2 + 0.1, -0.05, 0, 0x2a2a30),
    part(w, h, d, 0, 0, 0, 0xb5823f), // crate
    part(w - 0.08, 0.04, d + 0.02, 0, h * 0.5, 0, 0x8a5e2a), // plank line
    part(w + 0.03, h + 0.03, 0.09, 0, -0.015, d * 0.25, 0xd9702e), // orange straps
    part(w + 0.03, h + 0.03, 0.09, 0, -0.015, -d * 0.25, 0xd9702e),
  ]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));
  mesh.castShadow = true;
  return mesh;
}

export function createLoad(carGroup: THREE.Object3D): Load {
  const crate = crateMesh();
  const pivot = new THREE.Group(); // rotates about the crate's base so it rocks on the roof
  pivot.position.set(0, ROOF_Y, CAR_DIMS.cabZ);
  pivot.add(crate);
  pivot.visible = false;
  carGroup.add(pivot);

  const q = new THREE.Quaternion();
  const fwd = new THREE.Vector3();
  const impulse = { x: 0, y: 0, z: 0 };
  let heavy = false;
  let ramp = 0;
  let roll = 0;
  let rollV = 0;
  let pitch = 0;
  let pitchV = 0;

  function setLoad(kind: PackageKind | null) {
    heavy = kind === 'heavy';
    pivot.visible = heavy;
    if (!heavy) roll = rollV = pitch = pitchV = 0;
  }

  function step(body: RAPIER.RigidBody, stats: CarStats, input: DriveInput, dt: number) {
    const target = heavy && !stats.drifting ? 1 : 0;
    ramp = target > ramp ? Math.min(target, ramp + dt / RAMP_TIME) : Math.max(target, ramp - dt / RAMP_TIME);
    if (ramp <= 0) return;

    const v = stats.vLong;
    let f = 0; // N, + = forward
    if (v > 0) f -= HEAVY_DRAG * input.throttle;
    if (v > BRAKE_PUSH_MIN_V) f += HEAVY_BRAKE_PUSH * carParams.brakeForce * input.brake;
    if (v > HEAVY_MAX_SPEED) f -= HEAVY_TOP_DRAG;
    if (f === 0) return;

    // Horizontal forward only: no lateral component, no downforce/lift on slopes or ramps.
    const r = body.rotation();
    fwd.set(0, 0, 1).applyQuaternion(q.set(r.x, r.y, r.z, r.w));
    fwd.y = 0;
    const len = fwd.length();
    if (len < 0.5) return; // nose straight up/down (tumbling): leave it alone
    const j = (f * ramp * dt) / len;
    impulse.x = fwd.x * j;
    impulse.z = fwd.z * j;
    body.applyImpulse(impulse, true);
  }

  function update(dt: number, impact: number) {
    if (!heavy) return;
    if (impact >= WOBBLE_MIN_IMPACT) {
      const kick = impact * WOBBLE_KICK;
      rollV += (Math.random() < 0.5 ? -1 : 1) * kick;
      pitchV += (Math.random() * 2 - 1) * kick;
    }
    const h = Math.min(dt, 1 / 30); // keep the spring stable on long frames
    rollV += (-WOBBLE_K * roll - WOBBLE_D * rollV) * h;
    pitchV += (-WOBBLE_K * pitch - WOBBLE_D * pitchV) * h;
    roll += rollV * h;
    pitch += pitchV * h;
    pivot.rotation.set(pitch, 0, roll);
  }

  return { setLoad, step, update };
}
