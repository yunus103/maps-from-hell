import GUI from 'lil-gui';
import { carParams } from './car';
import { cameraParams } from './chaseCamera';
import { inputParams } from './input';
import { modelParams } from './carModel';
import { audioParams } from './audio';
import { lightParams } from './lighting';
import { postParams } from './post';

const STORAGE_KEY = 'mfh.tuning.v6';

type Params = Record<string, number | string | boolean>;
const sections: Record<string, Params> = {
  car: carParams,
  camera: cameraParams,
  input: inputParams,
  model: modelParams,
  audio: audioParams,
  light: lightParams,
  post: postParams,
};
const defaults = structuredClone(sections);

// Copies only known keys of matching type, so presets from older builds load cleanly.
function assign(data: unknown) {
  if (typeof data !== 'object' || data === null) return;
  const src = data as Record<string, Params | undefined>;
  for (const [name, target] of Object.entries(sections)) {
    const values = src[name];
    if (!values) continue;
    for (const key of Object.keys(target)) {
      if (typeof values[key] === typeof target[key]) target[key] = values[key];
    }
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  } catch {
    // Storage blocked (private mode etc.); tuning still works for this session.
  }
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) assign(JSON.parse(raw));
  } catch {
    // Corrupt or blocked storage: keep defaults.
  }
}

export function createTuning(onChange: () => void): GUI {
  loadSaved();
  const gui = new GUI({ title: 'Tuning' });
  const c = carParams;

  // The handful of knobs that shape the feel most; everything else lives under Advanced.
  // The same value can appear in both; onFinishChange below keeps the two sliders in sync.
  const basic = gui.addFolder('Basic');
  basic.add(c, 'driftAssist', 0, 1, 0.01);
  basic.add(c, 'driftGripThrottle', 0.2, 1.5, 0.01);
  basic.add(c, 'driftGripLift', 0.3, 2, 0.01);
  basic.add(c, 'handbrakeGrip', 0, 1, 0.01);
  basic.add(c, 'frontGrip', 0.3, 3, 0.01);
  basic.add(c, 'rearGrip', 0.3, 3, 0.01);
  basic.add(c, 'yawInertia', 0.3, 3, 0.01);
  basic.add(c, 'highSpeedStability', 0, 1.5, 0.01);
  basic.add(c, 'engineForce', 1000, 25000, 100);
  basic.add(c, 'maxSpeed', 10, 90, 0.5);

  const adv = gui.addFolder('Advanced').close();
  const chassis = adv.addFolder('Chassis').close();
  chassis.add(c, 'mass', 600, 2500, 10);
  chassis.add(c, 'comHeight', 0.2, 1.2, 0.01);
  chassis.add(c, 'yawInertia', 0.3, 3, 0.01);
  chassis.add(c, 'extraGravity', 0, 20, 0.1);
  chassis.add(c, 'angularDamping', 0, 3, 0.01);
  chassis.add(c, 'airLevel', 0, 60, 1);
  chassis.add(c, 'rollReduce', 0, 1, 0.01);

  const susp = adv.addFolder('Suspension').close();
  susp.add(c, 'restLength', 0.1, 0.6, 0.01);
  susp.add(c, 'springK', 5000, 100000, 100);
  susp.add(c, 'damperC', 0, 15000, 50);

  const tires = adv.addFolder('Tires').close();
  tires.add(c, 'frontGrip', 0.3, 3, 0.01);
  tires.add(c, 'rearGrip', 0.3, 3, 0.01);
  tires.add(c, 'peakSlipDeg', 1, 30, 0.1);
  tires.add(c, 'falloffDeg', 1, 60, 0.1);
  tires.add(c, 'slideGrip', 0.1, 1.5, 0.01);
  tires.add(c, 'handbrakeGrip', 0, 1, 0.01);

  const drive = adv.addFolder('Drive').close();
  drive.add(c, 'engineForce', 1000, 25000, 100);
  drive.add(c, 'maxSpeed', 10, 90, 0.5);
  drive.add(c, 'gearSpread', 1, 1.6, 0.01);
  drive.add(c, 'shiftTime', 0, 0.5, 0.01);
  drive.add(c, 'driftPower', 0.5, 2.5, 0.05);
  drive.add(c, 'driftRampTime', 0, 1.5, 0.05);
  drive.add(c, 'brakeForce', 1000, 40000, 100);
  drive.add(c, 'reverseForce', 500, 15000, 100);
  drive.add(c, 'maxReverse', 2, 30, 0.5);
  drive.add(c, 'rollResistance', 0, 200, 1);
  drive.add(c, 'handbrakeForce', 0, 15000, 100);

  const steering = adv.addFolder('Steering').close();
  steering.add(c, 'maxSteerDeg', 10, 60, 0.5);
  steering.add(c, 'highSpeedSteer', 0.1, 1, 0.01);
  steering.add(c, 'steerFalloffSpeed', 5, 80, 0.5);
  steering.add(inputParams, 'keySteerSpeed', 1, 20, 0.1);
  steering.add(inputParams, 'keySteerReturn', 1, 30, 0.1);
  steering.add(inputParams, 'padDeadzone', 0, 0.4, 0.01);
  steering.add(inputParams, 'keyThrottleRise', 0, 1, 0.01);

  const drift = adv.addFolder('Drift').close();
  drift.add(c, 'driftAssist', 0, 1, 0.01);
  drift.add(c, 'assistStartDeg', 0, 30, 0.5);
  drift.add(c, 'driftEnterDeg', 2, 30, 0.5);
  drift.add(c, 'driftAutoEnterDeg', 10, 60, 0.5);
  drift.add(c, 'driftExitDeg', 1, 20, 0.5);
  drift.add(c, 'driftExitTime', 0, 1.5, 0.05);
  drift.add(c, 'driftMinSpeed', 0, 20, 0.5);
  drift.add(c, 'driftGripLift', 0.3, 2, 0.01);
  drift.add(c, 'driftGripThrottle', 0.2, 1.5, 0.01);
  drift.add(c, 'driftMaxDeg', 20, 80, 0.5);
  drift.add(c, 'spinGuardGrip', 1, 4, 0.05);
  drift.add(c, 'spinGuardSpeed', 0, 40, 0.5);
  drift.add(c, 'driftSpeedKeep', 0, 1, 0.01);
  drift.add(c, 'driftSteerYaw', 0, 6, 0.05);
  drift.add(c, 'powerOversteer', 0, 1, 0.01);
  drift.add(c, 'powerOversteerMaxSpeed', 0, 45, 0.5);
  drift.add(c, 'highSpeedStability', 0, 1.5, 0.01);

  const boost = adv.addFolder('Boost').close();
  boost.add(c, 'boostMinTime', 0.2, 5, 0.05);
  boost.add(c, 'boostDuration', 0.1, 3, 0.05);
  boost.add(c, 'boostForce', 0, 30000, 100);

  const cam = gui.addFolder('Camera').close();
  const k = cameraParams;
  cam.add(k, 'distance', 2, 15, 0.1);
  cam.add(k, 'height', 0.5, 8, 0.05);
  cam.add(k, 'lookHeight', 0, 3, 0.05);
  cam.add(k, 'distPerSpeed', 0, 0.2, 0.005);
  cam.add(k, 'yawFollow', 0.5, 20, 0.1);
  cam.add(k, 'driftYawBlend', 0, 1, 0.01);
  cam.add(k, 'driftLookFollow', 0.2, 10, 0.1);
  cam.add(k, 'speedShake', 0, 0.15, 0.005);
  cam.add(k, 'impactShake', 0, 0.2, 0.005);
  cam.add(k, 'baseFov', 30, 100, 0.5);
  cam.add(k, 'fovPerSpeed', 0, 1, 0.01);
  cam.add(k, 'maxFovAdd', 0, 40, 0.5);
  cam.add(k, 'boostFov', 0, 30, 0.5);
  cam.add(k, 'fovFollow', 0.5, 20, 0.1);
  cam.add(k, 'collisionRadius', 0, 1, 0.01);

  const l = lightParams;
  const light = gui.addFolder('Lighting').close();
  light.add(l, 'sunElevation', 2, 90, 0.5);
  light.add(l, 'sunAzimuth', 0, 360, 1);
  light.addColor(l, 'sunColor');
  light.add(l, 'sunIntensity', 0, 8, 0.05);
  light.addColor(l, 'skyTop');
  light.addColor(l, 'skyHorizon');
  light.addColor(l, 'hemiSky');
  light.addColor(l, 'hemiGround');
  light.add(l, 'hemiIntensity', 0, 4, 0.05);
  light.add(l, 'fogNear', 0, 300, 1);
  light.add(l, 'fogFar', 50, 900, 1);
  light.add(l, 'glow', 0, 8, 0.05);
  light.add(l, 'lampIntensity', 0, 800, 1);
  light.add(l, 'headlights', 0, 500, 1);
  light.add(l, 'carFill', 0, 40, 0.1);

  const pp = postParams;
  const post = gui.addFolder('Post').close();
  post.add(pp, 'enabled');
  post.add(pp, 'aoIntensity', 0, 8, 0.05);
  post.add(pp, 'aoRadius', 0.2, 10, 0.1);
  post.add(pp, 'bloomIntensity', 0, 3, 0.01);
  post.add(pp, 'bloomThreshold', 0, 1.5, 0.01);
  post.add(pp, 'saturation', -1, 1, 0.01);
  post.add(pp, 'contrast', -1, 1, 0.01);
  post.add(pp, 'vignette', 0, 1, 0.01);

  gui.addFolder('Look').close().addColor(modelParams, 'paint');
  gui.addFolder('Audio').close().add(audioParams, 'volume', 0, 1, 0.01);

  const refresh = () => {
    for (const ctrl of gui.controllersRecursive()) ctrl.updateDisplay();
    save();
    onChange();
  };

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      assign(JSON.parse(await file.text()));
      refresh();
    } catch (e) {
      alert(`Preset could not be loaded: ${e}`);
    }
  });

  const presets = gui.addFolder('Presets');
  presets.add(
    {
      export() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(sections, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mfh-tuning.json';
        a.click();
        URL.revokeObjectURL(url);
      },
    },
    'export',
  ).name('Export JSON');
  presets.add({ import: () => fileInput.click() }, 'import').name('Import JSON');
  presets.add(
    {
      reset() {
        assign(defaults);
        refresh();
      },
    },
    'reset',
  ).name('Reset to defaults');

  gui.onChange(() => {
    save();
    onChange();
  });
  gui.onFinishChange(() => {
    for (const ctrl of gui.controllersRecursive()) ctrl.updateDisplay();
  });
  return gui;
}
