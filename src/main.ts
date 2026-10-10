import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createDebugOverlay } from './debug';
import { readInput } from './input';
import { Car, carParams } from './car';
import { createChaseCamera } from './chaseCamera';
import { createTrack } from './track';
import { CAMERA_QUERY_GROUPS, createBlock } from './block';
import { createTuning } from './tuning';
import { updateAudio } from './audio';
import { PRESETS, createLighting } from './lighting';
import { createPost } from './post';

const PHYSICS_DT = 1 / 60;
// Caps catch-up steps after a stall (tab switch, breakpoint) so physics doesn't spiral.
const MAX_STEPS_PER_FRAME = 5;
const RAD_TO_DEG = 180 / Math.PI;

await RAPIER.init();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Used only with post off; with post on, the composer renders to targets and tone-maps itself.
renderer.toneMapping = THREE.AgXToneMapping;
// Post runs several passes per frame; the debug overlay should count all of them.
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(12, 8, 12);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false;

const post = createPost(renderer, scene, camera);

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = PHYSICS_DT;

const level = new URLSearchParams(location.search).has('track') ? createTrack(scene, world) : createBlock(scene, world);
const car = new Car(world, scene);
const lighting = createLighting(scene, level.lamps, car.model.group);
const cameraBall = new RAPIER.Ball(1);
const updateChase = createChaseCamera(camera, (from, to, radius) => {
  cameraBall.radius = radius;
  const vel = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  // Dynamic bodies (the car, knock-over props) don't block the view.
  const hit = world.castShape(
    from,
    { x: 0, y: 0, z: 0, w: 1 },
    vel,
    cameraBall,
    0,
    1,
    true,
    RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,
    CAMERA_QUERY_GROUPS,
  );
  return hit ? hit.time_of_impact : 1;
});
function applyTuning() {
  car.applyParams();
  lighting.apply();
  post.apply();
}
const gui = createTuning(applyTuning);
// createTuning loads the saved values; push them into the car, lights and post once.
applyTuning();
gui.addFolder('Render').close().add(renderer, 'toneMappingExposure', 0, 3, 0.01).name('exposure');

// Time of day: picking a preset overwrites the Lighting values (T cycles through them).
const presetNames = Object.keys(PRESETS);
const timeOfDay = gui
  .add({ preset: 'day' }, 'preset', presetNames)
  .name('time of day')
  .onChange((name: string) => {
    lighting.setPreset(name);
    for (const c of gui.controllersRecursive()) c.updateDisplay();
  });
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyT' || e.repeat) return;
  const next = presetNames[(presetNames.indexOf(timeOfDay.getValue()) + 1) % presetNames.length];
  timeOfDay.setValue(next);
});

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
  post.setSize(window.innerWidth, window.innerHeight);
});

let lastTime: number | null = null;
let accumulator = 0;

renderer.setAnimationLoop((time) => {
  const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  const input = readInput(dt);
  if (input.reset) {
    const { x, z } = car.model.group.position;
    const spot = level.nearest(x, z);
    car.place(spot.x, spot.z, spot.heading);
  }

  accumulator = Math.min(accumulator + dt, PHYSICS_DT * MAX_STEPS_PER_FRAME);
  let impact = 0; // strongest hit across this frame's physics steps
  while (accumulator >= PHYSICS_DT) {
    car.step(input, PHYSICS_DT);
    impact = Math.max(impact, car.stats.impact);
    world.step();
    accumulator -= PHYSICS_DT;
  }
  car.syncVisual(accumulator / PHYSICS_DT);
  level.syncProps();
  updateAudio(dt, car.stats, input.throttle, carParams.maxSpeed, impact);

  if (freeCam) controls.update();
  else updateChase(dt, car.model.group, car.stats, impact);

  lighting.follow(car.model.group.position, camera);
  renderer.info.reset();
  post.render(dt);

  const s = car.stats;
  updateDebug(
    dt,
    `\nspeed ${Math.round(s.speed * 3.6)} km/h  gear ${s.gear}\n` +
      `angle ${Math.round(s.beta * RAD_TO_DEG)}°\n` +
      `slip  F ${Math.round(s.frontSlip * RAD_TO_DEG)}° R ${Math.round(s.rearSlip * RAD_TO_DEG)}°\n` +
      `drift ${s.drifting ? s.driftTime.toFixed(1) + 's' : '-'}${s.boosting ? '  BOOST' : ''}`,
  );
});
