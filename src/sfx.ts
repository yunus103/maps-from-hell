// Synthesised one-shot sound cues (WebAudio, no files).
import { audioOut } from './audio';

export type SfxId =
  | 'crack' | 'squish' | 'thud_box' | 'tick' | 'cheer' | 'boo'
  | 'bank' | 'chain_up' | 'chain_lost' | 'near_miss' | 'bonus'
  | 'horn' | 'ped_hey' | 'bonk' | 'pigeons' | 'wrench' | 'cash';

const MAX_VOICES = 8;
const BUS_GAIN = 0.9;

let ctx: AudioContext | null = null;
let bus: GainNode;
let noiseBuf: AudioBuffer;
const ends: number[] = []; // end times of the cues still sounding

function setup(ac: AudioContext, out: AudioNode) {
  ctx = ac;
  bus = ac.createGain();
  bus.gain.value = BUS_GAIN;
  bus.connect(out);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
}

// Gain envelope: fast attack to `peak`, exponential decay to silence at t + dur.
function env(ac: AudioContext, t: number, dur: number, peak: number, attack = 0.005): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(bus);
  return g;
}

function tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, attack?: number) {
  const ac = ctx!;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(env(ac, t, dur, peak, attack));
  o.start(t);
  o.stop(t + dur + 0.02);
  return o;
}

function noise(t: number, dur: number, peak: number, filter: BiquadFilterType, f0: number, f1 = f0, q = 1, attack?: number) {
  const ac = ctx!;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const bq = ac.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
  src.connect(bq).connect(env(ac, t, dur, peak, attack));
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
  return bq;
}

// Each cue returns its length in seconds.
const CUES: Record<SfxId, (t: number, g: number) => number> = {
  // Glass/egg shell: bright burst and a few tiny cracks after it.
  crack(t, g) {
    noise(t, 0.09, 0.5 * g, 'highpass', 2500);
    for (const dt of [0.035, 0.07, 0.12]) noise(t + dt, 0.025, 0.3 * g, 'bandpass', 4200 + Math.random() * 1500, undefined, 6);
    tone('square', 1800, 900, t, 0.05, 0.06 * g);
    return 0.16;
  },
  // Cream giving way: wet low-passed sweep plus a sagging tone.
  squish(t, g) {
    noise(t, 0.28, 0.35 * g, 'lowpass', 1400, 250, 4, 0.03);
    tone('sine', 320, 110, t, 0.25, 0.18 * g, 0.03);
    return 0.3;
  },
  // Box sliding into the door: body thud and a rattle.
  thud_box(t, g) {
    tone('sine', 120, 50, t, 0.28, 0.5 * g);
    noise(t, 0.12, 0.35 * g, 'lowpass', 500);
    noise(t + 0.08, 0.04, 0.2 * g, 'bandpass', 900, undefined, 3);
    noise(t + 0.15, 0.04, 0.14 * g, 'bandpass', 800, undefined, 3);
    return 0.3;
  },
  tick(t, g) {
    tone('square', 2400, 2400, t, 0.03, 0.08 * g, 0.001);
    noise(t, 0.02, 0.12 * g, 'highpass', 5000);
    return 0.04;
  },
  // Small crowd swell under a rising arpeggio.
  cheer(t, g) {
    noise(t, 0.9, 0.22 * g, 'bandpass', 1300, 1700, 0.8, 0.2);
    [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, t + i * 0.07, 0.35, 0.16 * g));
    return 0.95;
  },
  // Disappointed crowd: detuned low saws sagging in pitch.
  boo(t, g) {
    const ac = ctx!;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    lp.connect(env(ac, t, 1.0, 0.3 * g, 0.12));
    for (const f of [138, 151, 166, 182]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.8, t + 1.0);
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.05);
    }
    return 1.05;
  },
  // Two-note chime.
  bank(t, g) {
    tone('sine', 880, 880, t, 0.35, 0.22 * g);
    tone('sine', 1760, 1760, t, 0.2, 0.06 * g);
    tone('sine', 1319, 1319, t + 0.11, 0.55, 0.24 * g);
    tone('sine', 2638, 2638, t + 0.11, 0.3, 0.06 * g);
    return 0.7;
  },
  chain_up(t, g) {
    tone('square', 520, 1100, t, 0.11, 0.09 * g);
    tone('sine', 1100, 1300, t + 0.08, 0.1, 0.12 * g);
    return 0.2;
  },
  chain_lost(t, g) {
    const bq = noise(t, 0.45, 0.08 * g, 'lowpass', 900, 200);
    bq.Q.value = 2;
    tone('sawtooth', 620, 110, t, 0.5, 0.16 * g);
    return 0.5;
  },
  // Whoosh: band-pass sweep up then down.
  near_miss(t, g) {
    const bq = noise(t, 0.45, 0.45 * g, 'bandpass', 400, 400, 1.5, 0.12);
    bq.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    bq.frequency.exponentialRampToValueAtTime(500, t + 0.45);
    return 0.45;
  },
  bonus(t, g) {
    [660, 880, 1100, 1320].forEach((f, i) => tone('triangle', f, f, t + i * 0.05, 0.18, 0.15 * g));
    return 0.35;
  },
  // Two detuned squares, a little nasal.
  horn(t, g) {
    const ac = ctx!;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const e = ac.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(0.12 * g, t + 0.01);
    e.gain.setValueAtTime(0.12 * g, t + 0.27);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    lp.connect(e).connect(bus);
    for (const f of [415, 498]) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.33);
    }
    return 0.33;
  },
  // "Hey!": a voiced saw through two formant filters, pitch up then down.
  ped_hey(t, g) {
    const ac = ctx!;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const f0 = 200 + Math.random() * 120;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.08);
    o.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.26);
    const e = env(ac, t, 0.28, 0.22 * g, 0.02);
    for (const [f, q] of [[650, 6], [1900, 9]]) {
      const bq = ac.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = f;
      bq.Q.value = q;
      o.connect(bq).connect(e);
    }
    noise(t, 0.05, 0.08 * g, 'bandpass', 2500, undefined, 2); // the "h"
    o.start(t);
    o.stop(t + 0.3);
    return 0.3;
  },
  // Cartoon boing: a sine wobbling down, plus a soft thump.
  bonk(t, g) {
    const ac = ctx!;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 14;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(70, t);
    depth.gain.exponentialRampToValueAtTime(5, t + 0.5);
    lfo.connect(depth).connect(o.frequency);
    o.connect(env(ac, t, 0.55, 0.28 * g));
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.56);
    lfo.stop(t + 0.56);
    tone('sine', 110, 50, t, 0.15, 0.3 * g);
    return 0.56;
  },
  // Wing flutter: noise chopped by a fast square LFO.
  pigeons(t, g) {
    const ac = ctx!;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const bq = ac.createBiquadFilter();
    bq.type = 'bandpass';
    bq.frequency.value = 1400;
    bq.Q.value = 1.2;
    const chop = ac.createGain();
    chop.gain.value = 0.5;
    const lfo = ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(19, t);
    lfo.frequency.linearRampToValueAtTime(13, t + 0.7);
    const lfoAmt = ac.createGain();
    lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt).connect(chop.gain);
    src.connect(bq).connect(chop).connect(env(ac, t, 0.75, 0.4 * g, 0.03));
    src.start(t, Math.random() * 0.2);
    lfo.start(t);
    src.stop(t + 0.77);
    lfo.stop(t + 0.77);
    return 0.77;
  },
  // Metal clinks: inharmonic partials, quick decay.
  wrench(t, g) {
    for (const [dt, f] of [[0, 2300], [0.11, 3100]]) {
      tone('sine', f, f, t + dt, 0.16, 0.14 * g, 0.001);
      tone('sine', f * 1.51, f * 1.51, t + dt, 0.1, 0.07 * g, 0.001);
      noise(t + dt, 0.015, 0.1 * g, 'highpass', 6000);
    }
    return 0.28;
  },
  // Cha-ching: drawer rattle then two bells.
  cash(t, g) {
    noise(t, 0.08, 0.25 * g, 'highpass', 3000);
    tone('sine', 1568, 1568, t + 0.07, 0.5, 0.18 * g, 0.002);
    tone('sine', 2093, 2093, t + 0.13, 0.6, 0.18 * g, 0.002);
    tone('sine', 4186, 4186, t + 0.13, 0.25, 0.04 * g, 0.002);
    return 0.75;
  },
};

export function playSfx(id: SfxId, gain = 1): void {
  const o = audioOut();
  if (!o) return;
  if (ctx !== o.ac) setup(o.ac, o.out);
  const t = o.ac.currentTime;
  for (let i = ends.length - 1; i >= 0; i--) if (ends[i] <= t) ends.splice(i, 1);
  if (ends.length >= MAX_VOICES) return;
  ends.push(t + CUES[id](t, gain));
}
