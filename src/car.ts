import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { DriveInput } from './input';
import { lateralGrip } from './tire';
import { CAR_DIMS, WHEEL_LAYOUT, WHEEL_TRAVEL, createCarModel, modelParams, type CarModel } from './carModel';

const DEG = Math.PI / 180;
// Suspension top mount height in chassis space (chassis origin = ground at design ride height).
const HARDPOINT_Y = 0.7;
// Collision box (centre y in chassis space); also used for the inertia estimate.
const BOX = { w: CAR_DIMS.W, h: 0.9, l: CAR_DIMS.L, y: 0.85 };
// How long after a handbrake pull a slide still counts as an intended drift.
const HANDBRAKE_WINDOW = 0.6;
const SPAWN_Y = 1;

export const carParams = {
  mass: 1200,
  comHeight: 0.55,
  yawInertia: 2.14, // multiplier on the box inertia around Y
  extraGravity: 6.3,
  angularDamping: 0.3,
  rollReduce: 0.5, // 0: tire forces at the contact patch, 1: at CoM height (no roll torque)

  restLength: 0.35,
  springK: 38000,
  damperC: 3500,

  frontGrip: 1.15,
  rearGrip: 1.0,
  peakSlipDeg: 8,
  falloffDeg: 13,
  slideGrip: 0.84,
  handbrakeGrip: 0.45,

  engineForce: 8000,
  maxSpeed: 45,
  brakeForce: 12000,
  reverseForce: 4000,
  maxReverse: 10,
  rollResistance: 8,
  handbrakeForce: 4000,

  maxSteerDeg: 35,
  highSpeedSteer: 0.4, // steer limit fraction at steerFalloffSpeed
  steerFalloffSpeed: 30,

  driftAssist: 0.68,
  assistStartDeg: 6,

  // Drift state: entered above driftEnterDeg with intent (handbrake or low-speed power-over),
  // or above driftAutoEnterDeg regardless; left after driftExitTime below driftExitDeg.
  driftEnterDeg: 12,
  driftAutoEnterDeg: 25,
  driftExitDeg: 3,
  driftExitTime: 0.35,
  driftMinSpeed: 5,
  driftGripLift: 1.05, // rear grip multiplier in a drift with no throttle
  driftGripThrottle: 0.9, // ... and at full throttle: throttle holds the angle
  driftMaxDeg: 42, // past this the rear regains grip so the car doesn't spin
  spinGuardGrip: 2.3,
  driftSpeedKeep: 0.2, // fraction of slide drag given back as thrust while on throttle
  driftSteerYaw: 1.5, // rad/s² of yaw from steering input while drifting
  powerOversteer: 0.35, // rear grip lost to full throttle + full steer outside a drift
  powerOversteerMaxSpeed: 20, // m/s; power-over fades out above this, so fast grip corners stay grippy
  highSpeedStability: 0.3, // extra rear grip outside a drift, ramping in over 15 m/s above powerOversteerMaxSpeed

  boostMinTime: 1.2,
  boostDuration: 1,
  boostForce: 7000,
};

export type CarStats = {
  speed: number;
  vLong: number;
  beta: number; // body slip angle, + = sliding toward the car's left
  frontSlip: number;
  rearSlip: number;
  drifting: boolean;
  driftTime: number;
  boosting: boolean;
};

type Wheel = {
  local: THREE.Vector3;
  front: boolean;
  compression: number;
  susp: number;
  steer: number;
  spin: number;
  slip: number;
};

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const up = new THREE.Vector3();
const down = new THREE.Vector3();
const fwd = new THREE.Vector3();
const left = new THREE.Vector3();
const com = new THREE.Vector3();
const hp = new THREE.Vector3();
const contact = new THREE.Vector3();
const point = new THREE.Vector3();
const wFwd = new THREE.Vector3();
const wLeft = new THREE.Vector3();
const velDir = new THREE.Vector3();
const vec = new THREE.Vector3();
const force = new THREE.Vector3();

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

export class Car {
  readonly model: CarModel;
  readonly stats: CarStats = {
    speed: 0,
    vLong: 0,
    beta: 0,
    frontSlip: 0,
    rearSlip: 0,
    drifting: false,
    driftTime: 0,
    boosting: false,
  };
  readonly body: RAPIER.RigidBody;
  private readonly world: RAPIER.World;
  private readonly wheels: Wheel[];
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private readonly prevPos = new THREE.Vector3(0, SPAWN_Y, 0);
  private readonly prevQuat = new THREE.Quaternion();
  private yawInertia = 1;
  private handbrakeWindow = 0;
  private straightTime = 0;
  private boostTime = 0;

  constructor(world: RAPIER.World, scene: THREE.Scene) {
    this.world = world;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(0, SPAWN_Y, 0).setCcdEnabled(true).setCanSleep(false),
    );
    // Density 0: mass and inertia come only from applyParams.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(BOX.w / 2, BOX.h / 2, BOX.l / 2).setTranslation(0, BOX.y, 0).setDensity(0).setFriction(0.3),
      this.body,
    );
    this.wheels = WHEEL_LAYOUT.map(({ x, z, front }) => ({
      local: new THREE.Vector3(x, HARDPOINT_Y, z),
      front,
      compression: 0,
      susp: carParams.restLength,
      steer: 0,
      spin: 0,
      slip: 0,
    }));
    this.model = createCarModel();
    scene.add(this.model.group);
    this.applyParams();
  }

  applyParams() {
    const p = carParams;
    const m = p.mass;
    const { w, h, l } = BOX;
    this.yawInertia = (m / 12) * (w * w + l * l) * p.yawInertia;
    this.body.setAdditionalMassProperties(
      m,
      { x: 0, y: p.comHeight, z: 0 },
      { x: (m / 12) * (h * h + l * l), y: this.yawInertia, z: (m / 12) * (w * w + h * h) },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
    this.body.setAngularDamping(p.angularDamping);
    this.model.paint.color.set(modelParams.paint);
  }

  // Places the car upright at (x, z) facing `heading` (radians, 0 = +Z), at rest.
  place(x: number, z: number, heading: number) {
    quat.setFromAxisAngle(up.set(0, 1, 0), heading);
    this.body.setTranslation({ x, y: SPAWN_Y, z }, true);
    this.body.setRotation(quat, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.prevPos.set(x, SPAWN_Y, z);
    this.prevQuat.copy(quat);
    this.stats.drifting = false;
    this.stats.driftTime = 0;
    this.boostTime = 0;
    for (const w of this.wheels) w.compression = 0;
  }

  // Call once per fixed step, before world.step().
  step(input: DriveInput, dt: number) {
    const p = carParams;
    const body = this.body;
    const stats = this.stats;
    const t = body.translation();
    const r = body.rotation();
    pos.set(t.x, t.y, t.z);
    quat.set(r.x, r.y, r.z, r.w);
    this.prevPos.copy(pos);
    this.prevQuat.copy(quat);

    up.set(0, 1, 0).applyQuaternion(quat);
    down.copy(up).negate();
    fwd.set(0, 0, 1).applyQuaternion(quat);
    left.set(1, 0, 0).applyQuaternion(quat);
    com.copy(up).multiplyScalar(p.comHeight).add(pos);

    const lv = body.linvel();
    vec.set(lv.x, lv.y, lv.z);
    const vLong = vec.dot(fwd);
    const vLeft = vec.dot(left);
    const speed = Math.hypot(vLong, vLeft);
    velDir.copy(fwd).multiplyScalar(vLong).addScaledVector(left, vLeft).divideScalar(Math.max(speed, 1e-3));
    const beta = speed > 1 ? Math.atan2(vLeft, Math.abs(vLong)) : 0;
    const absBeta = Math.abs(beta);

    // Drift state. Entry needs intent so fast grip cornering doesn't fall into it; exit waits
    // driftExitTime so a direction change (angle passing through zero) stays one drift.
    this.handbrakeWindow = input.handbrake ? HANDBRAKE_WINDOW : Math.max(this.handbrakeWindow - dt, 0);
    const powerOver = clamp01((p.powerOversteerMaxSpeed - speed) / 5);
    const wasDrifting = stats.drifting;
    if (vLong <= 0 || speed < p.driftMinSpeed) {
      stats.drifting = false;
    } else if (!stats.drifting) {
      const intent = this.handbrakeWindow > 0 || (input.throttle > 0.5 && powerOver > 0);
      stats.drifting = (intent && absBeta > p.driftEnterDeg * DEG) || absBeta > p.driftAutoEnterDeg * DEG;
      this.straightTime = 0;
    } else if (absBeta < p.driftExitDeg * DEG) {
      this.straightTime += dt;
      if (this.straightTime >= p.driftExitTime) stats.drifting = false;
    } else {
      this.straightTime = 0;
    }

    // Steering: speed-sensitive limit on player input, assist counter-steers toward the travel direction.
    const maxSteer = p.maxSteerDeg * DEG;
    const speedT = Math.min(speed / p.steerFalloffSpeed, 1);
    let steer = input.steer * maxSteer * (1 + (p.highSpeedSteer - 1) * speedT);
    if (vLong > 0) {
      const start = p.assistStartDeg * DEG;
      steer += p.driftAssist * beta * clamp01((absBeta - start) / Math.max(start, DEG));
    }
    steer = Math.min(Math.max(steer, -maxSteer), maxSteer);

    // Rear grip multiplier: throttle loosens the rear in a drift, the spin guard tightens it past the max angle.
    let rearMul: number;
    if (stats.drifting) {
      rearMul = p.driftGripLift + (p.driftGripThrottle - p.driftGripLift) * input.throttle;
      const over = clamp01((absBeta - p.driftMaxDeg * DEG) / (10 * DEG));
      rearMul += (p.spinGuardGrip - rearMul) * over;
    } else {
      rearMul = 1 - p.powerOversteer * input.throttle * Math.abs(input.steer) * clamp01(speed / 10) * powerOver;
      rearMul *= 1 + p.highSpeedStability * clamp01((speed - p.powerOversteerMaxSpeed) / 15);
    }

    let drive = 0;
    let brake = 0;
    if (input.throttle > 0) drive = input.throttle * p.engineForce * Math.max(1 - (vLong / p.maxSpeed) ** 2, 0);
    if (input.brake > 0) {
      if (vLong > 1) brake = input.brake * p.brakeForce;
      else if (vLong > -p.maxReverse) drive -= input.brake * p.reverseForce;
    }

    const wheelMass = p.mass / 4;
    let grounded = 0;
    let frontSlip = 0;
    let rearSlip = 0;
    let slideDrag = 0;
    for (const w of this.wheels) {
      w.steer = w.front ? steer : 0;
      hp.copy(w.local).applyQuaternion(quat).add(pos);
      this.ray.origin = hp;
      this.ray.dir = down;
      const maxLen = p.restLength + CAR_DIMS.wheelR;
      const hit = this.world.castRay(this.ray, maxLen, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
      if (!hit) {
        w.compression = 0;
        w.susp = p.restLength;
        w.slip = 0;
        continue;
      }
      grounded++;
      const dist = hit.timeOfImpact;
      w.susp = Math.max(dist - CAR_DIMS.wheelR, 0);
      const compression = p.restLength - w.susp;
      const load = Math.max(p.springK * compression + (p.damperC * (compression - w.compression)) / dt, 0);
      w.compression = compression;
      contact.copy(down).multiplyScalar(dist).add(hp);
      body.applyImpulseAtPoint(force.copy(up).multiplyScalar(load * dt), contact, true);

      const c = Math.cos(w.steer);
      const s = Math.sin(w.steer);
      wFwd.copy(fwd).multiplyScalar(c).addScaledVector(left, s);
      wLeft.copy(left).multiplyScalar(c).addScaledVector(fwd, -s);
      const pv = body.velocityAtPoint(contact);
      vec.set(pv.x, pv.y, pv.z);
      const vx = vec.dot(wFwd);
      const vy = vec.dot(wLeft);
      w.slip = Math.atan2(Math.abs(vy), Math.abs(vx));
      if (w.front) frontSlip = Math.max(frontSlip, w.slip);
      else rearSlip = Math.max(rearSlip, w.slip);

      const handbrake = !w.front && input.handbrake;
      // A loosened rear also spins up instead of putting full power down, which caps speed gain in a drift.
      const axleGrip = (w.front ? p.frontGrip : p.rearGrip * rearMul) * load;
      const latMaxF = axleGrip * (handbrake ? p.handbrakeGrip : 1);
      // Force that would stop this wheel's share of mass in one step; caps resistive forces so they never overshoot.
      const stopLong = (Math.abs(vx) * wheelMass) / dt;
      const stopLat = (Math.abs(vy) * wheelMass) / dt;

      const fDrive = w.front ? 0 : drive / 2;
      const braking = brake / 4 + (handbrake ? p.handbrakeForce / 2 : 0);
      const resist = Math.abs(vx) * p.rollResistance + braking;
      let fx = fDrive - Math.sign(vx) * Math.min(resist, stopLong);
      fx = Math.min(Math.max(fx, -axleGrip), axleGrip);

      // Friction circle only for braking: trail-braking eats lateral grip, throttle is handled by rearMul.
      const brakeUse = Math.min(braking, axleGrip);
      const latBudget = Math.sqrt(Math.max(latMaxF * latMaxF - brakeUse * brakeUse, 0));
      const curve = lateralGrip(w.slip, p.peakSlipDeg * DEG, p.falloffDeg * DEG, p.slideGrip);
      const fy = -Math.sign(vy) * Math.min(curve * latMaxF, stopLat, latBudget);

      // Raise the application point toward CoM height to tame body roll.
      point.copy(up).multiplyScalar(p.rollReduce * vec.subVectors(com, contact).dot(up)).add(contact);
      force.copy(wFwd).multiplyScalar(fx).addScaledVector(wLeft, fy);
      slideDrag -= wLeft.dot(velDir) * fy;
      body.applyImpulseAtPoint(force.multiplyScalar(dt), point, true);

      w.spin = handbrake ? w.spin : w.spin + (vx * dt) / CAR_DIMS.wheelR;
    }

    body.applyImpulse({ x: 0, y: -p.extraGravity * p.mass * dt, z: 0 }, true);

    if (stats.drifting && grounded >= 2) {
      // Give back part of the speed the sideways tires scrub off, so a held drift doesn't die.
      if (slideDrag > 0) {
        body.applyImpulse(force.copy(velDir).multiplyScalar(slideDrag * p.driftSpeedKeep * input.throttle * dt), true);
      }
      // Steering input nudges the drift angle directly.
      body.applyTorqueImpulse(force.copy(up).multiplyScalar(input.steer * p.driftSteerYaw * this.yawInertia * dt), true);
    }

    if (stats.drifting) {
      stats.driftTime += dt;
    } else if (wasDrifting) {
      if (stats.driftTime >= p.boostMinTime) this.boostTime = p.boostDuration;
      stats.driftTime = 0;
    }
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      if (grounded >= 2) body.applyImpulse(force.copy(fwd).multiplyScalar(p.boostForce * dt), true);
    }

    Object.assign(stats, { speed, vLong, beta, frontSlip, rearSlip, boosting: this.boostTime > 0 });
  }

  // Interpolates between the last two physics states so rendering is smooth at any refresh rate.
  syncVisual(alpha: number) {
    const t = this.body.translation();
    const r = this.body.rotation();
    const g = this.model.group;
    g.position.lerpVectors(this.prevPos, pos.set(t.x, t.y, t.z), alpha);
    g.quaternion.slerpQuaternions(this.prevQuat, quat.set(r.x, r.y, r.z, r.w), alpha);
    this.wheels.forEach((w, i) => {
      const { pivot, spin } = this.model.wheels[i];
      // Clamped so the wheel stays inside its arch.
      pivot.position.y = Math.min(Math.max(HARDPOINT_Y - w.susp, WHEEL_TRAVEL.min), WHEEL_TRAVEL.max);
      pivot.rotation.y = w.steer;
      spin.rotation.x = w.spin;
    });
  }
}
