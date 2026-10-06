# Handoff — Tech Demo: Lookdev + Drift

## Context
- Game: **Maps From Hell**. Full design in `GAME_DESIGN.md`; read §1 (identity), §3 (drift), §14 (tech stack), §15 (art pipeline) before starting. Other sections only when needed.
- The game is being **rebuilt from scratch**. The current code in `src/` is the V2 prototype (vanilla JS, Three r128, global scope). It is reference only and is not ported.
- This phase is roadmap step 1 (`GAME_DESIGN.md` §17).

## Goal
Answer two questions before any game content is built:
1. **Does it look good?** A single street block whose look we would ship.
2. **Is driving fun with no goal?** Drift alone should be enjoyable.

**Exit criterion:** the user drives around the block for 5+ minutes for fun, and screenshots of it look like a game, not a prototype.

## Scope

### In
1. **Scaffold:** Vite + TypeScript + Three.js (current) + Rapier (`@dimforge/rapier3d-compat`). Static build.
2. **Drift car on a flat test plane first** (feel before visuals):
   - Rapier rigid body chassis + 4 raycast wheels with suspension.
   - **Custom arcade tire model:** separate front/rear lateral grip, grip falloff curve vs. slip angle, RWD.
   - Handbrake drops rear grip; counter-steer holds the angle.
   - **Drift assist** (auto counter-steer amount, 0–1).
   - **Drift boost:** a long drift grants a short speed burst.
   - Chase camera that reacts to drift angle and speed (offset, FOV kick on boost).
   - Keyboard + gamepad.
3. **Live tuning panel** for every physics and camera parameter, with export/import of presets as JSON. Tuning feel is the main work of this phase, so this is not optional.
4. **Lookdev block** around the car:
   - One intersection + two streets, one slope/ramp, sidewalks with curbs, a few buildings built from modular facade pieces (boxes are fine at first).
   - Lighting: sun + sky/hemisphere, soft shadows, tone mapping, fog, ambient occlusion, light bloom, color grading.
   - **One shared palette texture / material** for all geometry (§15.2).
   - 3 lighting presets switchable at runtime: day, sunset, night (street lamps, lit windows).
   - A handful of Turkish placeholder props (AC unit, satellite dish, shop awning, hanging sign) to test whether the style carries the place.
5. **Drift juice:** tire smoke, skid marks, a minimal drift score readout (angle × speed × duration, chain multiplier, banked on clean end, lost on crash).
6. **Performance readout:** FPS, draw calls, triangles (debug overlay).

### Out (do not build in this phase)
YOLDAŞ, navigation, orders, missions, UI/HUD design, menus, save system, traffic, pedestrians, damage model, audio beyond a placeholder engine pitch, final car model, multiplayer.

## Suggested order
1. Scaffold + empty scene + debug overlay.
2. Car on a flat plane + tuning panel → iterate on feel with the user.
3. Lookdev block + lighting presets.
4. Drift juice + score.
5. Hand over to the user for playtesting and screenshots.

Stop after each step and let the user drive it. Feel and look are verified by the user manually; do not run browser or visual tests.

## Prototype: what is useful as reference
Do not port code. Look at these only for ideas:
- `src/js/city.js` — `PAL` palette, shop/sign list (`SHOPS`, `SIGNS`), Turkish building types (`apartment`, `oldHouse`, `balconies`, `roofClutter`, `shopFront`). Good list of what makes the place feel Turkish.
- `src/js/world.js` — sky shader and time-of-day color table (`TOD`, `setClock`), quality presets. The palette direction (warm, saturated, slightly pastel) is a reasonable starting point.
- `tools/shots/*.png` — screenshots of the prototype's look.
- **Not useful:** `src/js/car.js` physics (single lateral damping value, no front/rear grip, no real drift) and the 2D AABB collision grid in `world.js` (no vertical gameplay).

## Decisions to confirm with the user before writing code
1. **Location:** new repo, or a new folder in this repo? (Recommended: new repo; this one stays as the prototype archive.)
2. **Dependencies** (user rule: ask before adding any):
   - `vite`, `typescript`
   - `three` (+ `@types/three`)
   - `@dimforge/rapier3d-compat`
   - `lil-gui` (tuning panel)
   - A post-processing library, e.g. `postprocessing` and/or an AO pass such as `n8ao`, or use Three's built-in `EffectComposer` passes only
3. **Visual references:** ask the user for 3–5 games or images they like for the look.
4. **Placeholder car:** box car vs. a CC0 model (e.g. Kenney Car Kit) for the demo.

## User working rules (summary; CLAUDE.md is authoritative)
- Reply in the user's language (Turkish); code, comments, docs in English.
- Before any code change, state the plan briefly and **wait for approval**. If the approved approach fails, stop and report.
- Simple over clever. No abstractions before they are needed.
- No build tests for small changes; never run browser/visual tests.
- Don't commit or push unless asked.
