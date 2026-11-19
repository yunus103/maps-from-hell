import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { CarSample, CityEvent, RoadEdge, RoadGraph } from '../game/types';
import { QUALITY, MOBILE } from '../quality';
import { playSfx } from '../sfx';
import { AGENT_GROUPS, DOLMUS, SEDAN, createInstanced, dolmusGeometry, sedanGeometry } from './agentMesh';
import type { Parked } from './parked';
import { agentEdges, nodeHalfAlong } from './roadGraph';

// Kinematic AI cars driving the right-hand lane of the road graph. They stop for the player and each other,
// yield at junctions, honk, and a dolmuş now and then pulls over. Hitting one is a normal physics impact.

const POOL_MUL = 1.6; // pool = ceil(QUALITY.traffic × this), so Live Traffic can add cars without allocating
const DOLMUS_COUNT = MOBILE ? 1 : 2;
const CRUISE = [7, 10]; // m/s, per car
const JUNCTION_SPEED = 4.5; // m/s within JUNCTION_NEAR of a node centre
const JUNCTION_NEAR = 12;
const SOFT_BRAKE = 3; // m/s², speed profile towards a junction
const ACCEL = 3;
const DECEL = 8;
const LANE_FROM_EDGE = 3; // lane centre = width/2 − 3: 2 m on 10 m streets, 3 m on the avenues
const BOX_PAD = 1; // turn curves start/end this far outside the junction box
const LOOK = 9; // look-ahead box length past the front bumper
const LOOK_HALF = 1.6;
const FRONT_CLEAR = 3.2; // player this close to the front bumper blocks too (catches turns)
const RESUME = 0.6; // s after the path is clear
const HONK_AFTER = 2.5;
const HONK_CHANCE = 0.3;
const HONK_COOLDOWN = 6;
const AI_DEADLOCK = 3; // blocked by AI this long, in a cycle of cars blocking each other → ignore AI for AI_IGNORE
const AI_IGNORE = 2;
const YIELD_MAX = 2; // s waiting for a busy junction
// Kinematic cars can't be pushed: one the player blocks (often head-on at a curbside drop zone) backs off, and if
// it is still stuck much later it respawns elsewhere once the player isn't looking at it.
const STANDOFF = 3; // s blocked by the player before backing up
const BACK_TIME = 2.5;
const BACK_SPEED = 2; // m/s
const STUCK_RESPAWN = 10; // s blocked by the player (unblocked time counts back at half speed)
const SIGHT_DIST = 60; // m: farther than this, or behind the player, counts as unseen
const HIT_IMPACT = 3;
const HIT_REACH = 2.5; // player centre within this of the car's box
const HIT_STOP = 3;
const NEAR_SPEED = 8;
const NEAR_GAP = 1.3;
const NEAR_CONFIRM = 0.4;
const NEAR_COOLDOWN = 3;
const PLAYER_HALF_W = 0.93;
const PLAYER_HALF_L = 2.25;
const DOLMUS_EVERY = [20, 35];
const DOLMUS_STOP = 3;
const DOLMUS_PULL = 1.5; // s to move over to / back from the curb
const DOLMUS_CURB = 1.1; // centre from the road edge while stopped
const DOLMUS_ROOM = 25; // m of edge left needed to start a stop
const SPAWN_MIN_DIST = 40;
const SPAWN_GAP = 14;
const HORN_RANGE = 50;
const COLORS = [0xf2f2f2, 0xb8bcc2, 0x4a4e55, 0x26282c, 0xb3302b, 0x2f5d9a, 0xf2c12e, 0xf2c12e, 0x2f5a44, 0xd8c7a0];

type AiCar = {
  dolmus: boolean;
  mesh: THREE.InstancedMesh;
  slot: number;
  body: RAPIER.RigidBody;
  halfL: number;
  halfW: number;
  active: boolean;
  edge: number;
  dir: 1 | -1; // +1 = a→b
  s: number; // m from the start node centre along the travel direction
  turning: boolean;
  node: number;
  next: number;
  nextDir: 1 | -1;
  u: number;
  turnLen: number;
  p: number[]; // bezier control points x0 z0 x1 z1 x2 z2
  speed: number;
  cruise: number;
  x: number;
  z: number;
  heading: number;
  clear: number;
  blockP: number;
  blockA: number;
  blocker: number; // index of the AI car in the look-ahead box, -1 = none
  ignoreAi: number;
  yieldT: number;
  hornCd: number;
  hitStop: number;
  nearCd: number;
  nearPending: number;
  pull: number; // 0 = lane, 1 = at the curb
  stopPhase: 0 | 1 | 2 | 3; // drive, pulling in, stopped, pulling out
  stopT: number;
  backT: number; // s of backing up left
  stuckT: number;
};

export interface Traffic {
  update(dt: number, car: CarSample, live: boolean, out: CityEvent[]): void;
  setDensity(mul: number): void;
  reset(x: number, z: number): void;
}

const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

export function createTraffic(scene: THREE.Scene, world: RAPIER.World, graph: RoadGraph, material: THREE.Material, parked: Parked): Traffic {
  const { nodes, edges } = graph;
  const ok = agentEdges(graph);
  const okIds = edges.filter((e) => ok[e.id]).map((e) => e.id);
  const nodeBusy = new Int16Array(nodes.length);
  const pool = Math.ceil(QUALITY.traffic * POOL_MUL);
  const sedans = createInstanced(sedanGeometry(true), material, pool - DOLMUS_COUNT, true);
  const dolmuses = createInstanced(dolmusGeometry(), material, DOLMUS_COUNT, true);
  scene.add(sedans, dolmuses);
  const color = new THREE.Color();
  const m = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const vec = { x: 0, y: 0, z: 0 };
  const rot = { x: 0, y: 0, z: 0, w: 1 };

  const cars: AiCar[] = [];
  for (let i = 0; i < pool; i++) {
    const dolmus = i < DOLMUS_COUNT;
    const dims = dolmus ? DOLMUS : SEDAN;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(dims.halfW, dims.halfH, dims.halfL)
        .setTranslation(0, dims.halfH, 0)
        .setFriction(0.2)
        .setCollisionGroups(AGENT_GROUPS),
      body,
    );
    body.setEnabled(false);
    cars.push({
      dolmus, mesh: dolmus ? dolmuses : sedans, slot: dolmus ? i : i - DOLMUS_COUNT, body,
      halfL: dims.halfL, halfW: dims.halfW, active: false,
      edge: 0, dir: 1, s: 0, turning: false, node: 0, next: 0, nextDir: 1, u: 0, turnLen: 1, p: [0, 0, 0, 0, 0, 0],
      speed: 0, cruise: 8, x: 0, z: 0, heading: 0,
      clear: 0, blockP: 0, blockA: 0, blocker: -1, ignoreAi: 0, yieldT: 0, hornCd: 0, hitStop: 0, nearCd: 0, nearPending: 0,
      pull: 0, stopPhase: 0, stopT: rnd(DOLMUS_EVERY), backT: 0, stuckT: 0,
    });
  }

  // ---------- lane geometry ----------
  const startNode = (e: RoadEdge, dir: number) => (dir > 0 ? e.a : e.b);
  const endNode = (e: RoadEdge, dir: number) => (dir > 0 ? e.b : e.a);
  const sStart = (e: RoadEdge, dir: number) => nodeHalfAlong(graph, e, startNode(e, dir)) + BOX_PAD;
  const sEnd = (e: RoadEdge, dir: number) => e.length - nodeHalfAlong(graph, e, endNode(e, dir)) - BOX_PAD;
  const laneOff = (e: RoadEdge) => e.width / 2 - LANE_FROM_EDGE;
  // Travel direction (ux, uz) of edge e in direction dir; written to `dirOut`.
  const dirOut = { x: 0, z: 0 };
  function travel(e: RoadEdge, dir: number) {
    const [a, b] = [nodes[e.a], nodes[e.b]];
    dirOut.x = (dir * (b.x - a.x)) / e.length;
    dirOut.z = (dir * (b.z - a.z)) / e.length;
  }
  // Point `s` along the lane, `off` metres to the right of the travel direction; written to `pt`.
  const pt = { x: 0, z: 0 };
  function lanePoint(e: RoadEdge, dir: number, s: number, off: number) {
    travel(e, dir);
    const st = nodes[startNode(e, dir)];
    // Right of travel is (−uz, ux): facing +Z the right is −X (the car's left is +X).
    pt.x = st.x + dirOut.x * s - dirOut.z * off;
    pt.z = st.z + dirOut.z * s + dirOut.x * off;
  }

  function place(c: AiCar) {
    const e = edges[c.edge];
    if (c.turning) {
      const p = c.p;
      const u = c.u;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const k = u * u;
      c.x = a * p[0] + b * p[2] + k * p[4];
      c.z = a * p[1] + b * p[3] + k * p[5];
      const dx = 2 * (1 - u) * (p[2] - p[0]) + 2 * u * (p[4] - p[2]);
      const dz = 2 * (1 - u) * (p[3] - p[1]) + 2 * u * (p[5] - p[3]);
      if (dx * dx + dz * dz > 1e-6) c.heading = Math.atan2(dx, dz);
    } else {
      const lane = laneOff(e);
      lanePoint(e, c.dir, c.s, lane + c.pull * (e.width / 2 - DOLMUS_CURB - lane));
      c.x = pt.x;
      c.z = pt.z;
      c.heading = Math.atan2(dirOut.x, dirOut.z);
    }
  }

  // Picks the exit at the end node and lays the turn curve from the lane end to the next lane's start.
  function beginTurn(c: AiCar) {
    const e = edges[c.edge];
    const node = endNode(e, c.dir);
    const nd = nodes[node];
    let exits = 0;
    for (const id of nd.edges) if (id !== c.edge && ok[id]) exits++;
    let next = c.edge; // U-turn when the street is a dead end for traffic (ramp / fake exits only)
    if (exits > 0) {
      let k = Math.floor(Math.random() * exits);
      for (const id of nd.edges) if (id !== c.edge && ok[id] && k-- === 0) next = id;
    }
    const ne = edges[next];
    const nextDir: 1 | -1 = ne.a === node ? 1 : -1;
    lanePoint(e, c.dir, sEnd(e, c.dir), laneOff(e));
    const [x0, z0] = [pt.x, pt.z];
    travel(e, c.dir);
    const [ux, uz] = [dirOut.x, dirOut.z];
    lanePoint(ne, nextDir, sStart(ne, nextDir), laneOff(ne));
    const [x2, z2] = [pt.x, pt.z];
    let x1: number;
    let z1: number;
    if (next === c.edge) {
      // Swing past the node centre so the U-turn has some radius.
      const reach = 2 * nodeHalfAlong(graph, e, node) + 2;
      [x1, z1] = [nd.x + ux * reach, nd.z + uz * reach];
    } else {
      travel(ne, nextDir);
      if (ux * dirOut.x + uz * dirOut.z > 0.5) [x1, z1] = [(x0 + x2) / 2, (z0 + z2) / 2];
      else if (Math.abs(ux) > 0.5) [x1, z1] = [x2, z0]; // corner where the two lane lines cross
      else [x1, z1] = [x0, z2];
    }
    const p = c.p;
    [p[0], p[1], p[2], p[3], p[4], p[5]] = [x0, z0, x1, z1, x2, z2];
    const d01 = Math.hypot(x1 - x0, z1 - z0);
    const d12 = Math.hypot(x2 - x1, z2 - z1);
    const d02 = Math.hypot(x2 - x0, z2 - z0);
    c.turnLen = Math.max((d01 + d12 + d02) / 2, 1);
    c.node = node;
    c.next = next;
    c.nextDir = nextDir;
    c.turning = true;
    c.u = 0;
    nodeBusy[node]++;
  }

  function endTurn(c: AiCar) {
    nodeBusy[c.node]--;
    c.turning = false;
    c.edge = c.next;
    c.dir = c.nextDir;
    c.s = sStart(edges[c.edge], c.dir);
  }

  let lastX = graph.spawn.x;
  let lastZ = graph.spawn.z;

  function spawn(c: AiCar) {
    if (c.turning) {
      nodeBusy[c.node]--;
      c.turning = false;
    }
    for (let tries = 0; tries < 40; tries++) {
      const e = edges[okIds[Math.floor(Math.random() * okIds.length)]];
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const [s0, s1] = [sStart(e, dir) + 3, sEnd(e, dir) - 3];
      if (s1 <= s0) continue;
      const s = s0 + Math.random() * (s1 - s0);
      lanePoint(e, dir, s, laneOff(e));
      if (tries < 30 && Math.hypot(pt.x - lastX, pt.z - lastZ) < SPAWN_MIN_DIST) continue;
      if (cars.some((o) => o !== c && o.active && Math.hypot(o.x - pt.x, o.z - pt.z) < SPAWN_GAP)) continue;
      c.edge = e.id;
      c.dir = dir;
      c.s = s;
      break;
    }
    c.cruise = rnd(CRUISE);
    c.speed = c.cruise * 0.7;
    c.clear = c.blockP = c.blockA = c.ignoreAi = c.yieldT = c.hitStop = c.nearPending = c.backT = c.stuckT = 0;
    c.pull = 0;
    c.stopPhase = 0;
    c.stopT = rnd(DOLMUS_EVERY);
    place(c);
    if (!c.dolmus) {
      c.mesh.setColorAt(c.slot, color.setHex(COLORS[Math.floor(Math.random() * COLORS.length)]));
      c.mesh.instanceColor!.needsUpdate = true;
    }
    c.body.setEnabled(true);
    vec.x = c.x;
    vec.z = c.z;
    rot.y = Math.sin(c.heading / 2);
    rot.w = Math.cos(c.heading / 2);
    c.body.setTranslation(vec, true);
    c.body.setRotation(rot, true);
  }

  function setActive(c: AiCar, on: boolean) {
    if (on === c.active) return;
    c.active = on;
    if (on) spawn(c);
    else {
      if (c.turning) {
        nodeBusy[c.node]--;
        c.turning = false;
      }
      c.body.setEnabled(false);
      c.mesh.setMatrixAt(c.slot, hidden);
    }
  }

  // Is (x, z) inside c's look-ahead box, given the other body's half length?
  function ahead(c: AiCar, x: number, z: number, otherHalfL: number) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const dx = x - c.x;
    const dz = z - c.z;
    const along = dx * fx + dz * fz;
    const lat = dx * fz - dz * fx;
    return along > 0 && along < c.halfL + otherHalfL + LOOK && Math.abs(lat) < LOOK_HALF;
  }

  // Distance from (x, z) to c's footprint rectangle.
  function boxDist(c: AiCar, x: number, z: number) {
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const dx = x - c.x;
    const dz = z - c.z;
    const qa = Math.max(Math.abs(dx * fx + dz * fz) - c.halfL, 0);
    const ql = Math.max(Math.abs(dx * fz - dz * fx) - c.halfW, 0);
    return Math.hypot(qa, ql);
  }

  function inCycle(c: AiCar) {
    let k = c.blocker;
    for (let n = 0; n < cars.length && k >= 0; n++) {
      if (cars[k] === c) return true;
      k = cars[k].blocker;
    }
    return false;
  }

  function honk(c: AiCar, car: CarSample, live: boolean) {
    const gain = 1 - Math.hypot(c.x - car.x, c.z - car.z) / HORN_RANGE;
    if (live && gain > 0) playSfx('horn', gain);
  }

  function seenBy(c: AiCar, car: CarSample) {
    const dx = c.x - car.x;
    const dz = c.z - car.z;
    return dx * Math.sin(car.heading) + dz * Math.cos(car.heading) > 0 && Math.hypot(dx, dz) < SIGHT_DIST;
  }

  function step(c: AiCar, dt: number, car: CarSample, live: boolean, out: CityEvent[]) {
    if (c.stuckT > STUCK_RESPAWN && !seenBy(c, car)) spawn(c);
    const e = edges[c.edge];
    c.clear = Math.max(0, c.clear - dt);
    c.ignoreAi = Math.max(0, c.ignoreAi - dt);
    c.hornCd = Math.max(0, c.hornCd - dt);
    c.hitStop = Math.max(0, c.hitStop - dt);
    c.nearCd = Math.max(0, c.nearCd - dt);

    // ---- blocking ----
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const frontDist = Math.hypot(car.x - (c.x + fx * c.halfL), car.z - (c.z + fz * c.halfL));
    const blockedP = ahead(c, car.x, car.z, PLAYER_HALF_L) || frontDist < FRONT_CLEAR;
    c.blocker = -1;
    if (c.ignoreAi <= 0) {
      for (let k = 0; k < cars.length; k++) {
        const o = cars[k];
        if (o === c || !o.active || Math.abs(o.x - c.x) > 20 || Math.abs(o.z - c.z) > 20) continue;
        if (ahead(c, o.x, o.z, o.halfL)) {
          c.blocker = k;
          break;
        }
      }
    }
    const blockedA = c.blocker >= 0;
    c.blockP = blockedP ? c.blockP + dt : 0;
    if (c.blockP > HONK_AFTER && c.hornCd <= 0) {
      if (Math.random() < HONK_CHANCE) honk(c, car, live);
      c.hornCd = HONK_COOLDOWN;
    }
    c.blockA = blockedA ? c.blockA + dt : 0;
    // Only a real deadlock (the chain of blockers comes back to this car) breaks; an ordinary queue waits.
    if (c.blockA > AI_DEADLOCK && inCycle(c)) {
      c.ignoreAi = AI_IGNORE;
      c.blockA = 0;
    }
    if (blockedP || (blockedA && c.ignoreAi <= 0)) c.clear = RESUME;
    if (c.blockP > STANDOFF && c.backT <= 0 && !c.turning && c.s > sStart(e, c.dir) + 1) {
      c.backT = BACK_TIME;
      c.blockP = 0;
    }
    c.stuckT = Math.max(0, c.stuckT + (blockedP ? dt : -dt / 2));

    // ---- player contact ----
    const gap = boxDist(c, car.x, car.z);
    if (live && car.impact >= HIT_IMPACT && gap < HIT_REACH && c.hitStop <= 0) {
      out.push({ type: 'trafficHit', impact: car.impact });
      c.hitStop = HIT_STOP;
      c.nearPending = 0;
      honk(c, car, live);
    }
    if (c.nearPending > 0) {
      c.nearPending -= dt;
      if (c.nearPending <= 0) {
        c.nearCd = NEAR_COOLDOWN;
        if (live) out.push({ type: 'nearMiss', target: 'car' });
      }
    } else if (live && c.nearCd <= 0 && c.hitStop <= 0 && car.speed > NEAR_SPEED) {
      const clearance = gap - PLAYER_HALF_W;
      if (clearance > 0.05 && clearance < NEAR_GAP) c.nearPending = NEAR_CONFIRM;
    }

    // ---- dolmuş stops ----
    if (c.dolmus && !c.turning) {
      if (c.stopPhase === 0) {
        c.stopT -= dt;
        const room = sEnd(e, c.dir) - c.s;
        if (c.stopT <= 0 && room > DOLMUS_ROOM) {
          // Curb side is the right of travel: side −1 (left of a→b is +1) when driving a→b.
          const sA = c.dir > 0 ? c.s : e.length - c.s;
          const sB = sA + c.dir * 14;
          if (parked.curbFree(e.id, c.dir > 0 ? -1 : 1, sA, sB)) c.stopPhase = 1;
          else c.stopT = 3; // try again a bit further on
        }
      } else if (c.stopPhase === 1) {
        c.pull = Math.min(1, c.pull + dt / DOLMUS_PULL);
        if (c.pull >= 1 && c.speed <= 0.05) {
          c.stopPhase = 2;
          c.stopT = DOLMUS_STOP;
        }
      } else if (c.stopPhase === 2) {
        c.stopT -= dt;
        if (c.stopT <= 0) c.stopPhase = 3;
      } else {
        c.pull = Math.max(0, c.pull - dt / DOLMUS_PULL);
        if (c.pull <= 0) {
          c.stopPhase = 0;
          c.stopT = rnd(DOLMUS_EVERY);
        }
      }
    }

    // ---- speed ----
    let target = c.cruise;
    if (c.turning) target = JUNCTION_SPEED;
    else {
      const toNode = e.length - c.s - JUNCTION_NEAR;
      target = Math.min(target, Math.sqrt(JUNCTION_SPEED ** 2 + 2 * SOFT_BRAKE * Math.max(toNode, 0)));
      if (c.s < JUNCTION_NEAR) target = Math.min(target, JUNCTION_SPEED + (c.s / JUNCTION_NEAR) * 2);
    }
    if (c.stopPhase === 1) target = c.pull >= 1 ? 0 : Math.min(target, JUNCTION_SPEED);
    if (c.stopPhase === 2) target = 0;
    if (c.stopPhase === 3) target = Math.min(target, JUNCTION_SPEED);
    if (c.clear > 0 || c.hitStop > 0) target = 0;
    c.speed = c.speed < target ? Math.min(target, c.speed + ACCEL * dt) : Math.max(target, c.speed - DECEL * dt);

    // ---- move ----
    if (c.backT > 0) {
      c.backT -= dt;
      c.speed = 0;
      c.s = Math.max(sStart(e, c.dir), c.s - BACK_SPEED * dt);
    } else if (c.turning) {
      c.u += (c.speed * dt) / c.turnLen;
      if (c.u >= 1) endTurn(c);
    } else {
      c.s += c.speed * dt;
      const end = sEnd(e, c.dir);
      if (c.s >= end) {
        c.s = end;
        if (c.pull > 0) {
          c.pull = 0;
          c.stopPhase = 0;
          c.stopT = rnd(DOLMUS_EVERY);
        }
        // Yield while another car is turning through this junction (at most YIELD_MAX).
        if (nodeBusy[endNode(e, c.dir)] > 0 && c.yieldT < YIELD_MAX) {
          c.yieldT += dt;
          c.speed = 0;
        } else {
          c.yieldT = 0;
          beginTurn(c);
        }
      }
    }
    place(c);

    vec.x = c.x;
    vec.z = c.z;
    rot.y = Math.sin(c.heading / 2);
    rot.w = Math.cos(c.heading / 2);
    c.body.setNextKinematicTranslation(vec);
    c.body.setNextKinematicRotation(rot);
    c.mesh.setMatrixAt(c.slot, m.makeRotationY(c.heading).setPosition(c.x, 0, c.z));
  }

  let density = 1;
  function setDensity(mul: number) {
    density = mul;
    const n = Math.min(Math.max(Math.round(QUALITY.traffic * mul), 0), pool);
    cars.forEach((c, i) => setActive(c, i < n));
    sedans.instanceMatrix.needsUpdate = true;
    dolmuses.instanceMatrix.needsUpdate = true;
  }

  for (const c of cars) c.mesh.setMatrixAt(c.slot, hidden);
  setDensity(density);

  return {
    update(dt, car, live, out) {
      lastX = car.x;
      lastZ = car.z;
      for (const c of cars) if (c.active) step(c, dt, car, live, out);
      sedans.instanceMatrix.needsUpdate = true;
      dolmuses.instanceMatrix.needsUpdate = true;
    },
    setDensity,
    reset(x, z) {
      lastX = x;
      lastZ = z;
      for (const c of cars) if (c.active) spawn(c);
      sedans.instanceMatrix.needsUpdate = true;
      dolmuses.instanceMatrix.needsUpdate = true;
    },
  };
}
