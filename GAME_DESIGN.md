# Maps From Hell — Game Design Document

> **Status:** Living document, v0.1
> **Supersedes:** `google-maps-from-hell.md` (initial idea) and the V2 prototype design. The prototype stays as a reference only; the game will be rebuilt from scratch.
> **Pitch:** *Crazy Taxi meets a passive-aggressive AI navigator in a fake Istanbul.*

---

## 0. Decision Log

| # | Decision | Status |
|---|---|---|
| D1 | YOLDAŞ is the courier company's navigation app (gig-economy satire), not a generic GPS | ✅ Decided |
| D2 | Districts are **handcrafted**; content inside them (orders, events, closures, traffic) is **procedural** | ✅ Decided |
| D3 | Main mode is **Mesai** (roguelite shift), not an open-world career | ✅ Decided |
| D4 | Drift is a **core mechanic**: fun on its own, scores points, gives speed boost | ✅ Decided |
| D5 | Rebuild from scratch; prototype is reference only | ✅ Decided |
| D6 | Drop "Google" from the public name (trademark risk). Working title: **Maps From Hell** | ✅ Decided |
| D7 | Languages at launch: **English + Turkish**, keeping the Turkish flavor in both | ✅ Decided |
| D8 | Platform: web first, Steam later as a paid full version | ✅ Decided |
| D9 | No energy systems, no loot boxes, no pay-to-win | ✅ Decided |
| D10 | Tech stack (see §14) | 🟡 Proposed |
| D11 | Art pipeline (see §15) | 🟡 Proposed |
| D12 | Failure: soft per-order failure; shift ends early on rating < 3.0 or car destroyed; no permanent progress loss (see §4.2) | ✅ Decided |
| D13 | Continue: max 1 per shift (rewarded ad or Ad-Free Pack), unranked, not in Daily Route | ✅ Decided |
| D14 | Consumable continue packs (sold separately) | 🟡 Open — recommended against |

---

## 1. Identity

**One line:** A driving game where your navigation app is trying to help you — and slowly becomes the reason you can't get anywhere.

**Framing:** You are a courier. YOLDAŞ is your employer's navigation app, built by a startup that keeps shipping "updates." Every update brings a new malfunction.

This framing gives us, for free:
- **A reason for every mission** → orders.
- **A scoring system** → courier rating, tips, customer stars.
- **A story engine** → startup growth, updates, "AI integration," replacement.
- **Self-aware monetization satire** → "YOLDAŞ Premium," sponsored routes, ads read aloud by the GPS.

**Core design rule (kept from the original idea):**
> Build a normal system, then turn the system itself into a character.
> Normal world + small breakages = funnier than constant screaming absurdity.

**Unfair advantage:** Turkish street and car culture (simit, dolmuş, teyze, rear-window stickers, nazar boncuğu, Şahin drift). Nobody else can make this. It must survive localization — think *Untitled Goose Game*'s English village: local flavor reads as charm to a foreign audience.

**Closest reference / competitor:** *Totally Reliable Delivery Service* (physics comedy delivery). Our difference: the navigator is the antagonist.

---

## 2. Core Loop (minute to minute)

```
Pick order → Pick up → Drive → YOLDAŞ gives a command
   → DO I TRUST IT? → Intersection → Arrive → Tip + rating
```

The prototype had no real decision: the player followed the GPS or didn't, with no cost either way. The mechanics below put a **decision at every intersection**.

### 2.1 Compliance Multiplier
- Following a correct YOLDAŞ command raises the tip multiplier (x1 → x2 → x3 …).
- Ignoring a command resets it.
- **But YOLDAŞ sometimes lies.** Following a lie means a wall, a dead end, stairs, a lake.
- Every intersection is a small bet.

### 2.2 YOLDAŞ Tells (the skill ceiling)
YOLDAŞ gives itself away when lying, like a poker tell:
- Hesitation in the voice ("Uhh… turn left.")
- A one-frame glitch on the app icon
- Suspiciously precise distances ("in 237.4 meters")
- Phrasing shifts ("I would *suggest* turning left")

Early districts: obvious tells. Later districts: subtle ones. **Learning to read YOLDAŞ is the core skill.**

### 2.3 Learning the City
Each district hides **real shortcuts** YOLDAŞ doesn't know: through a parking garage, a passage, a bazaar alley. The player gradually knows the city better than the GPS. This mastery is the Crazy Taxi hook.

### 2.4 Competing Navigator: the Passenger
Passenger orders bring a second voice with their own directions.
- Teyze: "Turn right here, son." / YOLDAŞ: "Continue straight."
- The player chooses whom to trust.
- Sometimes teyze knows a shortcut. Sometimes she's describing the city as it was in 1987.

### 2.5 Package Condition
Package types change how the same route plays:
- **Fragile** (eggs, cake, aquarium fish, wedding cake) → punishes speed, collisions, drifting.
- **Urgent** (ice cream, medicine, hot food) → punishes slowness.
- **Heavy** → affects handling.

### 2.6 Reporting Fake Roads
When the player discovers a fake road, they can report it (Waze-style satire). Reports raise the district's **Map Accuracy %** and earn rewards. Weekly YOLDAŞ updates partially re-break the map.

---

## 3. Drift

Drift must be fun even for a player who ignores every order. "Toy first."

### 3.1 Physics
- **Arcade tire model**, not simulation. Rapier handles collisions and the body; lateral grip is custom code with separate front/rear values.
- Handbrake drops rear grip; counter-steer holds the angle.
- **Adjustable drift assist** (auto counter-steer amount): on for beginners, off for experts.
- **Drift boost** (Mario Kart mini-turbo logic): a long drift grants a short speed burst. Drift is useful for delivery, not only for score.
- Starter car is a RWD Şahin/Doğan-style sedan — "Şahin drift" is an existing Turkish meme.

### 3.2 Scoring
- Score = angle × speed × duration; chaining drifts raises the multiplier.
- **Near-miss bonus:** passing close to traffic, pedestrians, walls.
- **Banking (Tony Hawk logic):** points are only banked when the drift ends cleanly. Crash → the chain is lost.
- **Drift park:** entering the delivery zone with a drift gives a style bonus.
- **Route Style bonus:** drifting through the exact turn YOLDAŞ just called.

### 3.3 Theme Tie-ins
- Fragile package + drift = ruined cake. Drift score vs. tip is a real trade-off.
- Customer types: some passengers pay extra for drifting ("one more, abi!"), teyze screams and cuts the tip.
- YOLDAŞ reactions escalate with chain length: "Please stay in your lane." → long silence → a reluctant "…impressive."

### 3.4 Content
- Per-district drift leaderboards; separate drift score in Daily Route.
- **Night Shift / Free Drive** mode: no goals, just driving.
- Cosmetics: tire smoke color, tire marks, drift sound.

---

## 4. Session Structure: Mesai (Shift)

A shift is a roguelite run of **5–10 minutes**, sized for a browser session.

```
Shift starts (morning)
 ├─ Order board: 3 orders, pick 1
 │    (far + big tip / fragile / passenger / urgent)
 ├─ Delivery
 ├─ YOLDAŞ Update: pick 1 of 3
 ├─ … 6–10 deliveries …
 └─ Shift ends: evening falls, car is wrecked, or rating drops below threshold
      → Payout: money + courier XP
```

### 4.1 YOLDAŞ Updates (run modifiers)
Stackable modifiers, mostly cursed, some with upside. Examples:

| Update | Effect |
|---|---|
| Reverse Left-Right v2 | Left and right are swapped. x2 tips |
| Sponsored Route | Every route passes a kebab shop. Earns ad money |
| Silent Mode | YOLDAŞ speaks only in emoji |
| Honesty Patch | YOLDAŞ never lies, but is extremely rude |
| Rhyme Engine | All instructions rhyme. Timing gets worse |
| Scenic Mode | Routes prefer "beautiful views" |
| Beta Voice | New TTS voice, occasionally wrong language |

Combinations generate **systemic comedy**, so not every joke has to be hand-written. Hand-written jokes are reserved for story moments. This is the fix for joke fatigue.

### 4.2 Failure & Damage

**Core tension:** the main joke is YOLDAŞ driving you into a building. If crashing is punished hard, players learn to never trust YOLDAŞ and the trust mechanic dies. Crashes must cost something, must not end the run on their own, and sometimes give something back.

All numbers below are starting values, to be tuned in playtests.

#### Order level — soft failure
There is no "mission failed" screen for a single order.
- **Time:** the tip decays over time. Past ~2× the expected time, the customer cancels.
- **Package condition:** fragile packages have their own health, reduced by impacts and hard drifting. At 0 the package is ruined; it can still be delivered, but pays nothing ("Your cake… has been delivered.").
- **Result:** cancelled or ruined order = no pay + **courier rating drops**. The shift continues.

#### Shift level — two "lives"
Time is not a failure condition; it is the shift's natural end. The day runs from morning to evening (~8–10 real minutes). The goal is to earn as much as possible in that window. Two things end a shift **early**:

| Life | Reduced by | At zero |
|---|---|---|
| **Courier Rating** (starts at 5.0 ★) | Cancellations, ruined packages, late deliveries, hitting pedestrians | Below 3.0: "Your account has been suspended." Fired, shift ends |
| **Vehicle Condition** (health bar) | Collisions | Car is towed, shift ends |

Either way, money earned so far is kept. A roguelite loss ends the run early; it never erases progress.

#### Career level — no permanent loss
Progress is never lost. Story deliveries have their own conditions and can be retried instantly.

#### Damage model
- **Speed-scaled:** low-speed scrapes deal no damage, only scratches. Damage ramps above a speed threshold. A light wall tap while drifting is nearly free; hitting a building at 80 km/h is expensive.
- **Visual damage:** bent bumpers, popped hood, falling parts, smoke. Comedy and clip material.
- **Mechanic stop:** during a shift, the player can visit a mechanic (sanayi) to repair for money. A decision: spend time and money, or keep the risk.
- **Between shifts:** damage does not persist. Every shift starts with a repaired car; the repair bill is deducted from the payout, so careful driving pays more. Persistent wear/maintenance is a chore and is out for v1.
- **Fuel:** none in v1 (chore). Exception: the EV's charge, as a vehicle trait.
- **Cosmetic idea:** a "Battered Look" cosmetic that keeps dents and a mismatched door color permanently.

#### Crashing because of YOLDAŞ
- **First crash into a given fake road counts as a discovery:** it is added to the Malfunction Collection and grants a map-report bonus that partially offsets the damage.
- **Compliance multiplier resets:** you lost the bet.
- **"File a Complaint" at shift end:** part of the damage taken while following YOLDAŞ is refunded. YOLDAŞ takes offense and is more passive-aggressive next shift.

#### Continue (second chance)
- When a shift ends early, the player may **continue once per shift**: the car is restored to 50% or the rating to 3.5, and the shift resumes.
- Source: **rewarded ad**, or free with the **Ad-Free Pack** (§13).
- Hard cap: **1 continue per shift**, regardless of source.
- Continued shifts are **not ranked** on leaderboards. Continue is not available in Daily Route.

#### By mode

| Mode | Failure |
|---|---|
| Mesai / Career | The system above |
| Daily Route | One attempt. If car or rating hits zero, the run ends with the current score. No continue |
| Free Roam | No failure. Damage is visual only, one button fixes it |

#### Out of scope for v1
- **Police and fines:** a separate system, later.
- **Pedestrians:** no gore. They dodge or ragdoll comically; rating drops.

---

## 5. Districts

Handcrafted layouts. Each has its own **driving character** and its own **YOLDAŞ weakness**.

| # | District | Driving character | YOLDAŞ weakness |
|---|---|---|---|
| 1 | **Mahalle** (start) | Flat, grid-ish, calm | Classic: routes through buildings |
| 2 | **Historic Peninsula** | Hills, stairs, one-ways, narrow alleys | Thinks stairs are roads. Moto courier shines |
| 3 | **Coast / Bosphorus** | Bridges, car ferries, fog | Unbuilt bridges, "continue by ferry" |
| 4 | **Plaza & Gated Sites** | Multi-story car parks, ramps, rooftops | Vertical routes: "turn right on floor 3" |
| 5 | **Industrial / Construction** | Roads change during the shift, cranes | Map is always outdated |
| 6 | **Mountain & Village Road** | Dirt roads, goats, no signal | Loses signal and improvises |
| 7 | **YOLDAŞ HQ** (finale) | Delivery into the server room | Story finale |

**Procedural layer inside each district:** order locations, road works, closures, traffic density, events, time of day, weather.

---

## 6. Story

A thin thread, not a heavy script. Career = shifts + **3–4 hand-written story deliveries per district** (like the 8 prototype missions), mixed into shifts.

- **Chapter 1:** YOLDAŞ is new, eager, incompetent.
- **Middle:** The startup grows. Updates, ads, "AI integration." YOLDAŞ starts remembering the player's habits.
- **Late:** The company wants to replace YOLDAŞ with a "more efficient" model. The new model is flawless and soulless. For the first time the player misses the old, lying YOLDAŞ.
- **Finale:** Final delivery to HQ. "Fix the GPS" flips: do you fix it, or save it as it is?

Goal: a small emotional beat under the comedy. "I felt bad for a GPS" spreads further than "funny game."

### 6.1 YOLDAŞ Personality & Memory
Kept from the original idea: YOLDAŞ tracks a few player metrics and reacts.

```ts
type PlayerNavigationStats = {
  ignoredDirections: number;
  wrongTurns: number;
  collisions: number;
  recalculations: number;
  shortcutsTaken: number;
  driftChains: number;
  gpsTrust: number;
};
```

Moods: `neutral`, `confused`, `annoyed`, `sarcastic`, `passive_aggressive`, `helpful`, `deceptive`. Mood affects lines and lie probability.

---

## 7. Modes

| Mode | Description | Launch |
|---|---|---|
| **Career** | Shifts + story deliveries, district unlocks | v1 |
| **Mesai (quick shift)** | Standalone shift in any unlocked district | v1 |
| **Daily Route** | Same seed for everyone, one attempt, share card, daily leaderboard | v1 |
| **Free Drive / Night Shift** | No goals, drift and explore | v1 |
| **Navigator (2P online)** | See §11 | v1.5 |
| **Courier Race (4–8P)** | See §11 | Later |

### 7.1 Daily Route Share Card
```
Maps From Hell #142 🚗
Trusted YOLDAŞ: 11 times
Hit a building: 4
Drift: 18,450
Time: 2:31
🟩🟥🟥🟩🟨🟥
```

---

## 8. First 60 Seconds (FTUE)

- **No menu.** The game opens with the player already in the car, engine running.
- YOLDAŞ: "Hello! Your first delivery: the kebab shop. Continue straight."
- Around second 40, the player drives into a building. "Recalculating…"
- The idea is understood before the first minute ends.
- Name entry, menus, and garage appear **after** the first delivery.

---

## 9. Retention (why come back)

1. **Daily Route** — shareable, one shot per day.
2. **Shift variety** — update combos, orders, events.
3. **Unlock chain** — districts, vehicles, YOLDAŞ versions.
4. **Malfunction Collection** — every malfunction type and rare line is logged ("47/120 malfunctions discovered"). Finding new jokes becomes a goal instead of jokes wearing out.
5. **Weekly Update** — one global YOLDAŞ modifier for everyone each week ("v4.2: now speaks in rhyme"). Live-game feel with minimal content cost.
6. **Courier Rank** — Intern → Courier → Senior → "Knows the city without GPS."
7. **Drift leaderboards** per district.

---

## 10. Vehicles

Vehicles change **play style**, not just stats. Each opens different parts of the districts.

| Vehicle | What it changes |
|---|---|
| **Classic sedan** (Şahin/Doğan-like, start) | Balanced, RWD, drift king |
| **Moto courier** | Stairs and narrow alleys, shortcut master. Flies on impact, can't carry fragile |
| **Dolmuş** | 4–5 passengers at once, all giving different directions |
| **Panel van** | Carries many packages, heavy, gets stuck in alleys |
| **Tractor** | Drives through parks and fields, slow. YOLDAŞ doesn't count it as a car |
| **Startup EV** | Silent, fast, runs out of charge, constantly updating. YOLDAŞ's cousin |
| **Ambulance** (late) | Traffic clears, but YOLDAŞ enters panic mode |

All vehicles need **accessory sockets** (spoiler, rims, mirror ornament, dashboard item, rear window) for cosmetics.

---

## 11. Online (phased)

| Phase | Content | Cost |
|---|---|---|
| **A** | Anonymous account, leaderboards, Daily Route, **ghost cars** (other players' routes as translucent cars) | Very low |
| **B — Navigator** ⭐ | 2 players via room code. One drives, the other **is YOLDAŞ**. The navigator sees only YOLDAŞ's map — **which is also wrong**, so the navigator is deceived too. Commands are sent via buttons and spoken in YOLDAŞ's voice. Optional **Traitor** variant: navigator scores when the driver crashes | Medium; 2-player netcode is manageable |
| **C — Courier Race** | 4–8 players, same order, each player's YOLDAŞ lies differently. Sabotage: send an "update" to a rival's YOLDAŞ | High; empty lobbies kill games without a player base |

Navigator mode is the viral feature (streamers, friend groups on Discord). It is the first online feature after single-player is proven.

---

## 12. Cosmetics

Built on Turkish car culture:
- **Rear window stickers** — "Kaderimde yol var" and friends; custom text (filtered).
- **Mirror ornaments** — nazar boncuğu, tespih, pine air freshener, fuzzy dice (physics-driven swing).
- **Dashboard** — bobblehead dog, dancing figure.
- **License plate** — custom text.
- **Horns** — melodic horns, wedding horn, "La Cucaracha."
- **Paint, rims, spoilers, decals.**
- **Drift** — tire smoke color, tire marks, drift sound.
- **YOLDAŞ voice packs & phone cases** — passive-aggressive teyze, motivational coach, conspiracy theorist, hungover YOLDAŞ. The most valuable cosmetic, because it is also content.

---

## 13. Monetization

- **All gameplay free.** Most cosmetics earnable in-game.
- **No** energy systems, loot boxes, or pay-to-win.
- **Rewarded ads on portals**, in-theme: "Call a tow truck: watch an ad," "Try YOLDAŞ Premium for one shift."
- **Continue via rewarded ad** — once per shift, unranked (§4.2).
- **Ad-Free Pack** — one-time purchase: removes ads, and the once-per-shift continue becomes free. Targets exactly the player who doesn't want ads, without selling an advantage.
- **Supporter Pack** — one-time small purchase: exclusive voice pack, exclusive vehicle, name in credits.
- **Steam (later)** — paid full version; web acts as the demo. Most likely the main revenue source for this genre.

---

## 14. Tech Stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript | Fast, static output |
| 3D | Three.js (current), **not** React Three Fiber | Hot game loop; React reconciliation adds complexity without benefit |
| UI | Plain DOM + TS (Preact/Svelte if needed) | Menus, garage, HUD |
| Physics | Rapier (`@dimforge/rapier3d-compat`) for bodies/collisions; custom arcade tire model | Vertical gameplay (stairs, ramps, roofs), flips, drift |
| Assets | glTF + meshopt/Draco, KTX2 textures | Lazy-load heavy content |
| Audio | Separate .ogg/.mp3 files, lazy-loaded, Web Audio | No base64 embedding |
| Backend (phase A) | Cloudflare Workers + D1, or Supabase | Leaderboards, Daily Route |
| Multiplayer (phase B+) | Colyseus or PartyKit / Durable Objects | Room-based sessions |
| Testing | Keep the prototype's autopilot approach (bot that trusts YOLDAŞ blindly + bot that drives the true shortest path) | Proven, valuable |
| Hosting | itch.io + web portals; Steam via Tauri/Electron later | |

---

## 15. Art Pipeline (proposed)

**Direction:** stylized low-poly, strong lighting and color. Most of the perceived quality comes from **light, palette, and post-processing**, not model detail.

1. **Lookdev first.** One street block with boxes only: lighting, palette, fog, tone mapping, AO, light bloom. Lock the look before producing assets.
2. **One palette, one material.** All models share a small gradient palette texture. Mixed-source assets look like one world; draw calls stay low.
3. **Buildings = modular kit + code assembly.** Wall, window, balcony, shopfront, awning, door modules; code composes them per building footprint.
4. **Turkish props sell the place:** AC units, satellite dishes, laundry lines, hanging signs, bakkal crates, apartment name lists, simit carts. Built in Blender (can be driven via Blender MCP).
5. **Roads generated in code** from the road graph: curves, slopes, stairs, ramps. No grid-locked road kits.
6. **District editor = Blender.** Layout is built in Blender; spawn points, fake roads, and shortcuts are named empties exported via glTF and read by the game.
7. **Vehicles are hero assets.** CC0 base + customization, or commissioned from an artist. Modular with accessory sockets. The one place worth spending money.
8. **Generic props** from CC0 kits (Kenney, KayKit, Quaternius, Poly Pizza), recolored to the palette. Check licenses of any paid pack (web builds expose files).
9. **UI and marketing visuals** (HUD, menus, garage, logo, store pages) via Claude Design.

---

## 16. v1 Launch Scope

- 2 districts: **Mahalle** + **Historic Peninsula**
- Career chapter 1, Mesai, Daily Route, Free Drive
- Drift system with leaderboards
- 4 vehicles, ~40 cosmetics
- Online phase A: leaderboards + ghosts
- English + Turkish

**v1.5:** Navigator mode. **After:** further districts shipped as updates ("YOLDAŞ v2.0 is out" doubles as marketing).

---

## 17. Roadmap

| Step | Goal | Exit criterion |
|---|---|---|
| 1. Tech demo | Lookdev block + drift physics | It looks good and driving is fun with no goals |
| 2. Core loop | One district, orders, YOLDAŞ lies/tells, compliance multiplier | Intersection decisions feel meaningful |
| 3. Mesai | Updates, order board, shift end, payout | A shift is fun to replay |
| 4. Playtest | 5–10 **strangers** (friends don't count) | **Do they come back the next day?** |
| 5. Juice & sharing | Clip button (last 10s + YOLDAŞ subtitle), Daily Route card, audio/visual polish | Clips are postable as-is |
| 6. v1 content | Second district, story ch.1, vehicles, cosmetics, EN+TR | v1 scope complete |
| 7. Launch | itch.io → Reddit (r/WebGames, r/playmygame, r/IndieGaming, Turkish subs) → portals | |
| 8. Data-driven | Navigator mode, Steam page, voice packs | |

**Don't list:** no multiplayer, economy balancing, or large asset work before step 4 passes. The rule is no longer "is it funny?" but **"is it played a second time?"**

---

## 18. Open Questions

- Final public name (EN + TR).
- Visual reference board for lookdev.
- Voice production: better TTS vs. voice actors; EN voices needed.
- Currency naming and economy numbers.
- Full YOLDAŞ Update list and balancing rules for Mesai.
- New repo vs. this repo.
