import type { CarStats } from './car';

export const audioParams = { volume: 0.6 };

const DEG = Math.PI / 180;
// Fake 5-speed gearbox: upshift points as fractions of top speed.
const GEARS = [0, 0.18, 0.32, 0.47, 0.64, 1];
const SHIFT_DIP = 0.18;

type Engine = { o1: OscillatorNode; o2: OscillatorNode; o3: OscillatorNode; lp: BiquadFilterNode; gain: GainNode };

let ac: AudioContext | null = null;
let master: GainNode;
let engine: Engine;
let screech: GainNode;
let gear = 1;
let shiftT = 0;

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
}

addEventListener('keydown', init);
addEventListener('pointerdown', init);
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend();
  else ac.resume();
});

export function updateAudio(dt: number, stats: CarStats, throttle: number, maxSpeed: number) {
  if (!ac) return;
  const t = ac.currentTime;
  master.gain.setTargetAtTime(audioParams.volume, t, 0.05);

  const frac = Math.min(stats.speed / maxSpeed, 1);
  let g = 1;
  while (g < 5 && frac > GEARS[g]) g++;
  if (stats.vLong < -0.5) g = 1;
  if (g > gear) shiftT = SHIFT_DIP;
  gear = g;
  shiftT = Math.max(0, shiftT - dt);
  const inGear = Math.min((frac - GEARS[gear - 1]) / (GEARS[gear] - GEARS[gear - 1]), 1);
  // In a drift the wheels spin up, so revs follow throttle more than road speed.
  const rev = stats.drifting ? Math.max(inGear, 0.55 + throttle * 0.4) : inGear;
  const rpm = 850 + rev * 4600 + throttle * 250 - (shiftT > 0 ? 900 : 0);
  const f = rpm / 30;
  engine.o1.frequency.setTargetAtTime(f, t, 0.05);
  engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  engine.o3.frequency.setTargetAtTime(f * 2.02, t, 0.05);
  engine.lp.frequency.setTargetAtTime(260 + rev * 900 + throttle * 500 + (stats.boosting ? 600 : 0), t, 0.08);
  engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.045 + rev * 0.02, t, 0.08);

  const slide = Math.min(Math.max((stats.rearSlip - 8 * DEG) / (20 * DEG), 0), 1);
  const speedT = Math.min(stats.speed / 8, 1);
  screech.gain.setTargetAtTime(slide * speedT * 0.07, t, 0.05);
}
