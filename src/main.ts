import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { createDebugOverlay } from './debug';
import { readInput } from './input';
import { Car, carParams } from './car';
import { createChaseCamera } from './chaseCamera';
import { createTrack, type Track } from './track';
import { CAMERA_QUERY_GROUPS, createBlock } from './block';
import { createTuning } from './tuning';
import { setAudioPaused, updateAudio } from './audio';
import { PRESETS, createLighting } from './lighting';
import { createPost } from './post';
import { MOBILE, QUALITY } from './quality';
import type { CarSample, CityEvent, GamePhase, LineId, RoadGraph, ScreenActions } from './game/types';
import { getLang, onLangChange, setLang } from './game/lang';
import { createVoice } from './game/voice';
import { createNavigator } from './game/navigator';
import { createShift, needsFtue } from './game/shift';
import { createDamage } from './game/damage';
import { createMarkers } from './game/markers';
import { createHud } from './ui/hud';
import { createScreens } from './ui/screens';
import { createTouchControls, isTouch } from './ui/touch';
import { createFullscreenButton, createStartGate } from './ui/fullscreen';
import { createCity } from './world/city';
import { createDriftScore } from './game/drift';
import { createMechanic } from './game/mechanic';
import { createPackageFx } from './game/packageFx';
import { createPassengers } from './game/passengers';
import { createLoad } from './game/load';
import { showRewardedAd } from './game/ads';
import { createDriftMeter } from './ui/driftMeter';
import { createPassengerCard } from './ui/passengerCard';
import { createMechanicPrompt } from './ui/mechanicPrompt';

const PHYSICS_DT = 1 / 60;
// Caps catch-up steps after a stall (tab switch, breakpoint) so physics doesn't spiral.
const MAX_STEPS_PER_FRAME = 5;
const RAD_TO_DEG = 180 / Math.PI;
const params = new URLSearchParams(location.search);
const DEV = params.has('dev');
const DRIVE_PHASES: GamePhase[] = ['ftue', 'driving', 'free'];
// Phases whose lighting follows the shift clock; the others keep the lil-gui preset.
const CLOCK_PHASES: GamePhase[] = ['ftue', 'board', 'driving', 'update', 'continue'];
const NO_CITY_EVENTS: CityEvent[] = [];
const CRASH_LINES: LineId[] = ['re_crash_1', 're_crash_2', 're_crash_3'];
const CRASH_LINE_COOLDOWN = 8; // s; also starts on a fake-road hit, which has its own line
const CRASH_LINE_TTL = 4; // s a crash line may wait out nav lines
const CONTINUE_GRACE = 3; // s without damage after a continue puts the car back on the road
const FAKE_HIT_DAMAGE_MUL = 0.5;
const FAKE_HIT_DAMAGE_MAX = 8; // hp
// Resolution fallback: averaging slower than this (~45 fps) over the window drops the pixel ratio one step.
const SLOW_FRAME = 0.022; // s
const SLOW_WINDOW = 2; // s

await RAPIER.init();

// Post renders into its own targets and applies SMAA; canvas MSAA only matters with post off, so phones skip its memory.
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE });
let pixelRatioStep = 0;
const applyPixelRatio = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY.pixelRatios[pixelRatioStep]));
applyPixelRatio();
renderer.setSize(window.innerWidth, window.innerHeight);
// Used only with post off; with post on, the composer renders to targets and tone-maps itself.
renderer.toneMapping = THREE.AgXToneMapping;
// Post runs several passes per frame; the debug overlay should count all of them.
renderer.info.autoReset = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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

const level: Track & { graph?: RoadGraph } = params.has('track') ? createTrack(scene, world) : createBlock(scene, world);
// The ?track test loop has no road graph: free drive only, no game layer.
const graph = level.graph ?? null;
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
  // During a shift the clock owns the lighting.
  if (e.code !== 'KeyT' || e.repeat || (game && game.shift.state.phase !== 'free')) return;
  const next = presetNames[(presetNames.indexOf(timeOfDay.getValue()) + 1) % presetNames.length];
  timeOfDay.setValue(next);
});

const debug = createDebugOverlay(renderer);
let devVisible = DEV;
function showDev(v: boolean) {
  devVisible = v;
  debug.setVisible(v);
  gui.show(v);
}
showDev(DEV);
addEventListener('keydown', (e) => {
  if (e.code !== 'F3' || e.repeat) return;
  e.preventDefault();
  showDev(!devVisible);
});

let freeCam = false;
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyC' || e.repeat) return;
  freeCam = !freeCam;
  controls.enabled = freeCam;
  if (freeCam) controls.target.copy(car.model.group.position);
});

document.documentElement.lang = getLang();
onLangChange((l) => (document.documentElement.lang = l));

window.addEventListener('resize', () => {
  // A hidden or collapsed pane reports 0×0; zero-size render targets flood the console with GL errors.
  if (window.innerWidth === 0 || window.innerHeight === 0) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

// Only steps down: stepping back up would oscillate around the threshold.
let frameTime = 0;
let frameCount = 0;
function watchFrameRate(dt: number) {
  // Stalls (tab switch, loading) aren't a slow GPU. Desktop has a single step, so this never fires there.
  if (dt > 0.25 || pixelRatioStep === QUALITY.pixelRatios.length - 1) return;
  frameTime += dt;
  frameCount++;
  if (frameTime < SLOW_WINDOW) return;
  if (frameTime / frameCount > SLOW_FRAME) {
    pixelRatioStep++;
    applyPixelRatio();
    post.setSize(window.innerWidth, window.innerHeight);
  }
  frameTime = 0;
  frameCount = 0;
}

function createGame(graph: RoadGraph) {
  const uiRoot = document.getElementById('ui')!;
  const voice = createVoice();
  const nav = createNavigator(graph, voice);
  const shift = createShift(graph, voice);
  const damage = createDamage(scene, car.model.group, car.model.paint);
  const markers = createMarkers(scene, camera);
  const city = createCity(scene, world, graph);
  const drift = createDriftScore(graph, voice);
  const mechanic = createMechanic(scene, graph, voice, shift);
  const pkgFx = createPackageFx(voice);
  const passengers = createPassengers(scene, graph, voice, shift);
  const load = createLoad(car.model.group);
  const actions: ScreenActions = {
    startShift: () => {
      voice.stop();
      nav.reset();
      shift.startShift();
    },
    // Only reachable from the title, where the one line that can still be playing is ftue_hired: let it finish.
    freeDrive: () => {
      shift.startFree();
    },
    pickOffer: (i) => shift.pickOffer(i),
    pickUpdate: (i) => shift.pickUpdate(i),
    continueShift: () => void showRewardedAd().then((ok) => ok && shift.acceptContinue()),
    declineContinue: () => shift.declineContinue(),
    resume: () => shift.setPaused(false),
    quitToTitle: () => {
      voice.stop();
      shift.toTitle();
    },
    setLang,
  };
  // The HUD goes in first so the screens layer sits on top of it.
  const hud = createHud(uiRoot);
  const driftMeter = createDriftMeter(uiRoot);
  const passengerCard = createPassengerCard(uiRoot);
  const mechPrompt = createMechanicPrompt(uiRoot);
  const screens = createScreens(uiRoot, actions);
  nav.reset();
  return {
    voice, nav, shift, damage, markers, city, drift, mechanic, pkgFx, passengers, load,
    hud, driftMeter, passengerCard, mechPrompt, screens,
  };
}
const game = graph ? createGame(graph) : null;
const touchUi = createTouchControls(document.getElementById('ui')!, () => game?.shift.setPaused(true));
createFullscreenButton(touchUi.corner);
if (game) {
  const start = () => (needsFtue() ? game.shift.startFtue() : game.shift.toTitle());
  if (isTouch()) createStartGate(document.getElementById('ui')!, start);
  else start();
}

// Esc/P toggle pause; Enter/Q on the pause screen and every menu key belong to the screens module.
addEventListener('keydown', (e) => {
  if (!game || e.repeat || (e.code !== 'Escape' && e.code !== 'KeyP')) return;
  const phase = game.shift.state.phase;
  if (phase === 'paused') game.shift.setPaused(false);
  else if (DRIVE_PHASES.includes(phase)) game.shift.setPaused(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game) game.shift.setPaused(true);
});

if (DEV) Object.assign(window, { __mfh: { game, car, renderer, graph, lighting, post, scene } });

const fwd = new THREE.Vector3();
function sampleCar(impact: number): CarSample {
  const g = car.model.group;
  const v = car.body.linvel();
  const s = car.stats;
  fwd.set(0, 0, 1).applyQuaternion(g.quaternion);
  return {
    x: g.position.x,
    z: g.position.z,
    vx: v.x,
    vz: v.z,
    heading: Math.atan2(fwd.x, fwd.z),
    speed: s.speed,
    impact,
    drifting: s.drifting,
    beta: s.beta,
    driftTime: s.driftTime,
  };
}

let lastTime: number | null = null;
let accumulator = 0;
let clockLit = false; // lightParams currently come from the shift clock, not the preset
let crashLineCooldown = 0;
let crashLineIndex = 0;
let damageGrace = 0;

// R reset and continue: the nearest road point, facing along the road.
function resetToRoad() {
  const { x, z } = car.model.group.position;
  const spot = level.nearest(x, z);
  // nearest() only knows the road axis: keep whichever of its two directions the car was facing.
  fwd.set(0, 0, 1).applyQuaternion(car.model.group.quaternion);
  const flip = fwd.x * Math.sin(spot.heading) + fwd.z * Math.cos(spot.heading) < 0;
  car.place(spot.x, spot.z, spot.heading + (flip ? Math.PI : 0));
  game?.nav.relocate();
}

function onPhase(phase: GamePhase) {
  setAudioPaused(!DRIVE_PHASES.includes(phase));
  // Voice keeps talking over menus (board/update/end lines); only the pause screen silences it.
  game!.voice.setPaused(phase === 'paused');
  if ((phase === 'title' || phase === 'free') && clockLit) {
    clockLit = false;
    lighting.setPreset(timeOfDay.getValue());
  }
}

// FTUE teaches the route without traffic; everything else follows the shift's Live Traffic modifier.
function syncDensity() {
  const { shift, city } = game!;
  city.setDensity(shift.state.phase === 'ftue' ? 0 : shift.state.mods.trafficMul);
}

// Everything after physics: city, damage, navigator, drift, passengers, package feedback, mechanic, shift, and
// routing of shift events to their consumers.
function updateGame(dt: number, impact: number) {
  if (!game) return;
  const { voice, nav, shift, damage, markers, city, drift, mechanic, pkgFx, passengers, load } = game;
  const { hud, driftMeter, passengerCard, mechPrompt, screens } = game;
  const sample = sampleCar(impact);
  const phase = shift.state.phase;
  const live = DRIVE_PHASES.includes(phase);
  // The city keeps moving behind menus; it freezes with the pause screen and has nothing to show on the title.
  const cityEvents = phase === 'paused' || phase === 'title' ? NO_CITY_EVENTS : city.update(dt, sample, live);
  crashLineCooldown -= dt;
  if (live) {
    let lost = damage.update(dt, impact, shift.state.health);
    damageGrace -= dt;
    if (damageGrace > 0) lost = 0;
    let fakeHit = false;
    for (const e of nav.update(dt, sample)) {
      if (e.type === 'fakeRoadHit') fakeHit = true;
      shift.onNavEvent(e);
      drift.onNavEvent(e);
      passengers.onNavEvent(e);
      hud.event(e);
    }
    // Obeying a lie into a fake road is the joke, not a punishment.
    if (fakeHit) lost = Math.min(lost * FAKE_HIT_DAMAGE_MUL, FAKE_HIT_DAMAGE_MAX);
    shift.applyDamage(lost);
    if (fakeHit) crashLineCooldown = CRASH_LINE_COOLDOWN;
    else if (lost > 0 && shift.state.phase === 'driving') {
      hud.hit(lost);
      if (crashLineCooldown <= 0) {
        crashLineCooldown = CRASH_LINE_COOLDOWN;
        voice.say(CRASH_LINES[crashLineIndex], { ttl: CRASH_LINE_TTL });
        crashLineIndex = (crashLineIndex + 1) % CRASH_LINES.length;
      }
    }
  } else {
    damage.update(dt, 0, shift.state.health);
  }
  for (const e of cityEvents) {
    drift.onCityEvent(e);
    if (e.type === 'pedHit') shift.penalty('pedestrian'); // shift ignores it outside 'driving'
  }
  for (const e of drift.update(dt, sample, shift.state)) {
    driftMeter.event(e);
    if (e.type === 'driftBank') shift.addDrift(e.total, e.chain);
  }
  passengers.update(dt, sample, shift.state);
  for (const fx of pkgFx.update(dt, sample, shift.state)) hud.event(fx);
  for (const fx of mechanic.update(dt, sample, shift.state)) hud.event(fx);
  load.update(dt, impact);
  shift.update(dt, sample);
  for (const e of shift.drain()) {
    hud.event(e);
    drift.onShiftEvent(e);
    passengers.onShiftEvent(e);
    for (const fx of pkgFx.onShiftEvent(e, shift.state)) hud.event(fx);
    switch (e.type) {
      case 'target':
        nav.setTarget(e.place, e.kind);
        markers.set(e.place, e.kind);
        break;
      case 'navScript':
        nav.setScript(e.script);
        break;
      case 'mods':
        nav.setModifiers(e.mods);
        voice.setModifiers(e.mods);
        syncDensity();
        break;
      case 'difficulty':
        nav.setDifficulty(e.level);
        break;
      case 'placeCar':
        car.place(e.spawn.x, e.spawn.z, e.spawn.heading);
        damage.reset();
        load.setLoad(null);
        drift.reset();
        passengers.reset();
        city.reset(e.spawn.x, e.spawn.z);
        accumulator = 0;
        break;
      case 'respawn':
        resetToRoad();
        city.reset(car.model.group.position.x, car.model.group.position.z); // clear the wreck's neighbours
        damageGrace = CONTINUE_GRACE;
        accumulator = 0;
        break;
      case 'pickedUp':
        load.setLoad(shift.state.order?.offer.package ?? null);
        break;
      case 'delivered':
      case 'cancelled':
        load.setLoad(null);
        break;
      case 'phase':
        onPhase(e.phase);
        syncDensity();
        break;
    }
  }
  voice.update(dt);
  markers.update(dt);
  const after = shift.state.phase;
  if (CLOCK_PHASES.includes(after)) {
    clockLit = true;
    lighting.setTimeOfDay(shift.state.clock01);
  }
  hud.update({ nav: nav.view(), subtitle: voice.current(), shift: shift.state, speedKmh: car.stats.speed * 3.6 });
  driftMeter.update(drift.view(), after);
  passengerCard.update(passengers.view(), after);
  mechPrompt.update(mechanic.view(), after);
  screens.render(shift.state);
}

renderer.setAnimationLoop((time) => {
  const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  // A phone held upright can't be driven; setPaused is a no-op outside the drive phases.
  if (game && touchUi.isPortrait()) game.shift.setPaused(true);
  const input = readInput(dt);
  // Menus and pause freeze the car: no physics steps, no reset.
  const simulate = !game || DRIVE_PHASES.includes(game.shift.state.phase);
  touchUi.setVisible(simulate);
  if (input.reset && simulate) resetToRoad();

  let impact = 0; // strongest hit across this frame's physics steps
  if (simulate) {
    accumulator = Math.min(accumulator + dt, PHYSICS_DT * MAX_STEPS_PER_FRAME);
    while (accumulator >= PHYSICS_DT) {
      car.step(input, PHYSICS_DT);
      game?.load.step(car.body, car.stats, input, PHYSICS_DT);
      impact = Math.max(impact, car.stats.impact);
      world.step();
      accumulator -= PHYSICS_DT;
    }
    car.syncVisual(accumulator / PHYSICS_DT);
    level.syncProps();
  }
  updateAudio(dt, car.stats, simulate ? input.throttle : 0, carParams.maxSpeed, impact);
  updateGame(dt, impact);

  if (freeCam) controls.update();
  else updateChase(dt, car.model.group, car.stats, impact);

  lighting.follow(car.model.group.position, camera);
  // Nothing to see while hidden or collapsed to 0×0, and zero-size targets only produce GL errors.
  if (document.hidden || window.innerWidth === 0 || window.innerHeight === 0) return;
  // Driving only: menus are where startup shader compiles land.
  if (simulate) watchFrameRate(dt);
  renderer.info.reset();
  post.render(dt);

  if (!devVisible) return;
  const s = car.stats;
  const st = game?.shift.state;
  const dv = game?.drift.view();
  debug.update(
    dt,
    (st ? `\nphase ${st.phase}  ${st.clockText}  x${st.multiplier}  hp ${Math.round(st.health)}` : '') +
      (dv ? `\ndrift x${dv.chain} ${Math.round(dv.points)}  total ${dv.shiftTotal}` : '') +
      `\nspeed ${Math.round(s.speed * 3.6)} km/h  gear ${s.gear}\n` +
      `angle ${Math.round(s.beta * RAD_TO_DEG)}°\n` +
      `slip  F ${Math.round(s.frontSlip * RAD_TO_DEG)}° R ${Math.round(s.rearSlip * RAD_TO_DEG)}°\n` +
      `drift ${s.drifting ? s.driftTime.toFixed(1) + 's' : '-'}${s.boosting ? '  BOOST' : ''}`,
  );
});
