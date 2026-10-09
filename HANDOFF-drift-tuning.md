# Handoff — Tech Demo, Step 2: Drift Feel (in progress)

Continue from here in a new chat. Read `HANDOFF-tech-demo.md` (phase goals, scope, user rules) and `GAME_DESIGN.md` §3 (drift) first. This file covers what was built and learned during step 2.

## Status
- Roadmap step 1 (scaffold + debug overlay): **done**.
- Step 2 (car on a test surface + tuning panel, iterate on feel): **in progress**. Wide/long drifts now feel good to the user. Still needs a tuning pass (see Open issues).
- Steps 3 (lookdev block), 4 (drift juice + score), 5 (handover): not started.

## How to run
```bash
npm run dev                      # game
npm run build                    # tsc --noEmit + vite build
node tools/runSim.mjs            # headless handling benchmark (default params)
node tools/runSim.mjs '{"driftGripThrottle":0.8}'   # with carParams overrides
```

Controls: W/↑ throttle, S/↓ brake/reverse, A/D steer, Space handbrake, R respawn on nearest track point, C free orbit camera. Gamepad: RT/LT/left stick/A, Y = respawn.

## Files
| File | Role |
|---|---|
| `src/main.ts` | Renderer, scene, lights, fixed 60 Hz physics loop with render interpolation, shadow box that follows the car snapped to shadow texels, debug overlay text |
| `src/car.ts` | Rapier chassis, 4 raycast wheels, suspension, arcade tire forces, drift state, gearbox, boost. `carParams` holds every tunable |
| `src/tire.ts` | Lateral grip curve (linear to peak slip, eases to `slideGrip`) |
| `src/carModel.ts` | Prototype "sedan" built from boxes, wheel arches, `WHEEL_LAYOUT`, `WHEEL_TRAVEL` |
| `src/chaseCamera.ts` | Chase cam: yaw follows heading + eased drift angle, speed FOV, boost FOV, speed shake |
| `src/input.ts` | Keyboard (steer ramp, throttle ramp) + gamepad → `DriveInput` |
| `src/track.ts` | Track generated from `SECTIONS` (straights + arcs, driver's-view left/right), barriers on the outside, curbs on the inside of each bend, skidpad outside the loop beside the main straight with a barrier opening, cones + box stack |
| `src/audio.ts` | Synth engine (revs from car gearbox), tire screech from rear slip, wind |
| `src/tuning.ts` | lil-gui: **Basic** (10 most important knobs) + **Advanced** folders, Camera, Look, Audio, Presets (export/import JSON, reset). Saves to localStorage |
| `tools/runSim.mjs` + `tools/driftSim.ts` | Headless benchmark through Vite SSR: accel times, fast-corner stability, handbrake drift hold (driver / feather / hands-off / no throttle), lift-off recovery, direction switch |

Dependencies (all approved): three, @dimforge/rapier3d-compat, lil-gui, postprocessing, n8ao (last two unused until lookdev), vite, typescript, @types/three.

## Drift model (how it works now)
Layers, in the order they act in `Car.step`:
1. **Tire model:** per wheel, slip angle → `lateralGrip` curve × axle grip × load. Separate `frontGrip` / `rearGrip`. Friction circle only for braking.
2. **Drift state** (`stats.drifting`): entered only with intent — handbrake (0.6 s window) or low-speed power-over (below `powerOversteerMaxSpeed`) and angle > `driftEnterDeg`, or any slide > `driftAutoEnterDeg`. Exits after `driftExitTime` below `driftExitDeg`, so S-turn transitions stay one drift. Stays on past 90° if yaw rate > `DONUT_YAW_RATE`.
3. **Rear grip multiplier in a drift:** `driftGripLift` (no throttle) ↔ `driftGripThrottle` (full throttle). Spin guard raises rear grip past `driftMaxDeg`, faded out at low speed (`spinGuardSpeed`).
4. **Outside a drift:** `powerOversteer` loosens the rear on throttle + steer at low speed; `highSpeedStability` adds rear grip at speed (prevents falling into a drift in fast corners).
5. **Drift-only forces, eased in/out over `driftRampTime`:** `driftPower` (gear-independent drive), `driftSpeedKeep` (gives back part of slide drag as thrust), `driftSteerYaw` (steering nudges the angle). Assist (`driftAssist`) auto counter-steers.
6. **Gearbox:** 5 auto gears (`GEAR_TOPS`), `gearSpread`, `shiftTime`. Gear is held during a drift.
7. **Boost:** after a drift ≥ `boostMinTime`, `boostForce` for `boostDuration`, eased in/out over 0.3 s.

Current defaults are the user's preferred tune (from their exported JSON) plus later changes; see `carParams` in `src/car.ts`.

## Benchmark baseline (current defaults)
0–50 3.4 s, 0–100 9.3 s, top 161 km/h. Full lock at 100/130 km/h: no drift. Handbrake drift held 15 s by the scripted driver at 60/80/110 km/h entry, S switch keeps the drift (≈50° the other way), lift-off recovers in ≈0.6 s. Hands-off with full throttle: ≈1.5 s.

## Open issues
1. **Donut does not work.** 5 s of full lock + full throttle gives ~1.2–1.3 turns (a donut should be 3+). Not changed by `yawInertia`, `angularDamping`, `driftAssist`, or extra low-speed rear loosening (that experiment also broke the drift suite and was reverted). Cause is structural; next step is to log per-wheel lateral/longitudinal forces and slip during a donut and see what resists rotation (suspects: front tires at ~90° slip, the per-step `stopLat` cap at low speed, β capped at 90° by `atan2(vLeft, |vLong|)`).
2. **"Lurch" at drift start/end** was mostly the boost (now softer and eased) and the drift-only forces (now ramped). Remaining one-frame jumps are the handbrake release. User has not confirmed whether it's gone.
3. **No-throttle drift while steering into it** can linger at low speed because `driftSteerYaw` keeps rotating the car. Releasing steering ends it in ~1 s.
4. **60 km/h full lock + full throttle (no handbrake) enters a drift** (~60°). Intended power-over, but may read as "too easy to throw". Knob: `powerOversteer`.
5. **Speed perception:** the gauge is correct (verified against position change). 70 km/h not feeling like 70 is mostly the empty, wide test track; to be judged again on the lookdev street. Ideas not yet done: narrower road, roadside posts, lower `distPerSpeed`, motion blur (lookdev).
6. **Track:** curbs/barriers OK; grass has the same grip as asphalt.
7. The user wants a **full tuning pass** ("baştan bir elden geçiririz ayarları").

## Lessons from this step (important for how to work with this user)
- **Change one thing at a time, in small steps.** A "simplification" pass that removed two mechanisms and moved five values at once made the car twitchy ("zor kopuyor, kopunca savuruyor") and had to be reverted.
- **The sim measures numbers, not feel.** Its driver is a perfect analog controller; it can't judge breakaway feel or keyboard play. Use it for regressions and sanity floors, then ask the user to drive.
- **Throttle range in a drift must be narrow.** A large gap between `driftGripLift` and `driftGripThrottle` turns the throttle into an on/off switch, especially on keyboard.
- **localStorage key:** `STORAGE_KEY` in `src/tuning.ts` is `mfh.tuning.v6`. Bumping it wipes the user's saved panel values; only bump when default changes would otherwise be shadowed, and say so. Otherwise tell the user to set the value in the panel or use Reset.
- Gearing must not starve or interrupt a drift (hence held gear + `driftPower`).

## User working rules (CLAUDE.md is authoritative)
- Reply in Turkish; code, comments, docs in English.
- Before any code change, state the plan briefly and **wait for approval**. If an approved approach doesn't work, stop and report; don't switch silently.
- Simple over clever; no new dependencies without asking.
- No build test for small changes; never run browser/visual tests (user verifies feel and look).
- Don't commit or push unless asked.
- Be direct and critical, including about your own earlier work.

## Suggested next steps
1. Ask the user how the current build drives (lurch gone? low-speed throttle drift? wide drift still good?).
2. Tuning pass with the user, one knob at a time, using the Basic panel.
3. Donut investigation via per-wheel force logging in a temp sim script.
4. Then roadmap step 3 (lookdev block), carrying over the prototype's warm sun look the user liked (`world.js` `TOD` table in the old repo `C:\PROJECTS\google-maps-from-hell`).
