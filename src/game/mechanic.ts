// Sanayi (mechanic) stops: drive into the blue ring, stop, and the car is repaired for money while the clock runs.
import * as THREE from 'three';
import type { CarSample, HudFx, L10n, Mechanic, MechanicState, MechanicView, Place, RoadGraph, Shift, ShiftState, Speaker, Voice } from './types';
import { playSfx } from '../sfx';

const ZONE_RADIUS = 6; // m, same as order zones
const STOP_SPEED = 1; // m/s
const STOP_HOLD = 0.8; // s below STOP_SPEED before the repair starts
const REPAIR_RATE = 12; // hp/s
const PRICE = 1.5; // ₺/hp (the end-of-shift bill is 2 ₺/hp)
const FULL_HEALTH = 100;
const LOW_HEALTH_HINT = 40;
const WRENCH_EVERY = 0.6; // s
const COLOR = 0x3a7bd5;
const RING_INNER = 4.9;
const RING_OUTER = 5.5;
const RING_Y = 0.07;
const BEAM_RADIUS = 1;
const BEAM_HEIGHT = 10;
const BEAM_OPACITY = 0.22;
const RING_OPACITY = 0.7;
const FILL_OPACITY = 0.12;
const PULSE_SPEED = 2.5;

const LINES = {
  enter: { en: 'Bring it in, abi. What happened, the GPS again?', tr: 'Getir abi. Ne oldu, yine mi GPS?' },
  done: { en: 'Good as new. Almost.', tr: 'Sıfır gibi oldu. Neredeyse.' },
  broke: { en: 'No money, no repair, abi.', tr: 'Para yoksa tamir de yok abi.' },
  full: { en: 'Your car is fine, abi. Go.', tr: 'Araban sağlam abi. Hadi yoluna.' },
} satisfies Record<string, L10n>;
const HINT_SUB: L10n = { en: 'Stop in the blue ring to repair', tr: 'Tamir için mavi halkada dur' };
const HINT_LINE: L10n = {
  en: 'Your car is smoking. There is a mechanic. I will not route you there.',
  tr: 'Araban duman atıyor. Bir sanayi var. Seni oraya götürmeyeceğim.',
};

export function createMechanic(scene: THREE.Scene, graph: RoadGraph, voice: Voice, shift: Shift): Mechanic {
  const places = graph.places.filter((p) => p.kind === 'mechanic');
  const markers = places.map((p) => buildMarker(scene, p));

  let time = 0;
  let at: Place | null = null; // mechanic of the current visit
  let state: MechanicState = 'stop';
  let hold = 0;
  let spent = 0;
  let wrench = 0;
  let saidBroke = false;
  let saidFull = false;
  let hinted = false;
  const out: HudFx[] = [];
  const view: MechanicView = { name: { en: '', tr: '' }, state: 'stop', health: 0, spent: 0, pricePerPoint: PRICE };

  const speakerOf = (p: Place): Speaker => ({ kind: 'mechanic', label: p.name, pitch: 0.85, rate: 1.1, voiceRank: 1 });
  const say = (p: Place, text: L10n) => voice.sayText(text, { speaker: speakerOf(p), priority: 'react' });

  function zoneAt(car: CarSample): Place | null {
    for (const p of places) if (Math.hypot(car.x - p.x, car.z - p.z) < ZONE_RADIUS) return p;
    return null;
  }

  function nearest(car: CarSample): Place {
    let best = places[0];
    let bd = Infinity;
    for (const p of places) {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bd) [best, bd] = [p, d];
    }
    return best;
  }

  function startVisit(p: Place) {
    at = p;
    state = 'stop';
    hold = 0;
    spent = 0;
    wrench = 0;
    saidBroke = saidFull = false;
    say(p, LINES.enter);
  }

  function repairStep(dt: number, p: Place, s: ShiftState) {
    if (s.health >= FULL_HEALTH) {
      state = 'full';
      if (!saidFull) {
        saidFull = true;
        say(p, spent > 0 ? LINES.done : LINES.full);
      }
      return;
    }
    if (s.money < PRICE) {
      state = 'broke';
      if (!saidBroke) {
        saidBroke = true;
        say(p, LINES.broke);
      }
      return;
    }
    state = 'repairing';
    const points = Math.min(REPAIR_RATE * dt, FULL_HEALTH - s.health, s.money / PRICE);
    const cost = Math.min(points * PRICE, s.money);
    shift.repair(points, cost);
    spent += cost;
    wrench -= dt;
    if (wrench <= 0) {
      wrench = WRENCH_EVERY;
      playSfx('wrench');
    }
  }

  function update(dt: number, car: CarSample, s: ShiftState): HudFx[] {
    out.length = 0;
    if (places.length === 0) return out;
    time += dt;

    const shown = s.phase === 'driving' || (s.phase === 'paused' && s.pausedFrom === 'driving');
    const pulse = 1 + 0.25 * Math.sin(time * PULSE_SPEED);
    for (const m of markers) {
      m.group.visible = shown;
      m.beam.opacity = BEAM_OPACITY * pulse;
      m.ring.scale.setScalar(1 + 0.03 * Math.sin(time * PULSE_SPEED));
    }

    if (s.phase === 'title' || s.phase === 'shiftEnd' || s.phase === 'free' || s.phase === 'ftue') hinted = false;
    if (s.phase === 'paused') return out;
    if (s.phase !== 'driving') {
      at = null;
      return out;
    }

    if (!hinted && s.health < LOW_HEALTH_HINT) {
      hinted = true;
      const name = nearest(car).name;
      out.push({ type: 'toast', text: { en: `Sanayi: ${name.en}`, tr: `Sanayi: ${name.tr}` }, sub: HINT_SUB, icon: 'mechanic.svg', tone: 'info' });
      voice.sayText(HINT_LINE, { mood: 'passive_aggressive', emoji: '💨🔧🙅', priority: 'react' });
    }

    const p = zoneAt(car);
    if (!p) {
      at = null;
      return out;
    }
    if (p !== at) startVisit(p);

    if (car.speed >= STOP_SPEED) {
      state = 'stop';
      hold = 0;
    } else if (state === 'stop') {
      hold += dt;
      if (hold >= STOP_HOLD) repairStep(dt, p, s);
    } else {
      repairStep(dt, p, s);
    }
    return out;
  }

  function getView(): MechanicView | null {
    if (!at) return null;
    view.name = at.name;
    const h = shift.state.health;
    view.state = state === 'stop' && h >= FULL_HEALTH ? 'full' : state;
    view.health = h;
    view.spent = spent;
    return view;
  }

  return { update, view: getView };
}

interface Marker {
  group: THREE.Group;
  beam: THREE.MeshBasicMaterial;
  ring: THREE.Mesh;
}

// Shared geometry for every mechanic marker; built on first use.
let geo: { beam: THREE.BufferGeometry; ring: THREE.BufferGeometry; fill: THREE.BufferGeometry } | null = null;

function buildMarker(scene: THREE.Scene, p: Place): Marker {
  geo ??= {
    beam: new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, BEAM_HEIGHT, 20, 1, true),
    ring: new THREE.RingGeometry(RING_INNER, RING_OUTER, 48),
    fill: new THREE.CircleGeometry(RING_INNER, 48),
  };
  const common = { color: COLOR, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide };
  const beamMat = new THREE.MeshBasicMaterial({ ...common, opacity: BEAM_OPACITY, blending: THREE.AdditiveBlending });
  const ringMat = new THREE.MeshBasicMaterial({ ...common, opacity: RING_OPACITY });
  const fillMat = new THREE.MeshBasicMaterial({ ...common, opacity: FILL_OPACITY });

  const group = new THREE.Group();
  group.position.set(p.x, 0, p.z);
  group.visible = false;
  const beam = new THREE.Mesh(geo.beam, beamMat);
  beam.position.y = BEAM_HEIGHT / 2;
  const ring = new THREE.Mesh(geo.ring, ringMat);
  const fill = new THREE.Mesh(geo.fill, fillMat);
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  ring.position.y = fill.position.y = RING_Y;
  for (const m of [beam, ring, fill]) {
    m.renderOrder = 3;
    group.add(m);
  }
  scene.add(group);
  return { group, beam: beamMat, ring };
}
