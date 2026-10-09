import * as THREE from 'three';
import type { CarStats } from './car';

const DEG = Math.PI / 180;
// Beyond this the "drift" is really a spin; don't swing the camera around with it.
const MAX_DRIFT_YAW = 70 * DEG;

export const cameraParams = {
  distance: 6.5,
  height: 2.4,
  lookHeight: 1.1,
  distPerSpeed: 0.04,
  yawFollow: 5,
  driftYawBlend: 0.5, // 0: look where the car points, 1: look where it travels
  driftLookFollow: 1.5, // how fast the camera eases into the drift angle; low = no snap at drift start
  speedShake: 0.025, // metres of camera shake at top speed
  baseFov: 62,
  fovPerSpeed: 0.35,
  maxFovAdd: 14,
  boostFov: 4,
  fovFollow: 4,
};

const fwd = new THREE.Vector3();
const look = new THREE.Vector3();
// Speed (m/s) where shake starts and where it is full.
const SHAKE_FROM = 20;
const SHAKE_FULL = 42;

function dampAngle(from: number, to: number, rate: number, dt: number): number {
  const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + diff * (1 - Math.exp(-rate * dt));
}

export function createChaseCamera(camera: THREE.PerspectiveCamera) {
  let yaw: number | null = null;
  let driftLook = 0;
  let time = 0;

  return function update(dt: number, target: THREE.Object3D, stats: CarStats) {
    const p = cameraParams;
    fwd.set(0, 0, 1).applyQuaternion(target.quaternion);
    const heading = Math.atan2(fwd.x, fwd.z);
    const drift = stats.vLong > 0 ? Math.min(Math.max(stats.beta, -MAX_DRIFT_YAW), MAX_DRIFT_YAW) : 0;
    driftLook += (drift - driftLook) * (1 - Math.exp(-p.driftLookFollow * dt));
    const targetYaw = heading + p.driftYawBlend * driftLook;
    yaw = yaw === null ? targetYaw : dampAngle(yaw, targetYaw, p.yawFollow, dt);

    const dist = p.distance + stats.speed * p.distPerSpeed;
    camera.position.set(
      target.position.x - Math.sin(yaw) * dist,
      target.position.y + p.height,
      target.position.z - Math.cos(yaw) * dist,
    );
    camera.lookAt(look.copy(target.position).setY(target.position.y + p.lookHeight));

    // Two detuned sines read as road buzz without the jitter of random noise.
    time += dt;
    const shake = p.speedShake * Math.min(Math.max((stats.speed - SHAKE_FROM) / (SHAKE_FULL - SHAKE_FROM), 0), 1);
    camera.position.x += shake * Math.sin(time * 37.1) * Math.cos(time * 23.3);
    camera.position.y += shake * Math.sin(time * 29.7 + 1.3);

    const fov = p.baseFov + Math.min(stats.speed * p.fovPerSpeed, p.maxFovAdd) + (stats.boosting ? p.boostFov : 0);
    camera.fov += (fov - camera.fov) * (1 - Math.exp(-p.fovFollow * dt));
    camera.updateProjectionMatrix();
  };
}
