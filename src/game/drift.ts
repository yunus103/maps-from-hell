// Drift scoring (Tony Hawk style): drifts score angle × speed × time, linked drifts raise the chain multiplier,
// points bank only when the chain ends cleanly, a crash eats it. Bonuses: near miss, drift park, route style.
import type {
  CarSample, CityEvent, DriftEvent, DriftScore, DriftView, L10n, Mood, NavEvent, NodeId, RoadGraph, ShiftEvent,
  ShiftState, Voice,
} from './types';
import { playSfx } from '../sfx';

const RAD2DEG = 180 / Math.PI;
const LINK_TIME = 1.8; // s after a drift ends in which the next drift links into the chain
const CHAIN_CAP = 10;
const CHAIN_MIN_DRIFT = 0.3; // s a linked drift must last before it counts, so one wobble can't farm chain levels
const CRASH_IMPACT = 6; // m/s; wall taps (2–5) keep the chain
const LONG_DRIFT_GAIN = 0.25; // per second of continuous drift…
const LONG_DRIFT_CAP = 4; // …up to this many seconds
const NEAR_MISS_CAR = 300;
const NEAR_MISS_PED = 200;
const NEAR_MISS_SOLO = 150; // no chain running: banks on its own
const NEAR_MISS_LINK = 0.5; // s added to the link window
const PARK_BONUS = 800; // added to the chain, so the bank's chain multiplier makes it 800 × chain
const PARK_WINDOW = 2.5; // s since the last drift ended
const ROUTE_STYLE_BONUS = 600;
const ROUTE_STYLE_WINDOW = 3; // s between drifting through the called junction and the decision
const RISK_FRAGILE = 1.5;
const RISK_HEAVY = 1.25;
const BIG_BANK = 15000;
const LINE_GAP = 4; // s between any two drift lines
const LINE_REPEAT = 25; // s before the same line may play again

type LineKey = 'chain2' | 'chain3' | 'chain5' | 'chain7' | 'bigBank' | 'lost' | 'routeStyle' | 'park';
interface DriftLine {
  text: L10n;
  mood: Mood;
  emoji: string;
  chance: number;
}

const LINES: Record<LineKey, DriftLine> = {
  chain2: { text: { en: 'Please stay in your lane.', tr: 'Lütfen şeridinde kal.' }, mood: 'annoyed', emoji: '🛣️😠', chance: 0.6 },
  chain3: { text: { en: 'This is not on the route.', tr: 'Bu rotada yok.' }, mood: 'confused', emoji: '🗺️❓', chance: 1 },
  chain5: { text: { en: '…', tr: '…' }, mood: 'offended', emoji: '😶', chance: 1 },
  chain7: { text: { en: '…Impressive.', tr: '…Etkileyici.' }, mood: 'impressed', emoji: '😳👏', chance: 1 },
  bigBank: {
    text: { en: 'I am not filming this. I am definitely not filming this.', tr: 'Bunu çekmiyorum. Kesinlikle bunu çekmiyorum.' },
    mood: 'sarcastic', emoji: '📹🙈', chance: 1,
  },
  lost: {
    text: { en: 'And that is why we stay in the lane.', tr: 'İşte bu yüzden şeridimizde kalıyoruz.' },
    mood: 'passive_aggressive', emoji: '🛣️💥', chance: 0.5,
  },
  routeStyle: { text: { en: 'I said turn. Not… *that*.', tr: 'Dön dedim. Böyle… *değil*.' }, mood: 'confused', emoji: '↪️😵', chance: 1 },
  park: { text: { en: 'Parked. Technically.', tr: 'Park ettin. Teknik olarak.' }, mood: 'sarcastic', emoji: '🅿️🙄', chance: 1 },
};
const CHAIN_LINES: Partial<Record<number, LineKey>> = { 2: 'chain2', 3: 'chain3', 5: 'chain5', 7: 'chain7' };

export function createDriftScore(graph: RoadGraph, voice: Voice, rand: () => number = Math.random): DriftScore {
  let now = 0; // s of scoring time (paused time doesn't count)
  let scoring = false; // last update was in 'driving' or 'free'
  let active = false; // a chain is running
  let drifting = false; // the car's current drift (also true for a drift that started after a crash/bank)
  let linked = false; // the current drift started inside the link window and hasn't counted as a level yet
  let segTime = 0;
  let points = 0;
  let chain = 1;
  let linkLeft = 0;
  let lastDriftEnd = -Infinity;
  let bonusMul = 1;
  let shiftTotal = 0;
  let cmdNode: NodeId = -1; // node of YOLDAŞ's latest command
  let styleNode: NodeId = -1; // that node, once the car drifted through it
  let styleAt = -Infinity;
  let lastLineAt = -Infinity;
  const lineAt: Partial<Record<LineKey, number>> = {};

  // Events from update() and from the on*Event callbacks; handed out by the next update(). Two arrays swap so
  // nothing is allocated per frame.
  let pending: DriftEvent[] = [];
  let spare: DriftEvent[] = [];
  const v: DriftView = { active: false, points: 0, chain: 1, link01: 0, angleDeg: 0, bonusMul: 1, shiftTotal: 0 };

  function flush(): DriftEvent[] {
    const out = pending;
    spare.length = 0;
    pending = spare;
    spare = out;
    return out;
  }

  function say(key: LineKey) {
    const l = LINES[key];
    if (now - lastLineAt < LINE_GAP || now - (lineAt[key] ?? -Infinity) < LINE_REPEAT || rand() >= l.chance) return;
    lastLineAt = now;
    lineAt[key] = now;
    voice.sayText(l.text, { mood: l.mood, emoji: l.emoji, priority: 'react' });
  }

  function clearChain() {
    active = false;
    linked = false;
    points = 0;
    chain = 1;
    linkLeft = 0;
  }

  function bank() {
    const total = Math.round(points * chain * bonusMul);
    if (total > 0) {
      shiftTotal += total;
      pending.push({ type: 'driftBank', points: Math.round(points), chain, total });
      playSfx('bank', Math.min(1, 0.6 + total / 20000));
      if (total > BIG_BANK) say('bigBank');
    }
    clearChain();
  }

  function lose() {
    pending.push({ type: 'driftLost', points: Math.round(points * chain * bonusMul) });
    playSfx('chain_lost');
    say('lost');
    clearChain();
  }

  // A bonus joins the running chain; with no chain it banks on its own (so the shift still tallies it).
  function bonus(kind: 'nearMiss' | 'park' | 'routeStyle', chained: number, solo: number) {
    const pts = active ? chained : solo;
    pending.push({ type: 'driftBonus', kind, points: pts });
    playSfx(kind === 'nearMiss' ? 'near_miss' : 'bonus');
    if (active) {
      points += pts;
      return;
    }
    const total = Math.round(pts * bonusMul);
    shiftTotal += total;
    pending.push({ type: 'driftBank', points: pts, chain: 1, total });
  }

  function riskOf(s: ShiftState): number {
    const o = s.order;
    if (!o || o.phase !== 'toDropoff') return 1;
    return o.offer.package === 'fragile' ? RISK_FRAGILE : o.offer.package === 'heavy' ? RISK_HEAVY : 1;
  }

  function update(dt: number, car: CarSample, state: ShiftState): DriftEvent[] {
    const phase = state.phase;
    if (phase === 'paused') return flush(); // chain frozen until resume
    scoring = phase === 'driving' || phase === 'free';
    if (!scoring) {
      // Board, update screen, shift end…: an unfinished chain just evaporates.
      clearChain();
      drifting = false;
      v.angleDeg = 0;
      return flush();
    }
    now += dt;
    bonusMul = riskOf(state);
    if (active && car.impact >= CRASH_IMPACT) lose();

    if (car.drifting) {
      if (!drifting) {
        drifting = true;
        segTime = 0;
        linked = active;
        active = true;
      }
      if (active) {
        segTime += dt;
        if (linked && segTime >= CHAIN_MIN_DRIFT) {
          linked = false;
          if (chain < CHAIN_CAP) {
            chain++;
            pending.push({ type: 'driftChain', chain });
            playSfx('chain_up', Math.min(1, 0.5 + chain * 0.08));
            const line = CHAIN_LINES[chain];
            if (line) say(line);
          }
        }
        const absDeg = Math.abs(car.beta) * RAD2DEG;
        points += absDeg * car.speed * dt * (1 + LONG_DRIFT_GAIN * Math.min(car.driftTime, LONG_DRIFT_CAP));
        if (cmdNode >= 0) {
          const pos = graph.locate(car.x, car.z);
          if (pos.kind === 'node' && pos.node === cmdNode) {
            styleNode = cmdNode;
            styleAt = now;
          }
        }
      }
    } else if (drifting) {
      drifting = false;
      linked = false;
      if (active) {
        linkLeft = LINK_TIME;
        lastDriftEnd = now;
      }
    } else if (active) {
      linkLeft -= dt;
      if (linkLeft <= 0) bank();
    }
    v.angleDeg = car.drifting ? Math.abs(car.beta) * RAD2DEG : 0;
    return flush();
  }

  function onNavEvent(e: NavEvent) {
    if (e.type === 'command') {
      cmdNode = e.command.node;
    } else if (e.type === 'decision' && scoring) {
      const followed = e.outcome === 'followTruth' || e.outcome === 'followLie'; // following a lie counts: that's the joke
      if (followed && e.node === styleNode && now - styleAt < ROUTE_STYLE_WINDOW) {
        bonus('routeStyle', ROUTE_STYLE_BONUS, ROUTE_STYLE_BONUS);
        say('routeStyle');
      }
      if (e.node === styleNode) styleNode = -1;
    }
  }

  function onShiftEvent(e: ShiftEvent) {
    if (!scoring || (e.type !== 'pickedUp' && e.type !== 'delivered')) return;
    if (!active && now - lastDriftEnd >= PARK_WINDOW) return;
    bonus('park', PARK_BONUS, PARK_BONUS);
    if (active) bank();
    say('park');
  }

  function onCityEvent(e: CityEvent) {
    if (!scoring) return;
    if (e.type === 'nearMiss') {
      bonus('nearMiss', e.target === 'car' ? NEAR_MISS_CAR : NEAR_MISS_PED, NEAR_MISS_SOLO);
      if (active && !drifting) linkLeft += NEAR_MISS_LINK;
    } else if (e.type === 'pedHit' && active) {
      lose(); // not a clean end, even though pedestrians have no collider to register an impact
    }
  }

  function view(): DriftView {
    v.active = active;
    v.points = points;
    v.chain = chain;
    v.link01 = !active ? 0 : drifting ? 1 : Math.min(1, linkLeft / LINK_TIME);
    v.bonusMul = bonusMul;
    v.shiftTotal = shiftTotal;
    return v;
  }

  function reset() {
    clearChain();
    drifting = false;
    shiftTotal = 0;
    cmdNode = -1;
    styleNode = -1;
    lastDriftEnd = -Infinity;
    pending.length = 0;
  }

  return { update, onNavEvent, onShiftEvent, onCityEvent, view, reset };
}
