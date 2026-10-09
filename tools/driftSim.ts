// Headless handling benchmark: drives the real Car on a flat plane with scripted inputs and prints metrics.
// Numbers are a sanity floor for tuning, not a substitute for driving it.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Car, carParams } from '../src/car';
import type { DriveInput } from '../src/input';

const DT = 1 / 60;
const DEG = 180 / Math.PI;
const KMH = 3.6;

type Rig = { world: RAPIER.World; car: Car; time: number };

function rig(): Rig {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = DT;
  world.createCollider(RAPIER.ColliderDesc.cuboid(5000, 0.1, 5000).setTranslation(0, -0.1, 0));
  const car = new Car(world, new THREE.Scene());
  const r = { world, car, time: 0 };
  tick(r, idle(), 1); // settle on the springs
  return r;
}

function idle(): DriveInput {
  return { steer: 0, throttle: 0, brake: 0, handbrake: false, reset: false };
}

function tick(r: Rig, input: DriveInput, seconds: number, each?: () => void) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    r.car.step(input, DT);
    r.world.step();
    r.time += DT;
    each?.();
  }
}

function tiltDeg(car: Car): number {
  const q = car.body.rotation();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  return Math.acos(Math.min(up.y, 1)) * DEG;
}

// Holds a target speed on a straight with bang-bang throttle.
function reachSpeed(r: Rig, kmh: number) {
  const input = idle();
  for (let i = 0; i < 60 * 30 && r.car.stats.speed * KMH < kmh; i++) {
    input.throttle = 1;
    tick(r, input, DT);
  }
}

function accel() {
  const r = rig();
  let t50 = NaN;
  let t100 = NaN;
  let top = 0;
  tick(r, { ...idle(), throttle: 1 }, 40, () => {
    const kmh = r.car.stats.speed * KMH;
    if (isNaN(t50) && kmh >= 50) t50 = r.time - 1;
    if (isNaN(t100) && kmh >= 100) t100 = r.time - 1;
    top = Math.max(top, kmh);
  });
  return { '0-50 s': t50.toFixed(1), '0-100 s': t100.toFixed(1), 'top km/h': top.toFixed(0) };
}

function corner(kmh: number, throttle: number) {
  const r = rig();
  reachSpeed(r, kmh);
  let maxBeta = 0;
  let maxTilt = 0;
  let drifted = false;
  let spun = false;
  tick(r, { ...idle(), steer: 1, throttle }, 4, () => {
    const s = r.car.stats;
    maxBeta = Math.max(maxBeta, Math.abs(s.beta) * DEG);
    maxTilt = Math.max(maxTilt, tiltDeg(r.car));
    drifted ||= s.drifting;
    spun ||= Math.abs(s.beta) * DEG > 100 || s.vLong < 0;
  });
  return { kmh, throttle, 'max angle°': maxBeta.toFixed(1), 'max tilt°': maxTilt.toFixed(1), drifted, spun };
}

type Throttle = 'full' | 'feather' | 'none';
type DriftOpts = {
  entryKmh: number;
  target: number;
  throttle: Throttle;
  steer: 'driver' | 'hands-off';
  liftAfter?: number; // seconds into the hold: throttle and steer to zero
  switchAfter?: number; // seconds into the hold: flick into a drift the other way
};

// Handbrake entry into a left drift, then a simple driver holds `target` degrees of angle.
function drift(o: DriftOpts) {
  const r = rig();
  reachSpeed(r, o.entryKmh);
  const s = r.car.stats;
  // Hold the handbrake until the drift starts, like a player would.
  const entry = { ...idle(), steer: 1, throttle: 1, handbrake: true };
  for (let i = 0; i < 90 && !s.drifting; i++) tick(r, entry, DT);

  const input = idle();
  const startSpeed = s.speed * KMH;
  let dir = 1; // +1: left drift (car slides right, beta < 0)
  let held = 0;
  let sumAngle = 0;
  let maxAngle = 0;
  let spun = false;
  let recoverS = NaN;
  let switchedAngle = 0;
  for (let i = 0; i < 60 * 15; i++) {
    const t = i * DT;
    const angle = -dir * s.beta * DEG; // positive when sliding the intended way
    const lifted = o.liftAfter !== undefined && t >= o.liftAfter;
    const flicking = o.switchAfter !== undefined && t >= o.switchAfter && t < o.switchAfter + 0.35;
    if (o.switchAfter !== undefined && t >= o.switchAfter) dir = -1;
    const driver = Math.max(-1, Math.min(1, -(angle - o.target) / 15));
    input.steer = flicking ? -1 : o.steer === 'driver' ? dir * driver : 0;
    input.throttle = o.throttle === 'full' ? 1 : o.throttle === 'none' ? 0 : angle < o.target ? 1 : 0.4;
    if (lifted) {
      input.throttle = 0;
      input.steer = 0;
    }
    tick(r, input, DT);
    spun ||= Math.abs(s.beta) * DEG > 100 || s.vLong < 0;
    if (lifted) {
      if (isNaN(recoverS) && !s.drifting) recoverS = t - o.liftAfter!;
      continue;
    }
    if (!s.drifting) break;
    held = t + DT;
    sumAngle += Math.abs(angle);
    maxAngle = Math.max(maxAngle, Math.abs(angle));
    if (dir === -1) switchedAngle = Math.max(switchedAngle, angle);
  }
  const frames = Math.max(Math.round(held / DT), 1);
  return {
    entry: o.entryKmh,
    target: o.target,
    throttle: o.throttle,
    steer: o.steer,
    'held s': held.toFixed(1),
    'avg°': (sumAngle / frames).toFixed(0),
    'max°': maxAngle.toFixed(0),
    'speed in→out': `${startSpeed.toFixed(0)}→${(s.speed * KMH).toFixed(0)}`,
    ...(o.liftAfter !== undefined ? { 'recover s': isNaN(recoverS) ? 'never' : recoverS.toFixed(2) } : {}),
    ...(o.switchAfter !== undefined ? { 'other-way max°': switchedAngle.toFixed(0) } : {}),
    spun,
  };
}

export async function run(overrides: Record<string, number>) {
  await RAPIER.init();
  Object.assign(carParams, overrides);

  console.log('\n# Straight line');
  console.table([accel()]);

  console.log('\n# Full lock, no handbrake (4 s). Fast corners must not drift.');
  console.table([corner(60, 0.3), corner(60, 1), corner(100, 1), corner(130, 1)]);

  const base = { entryKmh: 60, target: 30, throttle: 'full', steer: 'driver' } as const;
  console.log('\n# Handbrake entry, then hold (15 s cap)');
  console.table([
    drift(base),
    drift({ ...base, throttle: 'feather' }),
    drift({ ...base, entryKmh: 80, target: 40 }),
    drift({ ...base, entryKmh: 110, target: 30 }),
    drift({ ...base, steer: 'hands-off' }),
    drift({ ...base, throttle: 'none' }),
  ]);

  console.log('\n# Lift off after 4 s / switch direction after 3 s (held s counts the whole chain)');
  console.table([drift({ ...base, liftAfter: 4 }), drift({ ...base, switchAfter: 3 })]);
}
