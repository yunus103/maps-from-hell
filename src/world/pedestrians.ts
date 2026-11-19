import * as THREE from 'three';
import type { CarSample, CityEvent, RoadEdge, RoadGraph } from '../game/types';
import { QUALITY } from '../quality';
import { playSfx } from '../sfx';
import { CURB_H } from './district';
import { PED_NECK, createInstanced, pedBodyGeometry, pedHeadGeometry } from './agentMesh';
import { agentEdges, isHorizontal, nodeHalfAlong } from './roadGraph';

// Sidewalk pedestrians: no colliders (they never stop the car). They walk round the blocks, leap out of the
// way of a fast car, and a hit sends them flying cartoon-style before they get up and shake a fist.

const WALK_FROM_EDGE = 1.6; // path from the road edge: clear of poles, sign posts and lamp posts
const SPEED = [1.1, 1.5];
const STAND_CHANCE = 0.15; // on the phone, not walking
const TURN_BACK = 0.2; // chance to turn round at a corner instead of going round it
const RETURN_SPEED = 1; // m/s back to the path after a leap or a launch
const DODGE_RANGE = 7;
const DODGE_CLOSING = 4; // m/s
const DODGE_PASS = 2; // predicted pass distance
const DODGE_LEAP = 1.8;
const DODGE_REACT = 0.25; // frozen in surprise first: above ~50 km/h the leap comes too late
const DODGE_TIME = 0.35;
const DODGE_HOLD = 0.3; // arms-up pause after landing
const DODGE_HOP = 0.45;
const HEY_COOLDOWN = 1.5; // global
const NEAR_SPEED = 8;
const NEAR_COOLDOWN = 2; // global, so sidewalk-surfing isn't a near-miss farm
const HIT_PAD = 0.3; // car box inflation
const HIT_SPEED = 2.5;
const HIT_COOLDOWN = 4;
const CAR_HALF = { W: 0.93, L: 2.25 };
const LAUNCH_CARRY = 0.6; // × car velocity
const LAUNCH_UP = 5;
const GRAVITY = 12;
const LIE_TIME = 1.5;
const GETUP_TIME = 0.5;
const FIST_TIME = 0.7;
const MAX_LAT_FROM_EDGE = 2.2; // a launched ped never ends up inside a building
const SPAWN_MIN_DIST = 40;
const SHIRTS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x34495e, 0xd35400, 0x16a085, 0x7f8c8d, 0xe84393];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

const WALK = 0;
const DODGE = 1;
const AIR = 2;
const DOWN = 3;
const GETUP = 4;
const FIST = 5;

type Ped = {
  edge: number;
  side: 1 | -1; // +1 = left of a→b travel
  dir: 1 | -1; // walking towards b (+1) or a
  s: number; // m from node a
  speed: number;
  standing: boolean;
  phase: number; // walk cycle
  state: number;
  t: number; // time in state
  ox: number; // offset from the path (leap, launch)
  oz: number;
  fx: number; // leap start / target offsets
  fz: number;
  tx: number;
  tz: number;
  y: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  pitch: number;
  fast: boolean; // the car was fast when this dodge started
  hitCd: number;
  x: number;
  z: number;
  heading: number;
};

export interface Pedestrians {
  update(dt: number, car: CarSample, live: boolean, out: CityEvent[]): void;
  reset(x: number, z: number): void;
}

export function createPedestrians(scene: THREE.Scene, graph: RoadGraph, material: THREE.Material): Pedestrians {
  const { nodes, edges } = graph;
  const ok = agentEdges(graph);
  const okIds = edges.filter((e) => ok[e.id]).map((e) => e.id);
  const count = QUALITY.peds;
  const bodies = createInstanced(pedBodyGeometry(), material, count, true);
  const heads = createInstanced(pedHeadGeometry(), material, count, true);
  scene.add(bodies, heads);

  const sMin = (e: RoadEdge) => nodeHalfAlong(graph, e, e.a) + WALK_FROM_EDGE;
  const sMax = (e: RoadEdge) => e.length - nodeHalfAlong(graph, e, e.b) - WALK_FROM_EDGE;
  const lateral = (e: RoadEdge) => e.width / 2 + WALK_FROM_EDGE;
  // Unit a→b axis and its left; written to `ax`.
  const ax = { x: 0, z: 0, lx: 0, lz: 0 };
  function axis(e: RoadEdge) {
    const a = nodes[e.a];
    const b = nodes[e.b];
    ax.x = (b.x - a.x) / e.length;
    ax.z = (b.z - a.z) / e.length;
    // Left of +X travel is −Z, left of +Z travel is +X.
    ax.lx = ax.z;
    ax.lz = -ax.x;
  }

  const peds: Ped[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    peds.push({
      edge: 0, side: 1, dir: 1, s: 0, speed: 1.3, standing: false, phase: Math.random() * 6, state: WALK, t: 0,
      ox: 0, oz: 0, fx: 0, fz: 0, tx: 0, tz: 0, y: CURB_H, vx: 0, vy: 0, vz: 0, spin: 0, pitch: 0, fast: false, hitCd: 0,
      x: 0, z: 0, heading: 0,
    });
    bodies.setColorAt(i, color.setHex(SHIRTS[i % SHIRTS.length]));
    heads.setColorAt(i, color.setHex(SKIN[Math.floor(Math.random() * SKIN.length)]));
  }

  function spawn(p: Ped, px: number, pz: number) {
    for (let tries = 0; tries < 30; tries++) {
      const e = edges[okIds[Math.floor(Math.random() * okIds.length)]];
      const side: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const s = sMin(e) + Math.random() * (sMax(e) - sMin(e));
      axis(e);
      const a = nodes[e.a];
      const x = a.x + ax.x * s + ax.lx * side * lateral(e);
      const z = a.z + ax.z * s + ax.lz * side * lateral(e);
      p.edge = e.id;
      p.side = side;
      p.s = s;
      p.x = x;
      p.z = z;
      if (Math.hypot(x - px, z - pz) >= SPAWN_MIN_DIST) break;
    }
    p.dir = Math.random() < 0.5 ? 1 : -1;
    p.speed = SPEED[0] + Math.random() * (SPEED[1] - SPEED[0]);
    p.standing = Math.random() < STAND_CHANCE;
    p.state = WALK;
    p.ox = p.oz = p.vx = p.vy = p.vz = p.pitch = p.hitCd = 0;
    p.heading = Math.atan2(ax.x * p.dir, ax.z * p.dir);
  }

  // At the end of a block side: go round the corner onto the cross street's sidewalk, or turn back.
  function corner(p: Ped) {
    const e = edges[p.edge];
    const n = p.dir > 0 ? e.b : e.a;
    const nd = nodes[n];
    axis(e);
    const a = nodes[e.a];
    const lat = p.side * lateral(e);
    const cx = a.x + ax.x * p.s + ax.lx * lat - nd.x; // corner point relative to the node
    const cz = a.z + ax.z * p.s + ax.lz * lat - nd.z;
    let next = -1;
    if (Math.random() > TURN_BACK) {
      for (const id of nd.edges) {
        const e2 = edges[id];
        if (id === p.edge || !ok[id] || isHorizontal(graph, e2) === isHorizontal(graph, e)) continue;
        const o = nodes[graph.other(id, n)];
        if ((o.x - nd.x) * cx + (o.z - nd.z) * cz > 0) next = id;
      }
    }
    if (next < 0) {
      p.dir = p.dir > 0 ? -1 : 1;
      return;
    }
    const e2 = edges[next];
    p.edge = next;
    p.dir = e2.a === n ? 1 : -1;
    p.s = p.dir > 0 ? sMin(e2) : sMax(e2);
    axis(e2);
    p.side = ax.lx * cx + ax.lz * cz > 0 ? 1 : -1;
  }

  let heyCd = 0;
  let nearCd = 0;
  const m = new THREE.Matrix4();
  const hm = new THREE.Matrix4();
  const tilt = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const one = new THREE.Vector3(1, 1, 1);

  function step(p: Ped, i: number, dt: number, car: CarSample, live: boolean, out: CityEvent[]) {
    const e = edges[p.edge];
    p.hitCd = Math.max(0, p.hitCd - dt);
    p.t += dt;
    const upright = p.state === WALK || p.state === DODGE;

    // ---- hit: inside the car's box (inflated) at speed ----
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    if (upright && p.hitCd <= 0 && car.speed > HIT_SPEED && Math.abs(dx) < 4 && Math.abs(dz) < 4) {
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      if (Math.abs(dx * fx + dz * fz) < CAR_HALF.L + HIT_PAD && Math.abs(dx * fz - dz * fx) < CAR_HALF.W + HIT_PAD) {
        p.state = AIR;
        p.t = 0;
        p.vx = car.vx * LAUNCH_CARRY;
        p.vz = car.vz * LAUNCH_CARRY;
        p.vy = LAUNCH_UP;
        p.spin = (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 5);
        p.hitCd = HIT_COOLDOWN;
        if (live) {
          playSfx('bonk');
          out.push({ type: 'pedHit' });
        }
      }
    }

    // ---- dodge: a fast car heading at us ----
    const sp = Math.hypot(car.vx, car.vz);
    const d2 = dx * dx + dz * dz;
    if (p.state === WALK && sp > DODGE_CLOSING && d2 < DODGE_RANGE * DODGE_RANGE) {
      const vhx = car.vx / sp;
      const vhz = car.vz / sp;
      const ahead = dx * vhx + dz * vhz;
      const perp = dx * vhz - dz * vhx;
      if (ahead > 0 && (sp * ahead) / Math.sqrt(d2) > DODGE_CLOSING && Math.abs(perp) < DODGE_PASS) {
        const sgn = perp >= 0 ? 1 : -1;
        p.state = DODGE;
        p.t = 0;
        p.fx = p.ox;
        p.fz = p.oz;
        p.tx = p.ox + sgn * vhz * DODGE_LEAP;
        p.tz = p.oz - sgn * vhx * DODGE_LEAP;
        p.fast = car.speed > NEAR_SPEED;
        if (live && heyCd <= 0) {
          playSfx('ped_hey');
          heyCd = HEY_COOLDOWN;
        }
      }
    }

    // ---- state ----
    axis(e);
    if (p.state === WALK) {
      if (!p.standing) {
        p.s += p.dir * p.speed * dt;
        if ((p.dir > 0 && p.s > sMax(e)) || (p.dir < 0 && p.s < sMin(e))) {
          p.s = Math.min(Math.max(p.s, sMin(e)), sMax(e));
          corner(p);
          axis(edges[p.edge]);
        }
        p.phase += p.speed * dt * 5.5;
      }
      // Walk back onto the path after a leap or a launch.
      const off = Math.hypot(p.ox, p.oz);
      let rx = 0;
      let rz = 0;
      if (off > 0.01) {
        const k = Math.min(off, RETURN_SPEED * dt) / off;
        rx = -p.ox * k;
        rz = -p.oz * k;
        p.ox += rx;
        p.oz += rz;
      }
      const wx = p.standing ? 0 : ax.x * p.dir * p.speed * dt + rx;
      const wz = p.standing ? 0 : ax.z * p.dir * p.speed * dt + rz;
      if (wx * wx + wz * wz > 1e-8) p.heading = Math.atan2(wx, wz);
      p.y = CURB_H + (p.standing ? 0 : Math.abs(Math.sin(p.phase)) * 0.05);
      p.pitch = 0;
    } else if (p.state === DODGE) {
      const k = Math.min(Math.max((p.t - DODGE_REACT) / DODGE_TIME, 0), 1);
      const ease = 1 - (1 - k) * (1 - k);
      p.ox = p.fx + (p.tx - p.fx) * ease;
      p.oz = p.fz + (p.tz - p.fz) * ease;
      p.y = CURB_H + Math.sin(k * Math.PI) * DODGE_HOP;
      if (p.t > DODGE_REACT + DODGE_TIME + DODGE_HOLD) {
        p.state = WALK;
        if (p.fast && live && nearCd <= 0) {
          out.push({ type: 'nearMiss', target: 'ped' });
          nearCd = NEAR_COOLDOWN;
        }
      }
    } else if (p.state === AIR) {
      p.ox += p.vx * dt;
      p.oz += p.vz * dt;
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      p.pitch += p.spin * dt;
      // Keep the landing spot between the far curb and the building line.
      const e2 = edges[p.edge];
      const latOff = p.ox * ax.lx + p.oz * ax.lz;
      const latTot = p.side * lateral(e2) + latOff;
      const lim = e2.width / 2 + MAX_LAT_FROM_EDGE;
      if (Math.abs(latTot) > lim) {
        const fix = Math.sign(latTot) * lim - latTot;
        p.ox += ax.lx * fix;
        p.oz += ax.lz * fix;
      }
      const ground = Math.abs(latTot) > e2.width / 2 ? CURB_H : 0;
      if (p.y <= ground && p.vy < 0) {
        p.y = ground;
        p.state = DOWN;
        p.t = 0;
        p.pitch = Math.PI / 2;
      }
    } else if (p.state === DOWN) {
      if (p.t > LIE_TIME) {
        p.state = GETUP;
        p.t = 0;
      }
    } else if (p.state === GETUP) {
      p.pitch = (Math.PI / 2) * (1 - Math.min(p.t / GETUP_TIME, 1));
      if (p.t > GETUP_TIME) {
        p.state = FIST;
        p.t = 0;
        p.heading = Math.atan2(car.x - p.x, car.z - p.z); // glare at the driver
      }
    } else if (p.t > FIST_TIME) {
      p.state = WALK;
    }

    // ---- world position + instances ----
    const e3 = edges[p.edge];
    const a = nodes[e3.a];
    const lat = p.side * lateral(e3);
    p.x = a.x + ax.x * p.s + ax.lx * lat + p.ox;
    p.z = a.z + ax.z * p.s + ax.lz * lat + p.oz;
    const shake = p.state === FIST ? Math.sin(p.t * 30) * 0.25 : 0;
    const sway = p.state === WALK && !p.standing ? Math.sin(p.phase) * 0.05 : 0;
    euler.set(p.pitch, p.heading + shake, sway);
    quat.setFromEuler(euler);
    pos.set(p.x, p.y, p.z);
    m.compose(pos, quat, one);
    bodies.setMatrixAt(i, m);
    // Phone users look down at the screen.
    tilt.makeRotationX(p.standing && p.state === WALK ? 0.45 : 0);
    hm.makeTranslation(0, PED_NECK, 0).premultiply(m).multiply(tilt);
    heads.setMatrixAt(i, hm);
  }

  let lastX = graph.spawn.x;
  let lastZ = graph.spawn.z;
  for (const p of peds) spawn(p, lastX, lastZ);

  return {
    update(dt, car, live, out) {
      lastX = car.x;
      lastZ = car.z;
      heyCd = Math.max(0, heyCd - dt);
      nearCd = Math.max(0, nearCd - dt);
      for (let i = 0; i < peds.length; i++) step(peds[i], i, dt, car, live, out);
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
    reset(x, z) {
      for (const p of peds) spawn(p, x, z);
    },
  };
}
