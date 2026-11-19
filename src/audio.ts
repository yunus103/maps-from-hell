import type { CarStats } from './car';

export const audioParams = { volume: 0.6 };

const DEG = Math.PI / 180;
// Short rev dip after an upshift; the car's own shift cut is about this long.
const SHIFT_DIP = 0.18;
// Impact (m/s) for the loudest thump, and the minimum gap between thumps so scraping doesn't machine-gun.
const IMPACT_FULL = 12;
const THUMP_GAP = 0.15;

type Engine = { o1: OscillatorNode; o2: OscillatorNode; o3: OscillatorNode; lp: BiquadFilterNode; gain: GainNode };

let ac: AudioContext | null = null;
let master: GainNode;
let engine: Engine;
let screech: GainNode;
let wind: GainNode;
let gear = 1;
let shiftT = 0;
let noiseBuf: AudioBuffer;
let lastThump = 0;
let paused = false;

// Browsers only allow audio after a user gesture, so the graph is built on the first key or click.
function init() {
  if (ac) return;
  ac = new AudioContext();
  master = ac.createGain();
  master.connect(ac.destination);

  // Engine: firing-frequency saw + sub square + rough harmonic through a lowpass.
  const o1 = ac.createOscillator();
  const o2 = ac.createOscillator();
  const o3 = ac.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  o3.type = 'triangle';
  const rough = ac.createGain();
  rough.gain.value = 0.25;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  const gain = ac.createGain();
  gain.gain.value = 0;
  o1.connect(lp);
  o2.connect(lp);
  o3.connect(rough).connect(lp);
  lp.connect(gain).connect(master);
  for (const o of [o1, o2, o3]) o.start();
  engine = { o1, o2, o3, lp, gain };

  // Tire screech: band-passed white noise.
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  noise.start();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 4;
  screech = ac.createGain();
  screech.gain.value = 0;
  noise.connect(bp).connect(screech).connect(master);

  // Wind: the same noise, low-passed, rising with speed.
  const windNoise = ac.createBufferSource();
  windNoise.buffer = buf;
  windNoise.loop = true;
  windNoise.start(0, 1); // offset so it doesn't phase with the screech
  const windLp = ac.createBiquadFilter();
  windLp.type = 'lowpass';
  windLp.frequency.value = 700;
  wind = ac.createGain();
  wind.gain.value = 0;
  windNoise.connect(windLp).connect(wind).connect(master);
}

addEventListener('keydown', init);
addEventListener('pointerdown', init);

// A touch pointerdown carries no user activation, so a context built there starts suspended; the start gate's tap resumes it.
export function unlockAudio() {
  init();
  ac!.resume();
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend();
  else ac.resume();
});

// Collision: a falling low sine for the body thud plus a short low-passed noise crunch.
function thump(strength: number) {
  if (!ac) return;
  const t = ac.currentTime;
  if (t - lastThump < THUMP_GAP) return;
  lastThump = t;
  const peak = 0.15 + 0.45 * strength;

  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
  const thud = ac.createGain();
  thud.gain.setValueAtTime(peak, t);
  thud.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(thud).connect(master);
  osc.start(t);
  osc.stop(t + 0.3);

  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600 + 1400 * strength;
  const crunch = ac.createGain();
  crunch.gain.setValueAtTime(peak * 0.6, t);
  crunch.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  noise.connect(lp).connect(crunch).connect(master);
  noise.start(t, Math.random());
  noise.stop(t + 0.18);
}

// For one-shot cues (sfx.ts): they go through the master gain so pause/mute applies to them too.
export function audioOut(): { ac: AudioContext; out: AudioNode } | null {
  return ac ? { ac, out: master } : null;
}

// Mutes everything via the master gain; the engine graph keeps running so resuming is seamless.
export function setAudioPaused(p: boolean) {
  paused = p;
  if (ac) master.gain.setTargetAtTime(p ? 0 : audioParams.volume, ac.currentTime, 0.05);
}

export function updateAudio(dt: number, stats: CarStats, throttle: number, maxSpeed: number, impact: number) {
  if (!ac) return;
  const t = ac.currentTime;
  if (impact > 0 && !paused) thump(Math.min(impact / IMPACT_FULL, 1));
  master.gain.setTargetAtTime(paused ? 0 : audioParams.volume, t, 0.05);

  // Revs come from the car's gearbox so what you hear matches how it pulls.
  if (stats.gear > gear) shiftT = SHIFT_DIP;
  gear = stats.gear;
  shiftT = Math.max(0, shiftT - dt);
  let rev = Math.max(stats.rpm - (shiftT > 0 ? 0.15 : 0), 0);
  // Spinning rears in a drift: revs follow the throttle more than road speed.
  if (stats.drifting) rev = Math.max(rev, 0.55 + throttle * 0.35);
  const rpm = 850 + rev * 5200 + throttle * 250;
  const f = rpm / 30;
  engine.o1.frequency.setTargetAtTime(f, t, 0.05);
  engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engine.o3.frequency.setTargetAtTime(f * 2.02, t, 0.05);
  engine.lp.frequency.setTargetAtTime(260 + rev * 900 + throttle * 500 + (stats.boosting ? 600 : 0), t, 0.08);
  engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.045 + rev * 0.02, t, 0.08);

  const slide = Math.min(Math.max((stats.rearSlip - 8 * DEG) / (20 * DEG), 0), 1);
  const speedT = Math.min(stats.speed / 8, 1);
  screech.gain.setTargetAtTime(slide * speedT * 0.07, t, 0.05);

  const windT = Math.min(stats.speed / maxSpeed, 1);
  wind.gain.setTargetAtTime(windT * windT * 0.06, t, 0.1);
}
