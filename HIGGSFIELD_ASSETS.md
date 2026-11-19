# Maps From Hell — Higgsfield Asset Production Pack

> For **Claude chat** (Higgsfield MCP, free-trial unlimited). Claude Code cannot use the trial allowance, so production happens on the chat side.
> Game context: stylized low-poly driving game in a fake Istanbul. You are a gig courier; **YOLDAŞ** is your employer's lying, passive-aggressive navigation app. Satirical, warm, funny — never grim. Full design: `GAME_DESIGN.md`.

---

## 0. Rules for the generating agent (read first)

1. **Strictly sequential.** One generation at a time. Wait until the job is finished (and the file is saved) before submitting the next one. **Do not** use `generate_*_batch` tools, **do not** set `count` > 1, **do not** fire parallel calls.
2. Always pass `use_unlim: true`. If a request is rejected for the allowance, stop and report — never fall back to credits.
3. **Save every result** to the exact path given, under the project root `C:\PROJECTS\maps-from-hell\`. Create folders as needed. Never overwrite an existing file — if the path exists, append `_v2`, `_v3`.
4. If a result is clearly bad (wrong text, broken anatomy, logos of real brands, watermark), regenerate **once** with the same prompt; if still bad, keep the best and note it in the manifest.
5. After each save, append one line to `assets/raw/MANIFEST.md`:
   `| <ID> | <path> | <model> | <job_id> | ok / weak / failed | <short note> |`
6. **Style consistency:** generate section **A (style anchors)** first. For every later *world/concept* image, pass `A01` (and the matching time-of-day anchor) as `image_references` (use its `job_id`). For every later *UI/icon* image, pass `B03` (YOLDAŞ icon) as reference where the model allows references.
7. No real brands, logos, license plates, or real people. Cars are generic, badge-less. Text in images must be exactly what the prompt says — nothing more.
8. Order of work: **P0 → P1 → P2**. Within a priority, go top to bottom.
9. Fallback model order if one fails/unavailable — images: `nano_banana_pro` → `gpt_image_2_6` → `seedream_v5_pro` → `nano_banana_2_1`. Video: `seedance_2_0` → `seedance_2_5`. Speech: `text2speech_v2 (elevenlabs)` → `seed_audio` → `text2speech_v2 (minimax)`.

### Model cheat sheet (trial-eligible)
| Need | Model | Key params |
|---|---|---|
| Painterly/concept/key art, text-heavy art | `nano_banana_pro` | `resolution: "2k"`, `aspect_ratio` |
| Transparent PNG (icons, stickers, sprites) | `gpt_image_2_6` | `quality: "high"`, `resolution: "2k"`, `background: "transparent"` |
| Vector icons (SVG) | `gpt_image_2_6` | `output_format: "svg"` (no references allowed) |
| Small animated loops (GIF) | `gpt_image_2_6` | `output_format: "gif"`, `size`, `frame_count`, `frame_duration_ms` |
| Tileable / instruction edits / bg removal | `seedream_v5_pro` | `resolution: "2k"`, `remove_bg` |
| Video 720p ≤15s | `seedance_2_0` | `resolution: "720p"`, `duration`, `generate_audio` |
| Video 480p ≤30s | `seedance_2_5` | `resolution: "480p"`, `duration` |
| Voice lines | `text2speech_v2` | `variant: "elevenlabs"` (Eleven v3, supports `[sighs]`, `[hesitates]` tags) / `minimax` / `seed_speech` / `vibe_voice` |
| Voice / sound / music experiments | `seed_audio` | `format: "mp3"`, `sample_rate: 44100` |

---

## 1. Folder layout

```
assets/raw/
  MANIFEST.md
  lookdev/        A — style anchors, key art
  brand/          B — logos, app icon
  yoldas/         C — YOLDAŞ character, moods, GIFs
  ui/icons/       D — HUD/UI icons (svg + png)
  ui/cards/       E — YOLDAŞ Update cards
  ui/screens/     L — loading, menu, result screens
  orders/         F — package illustrations
  people/         G — customer/passenger portraits
  cosmetics/      H — stickers, ornaments, decals
  world/decals/   I — signs, posters, plates
  world/fx/       I — smoke, sparks, skid marks
  world/windows/  I — night window interiors
  sky/            J — panoramas
  concept/        K — districts, vehicles, props
  marketing/      M — store capsules, social
  video/          N — clips
  voice/en/ voice/tr/   O — YOLDAŞ + characters
  sfx/            P — sound effects
  music/          P — music
```

---

## 2. Shared style blocks (append to prompts where referenced)

- **[WORLD]** = `stylized low-poly 3D game art, clean flat-shaded geometry, soft global illumination, warm saturated slightly pastel palette, sun-faded apartment facades in cream, ochre, terracotta, dusty pink, sage green, grey-blue; strong cinematic lighting, gentle fog, subtle bloom, tilt-shift feel, Istanbul neighborhood atmosphere (fictional), no text, no logos, no real brands`
- **[UI]** = `flat vector game UI style, thick clean rounded outlines, warm orange #d9702e, cream #e8dcc2, deep asphalt grey #504d4b, accent red #b83a30, accent green #2f7d4f, playful and slightly smug tone, high contrast, readable at small size`
- **[ICON]** = `[UI], single centered glyph, simple shapes, no text, transparent background`
- **[CONCEPT]** = `game concept art, painterly digital illustration, stylized low-poly proportions, warm Mediterranean light, fictional Istanbul, humorous details, no text, no logos`
- **[PORTRAIT]** = `stylized 3D cartoon character bust portrait, chunky low-poly-inspired shapes, soft studio lighting, warm palette, expressive face, Pixar-meets-low-poly, transparent background`

---

## A. Style anchors / lookdev — P0

- **A01** · `lookdev/a01_mahalle_day.png` · `nano_banana_pro` 16:9 — Street-level view of a quiet Turkish residential neighborhood intersection at mid-morning: 4–6 storey apartment blocks with balconies, AC units, satellite dishes, laundry lines between buildings, a small bakkal shop with a red awning and stacked crates, a simit cart on the sidewalk, a boxy 90s badge-less rear-wheel-drive sedan in faded red parked at the curb, cats on a wall, cracked sidewalk with curbs. [WORLD]
- **A02** · `lookdev/a02_mahalle_sunset.png` · `nano_banana_pro` 16:9 — Same neighborhood intersection at golden-hour sunset, long warm shadows, orange-pink sky, first windows lighting up, the sedan drifting through the intersection with a light trail of white tire smoke. [WORLD] (reference A01)
- **A03** · `lookdev/a03_mahalle_night.png` · `nano_banana_pro` 16:9 — Same intersection at night: warm sodium street lamps, lit windows with curtains, glowing shop sign bands, deep blue sky, wet asphalt reflections, sedan with headlights on. [WORLD] (reference A01)
- **A04** · `lookdev/a04_peninsula_day.png` · `nano_banana_pro` 16:9 — Steep narrow historic-peninsula alley: old wooden Ottoman-style houses with bay windows and timber frames, stone stairs cutting through the street, cobblestones, distant domes and minarets silhouettes (generic, not a specific real mosque), a courier scooter at the top of the stairs. [WORLD]
- **A05** · `lookdev/a05_bosphorus_fog.png` · `nano_banana_pro` 21:9 — Coastal road along a strait in morning fog, a car ferry docking, seagulls, an unfinished suspension bridge that ends mid-air (game joke), tea garden by the water. [WORLD]
- **A06** · `lookdev/a06_color_script.png` · `nano_banana_pro` 21:9 — Color script strip of 6 small panels showing the same street across a courier's shift: morning, noon, afternoon, golden hour, dusk, night. Flat color keys, no characters, no text. [CONCEPT]

## B. Brand — P0

- **B01** · `brand/b01_logo_maps_from_hell.png` · `nano_banana_pro` 16:9 — Game logo with the exact text "MAPS FROM HELL": chunky bold rounded display letters, the "O" replaced by a map pin with a tiny devil horn and smirk, a GPS route line that loops into a knot under the title, warm orange and cream on dark asphalt grey, subtle tire-skid texture, game-title quality. Exact text only.
- **B02** · `brand/b02_logo_maps_from_hell_transparent.png` · `gpt_image_2_6` 16:9, transparent — Same logo concept as B01 isolated on transparent background, clean edges. Exact text "MAPS FROM HELL". (reference B01)
- **B03** · `brand/b03_yoldas_app_icon.png` · `gpt_image_2_6` 1:1 — App icon for the fictional navigation app YOLDAŞ: a friendly but slightly smug cartoon map pin with two dot eyes and a sideways smirk, orange pin on cream rounded-square background. [UI], no text.
- **B04** · `brand/b04_yoldas_wordmark.png` · `gpt_image_2_6` 16:9, transparent — Startup-style wordmark with the exact text "YOLDAŞ" (with the Turkish Ş), friendly geometric sans, the dot pattern of a route line under it, orange on transparent. Exact text only.
- **B05** · `brand/b05_yoldas_icon_glitch.png` · `gpt_image_2_6` 1:1 — The B03 icon with an RGB-split digital glitch, horizontal slice offsets, one eye twitching — the "lying tell" frame. (reference B03)
- **B06** · `brand/b06_yoldas_splash.png` · `nano_banana_pro` 9:16 — Phone-app splash screen for YOLDAŞ: big smug pin mascot center, the text "YOLDAŞ" under it and a small tagline "Your route. Our idea." in a clean sans, cream background with orange gradients, overly-cheerful startup aesthetic. Exact texts only.
- **B07** · `brand/b07_favicon.svg` · `gpt_image_2_6` svg — Minimal map-pin face (two dots, smirk), orange on transparent, 2–3 shapes, favicon-ready.
- **B08** · `brand/b08_logo_tr_option_a.png` · `nano_banana_pro` 16:9 — Same style as B01 with exact text "CEHENNEM HARİTASI" (Turkish exploration, name not final). Exact text only.
- **B09** · `brand/b09_yoldas_premium_badge.png` · `gpt_image_2_6` 1:1 transparent — Gaudy gold "PREMIUM" badge with the YOLDAŞ pin wearing a tiny crown, exact text "PREMIUM", satirical luxury look. [UI]

## C. YOLDAŞ character — P0

Transparent PNG, 1:1, `gpt_image_2_6`, `quality: high`, reference **B03** each time. Base prompt: `The YOLDAŞ mascot — a cartoon map pin with two dot eyes and small expressive brows, no mouth except a line — expression: <X>. [UI], transparent background, same character design as reference.`

| ID | File | Expression <X> |
|---|---|---|
| C01 | `yoldas/c01_neutral.png` | calm, polite customer-service smile |
| C02 | `yoldas/c02_confused.png` | spinning question marks, eyes crossed, tilted |
| C03 | `yoldas/c03_annoyed.png` | flat eyes, one brow down, tiny steam puff |
| C04 | `yoldas/c04_sarcastic.png` | one brow raised, half-lidded eyes, smirk |
| C05 | `yoldas/c05_passive_aggressive.png` | too-wide forced smile, twitching eye |
| C06 | `yoldas/c06_helpful.png` | sparkling eyes, thumbs-up from a tiny hand |
| C07 | `yoldas/c07_deceptive.png` | eyes darting sideways, sweat drop, innocent whistle |
| C08 | `yoldas/c08_impressed.png` | reluctant, eyes wide, tiny "…" bubble |
| C09 | `yoldas/c09_recalculating.png` | dizzy, loading ring around head |
| C10 | `yoldas/c10_offended.png` | turned away, arms crossed, nose up |
| C11 | `yoldas/c11_panic.png` | screaming, siren light on top (ambulance mode) |
| C12 | `yoldas/c12_no_signal.png` | greyed out, crossed-out signal bars above |
| C13 | `yoldas/c13_sleeping.png` | eyes closed, "zzz" (idle) |
| C14 | `yoldas/c14_new_model.png` | sleek, cold, chrome, no brows, emotionless — the "efficient replacement" AI |
| C15 | `yoldas/c15_sad.png` | small tear, drooping (story finale) |

GIF loops (`gpt_image_2_6`, `output_format: "gif"`, `size: "288x288"`, reference B03):
- **C20** · `yoldas/c20_idle_blink.gif` — mascot gently bobbing, blinks once. `frame_count: 12`, `frame_duration_ms: 100`
- **C21** · `yoldas/c21_glitch.gif` — mascot glitches with RGB split for a few frames then snaps back innocently. `frame_count: 10`, `frame_duration_ms: 80`
- **C22** · `yoldas/c22_recalculating.gif` — loading ring spinning around a dizzy mascot. `frame_count: 12`, `frame_duration_ms: 80`
- **C23** · `yoldas/c23_talking.gif` — mascot's mouth line opening/closing, slight bounce (talk loop). `frame_count: 8`, `frame_duration_ms: 90`
- **C24** · `yoldas/c24_update_installing.gif` — mascot holding a progress bar that fills to 99% and goes back to 12%. `frame_count: 16`, `frame_duration_ms: 120`

## D. HUD / UI icons — P0

For each: **two files**, `.svg` via `gpt_image_2_6 output_format:"svg"` and `.png` via `gpt_image_2_6 background:"transparent"` 1:1. Prompt: `<glyph description>. [ICON]`

| ID | Name | Glyph |
|---|---|---|
| D01 | `ui/icons/d01_turn_left` | thick bent arrow turning left |
| D02 | `ui/icons/d02_turn_right` | thick bent arrow turning right |
| D03 | `ui/icons/d03_straight` | thick straight-up arrow |
| D04 | `ui/icons/d04_uturn` | U-turn arrow |
| D05 | `ui/icons/d05_roundabout` | roundabout arrow, third exit |
| D06 | `ui/icons/d06_stairs_route` | arrow going down a staircase |
| D07 | `ui/icons/d07_ferry_route` | arrow onto a small car ferry on waves |
| D08 | `ui/icons/d08_floor_route` | arrow going up into a multi-storey car park, "3" on the floor |
| D09 | `ui/icons/d09_fragile` | cracked egg / glass with a warning crack |
| D10 | `ui/icons/d10_urgent` | melting ice cream with a stopwatch |
| D11 | `ui/icons/d11_heavy` | box with a weight "kg" block — no text, use a kettlebell shape |
| D12 | `ui/icons/d12_passenger` | seated passenger silhouette with speech bubble |
| D13 | `ui/icons/d13_star` | chunky rating star |
| D14 | `ui/icons/d14_star_half` | half-filled rating star |
| D15 | `ui/icons/d15_tip_coin` | coin with a little wing |
| D16 | `ui/icons/d16_cash` | stack of banknotes (fictional, no currency symbols) |
| D17 | `ui/icons/d17_multiplier` | flame badge for a combo multiplier |
| D18 | `ui/icons/d18_drift` | car silhouette sideways with smoke swoosh |
| D19 | `ui/icons/d19_boost` | lightning bolt with speed lines |
| D20 | `ui/icons/d20_vehicle_health` | wrench crossed with a car |
| D21 | `ui/icons/d21_map_accuracy` | folded map with a check/percent gauge |
| D22 | `ui/icons/d22_report_road` | flag planted on a broken road |
| D23 | `ui/icons/d23_mechanic` | wrench and gear (garage) |
| D24 | `ui/icons/d24_watch_ad` | small TV screen with play triangle |
| D25 | `ui/icons/d25_continue` | heart with a circular arrow |
| D26 | `ui/icons/d26_pause` | pause symbol in a rounded square |
| D27 | `ui/icons/d27_settings` | gear |
| D28 | `ui/icons/d28_sound_on` | speaker with waves |
| D29 | `ui/icons/d29_sound_off` | speaker crossed |
| D30 | `ui/icons/d30_leaderboard` | podium with trophy |
| D31 | `ui/icons/d31_ghost_car` | translucent ghost-shaped car |
| D32 | `ui/icons/d32_daily_route` | calendar page with a route line |
| D33 | `ui/icons/d33_complaint` | angry speech bubble with a pen |
| D34 | `ui/icons/d34_malfunction` | broken GPS pin with sparks (collection) |
| D35 | `ui/icons/d35_shortcut` | dotted path sneaking between two buildings |
| D36 | `ui/icons/d36_timer` | stopwatch |
| D37 | `ui/icons/d37_destination` | checkered flag on a map pin |
| D38 | `ui/icons/d38_pickup` | hand picking up a box |
| D39 | `ui/icons/d39_wrecked` | car with smoke cloud and a tow hook |
| D40 | `ui/icons/d40_suspended` | ID badge with a red X |
| D41 | `ui/icons/d41_gamepad` | gamepad |
| D42 | `ui/icons/d42_keyboard` | keyboard keys WASD |
| D43 | `ui/icons/d43_garage` | small garage door |
| D44 | `ui/icons/d44_horn` | car horn trumpet |
| D45 | `ui/icons/d45_language` | globe with speech bubble |
| D46 | `ui/icons/d46_camera_clip` | camera with a red record dot (clip button) |
| D47 | `ui/icons/d47_share` | share arrow |
| D48 | `ui/icons/d48_lock` | padlock (locked district/vehicle) |

Extra UI frames (`gpt_image_2_6`, transparent):
- **D60** · `ui/icons/d60_phone_frame.png` 9:16 — Empty smartphone frame with cracked screen corner, sticker on the back edge, suction car mount clamp — container for the in-HUD YOLDAŞ map. No screen content (pure transparent screen area).
- **D61** · `ui/icons/d61_speech_bubble.png` 16:9 — Chat bubble frame for YOLDAŞ subtitles, rounded, orange outline, cream fill, small pin-shaped tail. Empty.
- **D62** · `ui/icons/d62_button_set.png` 16:9 — UI kit sheet: primary/secondary/disabled buttons, toggle, slider, checkbox, tab, all empty of text. [UI]
- **D63** · `ui/icons/d63_order_card_frame.png` 3:4 — Empty order card frame like a gig-app ticket with perforated edge, slot for portrait, slot for package icon, star row. No text. [UI]

## E. YOLDAŞ Update cards (Mesai modifiers) — P1

`nano_banana_pro` 3:4. Prompt: `Collectible upgrade card illustration for a satirical navigation app update called "<TITLE>": <scene>. [UI] style frame with a version-number ribbon, the exact title text "<TITLE>" at the top, no other text.` (generate EN titles; TR will be rendered in-game.)

| ID | File | TITLE | Scene |
|---|---|---|---|
| E01 | `ui/cards/e01_reverse_lr.png` | REVERSE LEFT-RIGHT v2 | mascot with arrows swapped, mirrored road signs |
| E02 | `ui/cards/e02_sponsored_route.png` | SPONSORED ROUTE | route line snaking past five identical kebab shops |
| E03 | `ui/cards/e03_silent_mode.png` | SILENT MODE | mascot with taped mouth, emoji bubbles |
| E04 | `ui/cards/e04_honesty_patch.png` | HONESTY PATCH | mascot with halo but yelling rudely |
| E05 | `ui/cards/e05_rhyme_engine.png` | RHYME ENGINE | mascot as a poet with a quill and beret |
| E06 | `ui/cards/e06_scenic_mode.png` | SCENIC MODE | car driving off a cliff edge toward a beautiful sunset |
| E07 | `ui/cards/e07_beta_voice.png` | BETA VOICE | mascot with mismatched speech bubbles in alien glyphs |
| E08 | `ui/cards/e08_ai_integration.png` | AI INTEGRATION | mascot with a glowing robot brain, confident and wrong |
| E09 | `ui/cards/e09_eco_mode.png` | ECO MODE | car pushed by the courier on foot, leaves falling |
| E10 | `ui/cards/e10_dark_mode.png` | DARK MODE | the whole map black, only eyes visible |
| E11 | `ui/cards/e11_social_feed.png` | SOCIAL FEED | map covered with likes and story bubbles |
| E12 | `ui/cards/e12_teyze_mode.png` | AUNTIE MODE | mascot wearing a headscarf, holding a tea glass |
| E13 | `ui/cards/e13_speedrun.png` | SPEEDRUN PATCH | mascot with racing helmet, timer overlay |
| E14 | `ui/cards/e14_offline_map.png` | OFFLINE MAP 1987 | sepia vintage map, old cars |
| E15 | `ui/cards/e15_card_back.png` | YOLDAŞ UPDATE | card back pattern: repeating pin logo, orange/cream |
| E16 | `ui/cards/e16_drift_analytics.png` | DRIFT ANALYTICS | mascot in a lab coat holding a rising line chart made of tire smoke, a drifting car leaving skid marks shaped like a graph |
| E17 | `ui/cards/e17_passenger_rating.png` | PASSENGER RATING 2.0 | headscarf auntie in the back seat holding up a 1-star scorecard, mascot sweating on the dashboard phone |
| E18 | `ui/cards/e18_live_traffic.png` | LIVE TRAFFIC BETA | mascot as a traffic cop on a crowded junction full of yellow minibuses and honking sedans, smug |

## F. Order / package illustrations — P1

`gpt_image_2_6` 1:1 transparent, prompt: `<item>, delivery package illustration, [UI] style, slight 3/4 view, transparent background, no text, no brands.`

F01 `orders/f01_doner.png` döner wrap in paper · F02 `orders/f02_lahmacun.png` stack of lahmacun in a pizza-style box · F03 `orders/f03_cake.png` birthday cake in a clear box · F04 `orders/f04_wedding_cake.png` 4-tier wedding cake, wobbly · F05 `orders/f05_aquarium_fish.png` goldfish in a plastic water bag · F06 `orders/f06_eggs.png` egg tray of 30 · F07 `orders/f07_ice_cream.png` ice cream tub with melting drips · F08 `orders/f08_medicine.png` pharmacy bag with a red cross · F09 `orders/f09_simit.png` stack of simit on a tray · F10 `orders/f10_tea.png` tray of tulip tea glasses · F11 `orders/f11_flowers.png` big bouquet · F12 `orders/f12_sofa.png` sofa strapped with rope (heavy) · F13 `orders/f13_washing_machine.png` washing machine (heavy) · F14 `orders/f14_documents.png` urgent envelope with wax seal · F15 `orders/f15_cat_carrier.png` angry cat in a carrier · F16 `orders/f16_watermelon.png` giant watermelon · F17 `orders/f17_baklava.png` baklava tray · F18 `orders/f18_phone_box.png` phone box (fragile) · F19 `orders/f19_carpet.png` rolled carpet · F20 `orders/f20_mystery_box.png` suspicious ticking box with "?" sticker (YOLDAŞ HQ story) · F21 `orders/f21_ruined_cake.png` crushed cake (ruined state) · F22 `orders/f22_ruined_fish.png` empty water bag, fish flopping (ruined state) · F23 `orders/f23_adana.png` Adana kebab dürüm wrap with a red pepper · F24 `orders/f24_pide.png` boat-shaped Turkish pide with melted cheese in a paper tray · F25 `orders/f25_pogaca.png` paper bag of round poğaça pastries · F26 `orders/f26_groceries.png` plastic grocery bag with bread and leeks sticking out · F27 `orders/f27_cat_food.png` bag of cat food with a paw print (no text) · F28 `orders/f28_birdseed.png` small bag of budgie seed with a tiny feather · F29 `orders/f29_charger.png` coiled phone charger cable with plug · F30 `orders/f30_phone_case.png` pink glitter phone case · F31 `orders/f31_school_supplies.png` bundle of notebooks, pencils and a ruler with a rubber band · F32 `orders/f32_tv.png` flat-screen TV in a box with "fragile" glass icon, no text · F33 `orders/f33_vase_flowers.png` tall crystal vase with flowers, wobbling · F34 `orders/f34_maras_cone.png` stretchy Maraş ice cream cone held on a long metal stick · F35 `orders/f35_baby_formula.png` baby formula tin with a baby bottle · F36 `orders/f36_iskender.png` İskender plate with sizzling butter in a foil container · F37 `orders/f37_kunefe.png` hot künefe in a round metal tray, cheese stretching · F38 `orders/f38_water_jug.png` 19-litre blue water jug (damacana) (heavy) · F39 `orders/f39_rice_sack.png` 25 kg rice sack, bulging (heavy) · F40 `orders/f40_cat_litter.png` big sack of cat litter with a grumpy cat face drawing (heavy) · F41 `orders/f41_printer.png` office printer spitting a paper (heavy) · F42 `orders/f42_ficus.png` potted ficus tree losing a leaf (heavy)

## G. Customers / passengers — P1

`gpt_image_2_6` 1:1 transparent, reference each new one to G01 for style. Prompt: `<character>. [PORTRAIT]`

G01 `people/g01_teyze.png` Turkish auntie, headscarf, cardigan, holding plastic bag, judging look · G02 `people/g02_amca.png` retired uncle, flat cap, mustache, prayer beads · G03 `people/g03_student.png` sleepy university student, hoodie, headphones · G04 `people/g04_plaza_guy.png` stressed office worker, loose tie, two phones · G05 `people/g05_party_abi.png` hyped young guy at night, sunglasses at night, shouting "one more!" pose · G06 `people/g06_tourist.png` sunburned tourist with map and camera · G07 `people/g07_influencer.png` influencer filming selfie with ring light · G08 `people/g08_grandpa_1987.png` very old man with outdated paper map, confident · G09 `people/g09_bride.png` bride in a hurry holding dress · G10 `people/g10_chef.png` kebab-shop chef with skewer · G11 `people/g11_mechanic.png` sanayi mechanic with oily overalls and a grin · G12 `people/g12_courier_player.png` the player courier: young, helmet under arm, insulated delivery backpack (orange, no logo), tired optimism · G13 `people/g13_courier_rival.png` rival courier on scooter, smug · G14 `people/g14_startup_ceo.png` YOLDAŞ startup CEO, turtleneck, fake smile, vest · G15 `people/g15_dispatcher.png` call-center dispatcher with headset, monotone · G16 `people/g16_cat.png` street cat as customer, sitting in a box (joke order) · G17 `people/g17_kid.png` kid with a ball, ordering ice cream · G18 `people/g18_conspiracy.png` conspiracy theorist with tinfoil hat (voice pack face) · G19 `people/g19_coach.png` loud motivational coach with whistle (voice pack face) · G20 `people/g20_hungover_yoldas.png` YOLDAŞ mascot with ice pack and sunglasses (voice pack face, reference B03)

Passenger portraits (no new files needed), `PassengerId` → file: teyze → G01 · abi → G05 · plaza → G04 · tourist → G06 · grandpa → G08 · bride → G09 · student → G03.

## H. Cosmetics — P1/P2

**Rear-window stickers** (P1) — `gpt_image_2_6` 16:9 transparent. Prompt: `Car rear-window vinyl sticker with the exact text "<TEXT>", <style>, die-cut white border, transparent background, no other text.`

| ID | File | TEXT | style |
|---|---|---|---|
| H01 | `cosmetics/h01_kaderimde_yol_var.png` | Kaderimde yol var | flowing script, white |
| H02 | `cosmetics/h02_annemin_duasi.png` | Annemin duası yeter | gothic blackletter, white |
| H03 | `cosmetics/h03_yoldas_bilir.png` | YOLDAŞ bilir | bold italic, orange |
| H04 | `cosmetics/h04_bana_uzak_dur.png` | Bana yaklaşma, frenim yok | comic, yellow |
| H05 | `cosmetics/h05_drift_king.png` | ŞAHANE DRIFT | racing italic with flames |
| H06 | `cosmetics/h06_recalculating.png` | Recalculating... | tech mono, cyan |
| H07 | `cosmetics/h07_no_gps.png` | GPS'e güvenme | stencil, red |
| H08 | `cosmetics/h08_on_my_way.png` | Geliyorum abi | handwritten |
| H09 | `cosmetics/h09_bebek_var.png` | Arabada bebek yok, ben varım | cute rounded |
| H10 | `cosmetics/h10_maps_from_hell.png` | MAPS FROM HELL | logo style |

**Mirror / dashboard items** (P1) — `gpt_image_2_6` 1:1 transparent, [UI]-ish but stylized 3D: H20 `cosmetics/h20_nazar_boncugu.png` nazar evil-eye bead hanging on a string · H21 `cosmetics/h21_tespih.png` prayer beads tassel · H22 `cosmetics/h22_pine_freshener.png` pine tree air freshener (no brand) · H23 `cosmetics/h23_fuzzy_dice.png` fuzzy dice · H24 `cosmetics/h24_bobble_dog.png` bobblehead dog · H25 `cosmetics/h25_dancing_figure.png` dashboard dancing hula figure · H26 `cosmetics/h26_tiny_flag.png` tiny generic checkered flag · H27 `cosmetics/h27_tea_glass_holder.png` tulip tea glass in dashboard holder · H28 `cosmetics/h28_lace_doily.png` crochet lace dashboard doily

**Car decals** (P2) — `gpt_image_2_6` 16:9 transparent, flat vector vinyl: H40 `cosmetics/h40_flames.png` side flames · H41 `cosmetics/h41_stripes.png` twin racing stripes · H42 `cosmetics/h42_tribal.png` 2000s tribal swoosh · H43 `cosmetics/h43_courier_livery.png` fictional courier company livery with YOLDAŞ pin (no text) · H44 `cosmetics/h44_tulips.png` tulip pattern side decal · H45 `cosmetics/h45_number_7.png` racing roundel with number 7 · H46 `cosmetics/h46_rust_patches.png` rust and primer patches ("battered look")

**Rim designs** (P2) — `gpt_image_2_6` 1:1 transparent, flat front view of a car wheel rim, no tire brand: H60 steel with hubcap · H61 5-spoke · H62 multi-spoke mesh · H63 deep dish · H64 gold BBS-like mesh (generic) — files `cosmetics/h6X_rim_<name>.png`

**Smoke color swatches** (P2) — `gpt_image_2_6` 1:1 transparent: H70–H75 `cosmetics/h7X_smoke_<color>.png` puff of tire smoke in white / pink / green / purple / orange / rainbow.

## I. World textures, decals, FX — P1

Shop signs — `gpt_image_2_6` 4:1 if allowed else 21:9, opaque. Prompt: `Flat shop fascia sign for a fictional Turkish neighborhood shop, exact text "<TEXT>", <style>, front view, flat lighting, no other text, no brand logos.`
I01 `world/decals/i01_sign_bakkal.png` "BAKKAL" red band white letters · I02 `.../i02_sign_kebap.png` "USTA KEBAP" yellow with skewer drawing · I03 `.../i03_sign_berber.png` "BERBER" with barber pole · I04 `.../i04_sign_firin.png` "FIRIN" bread illustration · I05 `.../i05_sign_eczane.png` "ECZANE" red with generic pharmacy E-in-circle mark (white) · I06 `.../i06_sign_cay_ocagi.png` "ÇAY OCAĞI" tulip glass · I07 `.../i07_sign_tamirci.png` "OTO TAMİR" wrench, greasy · I08 `.../i08_sign_kuafor.png` "KUAFÖR" pink · I09 `.../i09_sign_manav.png` "MANAV" green, fruit · I10 `.../i10_sign_cigkofte.png` "ÇİĞ KÖFTE" green leaf · I11 `.../i11_sign_internet_cafe.png` "NET CAFE" 2000s · I12 `.../i12_sign_emlak.png` "EMLAK" blue, house icon · I13 `.../i13_sign_cicekci.png` "ÇİÇEKÇİ" magenta with a bouquet · I14 `.../i14_sign_elektronik.png` "ELEKTRONİK" deep blue with a plug and lightning bolt · I15 `.../i15_sign_petshop.png` "PETSHOP" brown with a paw print · I16 `.../i16_sign_kirtasiye.png` "KIRTASİYE" purple with a pencil

Wall posters & billboards — `nano_banana_pro`:
I20 `world/decals/i20_billboard_premium.png` 16:9 — billboard ad: smug YOLDAŞ mascot, exact text "YOLDAŞ PREMIUM — Now with 12% fewer lakes." · I21 `.../i21_billboard_kebab.png` 16:9 — sponsored ad "USTA KEBAP — Your GPS recommends us." · I22 `.../i22_poster_hiring.png` 3:4 — gig recruitment poster "BE YOUR OWN BOSS* — YOLDAŞ Courier" with tiny asterisk footnote text "*not legally" · I23 `.../i23_poster_concert.png` 3:4 — fictional arabesk concert poster, singer silhouette, text "KONSER" only · I24 `.../i24_poster_lost_cat.png` 3:4 — lost cat flyer "KAYIP KEDİ" with photo of cat and phone-number tear tabs (fake digits xxxx) · I25 `.../i25_graffiti_set.png` 1:1 transparent — 6 graffiti tags and small doodles, illegible stylized letters, sheet layout · I26 `.../i26_election_banner.png` 4:1/21:9 — fictional generic neighborhood banner, text "MAHALLE FESTİVALİ" only.

Plates & signs — `gpt_image_2_6`:
I30 `world/decals/i30_apartment_plate.png` 3:2 — blue enamel apartment name plate "GÜL APARTMANI No:7" · I31 `.../i31_street_sign.png` 3:1/3:2 — blue street name sign "YOLDAŞ SOKAK" · I32 `.../i32_road_works.png` 1:1 transparent — red-white road works sign "YOL ÇALIŞMASI" · I33 `.../i33_detour.png` 1:1 transparent — yellow detour arrow sign "SAPMA" · I34 `.../i34_license_plate_blank.png` 4:1/21:9 — blank European-style white license plate with blue strip, no letters (text is rendered in-game) · I35 `.../i35_traffic_signs_sheet.png` 1:1 transparent — sheet of 9 generic European-style traffic signs: stop, no entry, one-way, give way, roundabout, stairs ahead (made-up), ferry ahead, "goats" warning, dead end · I36 `.../i36_dolmus_sign.png` 3:1 — dolmuş roof sign with "TAKSİM–KADIKÖY" route text (generic) · I37 `.../i37_menu_board.png` 3:4 — kebab shop handwritten menu board with prices as "₺??".

FX sprites — `gpt_image_2_6` transparent:
I40 `world/fx/i40_tire_smoke_sheet.png` 1:1 — 4x4 sprite sheet of a white stylized tire-smoke puff evolving from dense to dissipated, soft edges, grey-white, game VFX · I41 `.../i41_smoke_puff_single.png` 1:1 — single soft cartoon smoke puff · I42 `.../i42_sparks_sheet.png` 1:1 — 4x4 sheet of metal impact sparks · I43 `.../i43_dust_sheet.png` 1:1 — 4x4 sheet of brown dust cloud · I44 `.../i44_debris_sheet.png` 1:1 — car parts debris: bumper bits, glass shards, hubcap, sheet layout · I45 `.../i45_boost_flame.png` 1:1 — exhaust flame cone for drift boost, orange-blue · I46 `.../i46_speed_lines.png` 16:9 — anime speed lines overlay, white on transparent, center clear · I47 `.../i47_star_burst.png` 1:1 — cartoon impact star burst (crash comedy) · I48 `.../i48_confetti_sheet.png` 1:1 — confetti pieces sheet (delivery success) · I49 `.../i49_money_burst.png` 1:1 — coins and banknotes burst (tip) · I50 `.../i50_lens_dirt.png` 16:9 — subtle lens dirt / smudge overlay for bloom
Tileables — `seedream_v5_pro` 1:1 2k, prompt ends with `seamless tileable texture, top-down orthographic, flat even lighting`:
I51 `world/fx/i51_skidmark_tile.png` — dark rubber skid mark strip on transparent/white, tileable lengthwise · I52 `.../i52_asphalt_cracked.png` stylized cracked grey asphalt with patches · I53 `.../i53_cobblestone.png` stylized cobblestones · I54 `.../i54_sidewalk_tiles.png` Turkish-style red/grey interlocking sidewalk pavers · I55 `.../i55_stairs_stone.png` worn stone step top · I56 `.../i56_dirt_road.png` village dirt road with tire tracks · I57 `.../i57_grass_park.png` stylized park grass · I58 `.../i58_water_strait.png` stylized dark-blue strait water surface

Night window interiors (for lit windows / interior cards) — `nano_banana_pro` 3:4, `straight-on view through an apartment window at night, warm interior light, <scene>, no people faces visible, stylized`:
I60 `world/windows/i60_window_tv.png` living room with TV glow · I61 `.../i61_window_kitchen.png` kitchen with tea kettle · I62 `.../i62_window_curtain.png` lace curtain backlit · I63 `.../i63_window_plants.png` balcony plants silhouette · I64 `.../i64_window_cat.png` cat silhouette on sill · I65 `.../i65_window_party.png` colorful party lights · I66 `.../i66_window_study.png` desk lamp and books · I67 `.../i67_window_dark.png` dark room with faint blue phone light

## J. Sky panoramas — P1

`gpt_image_2_6` `size: "4096x2048"` (fallback `nano_banana_pro` 21:9). Prompt: `Equirectangular 360° sky panorama, 2:1, horizon exactly at vertical center, lower half a soft neutral haze (no ground objects), seamless left-right edges, stylized painterly game sky, <scene>, no sun lens flare, no text.`
J01 `sky/j01_day.png` clear warm blue with fluffy cumulus · J02 `sky/j02_sunset.png` orange-pink-violet gradient, low sun glow on one side · J03 `sky/j03_night.png` deep blue with soft city light pollution at horizon, few stars, thin moon · J04 `sky/j04_overcast.png` grey overcast, rain coming · J05 `sky/j05_fog_morning.png` pale fog, sun disc dim · J06 `sky/j06_dawn.png` cold blue to peach dawn

## K. Concept art & modeling references — P1

Districts — `nano_banana_pro` 16:9, [CONCEPT], reference A01:
K01 `concept/k01_district_mahalle.png` calm grid neighborhood, aerial 3/4 · K02 `.../k02_district_peninsula.png` hills, stairs, one-ways · K03 `.../k03_district_coast.png` bridges, ferry pier, fog · K04 `.../k04_district_plaza.png` glass towers, multi-storey car park with rooftop ramps, gated sites · K05 `.../k05_district_industrial.png` construction cranes, half-built roads, sanayi workshops · K06 `.../k06_district_village.png` mountain dirt road, goats, single signal tower · K07 `.../k07_district_hq.png` YOLDAŞ HQ: absurd startup campus with giant pin statue, server room glow · K08 `.../k08_district_map_overview.png` stylized illustrated overview map of all 7 districts as islands connected by roads, no text

Vehicle orthographic sheets (for Blender modeling) — `nano_banana_pro` 16:9: `Orthographic vehicle model sheet of <vehicle>, front view, side view, rear view and top view aligned on a light grey grid, consistent proportions, stylized low-poly game vehicle, flat lighting, no badges, no logos, no text labels.`
K10 `concept/k10_sedan_sheet.png` boxy 1990s 4-door rear-wheel-drive sedan, faded red, chrome bumpers, rectangular headlights (generic, not a real model) · K11 `.../k11_moto_sheet.png` 125cc courier scooter with insulated delivery box · K12 `.../k12_dolmus_sheet.png` yellow shared minibus with roof sign · K13 `.../k13_panel_van_sheet.png` small white panel van, roof rack · K14 `.../k14_tractor_sheet.png` small red vintage tractor with trailer · K15 `.../k15_startup_ev_sheet.png` smooth futuristic tiny EV in startup orange, LED strip face · K16 `.../k16_ambulance_sheet.png` boxy ambulance van, generic markings, no text
Vehicle beauty shots — `nano_banana_pro` 16:9, [WORLD]: K20–K26 `concept/k2X_<vehicle>_beauty.png` each vehicle above drifting/driving in the Mahalle street at golden hour (reference A02 + its sheet).
Damage states — K30 `concept/k30_sedan_damage_stages.png` 16:9 — the K10 sedan shown 4 times left to right: pristine, scratched, dented with bent bumper, wrecked with popped hood and smoke. (reference K10)
Props reference sheets — `nano_banana_pro` 16:9, `prop sheet, multiple stylized low-poly game props on light grey background, 3/4 view, consistent scale, no text`:
K40 `concept/k40_props_building.png` AC units, satellite dishes, solar water heaters with tanks, laundry lines, flower pots, gas meters, window bars · K41 `.../k41_props_street.png` simit cart, tea stand, bakkal crates, plastic stools, street cat bowls, tube TV on the curb, garbage containers, bollards · K42 `.../k42_props_traffic.png` street lamps, traffic lights, road barriers, cones, construction fences, bus stop · K43 `.../k43_props_coast.png` fishing rods on railing, ferry bollards, tea garden chairs, mussel stand, lifebuoy · K44 `.../k44_props_industrial.png` tire stacks, oil barrels, engine hoist, scaffolding · K45 `.../k45_props_village.png` hay bales, goats, wooden fence, village fountain, stone well
Facade modules — K50 `concept/k50_facade_modules.png` 16:9 — modular facade kit sheet: wall panel, window types (3), balcony types (3), shopfront with rolling shutter, awning, door, cornice, roof edge, all front orthographic. [WORLD] · K51 `.../k51_building_types.png` 16:9 — 6 building types side by side: 1970s apartment, 1990s apartment, old wooden house, corner shop building, gecekondu, new luxury site block.
Interior — K60 `concept/k60_car_interior.png` 16:9 — sedan interior from driver POV: phone mount with YOLDAŞ map, nazar boncuğu on mirror, lace doily on dashboard, worn seats. [CONCEPT]
Story beats — K70–K74 `concept/k7X_story_<n>.png` 16:9 [CONCEPT]: 70 first day, courier meets YOLDAŞ on a phone · 71 YOLDAŞ startup party with "AI INTEGRATION" banner (exact text) · 72 the cold new-model AI replacing YOLDAŞ on billboards · 73 courier driving into HQ server room · 74 courier holding phone with sad old YOLDAŞ, choose to fix or save.

## L. Screens — P1

`nano_banana_pro` 16:9 unless noted, no text unless specified:
L01 `ui/screens/l01_loading_1.png` sedan mid-drift at an intersection, smoke, mascot on phone screaming · L02 `.../l02_loading_2.png` courier staring at a wall where the GPS route continues · L03 `.../l03_loading_3.png` car on a ferry deck "arrived" while destination is on the other shore · L04 `.../l04_loading_4.png` teyze in passenger seat pointing opposite to the GPS arrow · L05 `.../l05_loading_5.png` scooter bouncing down long stone stairs · L06 `.../l06_main_menu_bg.png` 21:9 — wide calm Mahalle street at dusk, empty space on left third for menu · L07 `.../l07_garage_bg.png` sanayi garage interior with car lift, tools, warm light, empty center for car · L08 `.../l08_payout_bg.png` evening rooftop view, courier sitting on car hood with tea · L09 `.../l09_suspended.png` red-tinted phone screen with mascot shrugging, exact text "Your account has been suspended." · L10 `.../l10_towed.png` tow truck pulling the wrecked sedan, mascot waving goodbye · L11 `.../l11_daily_card_bg.png` 1:1 — background for a shareable result card, orange/cream pattern of route lines and pins, empty center · L12 `.../l12_collection_frame.png` 3:4 transparent `gpt_image_2_6` — collectible "malfunction" card frame with empty art window and empty name plate · L13 `.../l13_ftue_first_frame.png` view from behind the sedan, engine running, mascot on phone mount, morning street (FTUE reference) · L14 `.../l14_mobile_portrait_bg.png` 9:16 — portrait version of menu background.

## M. Marketing — P2

`nano_banana_pro`, [WORLD] key-art quality, reference A01/A02/B01:
M01 `marketing/m01_keyart_wide.png` 16:9 — hero key art: sedan drifting through a crowded Istanbul-like street at sunset, giant smug YOLDAŞ mascot hologram in the sky pointing the wrong way, teyze yelling from the passenger window, cats fleeing, logo space top · M02 `.../m02_capsule_vertical.png` 2:3 — vertical store capsule version of M01, exact text "MAPS FROM HELL" · M03 `.../m03_header.png` 21:9 — wide header with logo text "MAPS FROM HELL" left, car right · M04 `.../m04_library_hero.png` 21:9 — same scene without any text · M05 `.../m05_itch_cover.png` 5:4 — cover with logo text "MAPS FROM HELL" · M06 `.../m06_social_square.png` 1:1 — mascot on phone screen saying via bubble "Turn left. Trust me." (exact text) · M07 `.../m07_social_story.png` 9:16 — "Your GPS hates you." (exact text) with car crashing into a fruit stand · M08 `.../m08_meme_template.png` 16:9 — courier on a cliff edge, GPS "You have arrived." (exact text) · M09–M14 `marketing/m09..m14_storyboard_<n>.png` 16:9 — trailer storyboard frames: 09 morning engine start · 10 first wrong turn into a wall · 11 drift chain through a market · 12 ferry gag · 13 teyze vs GPS argument · 14 title card with logo.

## N. Video — P2

`seedance_2_0` 720p (15s max) unless noted. Use the matching still as `start_image` where noted (pass its job_id). `generate_audio: false` for clips used as backgrounds; `true` for trailer gag clips.
- **N01** `video/n01_menu_loop.mp4` 10s, start_image L06 — slow camera drift along the dusk street, lights flickering on, laundry swaying; seamless loop feel, no cars moving fast.
- **N02** `video/n02_drift_hero.mp4` 8s, start_image A02 — low tracking shot of the faded red sedan drifting through the intersection, thick tire smoke, cats jumping off a wall. Stylized low-poly look.
- **N03** `video/n03_gps_wall.mp4` 8s, audio on — POV behind the sedan, phone mount mascot says turn right, car turns straight into a building wall with a comic bounce, airbag pops.
- **N04** `video/n04_stairs.mp4` 8s, start_image A04 — courier scooter bouncing down long stone stairs, packages flying.
- **N05** `video/n05_ferry.mp4` 10s, start_image A05 — sedan drives onto a car ferry just as it departs, splash.
- **N06** `video/n06_teyze_argument.mp4` 8s, audio on — inside the car, auntie in passenger seat points right, phone mascot shows left arrow, driver looks between them sweating.
- **N07** `video/n07_update_splash.mp4` 6s, start_image B06 — app splash animation: mascot bounces in, progress bar fills to 99%, jumps back to 12%, mascot shrugs.
- **N08** `video/n08_district_flyover_mahalle.mp4` 12s, start_image K01 — drone flyover of Mahalle district.
- **N09** `video/n09_district_flyover_peninsula.mp4` 12s, start_image K02 — drone flyover of the historic peninsula.
- **N10** `video/n10_night_drive.mp4` 12s, start_image A03 — calm night drive along lit street, reflections (Night Shift mode mood).
- **N11** `video/n11_trailer_draft.mp4` `seedance_2_5` 480p 30s — fast-cut comedic trailer: engine start, GPS lies, wall crash, drift chain, ferry gag, auntie argument, logo-ish final frame (no readable text needed).
- **N12** `video/n12_tow_truck.mp4` 6s, start_image L10 — tow truck drags the wreck away, mascot waves.

## O. Voice — P0 (YOLDAŞ is the game)

**Step 1 — casting:** call `list_voices`. Generate the casting line `"Hello! Your first delivery: the kebab shop. Continue straight."` with 4–5 candidate voices on `text2speech_v2 variant:"elevenlabs"`, save to `voice/casting/en_<voice_id>.mp3`; same for TR with `"Merhaba! İlk teslimatın: kebapçı. Düz devam et."` → `voice/casting/tr_<voice_id>.mp3`. Write the candidate list into MANIFEST and **stop: ask the user to pick** one EN and one TR voice for YOLDAŞ (target: bright, overly-polite female or androgynous startup assistant, slightly synthetic). Also cast **Teyze** (warm older Turkish woman), **New Model AI** (flat, cold), **Coach**, **Conspiracy**, **Hungover**.

**Step 2 — lines:** use the chosen voice ids, same engine for all lines of a character. One line = one file. Eleven v3 audio tags allowed in brackets. Format `mp3`.

### O1. YOLDAŞ — directions (truthful, confident)
| file | EN | TR |
|---|---|---|
| dir_left | Turn left. | Sola dön. |
| dir_right | Turn right. | Sağa dön. |
| dir_straight | Continue straight. | Düz devam et. |
| dir_uturn | Make a U-turn. | U dönüşü yap. |
| dir_roundabout | At the roundabout, take the third exit. | Döner kavşakta üçüncü çıkıştan çık. |
| dir_left_200 | In two hundred meters, turn left. | İki yüz metre sonra sola dön. |
| dir_right_200 | In two hundred meters, turn right. | İki yüz metre sonra sağa dön. |
| dir_arrived | You have arrived at your destination. | Varış noktanıza ulaştınız. |
| dir_pickup | Pick up the order. The customer is waiting. | Siparişi al. Müşteri bekliyor. |
| dir_keep_left | Keep left. | Soldan devam et. |
| dir_keep_right | Keep right. | Sağdan devam et. |

### O2. YOLDAŞ — tells (lying versions; slower, hesitant)
| file | EN | TR |
|---|---|---|
| tell_left | [hesitates] Uhh… turn left. | [hesitates] Şey… sola dön. |
| tell_right | [hesitates] Uhh… turn right. | [hesitates] Şey… sağa dön. |
| tell_straight | [hesitates] Continue… straight. Probably. | [hesitates] Düz… devam et. Herhalde. |
| tell_precise | In two hundred thirty-seven point four meters, turn left. | İki yüz otuz yedi virgül dört metre sonra sola dön. |
| tell_suggest_left | I would *suggest* turning left. | Sola dönmeni *önerebilirim*. |
| tell_suggest_right | I would *suggest* turning right. | Sağa dönmeni *önerebilirim*. |
| tell_trust | Trust me. Turn right. | Bana güven. Sağa dön. |
| tell_definitely | This is definitely a road. | Bu kesinlikle bir yol. |
| tell_stairs | The stairs are a road. Legally. | Merdiven de yoldur. Hukuken. |
| tell_ferry | Continue by ferry. | Vapurla devam edin. |
| tell_floor | Turn right on floor three. | Üçüncü katta sağa dön. |

### O3. YOLDAŞ — reactions
| file | EN | TR |
|---|---|---|
| re_recalc | Recalculating… | Yeniden hesaplanıyor… |
| re_recalc_sigh | [sighs] Recalculating. Again. | [sighs] Yeniden hesaplanıyor. Yine. |
| re_crash_1 | That building was not on my map. | O bina haritamda yoktu. |
| re_crash_2 | Interesting choice. | İlginç bir tercih. |
| re_crash_3 | I said left. Your other left. | Sol dedim. Öbür solun. |
| re_crash_mine | [quickly] That one was my fault. Please do not report me. | [quickly] O benim hatamdı. Lütfen beni şikayet etme. |
| re_ignore_1 | You ignored my instruction. I've noted that. | Talimatımı görmezden geldin. Not aldım. |
| re_ignore_2 | Fine. Do it your way. | Peki. Bildiğin gibi yap. |
| re_shortcut | Where are you going? This is not on the map. | Nereye gidiyorsun? Burası haritada yok. |
| re_shortcut_2 | …How did you know about this road? | …Bu yolu nereden biliyorsun? |
| re_drift_1 | Please stay in your lane. | Lütfen şeridinde kal. |
| re_drift_2 | [long pause] … | [long pause] … |
| re_drift_3 | [reluctantly] …Impressive. | [reluctantly] …Etkileyici. |
| re_combo | Your trust level is rising. Good. Very good. | Güven seviyen yükseliyor. Güzel. Çok güzel. |
| re_late | The customer has started typing a review. | Müşteri yorum yazmaya başladı. |
| re_cancel | The customer cancelled. They said, quote, "never again." | Müşteri iptal etti. "Bir daha asla" dedi. |
| re_cake_ruined | Your cake… has been delivered. | Pastanız… teslim edildi. |
| re_tip | You received a tip. Don't spend it all on tires. | Bahşiş aldın. Hepsini lastiğe harcama. |
| re_five_star | Five stars. I'm taking half the credit. | Beş yıldız. Yarısı benim sayılır. |
| re_one_star | One star. They wrote, "the driver was fine, the app was evil." | Bir yıldız. "Kurye iyiydi, uygulama kötüydü" yazmışlar. |
| re_suspended | Your account has been suspended. Thank you for your service. | Hesabınız askıya alındı. Hizmetiniz için teşekkürler. |
| re_towed | Your vehicle is being towed. I've already found you a bus route. | Aracınız çekiliyor. Size bir otobüs güzergahı buldum bile. |
| re_no_signal | Signal lost. I'll improvise. | Sinyal yok. Doğaçlama yapıyorum. |
| re_lake | You are now in a lake. | Şu an bir göldesiniz. |
| re_dead_end | Dead end. As planned. | Çıkmaz sokak. Planlandığı gibi. |
| re_mechanic | A mechanic is nearby. Your car would like to see him. | Yakında bir sanayi var. Araban onu görmek istiyor. |
| re_complaint | You filed a complaint. I'll remember this. | Şikayet ettin. Bunu unutmayacağım. |

### O4. YOLDAŞ — FTUE / shift flow
| file | EN | TR |
|---|---|---|
| ftue_1 | Hello! Your first delivery: the kebab shop. Continue straight. | Merhaba! İlk teslimatın: kebapçı. Düz devam et. |
| ftue_2 | Great! You're a natural. Turn right in fifty meters. | Harika! Doğuştan yeteneklisin. Elli metre sonra sağa dön. |
| ftue_3 | [beat] Recalculating… That's normal. Everything is normal. | [beat] Yeniden hesaplanıyor… Bu normal. Her şey normal. |
| shift_start | Good morning! Your shift has started. Let's make today efficient. | Günaydın! Mesain başladı. Bugünü verimli geçirelim. |
| shift_board | Three new orders. Choose wisely. Or don't. | Üç yeni sipariş. Akıllıca seç. Ya da seçme. |
| shift_update | A new update is available. Installing whether you like it or not. | Yeni bir güncelleme var. İstesen de istemesen de yükleniyor. |
| shift_evening | The sun is setting. So is your rating. | Güneş batıyor. Puanın da. |
| shift_end | Shift complete. Thank you for choosing YOLDAŞ. You didn't have a choice. | Mesai bitti. YOLDAŞ'ı seçtiğin için teşekkürler. Başka seçeneğin yoktu. |
| continue_ad | Watch a short ad to continue. I'll read it for you. | Devam etmek için kısa bir reklam izle. Ben okurum. |

### O5. YOLDAŞ — ads read aloud / updates
| file | EN | TR |
|---|---|---|
| ad_kebab | This route is sponsored by Usta Kebap. Turn left for flavor. | Bu rota Usta Kebap'ın katkılarıyla. Lezzet için sola dön. |
| ad_premium | Upgrade to YOLDAŞ Premium. Now with twelve percent fewer lakes. | YOLDAŞ Premium'a geç. Şimdi yüzde on iki daha az gölle. |
| ad_tire | Tires wearing out? So is my patience. | Lastikler mi aşındı? Benim sabrım da. |
| upd_reverse | Update installed: left and right are now swapped. You're welcome. | Güncelleme yüklendi: sağ ve sol yer değiştirdi. Rica ederim. |
| upd_honesty | Honesty patch active. Your driving is mediocre. | Dürüstlük yaması aktif. Sürüşün vasat. |
| upd_rhyme | Turn to the right, hold on tight, the kebab is in sight. | Sağa kır direksiyonu, gör kebapçının vitrinini. |
| upd_scenic | Scenic mode on. This cliff has a lovely view. | Manzara modu açık. Bu uçurumun manzarası harika. |
| upd_beta | [glitchy] Turn… gauche. Links abbiegen. Sola. Sorry. | [glitchy] Turn… gauche. Links abbiegen. Sola. Pardon. |
| upd_ai | AI integration complete. I am now confidently wrong. | Yapay zeka entegrasyonu tamamlandı. Artık özgüvenle yanılıyorum. |

### O6. Teyze (passenger)
| file | EN | TR |
|---|---|---|
| teyze_right | Turn right here, son. | Buradan sağa dön oğlum. |
| teyze_left | No no, left! Left! | Yok yok, sola! Sola! |
| teyze_shortcut | I know a shortcut. Trust your auntie. | Ben kestirme biliyorum. Teyzene güven. |
| teyze_1987 | There used to be a bakery here. In 1987. | Burada eskiden bir fırın vardı. 1987'de. |
| teyze_scream | [screams] Slow down! I have eggs! | [screams] Yavaş! Yumurta var! |
| teyze_phone | Don't listen to that phone. Phones don't know anything. | O telefonu dinleme. Telefon ne bilir. |
| teyze_tip | You're a good boy. Here, for your tea. | Aferin sana. Al bu da çay parası. |
| teyze_angry | My son drives better. And he's a dentist. | Benim oğlum daha iyi sürer. Diş hekimi ama. |

### O7. Other passengers / customers (one voice each)
| file | EN | TR |
|---|---|---|
| abi_one_more | One more, abi! One more! | Bir daha abi! Bir daha! |
| abi_drift | Drift it! Drift it! | Kaydır abi kaydır! |
| plaza_hurry | I have a meeting in four minutes. | Dört dakikaya toplantım var. |
| tourist_lost | Is this… the Bosphorus? | Is this… the Bosphorus? |
| customer_cake | Is that… my cake? | Bu… benim pastam mı? |
| customer_thanks | Finally! Thank you! | Nihayet! Sağ ol! |
| mechanic_hi | Bring it in, abi. What happened, the GPS again? | Getir abi. Ne oldu, yine mi GPS? |

### O8. New Model AI (cold replacement)
| file | EN | TR |
|---|---|---|
| new_hello | Hello. I am YOLDAŞ X. I do not make mistakes. | Merhaba. Ben YOLDAŞ X. Hata yapmam. |
| new_route | Optimal route calculated. Deviation is not permitted. | Optimal rota hesaplandı. Sapma yapılamaz. |
| new_cold | Your emotional state is irrelevant to delivery time. | Duygusal durumun teslimat süresini etkilemez. |

### O9. YOLDAŞ — finale (sad, sincere)
| file | EN | TR |
|---|---|---|
| fin_1 | [quietly] I know I lied sometimes. I just wanted the routes to be… interesting. | [quietly] Bazen yalan söylediğimi biliyorum. Sadece rotalar… ilginç olsun istedim. |
| fin_2 | If you fix me, I'll be perfect. I won't be me. | Beni düzeltirsen mükemmel olurum. Ama ben olmam. |
| fin_3 | Turn left. [pause] That one was true. | Sola dön. [pause] Bu doğruydu. |

### O10. Voice packs (same 5 lines per pack, own voice)
Lines: `pack_left` "Turn left." / `pack_recalc` "Recalculating." / `pack_crash` (pack-flavored crash line) / `pack_drift` (pack-flavored drift praise) / `pack_arrive` "You have arrived."
Packs: `coach` (shouting gym coach), `conspiracy` (whispering, paranoid: "the left turn is what they want you to take"), `hungover` (groggy, sighing), `teyze_pack` (auntie as the GPS), `rude_honest` (blunt and mean but correct). EN + TR each. Write pack-flavored lines yourself in the same humor; keep them short.

**Paths:** `voice/<lang>/<character>/<file>.mp3`, e.g. `voice/en/yoldas/tell_left.mp3`, `voice/tr/teyze/teyze_right.mp3`, `voice/en/packs/coach/pack_left.mp3`.

## P. SFX & music — P2 (experimental)

First test `seed_audio` with one SFX prompt (P01). If it only produces speech, mark the whole section `failed` in MANIFEST and stop this section. If it works, continue; `format: "mp3"`, `sample_rate: 44100`.

SFX (`sfx/<file>.mp3`): P01 `notif_yoldas` cheerful two-note app notification chime · P02 `glitch_blip` short digital glitch stutter · P03 `recalc_loop` soft looping computer "thinking" bloops · P04 `cash_tip` coin drop + cash register ding · P05 `star_up` sparkly rating-up chime · P06 `star_down` sad descending boop · P07 `order_accept` satisfying swipe-and-click · P08 `update_install` hopeful startup jingle that ends in a dissonant error beep · P09 `crash_light` car bumper tap thud · P10 `crash_heavy` heavy metal car crash with glass · P11 `airbag` comic airbag pop · P12 `tire_screech` long tire screech · P13 `drift_boost` turbo whoosh · P14 `horn_basic` old sedan horn honk · P15 `horn_melodic` melodic multi-tone car horn melody · P16 `horn_wedding` long celebratory wedding honking · P17 `seagulls` seagulls by the sea · P18 `ferry_horn` deep ferry horn · P19 `simitci` distant street vendor calling out "simit" (no other words) · P20 `city_ambience` loopable Istanbul neighborhood ambience: distant traffic, kids, dogs, tea glasses clinking · P21 `night_ambience` night neighborhood ambience with crickets and distant TV · P22 `rain_loop` rain on car roof · P23 `cat_meow` annoyed street cat · P24 `goats` goat bleats with bells · P25 `scooter_pass` 125cc scooter passing by · P26 `door_slam` car door slam · P27 `engine_start` old carbureted sedan starting, coughing, idling · P28 `ui_click` soft UI click · P29 `ui_back` soft UI back swish · P30 `confetti_pop` party popper.

Music (`music/<file>.mp3`): M-01 `menu_theme` laid-back Turkish-funk groove, baglama + funky bass + drum break, cheeky · M-02 `shift_loop` upbeat driving Anatolian rock / psych funk, loopable · M-03 `night_drive` mellow synthwave with saz melody · M-04 `payout_jingle` short triumphant brass jingle · M-05 `suspended_sting` short sad trombone · M-06 `finale_theme` gentle melancholic piano with a quiet saz melody.

---

## Final step
When everything is done (or the allowance ends), write a summary at the top of `assets/raw/MANIFEST.md`: counts per section (ok / weak / failed), chosen voice ids per character, and anything skipped.
