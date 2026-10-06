import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createDebugOverlay } from './debug';
import { readInput } from './input';
import { Car, carParams } from './car';
import { createChaseCamera } from './chaseCamera';
import { createTrack } from './track';
import { createTuning } from './tuning';
import { updateAudio } from './audio';

const PHYSICS_DT = 1 / 60;
// Caps catch-up steps after a stall (tab switch, breakpoint) so physics doesn't spiral.
const MAX_STEPS_PER_FRAME = 5;
const SUN_OFFSET = new THREE.Vector3(20, 30, 10);
const SHADOW_EXTENT = 30;
const SHADOW_MAP_SIZE = 2048;
const RAD_TO_DEG = 180 / Math.PI;

await RAPIER.init();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e4);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(12, 8, 12);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x6b5a48, 1.0));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -SHADOW_EXTENT, right: SHADOW_EXTENT, top: SHADOW_EXTENT, bottom: -SHADOW_EXTENT });
scene.add(sun, sun.target);

// The shadow box follows the car in whole shadow-map texels; sub-texel moves make shadow edges crawl.
const sunRotation = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
const sunRotationInv = sunRotation.clone().transpose();
const shadowTexel = (SHADOW_EXTENT * 2) / SHADOW_MAP_SIZE;
const sunFocus = new THREE.Vector3();
function followSun(target: THREE.Vector3) {
  sunFocus.copy(target).applyMatrix4(sunRotationInv);
  sunFocus.x = Math.round(sunFocus.x / shadowTexel) * shadowTexel;
  sunFocus.y = Math.round(sunFocus.y / shadowTexel) * shadowTexel;
  sunFocus.applyMatrix4(sunRotation);
  sun.target.position.copy(sunFocus);
  sun.position.copy(sunFocus).add(SUN_OFFSET);
}

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = PHYSICS_DT;

const track = createTrack(scene, world);
const car = new Car(world, scene);
const updateChase = createChaseCamera(camera);
const gui = createTuning(() => car.applyParams());
gui.addFolder('Render').close().add(renderer, 'toneMappingExposure', 0, 3, 0.01).name('exposure');

const updateDebug = createDebugOverlay(renderer);

let freeCam = false;
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyC' || e.repeat) return;
  freeCam = !freeCam;
  controls.enabled = freeCam;
  if (freeCam) controls.target.copy(car.model.group.position);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastTime: number | null = null;
let accumulator = 0;

renderer.setAnimationLoop((time) => {
  const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  const input = readInput(dt);
  if (input.reset) {
    const { x, z } = car.model.group.position;
    const spot = track.nearest(x, z);
    car.place(spot.x, spot.z, spot.heading);
  }

  accumulator = Math.min(accumulator + dt, PHYSICS_DT * MAX_STEPS_PER_FRAME);
  while (accumulator >= PHYSICS_DT) {
    car.step(input, PHYSICS_DT);
    world.step();
    accumulator -= PHYSICS_DT;
  }
  car.syncVisual(accumulator / PHYSICS_DT);
  track.syncProps();
  followSun(car.model.group.position);
  updateAudio(dt, car.stats, input.throttle, carParams.maxSpeed);

  if (freeCam) controls.update();
  else updateChase(dt, car.model.group, car.stats);

  renderer.render(scene, camera);

  const s = car.stats;
  updateDebug(
    dt,
    `\nspeed ${Math.round(s.speed * 3.6)} km/h\n` +
      `angle ${Math.round(s.beta * RAD_TO_DEG)}°\n` +
      `slip  F ${Math.round(s.frontSlip * RAD_TO_DEG)}° R ${Math.round(s.rearSlip * RAD_TO_DEG)}°\n` +
      `drift ${s.drifting ? s.driftTime.toFixed(1) + 's' : '-'}${s.boosting ? '  BOOST' : ''}`,
  );
});
