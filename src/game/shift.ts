import { BASE_MODIFIERS } from './types';
import type {
  ActiveOrder, CarSample, DeliveryResult, EndReason, GamePhase, NavEvent, Place, RoadGraph, Shift, ShiftEvent,
  ShiftState, ShiftSummary, Spawn, TargetKind, Voice,
} from './types';
import { ITEMS, buildOffer, deliver, isLate, makeOffers, shouldCancel, startOrder, tipAt, updatePackage } from './orders';
import { combineUpdates, updateChoices } from './updates';
import { tx } from './lang';

const SHIFT_SECONDS = 480;
const START_HOUR = 9;
const SHIFT_HOURS = 10;
const EVENING_AT = 0.85; // clock01
const ZONE_RADIUS = 6; // m
const ZONE_MAX_SPEED = 4; // m/s
const MULT_STEP = 0.5;
const MULT_MAX = 4;
const COMBO_AT = 3;
const RATING_START = 5;
// Rating moves this share toward each order's stars: from 5.0, five straight cancels (or ~7 very late
// deliveries) get you fired, so a bad driver goes late in the shift, not after two minutes.
const RATING_WEIGHT = 0.15;
const FIRE_RATING = 3.0;
const CANCEL_STARS = 1;
const REPAIR_PER_POINT = 2; // ₺ per health point
const DISCOVERY_BONUS = 20; // ₺
const UPDATE_CAP = 5;
const FTUE_PICKUP_HINT_DIST = 25; // m
const FTUE_TELL_HINT_DELAY = 3; // s after the scripted crash
const RESULT_HOLD = 2.5; // s on the road with the delivery/cancel result before the next screen
const FTUE_RESULT_HOLD = 4;
const CONTINUE_HEALTH = 50; // continue restores the car to at least this
const CONTINUE_RATING = 3.5; // ...or the rating to at least this
const PED_RATING_PENALTY = 0.2;
const PED_PENALTY_COOLDOWN = 2; // s
const PED_LINE_CHANCE = 0.5;
const DRIFT_CASH_PER_1000 = 2; // ₺ per 1000 banked drift points, × mods.driftCashMul
const REPAIR_EVENT_EVERY = 1; // s: mechanic spending is reported at most once per second

const FTUE_KEY = 'mfh.ftue.v1';
const BEST_KEY = 'mfh.best';
const BEST_DRIFT_KEY = 'mfh.bestDrift';

const CONTINUE_LINE = { en: "Want to continue? It's free. For now.", tr: 'Devam etmek ister misin? Ücretsiz. Şimdilik.' };
const PED_LINE = { en: 'That was a pedestrian. They have ratings too.', tr: 'O bir yayaydı. Onların da puanı var.' };

// First run (or ?ftue): main.ts should call startFtue() instead of toTitle().
export function needsFtue(): boolean {
  if (new URLSearchParams(location.search).has('ftue')) return true;
  try {
    return localStorage.getItem(FTUE_KEY) === null;
  } catch {
    return false;
  }
}

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: not persisted.
  }
}

function clockText(t01: number): string {
  const min = Math.floor(START_HOUR * 60 + t01 * SHIFT_HOURS * 60);
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function createShift(graph: RoadGraph, voice: Voice, rand: () => number = Math.random): Shift {
  const state: ShiftState = {
    phase: 'title',
    pausedFrom: null,
    clock01: 0,
    clockText: clockText(0),
    money: 0,
    rating: RATING_START,
    health: 100,
    multiplier: 1,
    deliveries: 0,
    order: null,
    offers: [],
    updateChoices: [],
    activeUpdates: [],
    mods: { ...BASE_MODIFIERS },
    summary: null,
    continueUsed: false,
    unranked: false,
    pendingEnd: null,
  };
  let events: ShiftEvent[] = [];

  // Per-shift tallies for the summary.
  let cancelled = 0;
  let fares = 0;
  let tips = 0;
  let adIncome = 0;
  let discoveries = 0;
  let discoveryBonus = 0;
  let bestMultiplier = 1;
  let trusted = 0;
  let liesDodged = 0;
  let liesFollowed = 0;
  let driftScore = 0;
  let bestChain = 0;
  let driftCash = 0;
  let repairs = 0;
  let pedsHit = 0;

  let resumeAfterContinue: (() => void) | null = null;
  let penaltyCooldown = 0;
  let repairPending = 0; // ₺ spent at the mechanic not yet reported as a money event
  let repairClock = 0;
  let eveningSaid = false;
  let lateSaid = false;
  let comboSaid = false;
  let ftuePickupSaid = false;
  let ftueHintTimer = -1; // < 0 = not scheduled
  let ftueHintDone = false;
  let resultHold = -1; // >= 0 while a result is on screen; afterHold runs when it runs out
  let afterHold: (() => void) | null = null;
  let carX = graph.spawn.x;
  let carZ = graph.spawn.z;

  const emit = (e: ShiftEvent) => events.push(e);
  const placeById = (id: number): Place => graph.places.find((p) => p.id === id)!;

  function setPhase(phase: GamePhase) {
    state.phase = phase;
    emit({ type: 'phase', phase });
  }

  function setTarget(place: Place | null, kind: TargetKind | null) {
    emit({ type: 'target', place, kind });
  }

  function placeCar(spawn: Spawn) {
    carX = spawn.x;
    carZ = spawn.z;
    emit({ type: 'placeCar', spawn });
  }

  function setMultiplier(value: number) {
    const delta = value - state.multiplier;
    if (delta === 0) return;
    state.multiplier = value;
    bestMultiplier = Math.max(bestMultiplier, value);
    emit({ type: 'multiplier', value, delta });
    if (value >= COMBO_AT && !comboSaid) {
      comboSaid = true;
      voice.say('re_combo');
    }
  }

  function clearOrder() {
    state.order = null;
    emit({ type: 'navScript', script: null });
    setTarget(null, null);
  }

  function activate(order: ActiveOrder) {
    state.order = order;
    lateSaid = false;
    comboSaid = false;
    setTarget(order.offer.pickup, 'pickup');
  }

  function toBoard() {
    state.offers = makeOffers(graph, graph.nearestNode(carX, carZ), rand, state.mods);
    setPhase('board');
  }

  function toUpdateOrBoard() {
    state.updateChoices = state.activeUpdates.length < UPDATE_CAP ? updateChoices(state.activeUpdates, rand) : [];
    if (state.updateChoices.length === 0) return toBoard();
    voice.say('shift_update');
    setPhase('update');
  }

  function hold(seconds: number, then: () => void) {
    resultHold = seconds;
    afterHold = then;
  }

  function clearHold() {
    resultHold = -1;
    afterHold = null;
  }

  function tickHold(dt: number) {
    if (resultHold < 0) return;
    resultHold -= dt;
    if (resultHold >= 0) return;
    const then = afterHold;
    clearHold();
    then?.();
  }

  function rate(stars: number) {
    state.rating = Math.min(5, Math.max(0, state.rating + (stars - state.rating) * RATING_WEIGHT));
  }

  function endShift(reason: EndReason) {
    voice.say(reason === 'fired' ? 're_suspended' : reason === 'towed' ? 're_towed' : 'shift_end');
    const repairBill = Math.round((100 - state.health) * REPAIR_PER_POINT);
    const total = Math.round(fares + tips + adIncome + discoveryBonus + driftCash - repairs - repairBill); // may be negative
    const drift = Math.round(driftScore);
    // A continued shift is unranked: show the stored records, never overwrite them.
    const best = state.unranked ? readNum(BEST_KEY) : Math.max(readNum(BEST_KEY), total);
    const bestDrift = state.unranked ? readNum(BEST_DRIFT_KEY) : Math.max(readNum(BEST_DRIFT_KEY), drift);
    if (!state.unranked) {
      writeKey(BEST_KEY, String(best));
      writeKey(BEST_DRIFT_KEY, String(bestDrift));
    }
    const summary: ShiftSummary = {
      reason, deliveries: state.deliveries, cancelled, fares, tips, adIncome, discoveries, discoveryBonus, repairBill,
      total, bestMultiplier, trusted, liesDodged, liesFollowed, best,
      driftScore: drift, bestChain, driftCash, repairs: Math.round(repairs), pedsHit, unranked: state.unranked, bestDrift,
    };
    state.summary = summary;
    state.pendingEnd = null;
    resumeAfterContinue = null;
    clearOrder();
    emit({ type: 'shiftEnd', reason });
    setPhase('shiftEnd');
  }

  // Back on the road where the shift stopped: the order (if any) and a pending result hold are untouched.
  const backToDriving = () => setPhase('driving');

  // A lost life offers the one continue per shift; `resume` is where play goes on if it is accepted.
  function failOrContinue(reason: 'fired' | 'towed', resume: () => void) {
    if (state.continueUsed) return endShift(reason);
    state.pendingEnd = reason;
    resumeAfterContinue = resume;
    voice.sayText(CONTINUE_LINE, { mood: 'sarcastic', emoji: '🔁❓', critical: true });
    setPhase('continue');
  }

  // Ends the shift (or offers a continue) if a life ran out or the day is over; true if play stopped.
  function checkEnd(resume: () => void = backToDriving): boolean {
    if (state.rating < FIRE_RATING) failOrContinue('fired', resume);
    else if (state.health <= 0) failOrContinue('towed', resume);
    else if (state.clock01 >= 1) endShift('time');
    else return false;
    return true;
  }

  function acceptContinue() {
    const resume = resumeAfterContinue;
    if (state.phase !== 'continue' || !resume) return;
    // Restore whichever life is out, so a double failure can't end the shift right after the continue.
    if (state.health <= 0 || state.pendingEnd === 'towed') state.health = Math.max(state.health, CONTINUE_HEALTH);
    if (state.rating < FIRE_RATING || state.pendingEnd === 'fired') state.rating = Math.max(state.rating, CONTINUE_RATING);
    state.continueUsed = true;
    state.unranked = true;
    state.pendingEnd = null;
    resumeAfterContinue = null;
    voice.flush(); // the continue prompt (and anything queued behind it) is over
    emit({ type: 'respawn' });
    resume();
  }

  function declineContinue() {
    if (state.phase !== 'continue' || !state.pendingEnd) return;
    voice.flush();
    endShift(state.pendingEnd);
  }

  function pickUp(order: ActiveOrder) {
    order.phase = 'toDropoff';
    emit({ type: 'pickedUp' });
    // Some names end in a dot ("Kardeşler Apt.") and the line ends in one too.
    voice.say('re_picked_up', { params: { name: tx(order.offer.dropoff.name).replace(/\.$/, '') } });
    if (state.phase === 'driving' && state.mods.adIncome > 0) voice.say('ad_kebab');
    setTarget(order.offer.dropoff, 'dropoff');
  }

  function complete(order: ActiveOrder): DeliveryResult {
    const result = deliver(order, state.multiplier, state.mods);
    emit({ type: 'delivered', result });
    clearOrder();
    return result;
  }

  function finishDelivery(order: ActiveOrder) {
    const result = complete(order);
    const ad = state.mods.adIncome;
    fares += result.fare;
    tips += result.tip;
    adIncome += ad;
    state.money += result.fare + result.tip + ad;
    if (ad > 0) emit({ type: 'money', amount: ad, reason: 'ad' });
    rate(result.stars);
    voice.say(
      result.ruined ? 're_cake_ruined' : result.stars >= 5 ? 're_five_star' : result.stars === 2 ? 're_two_star' : result.stars <= 1 ? 're_one_star' : 're_tip',
    );
    state.deliveries++;
    emit({ type: 'difficulty', level: state.deliveries });
    if (!checkEnd(toUpdateOrBoard)) hold(RESULT_HOLD, toUpdateOrBoard);
  }

  function finishFtue(order: ActiveOrder) {
    complete(order);
    voice.say('ftue_hired');
    writeKey(FTUE_KEY, '1');
    hold(FTUE_RESULT_HOLD, toTitle);
  }

  function cancelOrder() {
    cancelled++;
    voice.flush(); // chatter and calls about this order are moot now
    voice.say('re_cancel');
    rate(CANCEL_STARS);
    state.multiplier = 1;
    clearOrder();
    emit({ type: 'cancelled' });
    if (!checkEnd(toBoard)) hold(RESULT_HOLD, toBoard);
  }

  function inZone(car: CarSample, p: Place): boolean {
    return Math.hypot(car.x - p.x, car.z - p.z) < ZONE_RADIUS && car.speed < ZONE_MAX_SPEED;
  }

  function updateOrder(dt: number, car: CarSample, ftue: boolean) {
    const order = state.order;
    if (!order) return;
    order.elapsed += dt;
    order.tipNow = tipAt(order);
    if (order.phase === 'toDropoff' && updatePackage(order, car, dt)) emit({ type: 'packageRuined' });
    // Passenger comfort ran out: they get out, which counts as a cancel.
    if (!ftue && order.offer.package === 'passenger' && order.packageHealth <= 0) return cancelOrder();

    if (ftue && order.phase === 'toPickup' && !ftuePickupSaid) {
      if (Math.hypot(car.x - order.offer.pickup.x, car.z - order.offer.pickup.z) < FTUE_PICKUP_HINT_DIST) {
        ftuePickupSaid = true;
        voice.say('ftue_pickup');
      }
    }

    if (!ftue) {
      if (!lateSaid && isLate(order)) {
        lateSaid = true;
        voice.say('re_late');
      }
      if (shouldCancel(order)) return cancelOrder();
    }

    if (order.phase === 'toPickup') {
      if (inZone(car, order.offer.pickup)) pickUp(order);
    } else if (inZone(car, order.offer.dropoff)) {
      if (ftue) finishFtue(order);
      else finishDelivery(order);
    }
  }

  function resetShiftState() {
    state.pausedFrom = null;
    state.clock01 = 0;
    state.clockText = clockText(0);
    state.money = 0;
    state.rating = RATING_START;
    state.health = 100;
    state.multiplier = 1;
    state.deliveries = 0;
    state.order = null;
    state.offers = [];
    state.updateChoices = [];
    state.activeUpdates = [];
    state.mods = { ...BASE_MODIFIERS };
    state.summary = null;
    state.continueUsed = false;
    state.unranked = false;
    state.pendingEnd = null;
    resumeAfterContinue = null;
    driftScore = bestChain = driftCash = repairs = pedsHit = 0;
    penaltyCooldown = repairPending = repairClock = 0;
    cancelled = fares = tips = adIncome = discoveries = discoveryBonus = 0;
    bestMultiplier = 1;
    trusted = liesDodged = liesFollowed = 0;
    eveningSaid = lateSaid = comboSaid = false;
    clearHold();
    emit({ type: 'mods', mods: state.mods });
    emit({ type: 'difficulty', level: 0 });
  }

  function startFtue() {
    resetShiftState();
    const f = graph.ftue;
    ftuePickupSaid = false;
    ftueHintTimer = -1;
    ftueHintDone = false;
    placeCar(f.spawn);
    const doner = ITEMS.find((i) => i.id === 'doner')!;
    const offer = buildOffer(
      graph, graph.nearestNode(f.spawn.x, f.spawn.z), doner, placeById(f.pickup), placeById(f.dropoff), false, state.mods,
    );
    emit({
      type: 'navScript',
      script: { firstLine: 'ftue_1', forced: { node: f.lieNode, exit: f.lieExit, line: 'ftue_2' }, fakeHitLine: 'ftue_3' },
    });
    setPhase('ftue');
    activate(startOrder(offer));
  }

  function startShift() {
    resetShiftState();
    clearOrder();
    placeCar(graph.spawn);
    voice.say('shift_start'); // also announces the board, so it plays while the board is open
    toBoard();
  }

  function startFree() {
    clearOrder();
    clearHold();
    placeCar(graph.spawn);
    state.pausedFrom = null;
    setPhase('free');
  }

  function toTitle() {
    clearOrder();
    clearHold();
    state.pausedFrom = null;
    setPhase('title');
  }

  function pickOffer(index: number) {
    const offer = state.offers[index];
    if (state.phase !== 'board' || !offer) return;
    state.offers = [];
    voice.drop('shift_start');
    setPhase('driving');
    activate(startOrder(offer));
  }

  function pickUpdate(index: number) {
    const u = state.updateChoices[index];
    if (state.phase !== 'update' || !u) return;
    state.activeUpdates = [...state.activeUpdates, u];
    state.updateChoices = [];
    voice.drop('shift_update');
    state.mods = combineUpdates(state.activeUpdates);
    emit({ type: 'mods', mods: state.mods });
    voice.say(u.line);
    toBoard();
  }

  function setPaused(p: boolean) {
    if (p && (state.phase === 'ftue' || state.phase === 'driving' || state.phase === 'free')) {
      state.pausedFrom = state.phase;
      setPhase('paused');
    } else if (!p && state.phase === 'paused' && state.pausedFrom) {
      const back = state.pausedFrom;
      state.pausedFrom = null;
      setPhase(back);
    }
  }

  function update(dt: number, car: CarSample) {
    const phase = state.phase;
    if (phase !== 'ftue' && phase !== 'driving' && phase !== 'free') return;
    carX = car.x;
    carZ = car.z;
    if (phase === 'free') return;

    if (phase === 'ftue') {
      if (ftueHintTimer >= 0) {
        ftueHintTimer -= dt;
        if (ftueHintTimer < 0) voice.say('ftue_hint_tells');
      }
      updateOrder(dt, car, true);
      tickHold(dt);
      return;
    }

    penaltyCooldown -= dt;
    repairClock -= dt;
    if (repairPending > 0 && repairClock <= 0) flushRepair();
    state.clock01 = Math.min(1, state.clock01 + dt / SHIFT_SECONDS);
    state.clockText = clockText(state.clock01);
    if (!eveningSaid && state.clock01 >= EVENING_AT) {
      eveningSaid = true;
      voice.say('shift_evening');
    }
    updateOrder(dt, car, false);
    if (state.phase === 'driving' && !checkEnd()) tickHold(dt);
  }

  function onNavEvent(e: NavEvent) {
    const phase = state.phase;
    if (phase !== 'ftue' && phase !== 'driving') return;
    if (e.type === 'decision') {
      switch (e.outcome) {
        case 'followTruth':
          trusted++;
          setMultiplier(Math.min(MULT_MAX, state.multiplier + MULT_STEP * state.mods.multiplierGainMul));
          break;
        case 'dodgeLie':
          liesDodged++;
          setMultiplier(Math.min(MULT_MAX, state.multiplier + MULT_STEP * state.mods.multiplierGainMul));
          break;
        case 'followLie':
          liesFollowed++;
          setMultiplier(1);
          break;
        case 'ignoreTruth':
          setMultiplier(1);
          break;
        case 'ignoreLie':
          break;
      }
    } else if (e.type === 'fakeRoadHit') {
      if (phase === 'ftue') {
        if (!ftueHintDone) {
          ftueHintDone = true;
          ftueHintTimer = FTUE_TELL_HINT_DELAY;
        }
      } else if (e.first) {
        discoveries++;
        discoveryBonus += DISCOVERY_BONUS;
        state.money += DISCOVERY_BONUS;
        emit({ type: 'money', amount: DISCOVERY_BONUS, reason: 'discovery' });
      }
    }
  }

  function applyDamage(points: number) {
    if (state.phase !== 'driving' || points <= 0) return;
    state.health = Math.max(0, state.health - points);
  }

  function adjustTip(delta: number) {
    const order = state.order;
    if (state.phase !== 'driving' || !order || delta === 0) return;
    order.tipBonus += delta;
    emit({ type: 'tipAdjust', delta });
  }

  function penalty(reason: 'pedestrian') {
    if (state.phase !== 'driving' || penaltyCooldown > 0) return;
    penaltyCooldown = PED_PENALTY_COOLDOWN;
    state.rating = Math.max(0, state.rating - PED_RATING_PENALTY);
    pedsHit++;
    emit({ type: 'penalty', amount: PED_RATING_PENALTY, reason });
    if (rand() < PED_LINE_CHANCE) voice.sayText(PED_LINE, { mood: 'passive_aggressive', emoji: '🚶💥⭐' });
    checkEnd();
  }

  function addDrift(points: number, chain: number) {
    if (state.phase !== 'driving' || points <= 0) return;
    driftScore += points;
    bestChain = Math.max(bestChain, chain);
    const cash = Math.round((points / 1000) * DRIFT_CASH_PER_1000 * state.mods.driftCashMul);
    if (cash <= 0) return;
    driftCash += cash;
    state.money += cash;
    emit({ type: 'money', amount: cash, reason: 'drift' });
  }

  function flushRepair() {
    emit({ type: 'money', amount: -Math.round(repairPending), reason: 'repair' });
    repairPending = 0;
    repairClock = REPAIR_EVENT_EVERY;
  }

  function repair(points: number, cost: number) {
    if (state.phase !== 'driving' || points <= 0) return;
    state.health = Math.min(100, state.health + points);
    state.money -= cost;
    repairs += cost;
    repairPending += cost;
    if (repairClock <= 0) flushRepair();
  }

  function drain(): ShiftEvent[] {
    const out = events;
    events = [];
    return out;
  }

  return {
    state, startFtue, startShift, startFree, toTitle, pickOffer, pickUpdate, setPaused, update, onNavEvent, applyDamage,
    acceptContinue, declineContinue, adjustTip, penalty, addDrift, repair, drain,
  };
}
