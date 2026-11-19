import type {
  CarSample,
  DecisionOutcome,
  EdgeId,
  LineId,
  NavCommand,
  NavEvent,
  NavScript,
  NavView,
  Navigator,
  NodeId,
  Place,
  RoadGraph,
  SayOptions,
  ShiftModifiers,
  TargetKind,
  TellKind,
  Turn,
  Voice,
} from './types';
import { BASE_MODIFIERS } from './types';
import { getLang } from './lang';
import { SIDEWALK } from '../world/district';

// Lies should usually end at a visible fake road: next to a fake exit the lie chance goes up, elsewhere a lie
// can only be a longer real route, which is rarer.
const LIE_FAKE_MUL = 1.6;
const LIE_DETOUR_MUL = 0.4;
const FALSE_TELL = 0.05;
// Glitch tell: the phone flickers for GLITCH_LEN out of every GLITCH_PERIOD seconds until the command changes.
const GLITCH_LEN = 1.4;
const GLITCH_PERIOD = 2.5;
const GLITCH_FLICKER = 0.09;
// After following a lie into an undiscovered fake street the arrow keeps pointing ahead (and the decision is held
// back) until the blocker is this close or hit, so the player actually gets to see the gag. The blocker is only
// ~15 m past the junction mouth (50 m blocks), so this is short enough that the car really gets there.
const REVEAL_DIST = 8;
// An exit counts once the car is this far past the junction box and moving along the new street.
const EXIT_DEPTH = 2;
const EXIT_DOT = 0.5;
const PRECISE_HOLD = 4; // s the phone shows the exact number that was spoken
const SIGH_COOLDOWN = 10;
const RHYMES = ['', '_2', '_3'] as const; // Rhyme Engine variants per direction
const FLIP_HOLD = 0.6;
const DIR_MIN_SPEED = 1.5;
const OFF_LOST = 2;
const RECALC_SHOW = 1.5;
const FAKE_HIT_RADIUS = 9;
const FAKE_HIT_IMPACT = 3;
const FAKE_HIT_COOLDOWN = 2;
const IGNORE_LINE_CHANCE = 0.4;
const DODGE_LINE_CHANCE = 0.3;
const SIGH_AFTER = 3;
// The next command waits for YOLDAŞ's previous line to finish, unless the intersection is already close.
const QUIET_AFTER_LINE = 2;
const QUIET_AFTER_FAKE_HIT = 2.5;
const URGENT_DIST = 15;
// Grid streets give many equal-length routes: exits within this of the best cost are equally good (never a "lie").
const TIE = 1;
const PASSED_PLACE = 6; // m past the destination before "arrive" becomes "U-turn"

const lieChance = (level: number) => Math.min(0.35, 0.15 + 0.03 * level);
const tellChance = (level: number) => (level < 3 ? 0.95 : 0.75);

interface Cmd {
  pub: NavCommand;
  costs: Map<EdgeId, number>;
  bestCost: number;
  line: LineId;
  opts: SayOptions;
  spoken: boolean;
  glitch: boolean;
  preciseText: string | null; // precise tell: the distance as spoken, shown on the phone for PRECISE_HOLD
}

const NO_VIEW: NavView = { icon: 'none', distance: null, distanceText: null, glitch: false, target: null };

export function createNavigator(graph: RoadGraph, voice: Voice, rand: () => number = Math.random): Navigator {
  const fakeEdges = graph.edges.filter((e) => e.fake);

  let mods: ShiftModifiers = BASE_MODIFIERS;
  let level = 0;
  let script: NavScript | null = null;
  let firstLinePending = false;
  let target: Place | null = null;
  let targetKind: TargetKind | null = null;
  const discovered = new Set<EdgeId>();

  let edge: EdgeId | null = null; // last edge the car was on
  let exitNode: NodeId | null = null; // node the car entered and has not left into an edge yet
  let carX = 0;
  let carZ = 0;
  let carT = 0; // position along `edge`
  let offTime = 0;
  let flipTime = 0;

  let upcoming: NodeId | null = null;
  let cmd: Cmd | null = null;
  let needResolve = false;
  let recalcs = 0;
  let recalcShow = 0;
  let glitchTime = -1;
  let quiet = 0;
  let fakeQuiet = 0;
  let fakeCooldown = 0;
  let preciseHold = 0;
  let sighCooldown = 0;
  let hidden: EdgeId | null = null; // fake street whose dead end is not revealed yet
  let heldOutcome: { outcome: DecisionOutcome; node: NodeId } | null = null;
  let events: NavEvent[] = [];
  // Lie roll of the current node visit: recalcs and re-resolves reuse it instead of rolling again.
  let roll: { n: NodeId; ein: EdgeId; meant: EdgeId; tell: TellKind | null } | null = null;

  const incident = (e: EdgeId, n: NodeId) => graph.edges[e].a === n || graph.edges[e].b === n;

  function travelDir(car: CarSample): [number, number] {
    const v = Math.hypot(car.vx, car.vz);
    return v > DIR_MIN_SPEED ? [car.vx / v, car.vz / v] : [Math.sin(car.heading), Math.cos(car.heading)];
  }

  // End of edge `e` the car is moving toward, or null when moving across it.
  function towardEnd(e: EdgeId, car: CarSample): NodeId | null {
    const ed = graph.edges[e];
    const a = graph.nodes[ed.a];
    const b = graph.nodes[ed.b];
    const [dx, dz] = travelDir(car);
    const d = (dx * (b.x - a.x) + dz * (b.z - a.z)) / Math.hypot(b.x - a.x, b.z - a.z);
    if (Math.abs(d) < 0.3) return null;
    return d > 0 ? ed.b : ed.a;
  }

  // Incident edge the car most likely arrived along.
  function entryEdge(n: NodeId, car: CarSample): EdgeId {
    const node = graph.nodes[n];
    const [dx, dz] = travelDir(car);
    let best = node.edges[0];
    let bestDot = -Infinity;
    for (const e of node.edges) {
      const o = graph.nodes[graph.other(e, n)];
      const l = Math.hypot(node.x - o.x, node.z - o.z);
      const dot = (dx * (node.x - o.x) + dz * (node.z - o.z)) / l;
      if (dot > bestDot) {
        bestDot = dot;
        best = e;
      }
    }
    return best;
  }

  function exitCost(n: NodeId, x: EdgeId, place: Place): number {
    const e = graph.edges[x];
    if (e.fake) return Infinity;
    // distToPlace from the far node would route back along this edge; measure from n directly instead.
    if (place.edge === x) return (n === e.a ? place.t : 1 - place.t) * e.length;
    return e.length + graph.distToPlace(graph.other(x, n), place);
  }

  function react(id: LineId) {
    voice.say(id, { priority: 'react' });
    quiet = QUIET_AFTER_LINE;
  }

  function pickTell(said: Turn): TellKind {
    if (said === 'uturn') return 'glitch';
    const r = rand();
    // Early on the loudest tell (hesitation) dominates so players learn it first.
    if (level < 3) return r < 0.5 ? 'hesitate' : r < 0.7 ? 'suggest' : r < 0.85 ? 'precise' : 'glitch';
    return r < 0.25 ? 'hesitate' : r < 0.5 ? 'suggest' : r < 0.75 ? 'precise' : 'glitch';
  }

  function lineFor(said: Turn, tell: TellKind | null, opts: SayOptions): LineId {
    if (said === 'uturn') return 'dir_uturn';
    if (tell === 'hesitate') {
      opts.hesitant = true;
      return `hes_${said}`;
    }
    if (tell === 'suggest') return `sug_${said}`;
    if (tell === 'precise') return `pre_${said}`;
    if (mods.rude) return `rude_${said}`;
    return mods.rhyme ? `rhyme_${said}${RHYMES[Math.floor(rand() * RHYMES.length)]}` : `dir_${said}`;
  }

  function setCmd(pub: NavCommand, costs: Map<EdgeId, number>, bestCost: number, line: LineId, opts: SayOptions) {
    if (firstLinePending && script?.firstLine) {
      line = script.firstLine;
      opts = {};
    }
    firstLinePending = false;
    cmd = { pub, costs, bestCost, line, opts, spoken: false, glitch: pub.tell === 'glitch', preciseText: null };
    glitchTime = -1;
    events.push({ type: 'command', command: pub });
  }

  // Command for node n, approached along edge ein.
  function issue(n: NodeId, ein: EdgeId) {
    upcoming = n;
    flipTime = 0;
    hidden = null;
    const place = target;
    if (!place) return;
    const e = graph.edges[ein];

    if (place.edge === ein) {
      const towardB = n === e.b;
      const ahead = towardB ? place.t > carT : place.t < carT;
      const pub: NavCommand = { node: -1, said: 'uturn', meantEdge: ein, isLie: false, tell: null, arriveSide: null };
      if (!ahead) return setCmd(pub, new Map(), 0, 'dir_uturn', {});
      const left = ((place.side === 1) === towardB) !== mods.swapLeftRight;
      pub.said = 'arrive';
      pub.arriveSide = left ? 'left' : 'right';
      return setCmd(pub, new Map(), 0, left ? 'dir_arrive_left' : 'dir_arrive_right', {});
    }

    // On a fake street heading for the blocker: the far node is unreachable, the only way on is back.
    if (e.fake && (n === e.b ? carT < 0.5 : carT > 0.5)) {
      const pub: NavCommand = { node: -1, said: 'uturn', meantEdge: ein, isLie: false, tell: null, arriveSide: null };
      if (!discovered.has(ein) && blockerDist(ein) > REVEAL_DIST) {
        // Silent "straight" (the lie was already spoken); node -1 so it never produces a decision.
        hidden = ein;
        setCmd({ ...pub, said: 'straight' }, new Map(), 0, 'dir_straight', {});
        if (cmd) cmd.spoken = true;
        return;
      }
      return setCmd(pub, new Map(), 0, 'dir_uturn', {});
    }

    let exits = graph.nodes[n].edges.filter((x) => x !== ein);
    if (!exits.length) exits = [ein];
    const costs = new Map<EdgeId, number>();
    let best = exits[0];
    let bestCost = Infinity;
    for (const x of exits) {
      const c = exitCost(n, x, place);
      costs.set(x, c);
      if (c < bestCost) {
        bestCost = c;
        best = x;
      }
    }
    if (bestCost === Infinity) {
      // Only fake exits ahead (a dead end): never point into a blocker.
      const pub: NavCommand = { node: -1, said: 'uturn', meantEdge: ein, isLie: false, tell: null, arriveSide: null };
      return setCmd(pub, new Map(), 0, 'dir_uturn', {});
    }
    const from = graph.other(ein, n);
    const turnTo = (x: EdgeId) => graph.turn(from, n, graph.other(x, n));

    let meant = best;
    let line: LineId | null = null;
    let tell: TellKind | null = null;
    let scripted = false;
    const forced = script?.forced;
    const opts: SayOptions = {};
    const rolled = !script && roll !== null && roll.n === n && roll.ein === ein && exits.includes(roll.meant);
    if (script && forced && forced.node === n && exits.includes(forced.exit)) {
      meant = forced.exit;
      line = forced.line;
      script = { ...script, forced: undefined };
      // The FTUE lie carries the two loudest tells so the hint that follows refers to something the player saw.
      tell = 'hesitate';
      opts.hesitant = true;
      scripted = true;
    } else if (rolled && roll) {
      meant = roll.meant;
      tell = roll.tell;
    } else if (!script) {
      // Scripted sessions (FTUE) stay deterministic: no random lies or tells.
      const fakes = exits.filter((x) => graph.edges[x].fake);
      const fresh = fakes.filter((x) => !discovered.has(x));
      const alts = fresh.length
        ? fresh
        : fakes.length
          ? fakes
          : exits.filter((x) => (costs.get(x) ?? Infinity) > bestCost + TIE && turnTo(x) !== 'uturn');
      const p = lieChance(level) * mods.lieChanceMul * (fakes.length ? LIE_FAKE_MUL : LIE_DETOUR_MUL);
      if (alts.length && rand() < p) meant = alts[Math.floor(rand() * alts.length)];
    }

    const isLie = (costs.get(meant) ?? Infinity) > bestCost + TIE;
    let said = turnTo(meant);
    if (mods.swapLeftRight) said = said === 'left' ? 'right' : said === 'right' ? 'left' : said;

    if (!line && !script && !rolled && rand() < (isLie ? tellChance(level) * mods.tellChanceMul : FALSE_TELL)) {
      tell = pickTell(said);
    }
    if (!script) roll = { n, ein, meant, tell };
    if (!line) line = lineFor(said, tell, opts);
    setCmd({ node: n, said, meantEdge: meant, isLie, tell, arriveSide: null }, costs, bestCost, line, opts);
    if (scripted && cmd) cmd.glitch = true;
  }

  function blockerDist(x: EdgeId): number {
    const e = graph.edges[x];
    return Math.hypot(carX - e.blockerX, carZ - e.blockerZ);
  }

  function releaseOutcome() {
    if (!heldOutcome) return;
    events.push({ type: 'decision', ...heldOutcome });
    heldOutcome = null;
  }

  // Past the junction box and heading along edge x, away from node n.
  function exitCommitted(n: NodeId, x: EdgeId, car: CarSample): boolean {
    const nd = graph.nodes[n];
    const o = graph.nodes[graph.other(x, n)];
    const len = Math.hypot(o.x - nd.x, o.z - nd.z);
    const [ux, uz] = [(o.x - nd.x) / len, (o.z - nd.z) / len];
    const depth = (carX - nd.x) * ux + (carZ - nd.z) * uz;
    const half = Math.abs(ux) > 0.5 ? nd.halfX : nd.halfZ;
    const [dx, dz] = travelDir(car);
    return depth >= half + SIDEWALK + EXIT_DEPTH && dx * ux + dz * uz > EXIT_DOT;
  }

  function decide(n: NodeId, x: EdgeId, c: Cmd) {
    let outcome: DecisionOutcome;
    if (x === c.pub.meantEdge) outcome = c.pub.isLie ? 'followLie' : 'followTruth';
    // Another exit as short as the meant one is not ignoring the truth (grids are full of ties).
    else if (!c.pub.isLie) outcome = (c.costs.get(x) ?? Infinity) <= c.bestCost + TIE ? 'followTruth' : 'ignoreTruth';
    else outcome = (c.costs.get(x) ?? Infinity) <= c.bestCost + TIE ? 'dodgeLie' : 'ignoreLie';
    if (graph.edges[x].fake && !discovered.has(x)) {
      heldOutcome = { outcome, node: n }; // released with the dead-end reveal
      return;
    }
    events.push({ type: 'decision', outcome, node: n });
    if (outcome === 'ignoreTruth' && rand() < IGNORE_LINE_CHANCE) react(rand() < 0.5 ? 're_ignore_1' : 're_ignore_2');
    else if (outcome === 'dodgeLie' && rand() < DODGE_LINE_CHANCE) react('re_dodged');
  }

  function onExit(n: NodeId, x: EdgeId) {
    releaseOutcome();
    if (cmd && cmd.pub.node === n) decide(n, x, cmd);
    issue(graph.other(x, n), x);
  }

  function recalc() {
    events.push({ type: 'recalc' });
    recalcShow = RECALC_SHOW;
    recalcs++;
    // Right after a fake-road crash the crash line already covers it.
    if (fakeQuiet > 0) return;
    if (recalcs < SIGH_AFTER) react('re_recalc');
    else if (sighCooldown <= 0) {
      sighCooldown = SIGH_COOLDOWN;
      react('re_recalc_sigh');
    }
  }

  function resolveOnEdge(x: EdgeId, car: CarSample) {
    needResolve = false;
    releaseOutcome();
    const e = graph.edges[x];
    const t = towardEnd(x, car) ?? (upcoming !== null && incident(x, upcoming) ? upcoming : e.b);
    issue(t, x);
  }

  function resolveInNode(n: NodeId, car: CarSample) {
    needResolve = false;
    releaseOutcome();
    const ein = entryEdge(n, car);
    carT = graph.edges[ein].b === n ? 1 : 0;
    issue(n, ein);
  }

  function flipCheck(x: EdgeId, car: CarSample, dt: number) {
    const t = towardEnd(x, car);
    if (t === null || t === upcoming) {
      flipTime = 0;
      return;
    }
    flipTime += dt;
    if (flipTime < FLIP_HOLD) return;
    // Obeying "Make a U-turn" is not a recalculation, nor is turning back early on a fake street.
    const wasUturn = cmd?.pub.said === 'uturn' || hidden === x;
    releaseOutcome();
    issue(t, x);
    if (!wasUturn) recalc();
  }

  function cmdDistance(): number | null {
    if (!cmd || !target) return null;
    if (cmd.pub.said === 'uturn') return null;
    if (cmd.pub.said === 'arrive') return Math.abs(target.t - carT) * graph.edges[target.edge].length;
    if (cmd.pub.node < 0) return null;
    const n = graph.nodes[cmd.pub.node];
    return Math.hypot(carX - n.x, carZ - n.z);
  }

  function fmt1(d: number): string {
    const s = d.toFixed(1);
    return getLang() === 'tr' ? s.replace('.', ',') : s;
  }

  function speakCheck() {
    if (!cmd || cmd.spoken) return;
    const d = cmdDistance();
    // The precise tell is called early so its number (the real distance, to the decimetre) reads odd.
    const precise = cmd.pub.tell === 'precise' && d !== null;
    if (d !== null && d > mods.callDistance && !precise) return;
    if (fakeQuiet > 0 || (quiet > 0 && (d === null || d > URGENT_DIST))) return;
    const params: Record<string, string> = {};
    if (precise) {
      cmd.preciseText = fmt1(d);
      params.d = cmd.preciseText;
      preciseHold = PRECISE_HOLD;
    }
    voice.say(cmd.line, { priority: 'nav', params, hesitant: cmd.opts.hesitant });
    cmd.spoken = true;
    events.push({ type: 'told', command: cmd.pub });
    quiet = QUIET_AFTER_LINE;
    if (cmd.glitch) glitchTime = 0;
  }

  function checkFakeHit(car: CarSample) {
    if (fakeCooldown > 0 || car.impact < FAKE_HIT_IMPACT) return;
    let hit: EdgeId = -1;
    let bestD = FAKE_HIT_RADIUS;
    for (const e of fakeEdges) {
      const d = Math.hypot(car.x - e.blockerX, car.z - e.blockerZ);
      if (d < bestD) {
        bestD = d;
        hit = e.id;
      }
    }
    if (hit < 0) return;
    fakeCooldown = FAKE_HIT_COOLDOWN;
    const first = !discovered.has(hit);
    discovered.add(hit);
    events.push({ type: 'fakeRoadHit', edge: hit, first });
    let line: LineId = first ? 're_crash_mine' : 're_dead_end';
    if (script?.fakeHitLine) {
      line = script.fakeHitLine;
      script = { ...script, fakeHitLine: undefined };
    }
    voice.say(line, { priority: 'react' });
    quiet = QUIET_AFTER_FAKE_HIT;
    fakeQuiet = QUIET_AFTER_FAKE_HIT;
  }

  function track(dt: number, car: CarSample) {
    const pos = graph.locate(car.x, car.z);
    if (pos.kind === 'off') {
      offTime += dt;
      return;
    }
    const lost = offTime > OFF_LOST;
    offTime = 0;

    if (pos.kind === 'node') {
      exitNode = pos.node;
      if (target && (needResolve || lost)) {
        const wasResolve = needResolve;
        resolveInNode(pos.node, car);
        if (lost && !wasResolve) recalc();
      }
      return;
    }

    const x = pos.edge;
    carT = pos.t;
    if (!target) {
      // Keep tracking position only; routing starts with the next setTarget.
    } else if (needResolve || lost) {
      const wasResolve = needResolve;
      resolveOnEdge(x, car);
      if (lost && !wasResolve) recalc();
    } else if (exitNode !== null && incident(x, exitNode)) {
      if (!exitCommitted(exitNode, x, car)) return; // still in the junction's mouth: keep the exit pending
      onExit(exitNode, x);
    } else if (x !== edge && edge !== null && upcoming !== null && incident(x, upcoming) && incident(edge, upcoming)) {
      onExit(upcoming, x); // corner cut across the sidewalk, never touched the intersection box
    } else if (x !== edge) {
      resolveOnEdge(x, car); // teleport (car placed by the shift)
    } else if (hidden === x && (discovered.has(x) || blockerDist(x) <= REVEAL_DIST)) {
      issue(upcoming as NodeId, x); // now the U-turn
      releaseOutcome();
    } else {
      flipCheck(x, car, dt);
      if (cmd?.pub.said === 'arrive' && x === target.edge) {
        const towardB = upcoming === graph.edges[x].b;
        const passed = (towardB ? carT - target.t : target.t - carT) * graph.edges[x].length;
        if (passed > PASSED_PLACE) issue(upcoming as NodeId, x);
      }
    }
    exitNode = null;
    edge = x;
  }

  return {
    setTarget(place, kind) {
      target = place;
      targetKind = kind;
      cmd = null;
      roll = null;
      hidden = null;
      heldOutcome = null;
      glitchTime = -1;
      // The first command of a new leg waits for the line that announced it (pickup, order start).
      quiet = QUIET_AFTER_LINE;
      if (kind !== 'dropoff') recalcs = 0;
      needResolve = place !== null;
      if (!place) upcoming = null;
    },
    setModifiers(m) {
      mods = m;
    },
    setDifficulty(l) {
      level = l;
    },
    setScript(s) {
      script = s;
      firstLinePending = !!s?.firstLine;
      if (cmd && !cmd.spoken && s?.firstLine) {
        cmd.line = s.firstLine;
        cmd.opts = {};
        firstLinePending = false;
      }
    },
    relocate() {
      offTime = 0;
      flipTime = 0;
      if (!target) return;
      needResolve = true;
      recalc();
    },
    reset() {
      discovered.clear();
      script = null;
      firstLinePending = false;
      target = null;
      targetKind = null;
      cmd = null;
      roll = null;
      hidden = null;
      heldOutcome = null;
      upcoming = null;
      needResolve = false;
      recalcs = 0;
      recalcShow = 0;
      glitchTime = -1;
      quiet = 0;
      fakeQuiet = 0;
      fakeCooldown = 0;
      offTime = 0;
      flipTime = 0;
    },
    update(dt, car) {
      events = [];
      quiet -= dt;
      fakeQuiet -= dt;
      fakeCooldown -= dt;
      recalcShow -= dt;
      preciseHold -= dt;
      sighCooldown -= dt;
      if (glitchTime >= 0) glitchTime += dt;
      carX = car.x;
      carZ = car.z;

      checkFakeHit(car);

      track(dt, car);
      if (target) speakCheck();
      return events;
    },
    view() {
      if (!target) return NO_VIEW;
      const recalcing = offTime > OFF_LOST || recalcShow > 0;
      const c = cmd;
      let icon: NavView['icon'] = 'none';
      if (recalcing) icon = 'recalc';
      else if (c) icon = c.pub.said === 'arrive' ? (c.pub.arriveSide === 'left' ? 'arrive_left' : 'arrive_right') : c.pub.said;
      const distance = recalcing || mods.hideDistance ? null : cmdDistance();
      let distanceText: string | null = null;
      if (distance !== null && c?.pub.tell === 'precise') {
        distanceText = `${c.preciseText !== null && preciseHold > 0 ? c.preciseText : fmt1(distance)} m`;
      } else if (distance !== null) distanceText = `${Math.round(distance / 5) * 5} m`;
      const glitch =
        glitchTime >= 0 && glitchTime % GLITCH_PERIOD < GLITCH_LEN && Math.floor(glitchTime / GLITCH_FLICKER) % 3 !== 2;
      return { icon, distance, distanceText, glitch, target: targetKind };
    },
  };
}
