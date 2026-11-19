// Shared contracts between world, navigator, shift and UI. Change only in the integration step.

export type Lang = 'en' | 'tr';
export type L10n = { en: string; tr: string };

// ---------- Road network (world) ----------

export type NodeId = number; // j * cols + i (i = x index, j = z index)
export type EdgeId = number;
export type BlockerKind = 'wall' | 'stairs' | 'bollards';
export type Turn = 'left' | 'right' | 'straight' | 'uturn';

export interface RoadNode {
  id: NodeId;
  x: number;
  z: number;
  halfX: number; // half size of the intersection box along X (half width of the N-S street)
  halfZ: number; // half size along Z (half width of the E-W street)
  edges: EdgeId[]; // incident edges, open and fake; closed segments are not edges
}

export interface RoadEdge {
  id: EdgeId;
  a: NodeId; // west (smaller x) or south (smaller z) end
  b: NodeId;
  fake: boolean; // paved and looks like a road, but blocked mid-way; never part of a true route
  blocker: BlockerKind | null; // set when fake
  blockerX: number; // blocker centre (edge midpoint) when fake, else the midpoint anyway
  blockerZ: number;
  width: number; // carriageway width (10 or 12)
  length: number; // node centre to node centre
}

export type RoadPos =
  | { kind: 'node'; node: NodeId }
  | { kind: 'edge'; edge: EdgeId; t: number } // t: 0 at a, 1 at b
  | { kind: 'off' };

export type ShopTag =
  | 'kebab' | 'lahmacun' | 'bakery' | 'grocer' | 'icecream' | 'pharmacy'
  | 'florist' | 'electronics' | 'petshop' | 'stationery';

export interface Place {
  id: number;
  edge: EdgeId; // never a fake edge
  t: number;
  side: 1 | -1; // +1 = on the left when driving a→b
  x: number; // zone centre, in the lane next to that curb
  z: number;
  kind: 'shop' | 'home' | 'mechanic'; // mechanic = sanayi repair stop; never an order pickup/dropoff
  shop: ShopTag | null;
  name: L10n;
}

export interface Spawn {
  x: number;
  z: number;
  heading: number; // radians, 0 = +Z
}

export interface FtueSetup {
  spawn: Spawn;
  pickup: number; // Place id (Usta Kebap)
  dropoff: number; // Place id
  lieNode: NodeId; // intersection of the scripted lie
  lieExit: EdgeId; // fake edge YOLDAŞ sends the player into
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
  places: Place[];
  spawn: Spawn; // shift start
  ftue: FtueSetup;
  locate(x: number, z: number): RoadPos;
  nearestNode(x: number, z: number): NodeId;
  other(edge: EdgeId, node: NodeId): NodeId;
  dist(a: NodeId, b: NodeId): number; // true shortest path over non-fake edges; Infinity if unreachable
  distToPlace(node: NodeId, place: Place): number; // node → place along true roads
  placeDist(from: Place, to: Place): number;
  turn(from: NodeId, via: NodeId, to: NodeId): Turn; // driver's view arriving from `from`
}

// ---------- Car snapshot (built by main.ts each frame) ----------

export interface CarSample {
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number; // atan2(fwd.x, fwd.z)
  speed: number; // m/s
  impact: number; // strongest car.stats.impact over this frame's physics steps (m/s)
  drifting: boolean;
  beta: number; // rad
  driftTime: number; // s
}

// ---------- YOLDAŞ voice ----------

export type Mood =
  | 'neutral' | 'confused' | 'annoyed' | 'sarcastic' | 'passive_aggressive' | 'helpful'
  | 'deceptive' | 'impressed' | 'recalculating' | 'offended' | 'panic' | 'sad';

export type LineId =
  | 'dir_left' | 'dir_right' | 'dir_straight' | 'dir_uturn' | 'dir_arrive_left' | 'dir_arrive_right'
  | 'hes_left' | 'hes_right' | 'hes_straight' // tell: hesitation
  | 'sug_left' | 'sug_right' | 'sug_straight' // tell: "I would suggest"
  | 'pre_left' | 'pre_right' | 'pre_straight' // tell: suspiciously precise distance, param {d}
  | 'rude_left' | 'rude_right' | 'rude_straight' // Honesty Patch
  | 'rhyme_left' | 'rhyme_right' | 'rhyme_straight' | 'rhyme_left_2' | 'rhyme_right_2' | 'rhyme_straight_2' // Rhyme Engine
  | 'rhyme_left_3' | 'rhyme_right_3' | 'rhyme_straight_3'
  | 're_recalc' | 're_recalc_sigh' | 're_crash_1' | 're_crash_2' | 're_crash_3' | 're_crash_mine'
  | 're_ignore_1' | 're_ignore_2' | 're_dodged' | 're_combo' | 're_late' | 're_cancel' | 're_cake_ruined'
  | 're_tip' | 're_five_star' | 're_two_star' | 're_one_star' | 're_suspended' | 're_towed' | 're_dead_end' | 're_drift_3'
  | 're_picked_up' // param {name}
  | 'ftue_1' | 'ftue_2' | 'ftue_3' | 'ftue_hint_tells' | 'ftue_pickup' | 'ftue_hired'
  | 'shift_start' | 'shift_board' | 'shift_update' | 'shift_evening' | 'shift_end'
  | 'ad_kebab' | 'ad_premium'
  | 'upd_reverse' | 'upd_sponsored' | 'upd_silent' | 'upd_honesty' | 'upd_rhyme' | 'upd_beta' | 'upd_ai'
  | 'upd_speedrun' | 'upd_offline' | 'upd_drift' | 'upd_passenger' | 'upd_traffic';

export type SayPriority = 'nav' | 'react' | 'chatter';

export interface SayOptions {
  priority?: SayPriority; // default 'react'
  params?: Record<string, string | number>;
  hesitant?: boolean; // slower, lower rate (tell)
  ttl?: number; // s a minor queued line survives, nav cuts included (default: the next nav line or STALE_REACT drops it)
}

export type SpeakerKind = 'yoldas' | 'passenger' | 'customer' | 'mechanic';

export interface Speaker {
  kind: SpeakerKind;
  label: L10n; // subtitle tag, e.g. "Ayşe Teyze"
  pitch: number; // TTS pitch (YOLDAŞ 1.1)
  rate: number; // TTS rate (YOLDAŞ 1.05)
  lang?: Lang; // always speak this language, whatever the UI language (the tourist)
  voiceRank?: number; // prefer the n-th system voice of the language (0 = YOLDAŞ's) so characters differ where the OS has several
}

export interface SayTextOptions {
  speaker?: Speaker; // default: YOLDAŞ
  mood?: Mood; // YOLDAŞ portrait mood; default 'neutral'
  emoji?: string; // Silent Mode subtitle; Silent Mode mutes only YOLDAŞ, never other speakers
  priority?: SayPriority; // default 'react'
  critical?: boolean; // like a CRITICAL LineId: waits behind anything, never dropped as stale
  params?: Record<string, string | number>;
  ttl?: number; // see SayOptions.ttl
  onPlay?: () => void; // the line started (spoken or shown as a subtitle); never called if it was dropped
}

export interface Subtitle {
  text: string; // already localised, params filled (emoji in Silent Mode)
  mood: Mood;
  speaker?: { kind: SpeakerKind; label: string }; // absent = YOLDAŞ; label already localised
}

export interface Voice {
  say(id: LineId, opts?: SayOptions): void;
  sayText(text: L10n, opts?: SayTextOptions): void; // free text (passengers, customers, new YOLDAŞ reactions) through the same queue
  current(): Subtitle | null; // what the HUD shows now
  setModifiers(m: ShiftModifiers): void;
  setPaused(p: boolean): void;
  stop(): void; // cancel speech and subtitle
  flush(): void; // context switch (cancel, continue): cut the current line and drop queued minor lines
  drop(id: LineId): void; // forget a queued line that is out of date
  update(dt: number): void; // expires subtitles
}

// ---------- Navigator ----------

export type TargetKind = 'pickup' | 'dropoff';
export type TellKind = 'hesitate' | 'suggest' | 'precise' | 'glitch';
export type DecisionOutcome = 'followTruth' | 'followLie' | 'ignoreTruth' | 'dodgeLie' | 'ignoreLie';

export interface NavCommand {
  node: NodeId; // intersection the command is for (-1 for mid-edge arrive / u-turn)
  said: Turn | 'arrive'; // what YOLDAŞ says/shows (after a left/right swap update)
  meantEdge: EdgeId | null; // exit YOLDAŞ actually designates
  isLie: boolean; // meantEdge is not the true best exit
  tell: TellKind | null;
  arriveSide: 'left' | 'right' | null;
}

export interface NavView {
  icon: Turn | 'arrive_left' | 'arrive_right' | 'recalc' | 'none';
  distance: number | null; // metres to the node (or place); null = hide
  distanceText: string | null; // formatted; "237.4 m" for the precise tell; null when hidden
  glitch: boolean; // icon glitch tell is playing
  target: TargetKind | null;
}

export interface NavScript {
  firstLine?: LineId; // replaces the line of the first command after setScript
  forced?: { node: NodeId; exit: EdgeId; line: LineId }; // one-shot scripted lie, no tell
  fakeHitLine?: LineId; // replaces re_crash_mine on the next fake-road hit
}

export type NavEvent =
  | { type: 'command'; command: NavCommand }
  | { type: 'decision'; outcome: DecisionOutcome; node: NodeId }
  | { type: 'recalc' }
  | { type: 'fakeRoadHit'; edge: EdgeId; first: boolean } // first = not yet discovered this shift
  | { type: 'told'; command: NavCommand }; // the command's line was handed to the voice

export interface Navigator {
  setTarget(place: Place | null, kind: TargetKind | null): void; // issues a fresh command
  setModifiers(m: ShiftModifiers): void;
  setDifficulty(level: number): void; // level = deliveries completed this shift
  setScript(s: NavScript | null): void;
  reset(): void; // new shift: forget discovered fake roads and state
  relocate(): void; // car was teleported (R reset): re-route from wherever it lands
  update(dt: number, car: CarSample): NavEvent[];
  view(): NavView;
}

// ---------- Shift / orders ----------

export type PackageKind = 'normal' | 'fragile' | 'urgent' | 'heavy' | 'passenger';
export type PassengerId = 'teyze' | 'abi' | 'plaza' | 'tourist' | 'grandpa' | 'bride' | 'student';

export interface ItemDef {
  id: string;
  name: L10n;
  icon: string; // 'ui/orders/doner.png' (contains '/') or an emoji fallback
  package: PackageKind;
  shop: ShopTag | null; // null for passengers (picked up at a home)
  passenger?: PassengerId; // set iff package === 'passenger'
  fragility?: number; // fragile damage multiplier, default 1 (wedding cake 1.6, eggs 1.3)
  alarm?: L10n; // short panic toast when it gets hurt: "The cake!"
}

export interface OrderOffer {
  id: number;
  item: ItemDef;
  pickup: Place;
  dropoff: Place;
  package: PackageKind;
  long: boolean; // "far + big tip" offer
  routeLength: number; // m, car → pickup → dropoff over true roads
  expectedTime: number; // s, already scaled by modifiers
  baseFare: number;
  tipMax: number;
  customer?: L10n; // who ordered (shown on the ticket); for passengers, the passenger's name
  note?: L10n; // flavour note: "Ring twice, the dog is asleep"
}

export interface ActiveOrder {
  offer: OrderOffer;
  phase: 'toPickup' | 'toDropoff';
  elapsed: number; // s since accepted
  tipNow: number; // current tip before multiplier
  packageHealth: number; // 0..100 condition: fragile health, heavy box condition, passenger comfort; 100 otherwise
  tipBonus: number; // ₺ added after the multiplier at delivery (passenger reactions); may be negative, final tip clamps at 0
}

export interface DeliveryResult {
  offer: OrderOffer;
  stars: number; // 1..5
  fare: number;
  tip: number; // tipNow × multiplier × tipMul
  ruined: boolean;
  late: boolean;
}

export type UpdateId =
  | 'reverse_lr' | 'sponsored' | 'silent' | 'honesty' | 'rhyme' | 'beta_voice' | 'ai' | 'speedrun' | 'offline'
  | 'drift_analytics' | 'passenger_rating' | 'live_traffic';

export interface ShiftModifiers {
  tipMul: number;
  lieChanceMul: number;
  tellChanceMul: number;
  multiplierGainMul: number;
  timeBudgetMul: number;
  adIncome: number; // money per delivery
  callDistance: number; // m before the node at which a command is spoken
  swapLeftRight: boolean;
  silent: boolean;
  rhyme: boolean;
  rude: boolean;
  betaVoice: boolean;
  hideDistance: boolean;
  driftCashMul: number; // × ₺ paid per banked drift point
  passengerMul: number; // × passenger tip reactions (both ways); > 1 also makes passenger offers likelier
  trafficMul: number; // × ambient traffic density
}

export const BASE_MODIFIERS: ShiftModifiers = {
  tipMul: 1,
  lieChanceMul: 1,
  tellChanceMul: 1,
  multiplierGainMul: 1,
  timeBudgetMul: 1,
  adIncome: 0,
  callDistance: 40,
  swapLeftRight: false,
  silent: false,
  rhyme: false,
  rude: false,
  betaVoice: false,
  hideDistance: false,
  driftCashMul: 1,
  passengerMul: 1,
  trafficMul: 1,
};

export interface UpdateDef {
  id: UpdateId;
  name: L10n;
  desc: L10n; // effect, one short line, e.g. "Left and right swapped. ×2 tips"
  card: string; // 'ui/cards/reverse_lr.png'
  line: LineId; // spoken when installed
  mods: Partial<ShiftModifiers>; // muls multiply (tipMul bonuses add), booleans OR, adIncome adds, callDistance takes the min
}

export type GamePhase = 'title' | 'ftue' | 'board' | 'driving' | 'update' | 'paused' | 'continue' | 'shiftEnd' | 'free';
export type EndReason = 'time' | 'fired' | 'towed';

export interface ShiftSummary {
  reason: EndReason;
  deliveries: number;
  cancelled: number;
  fares: number;
  tips: number;
  adIncome: number;
  discoveries: number;
  discoveryBonus: number;
  repairBill: number;
  total: number;
  bestMultiplier: number;
  trusted: number; // followTruth count
  liesDodged: number;
  liesFollowed: number;
  best: number; // all-time best total (localStorage)
  driftScore: number; // banked drift points this shift
  bestChain: number; // longest drift chain multiplier
  driftCash: number; // ₺ earned from drift points
  repairs: number; // ₺ spent at the mechanic during the shift
  pedsHit: number;
  unranked: boolean; // a continue was used: records are not written
  bestDrift: number; // all-time best drift score (localStorage)
}

export interface ShiftState {
  phase: GamePhase;
  pausedFrom: GamePhase | null;
  clock01: number; // 0 = 09:00, 1 = 19:00
  clockText: string; // "14:35"
  money: number;
  rating: number; // 0..5
  health: number; // 0..100
  multiplier: number;
  deliveries: number;
  order: ActiveOrder | null;
  offers: OrderOffer[];
  updateChoices: UpdateDef[];
  activeUpdates: UpdateDef[];
  mods: ShiftModifiers;
  summary: ShiftSummary | null;
  continueUsed: boolean;
  unranked: boolean;
  pendingEnd: EndReason | null; // set while phase === 'continue'
}

export type ShiftEvent =
  | { type: 'phase'; phase: GamePhase }
  | { type: 'target'; place: Place | null; kind: TargetKind | null }
  | { type: 'navScript'; script: NavScript | null }
  | { type: 'mods'; mods: ShiftModifiers }
  | { type: 'difficulty'; level: number }
  | { type: 'placeCar'; spawn: Spawn }
  | { type: 'respawn' } // continue accepted: car back on the nearest road, short damage grace; the order stays
  | { type: 'pickedUp' }
  | { type: 'delivered'; result: DeliveryResult }
  | { type: 'cancelled' }
  | { type: 'packageRuined' }
  | { type: 'multiplier'; value: number; delta: number }
  | { type: 'money'; amount: number; reason: 'discovery' | 'ad' | 'drift' | 'repair' } // repair: negative amount
  | { type: 'penalty'; amount: number; reason: 'pedestrian' } // rating points lost
  | { type: 'tipAdjust'; delta: number } // passenger reaction changed the active order's tipBonus
  | { type: 'shiftEnd'; reason: EndReason };

export interface Shift {
  readonly state: ShiftState;
  startFtue(): void; // phase 'ftue'
  startShift(): void; // full reset, phase 'board'
  startFree(): void; // phase 'free'
  toTitle(): void; // phase 'title'
  pickOffer(index: number): void; // board → driving
  pickUpdate(index: number): void; // update → board
  setPaused(p: boolean): void; // ftue/driving/free ↔ paused
  update(dt: number, car: CarSample): void; // no-op unless phase is ftue/driving/free
  onNavEvent(e: NavEvent): void;
  applyDamage(points: number): void; // ignored in ftue/free
  acceptContinue(): void; // 'continue' → car to ≥ 50 % or rating to ≥ 3.5, unranked, resume where the shift stopped
  declineContinue(): void; // 'continue' → shiftEnd with the pending reason
  adjustTip(delta: number): void; // ₺ into the active order's tipBonus (driving + order only), emits tipAdjust
  penalty(reason: 'pedestrian'): void; // driving only; shift owns the amount and a short cooldown; may fire
  addDrift(points: number, chain: number): void; // a banked chain (driving only): summary tally + drift cash
  repair(points: number, cost: number): void; // mechanic (driving only): +health (cap 100), −money
  drain(): ShiftEvent[]; // events queued since the last drain (by any method)
}

export interface Damage {
  update(dt: number, impact: number, health: number): number; // returns health points lost; draws smoke by health
  reset(): void;
}

export interface Markers {
  set(place: Place | null, kind: TargetKind | null): void;
  update(dt: number): void;
}

// ---------- UI ----------

export interface HudView {
  nav: NavView;
  subtitle: Subtitle | null;
  shift: ShiftState;
  speedKmh: number;
}

export interface Hud {
  update(v: HudView): void; // every frame; shows/hides parts by v.shift.phase
  event(e: NavEvent | ShiftEvent | HudFx): void; // toasts, flashes, shakes
}

export interface ScreenActions {
  startShift(): void;
  freeDrive(): void;
  pickOffer(index: number): void;
  pickUpdate(index: number): void;
  continueShift(): void; // main.ts runs the rewarded-ad hook, then shift.acceptContinue()
  declineContinue(): void;
  resume(): void;
  quitToTitle(): void;
  setLang(l: Lang): void;
}

export interface Screens {
  render(state: ShiftState): void; // every frame; rebuilds DOM only when phase/offers/choices/lang change
}

// ---------- HUD effects (produced by gameplay modules, rendered by hud.ts) ----------

export type HudFx =
  | { type: 'toast'; text: L10n; params?: Record<string, string | number>; sub?: L10n; icon?: string; tone: 'good' | 'bad' | 'info' } // icon: file under ui/icons/ (has a '.') or an emoji
  | { type: 'shake'; strength: number } // 0..1: HUD jolt + red edge flash
  | { type: 'pkgWobble'; strength: number } // 0..1: order-strip package cell wobbles
  | { type: 'urgentTick'; level: 1 | 2 }; // tip/package cell pulse: 1 = half the time used, 2 = late

// ---------- Ambient city (world/city.ts) ----------

export type CityEvent =
  | { type: 'nearMiss'; target: 'car' | 'ped' }
  | { type: 'pedHit' }
  | { type: 'trafficHit'; impact: number };

export interface City {
  update(dt: number, car: CarSample, live: boolean): CityEvent[]; // live = the car is simulated; events only then
  setDensity(mul: number): void; // ShiftModifiers.trafficMul; 0 = no moving traffic (FTUE)
  reset(x: number, z: number): void; // respawn moving agents at least ~40 m from (x, z)
}

// ---------- Drift scoring (game/drift.ts) ----------

export interface DriftView {
  active: boolean; // a chain is running (drifting or inside the link window)
  points: number; // unbanked chain points (before chain × bonus)
  chain: number; // chain multiplier, 1..
  link01: number; // 1 while drifting, then counts down the link window
  angleDeg: number; // current |slip angle|
  bonusMul: number; // risk bonus applied on banking (fragile/heavy aboard), 1 = none
  shiftTotal: number; // banked total since the last reset
}

export type DriftEvent =
  | { type: 'driftChain'; chain: number } // chain level went up
  | { type: 'driftBank'; points: number; chain: number; total: number } // total = points × chain × bonusMul
  | { type: 'driftLost'; points: number } // a crash ate the chain
  | { type: 'driftBonus'; kind: 'nearMiss' | 'park' | 'routeStyle'; points: number };

export interface DriftScore {
  update(dt: number, car: CarSample, state: ShiftState): DriftEvent[]; // scores only in 'driving' and 'free'
  onNavEvent(e: NavEvent): void;
  onShiftEvent(e: ShiftEvent): void;
  onCityEvent(e: CityEvent): void;
  view(): DriftView;
  reset(): void;
}

// ---------- Passengers (game/passengers.ts) ----------

export interface PassengerView {
  id: PassengerId;
  name: L10n;
  icon: string; // portrait path or emoji
  aboard: boolean; // false while waiting at the pickup
  mood: number; // 0..1
  wants: Turn | null; // the passenger's current direction call; null = none
  tipDelta: number; // ₺ added/cut by this passenger so far
}

export interface PassengerDirector {
  update(dt: number, car: CarSample, state: ShiftState): void; // reactions; calls shift.adjustTip
  onNavEvent(e: NavEvent): void; // 'command' → competing call for the same junction
  onShiftEvent(e: ShiftEvent): void; // pickedUp / delivered / cancelled
  view(): PassengerView | null; // null when the active order is not a passenger
  reset(): void;
}

// ---------- Mechanic stop (game/mechanic.ts) ----------

export type MechanicState = 'stop' | 'repairing' | 'full' | 'broke';

export interface MechanicView {
  name: L10n;
  state: MechanicState; // stop = in the zone, not yet stopped
  health: number;
  spent: number; // ₺ this visit
  pricePerPoint: number;
}

export interface Mechanic {
  update(dt: number, car: CarSample, state: ShiftState): HudFx[];
  view(): MechanicView | null; // null unless the car is in a mechanic zone during 'driving'
}

// ---------- Package feedback (game/packageFx.ts) ----------

export interface PackageFx {
  update(dt: number, car: CarSample, state: ShiftState): HudFx[]; // condition/time feedback for the active order
  onShiftEvent(e: ShiftEvent, state: ShiftState): HudFx[]; // pickedUp / delivered / packageRuined
}
