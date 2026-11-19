# Asset Manifest

| ID | path | model | job_id | status | note |
|---|---|---|---|---|---|
| A01 | assets/raw/lookdev/a01_mahalle_day.png | nano_banana_pro (job reports nano_banana_2) | d7326016-d945-4ae8-a78b-784c86614c69 | ok | 2752x1536; model id reported differs from requested |
| A02 | assets/raw/lookdev/a02_mahalle_sunset.png | nano_banana_pro (job reports nano_banana_2) | 9db25dbf-caf9-427f-867e-40c5007a72ae | ok | ref A01; checked ok |
| A03 | assets/raw/lookdev/a03_mahalle_night.png | nano_banana_pro (job reports nano_banana_2) | b4e8a4c6-2185-48f2-b935-a01d90d3cd31 | ok | ref A01; checked ok |
| A04 | assets/raw/lookdev/a04_peninsula_day.png | nano_banana_pro (job reports nano_banana_2) | 333ebdd9-c6f4-45f0-88fb-e8337defa0af | ok | ref A01; checked ok |
| A05 | assets/raw/lookdev/a05_bosphorus_fog.png | nano_banana_pro (job reports nano_banana_2) | a5fc43b9-4cef-484a-9c79-fe31e0e3969a | ok | ref A01; checked ok |
| A06 | assets/raw/lookdev/a06_color_script.png | nano_banana_pro (job reports nano_banana_2) | 52b184a7-c68f-425b-9cfc-0f516c7ab400 | ok | ref A01; checked ok |
| B01 | assets/raw/brand/b01_logo_maps_from_hell.png | nano_banana_pro (job reports nano_banana_2) | e6a31370-14eb-452d-a1e7-476df49e7b4c | ok | text exact; pin replaces the O in FROM; checked ok |
| B02 | assets/raw/brand/b02_logo_maps_from_hell_transparent.png | gpt_image_2_6 (quality medium) | e5416fd8-83c4-4b00-a1ca-6e85e65813ed | failed | background NOT transparent (opaque black/cream glow baked in); do not use |
| B02 | assets/raw/brand/b02_logo_maps_from_hell_transparent_v2.png | gpt_image_2_6 (quality medium) | fe5e0320-24b7-4a9d-bae6-6d42bc925b56 | ok | USE THIS: true alpha, sticker outline, text exact; regenerated once per rule 4 |
| B03 | assets/raw/brand/b03_yoldas_app_icon.png | gpt_image_2_6 (quality medium) | 7379e630-1727-4284-9b1d-7e772bc37027 | ok | smug pin on cream rounded square with road/hills scene; face sits in a cream circle; RGB (black corners, no alpha); used as mascot reference |
| B04 | assets/raw/brand/b04_yoldas_wordmark.png | gpt_image_2_6 (quality medium) | d7578535-8b29-499d-bd0d-74602dc5e30b | ok | text exact incl. Ş; true alpha; checked ok |
| B05 | assets/raw/brand/b05_yoldas_icon_glitch.png | gpt_image_2_6 (quality medium) | d79bed3d-11cc-4f8f-95ef-5dffa62d8757 | ok | ref B03; RGB split + slice offsets + twitching eye; checked ok |
| B06 | assets/raw/brand/b06_yoldas_splash.png | nano_banana_pro (job reports nano_banana_2) | 5cab9f57-3d29-434a-9ef2-065c879bc61a | ok | ref B03; texts exact (YOLDAŞ / Your route. Our idea.); 1536x2752 |
| B07 | assets/raw/brand/b07_favicon.svg | gpt_image_2_6 (svg, quality medium) | a44e1a90-7fbe-4a2a-b796-59edb74ef089 | ok | single path, evenodd cutouts, 553 bytes; rendered check ok |
| B08 | assets/raw/brand/b08_logo_tr_option_a.png | nano_banana_pro (job reports nano_banana_2) | 3ce801b2-617e-452e-a179-ba289511fd29 | failed | pin replaced the A, reads "H?RİTASI"; regenerating once (v2) with explicit instruction |
| B08 | assets/raw/brand/b08_logo_tr_option_a_v2.png | nano_banana_pro (job reports nano_banana_2) | d1d8344e-b52b-4bba-8be9-a33973e0a516 | ok | USE THIS: text exact "CEHENNEM HARİTASI"; pin as side accent; prompt adjusted vs pack (no letter replacement) |
| B09 | assets/raw/brand/b09_yoldas_premium_badge.png | gpt_image_2_6 (quality medium) | 3f36095d-707e-437f-a09d-0dce6ff20a13 | ok | text exact "PREMIUM"; crowned mascot; true alpha; checked ok |
| C01 | assets/raw/yoldas/c01_neutral.png | gpt_image_2_6 (quality medium) | e3e0fc2f-7613-4525-b842-de790e106c96 | failed | carried over road/hills scene from B03 ref; brows still smug; regenerating once as c01_neutral_v2 |
| C01 | assets/raw/yoldas/c01_neutral_v2.png | gpt_image_2_6 (quality medium) | 729cdec1-6c85-4a84-a35d-ca40d271689e | ok | USE THIS: isolated pin, true alpha, level brows. Template for C02-C15: reference = this job (not B03, which leaks its road scene) |
| C02 | assets/raw/yoldas/c02_confused.png | gpt_image_2_6 (quality medium) | 4914d7fc-b21c-48f7-8e69-6354273db0f0 | ok | ref C01v2; question marks + tilt + worried brows; eyes not strictly crossed (weak on that detail) |
| C03 | assets/raw/yoldas/c03_annoyed.png | gpt_image_2_6 (quality medium) | 60c068a0-0b2b-426d-b6e1-70a2d2e55c9c | ok | ref C01v2; checked ok |
| C04 | assets/raw/yoldas/c04_sarcastic.png | gpt_image_2_6 (quality medium) | 3be74e9d-d90e-4d08-bb40-0eda906ad52b | ok | ref C01v2; checked ok |
| C05 | assets/raw/yoldas/c05_passive_aggressive.png | gpt_image_2_6 (quality medium) | 4a71d476-4755-49fe-9643-acdf7d4eb9a6 | ok | ref C01v2; checked ok |
| C06 | assets/raw/yoldas/c06_helpful.png | gpt_image_2_6 (quality medium) | 6d7952d3-bcfe-49d5-95c8-7eedd8de2458 | weak | sparkle eyes + thumbs-up OK, but brows read determined and mouth is a flat line (not a smile); usable |
| C07 | assets/raw/yoldas/c07_deceptive.png | gpt_image_2_6 (quality medium) | 1370ec9a-c4d9-4c19-8698-c482052bf33e | ok | ref C01v2; darting eyes, sweat drop, whistle; checked ok |
| C08 | assets/raw/yoldas/c08_impressed.png | gpt_image_2_6 (quality medium) | 3cef884e-0ddd-4c93-9c1a-8c7672e4030b | ok | ref C01v2; lifted brows, "…" bubble (dots only); checked ok |
| C09 | assets/raw/yoldas/c09_recalculating.png | gpt_image_2_6 (quality medium) | 29d2c1a6-dee4-4ad9-a72c-2e4c8e2ba5e9 | ok | ref C01v2; spiral eyes + loading ring; checked ok |
| C10 | assets/raw/yoldas/c10_offended.png | gpt_image_2_6 (quality medium) | 05ecacc3-5de1-4008-b0c0-f07f7cbc72d8 | ok | ref C01v2; closed eyes, crossed arms, head turned; checked ok |
| C11 | assets/raw/yoldas/c11_panic.png | gpt_image_2_6 (quality medium) | 49f4adae-5230-4c8a-a55e-7ac7567eecc3 | ok | ref C01v2; screaming + siren light; slightly more shaded than the others; checked ok |
| C12 | assets/raw/yoldas/c12_no_signal.png | gpt_image_2_6 (quality medium) | 9d0bbf28-a3d0-4406-9798-0c9ec9f5e66e | ok | ref C01v2; greyed pin, blank eyes, crossed-out signal bars; checked ok |
| C13 | assets/raw/yoldas/c13_sleeping.png | gpt_image_2_6 (quality medium) | cbe84b89-baa0-4e4e-b532-ebf577eede2a | ok | ref C01v2; closed eyes + zzz; checked ok |
| C14 | assets/raw/yoldas/c14_new_model.png | gpt_image_2_6 (quality medium) | 4ff375ff-3862-41de-93ed-6bc4c11dda4e | ok | ref C01v2; chrome pin, cyan slit eyes, no brows; checked ok |
| C15 | assets/raw/yoldas/c15_sad.png | gpt_image_2_6 (quality medium) | 6f1b3c9e-8392-45ff-b87f-14ef2b35e988 | ok | ref C01v2; tear, drooping, downturned mouth; checked ok |
| C20 | assets/raw/yoldas/c20_idle_blink.gif | gpt_image_2_6 (gif, quality medium) | 577a5957-de03-43fc-9f21-96a9db292199 | ok | 288x288, 12 frames @100ms, loops; bob + blink; transparent bg; ref C01v2 |
| C21 | assets/raw/yoldas/c21_glitch.gif | gpt_image_2_6 (gif, quality medium) | ea0efb43-8afc-424e-bd54-08b5b0ced4b7 | ok | 288x288, 10 frames @80ms, loops; RGB split + slices + wink, snaps back calm; checked ok |
| C22 | assets/raw/yoldas/c22_recalculating.gif | gpt_image_2_6 (gif, quality medium) | 79340e10-253c-4f16-ac77-c3e64a89053e | ok | 288x288, 12 frames @80ms, loops; ring with orange highlight segment rotating around pin; spiral eyes but mouth is a smile (less dizzy than C09) |
| C23 | assets/raw/yoldas/c23_talking.gif | gpt_image_2_6 (gif, quality medium) | cbde88d4-18e0-4684-b12b-77dc3f036429 | ok | 288x288, 8 frames @90ms, loops; mouth opens frames 2-4 then closes, bounce; checked ok |
| C24 | assets/raw/yoldas/c24_update_installing.gif | gpt_image_2_6 (gif, quality medium) | 3e0d84c8-6be5-4e92-9662-b8eb4f159d8b | ok | 288x288, 16 frames @120ms, loops; green bar fills to ~full with proud smile, drops to ~12%, deadpan; no text; checked ok |
| D01 | assets/raw/ui/icons/d01_turn_left_v1_face.svg | gpt_image_2_6 (svg) | 3010ad27-b722-40b6-b2a6-530c01e63e75 | failed | arrow got a smug face + bandana (the [UI] "smug tone" read literally); regenerating once with "no face/characters" in the icon template |
| D01 | assets/raw/ui/icons/d01_turn_left.svg | gpt_image_2_6 (svg) | 4cdaa8cc-de0b-4cc2-b896-cb425cfad7ad | ok | USE THIS (v2); 725 bytes; plain arrow, rendered check ok. ICON TEMPLATE for all D: "plain abstract UI glyph only: no face, no eyes, no character, no accessories, no decoration" |
| D01 | assets/raw/ui/icons/d01_turn_left.png | gpt_image_2_6 (quality medium, 1k) | 040375ea-8d06-46b8-9d77-9698c544b17d | ok | 1024x1024 transparent; matches SVG; checked ok |
| D02 | assets/raw/ui/icons/d02_turn_right.svg | gpt_image_2_6 (svg) | 64227c2c-2d89-4c13-986f-455963315d19 | ok | 695 bytes; checked ok |
| D02 | assets/raw/ui/icons/d02_turn_right.png | gpt_image_2_6 (quality medium, 1k) | 8faafa7b-0428-47f2-8fe3-4e5b70bb5649 | ok | 1024x1024 transparent; checked ok |
| D03 | assets/raw/ui/icons/d03_straight.svg | gpt_image_2_6 (svg) | 34eead89-8d2e-4e51-806b-a5442906019a | ok | 642 bytes; checked ok |
| D03 | assets/raw/ui/icons/d03_straight.png | gpt_image_2_6 (quality medium, 1k) | 4b9bfbee-dec9-4727-bd69-1f5913923f3c | ok | 1024x1024 transparent; checked ok |
| D04 | assets/raw/ui/icons/d04_uturn.svg | gpt_image_2_6 (svg) | 622e276c-6da0-4062-b5b3-e6bcbf48d0df | ok | clean |
| D04 | assets/raw/ui/icons/d04_uturn.png | gpt_image_2_6 | 723df17a-2c5c-497e-811c-68ce7970b21d | ok | transparent |
| D05 | assets/raw/ui/icons/d05_roundabout.svg | gpt_image_2_6 (svg) | 2cc72436-a9f4-451d-bd60-eeb8be1e078e | ok | roundabout with exit arrow |
| D05 | assets/raw/ui/icons/d05_roundabout.png | gpt_image_2_6 | 6ea2ad6b-c491-4322-a585-a3ea695d069e | ok | transparent |
| D06 | assets/raw/ui/icons/d06_stairs_route.svg | gpt_image_2_6 (svg) | 78605cdd-1cfb-4ffc-8ecc-02423e192768 | ok | clean |
| D06 | assets/raw/ui/icons/d06_stairs_route.png | gpt_image_2_6 | 63d22651-d7a9-4348-a9db-f151932b6103 | ok | transparent |
| D07 | assets/raw/ui/icons/d07_ferry_route.svg | gpt_image_2_6 (svg) | 1b0eba8f-adf9-4890-8185-c6794568e5a9 | ok | car ferry on waves, down arrow |
| D07 | assets/raw/ui/icons/d07_ferry_route.png | gpt_image_2_6 | 81a8615a-b1f8-4846-bc4d-9855cbea4295 | ok | transparent |
| D08 | assets/raw/ui/icons/d08_floor_route.svg | gpt_image_2_6 (svg) | 5af66cdf-aaaa-42c8-8d9d-b2eda210611f | ok | car park, arrow up, digit 3 on floor |
| D08 | assets/raw/ui/icons/d08_floor_route.png | gpt_image_2_6 | 41a28c35-dabb-45cf-9327-24bff584159d | ok | transparent, digit 3 correct |
| D09 | assets/raw/ui/icons/d09_fragile.svg | gpt_image_2_6 (svg) | 536fd5f0-d428-4f6b-90a2-366ae9cdfd53 | ok | cracked egg |
| D09 | assets/raw/ui/icons/d09_fragile.png | gpt_image_2_6 | 822397a3-8ed1-429f-ba23-ce330d09e7e8 | ok | transparent |
| D10 | assets/raw/ui/icons/d10_urgent.svg | gpt_image_2_6 (svg) | 526a0108-fc25-439e-9705-1b657eea426f | ok | melting ice cream + stopwatch; cone slightly muddled |
| D10 | assets/raw/ui/icons/d10_urgent.png | gpt_image_2_6 | 099631b7-2614-4ae7-b6a5-6cb83bee8d50 | ok | transparent |
| D11 | assets/raw/ui/icons/d11_heavy.svg | gpt_image_2_6 (svg) | ac4b295a-0845-4c14-a1b7-1944db3a4e69 | ok | kettlebell |
| D11 | assets/raw/ui/icons/d11_heavy.png | gpt_image_2_6 | 5d539379-7a7c-49c9-8379-691d31496621 | ok | transparent |
| D12 | assets/raw/ui/icons/d12_passenger.svg | gpt_image_2_6 (svg) | e6c767fb-c7d9-4b03-ae58-64edd44d0b8e | ok | faceless seated passenger + empty bubble |
| D12 | assets/raw/ui/icons/d12_passenger.png | gpt_image_2_6 | 2858535d-8182-4859-a6a5-78822720a235 | ok | transparent |
| D13 | assets/raw/ui/icons/d13_star.svg | gpt_image_2_6 (svg) | c4c2b562-84d3-4e97-b8dd-b5df72e0e4ba | failed | shading shape spills outside star (bad clipPath); do not use |
| D13 | assets/raw/ui/icons/d13_star_v2.svg | gpt_image_2_6 (svg) | 813bc3e8-8f59-420f-b718-d98cb3f5f7b2 | ok | regenerated once, clean; use this |
| D13 | assets/raw/ui/icons/d13_star.png | gpt_image_2_6 | 25ddcc50-5bbb-42d7-843b-7bcffe5679f6 | ok | transparent |
| D14 | assets/raw/ui/icons/d14_star_half.svg | gpt_image_2_6 (svg) | 3a1903e0-d582-47d1-a369-d3ca03a32f06 | weak | right half filled instead of left (mirrored) |
| D14 | assets/raw/ui/icons/d14_star_half_v2.svg | gpt_image_2_6 (svg) | 1ce268a1-72b1-4e1f-8b16-59159ca5fe78 | weak | retry also right-filled; clean otherwise, cream outline. Use scaleX(-1) in engine or prefer the PNG |
| D14 | assets/raw/ui/icons/d14_star_half.png | gpt_image_2_6 | addf1c6a-3264-4bad-a80e-4299a987dec9 | ok | left half filled, empty half transparent; use this |
| D15 | assets/raw/ui/icons/d15_tip_coin.svg | gpt_image_2_6 (svg) | a4f0327d-872f-4851-91b5-16c281fc675b | ok | winged coin |
| D15 | assets/raw/ui/icons/d15_tip_coin.png | gpt_image_2_6 | 984538de-3cfe-49e3-b987-7f7472f354b4 | ok | transparent |
| D16 | assets/raw/ui/icons/d16_cash.svg | gpt_image_2_6 (svg) | 30f08a3a-a51a-4d32-b022-1fda41ada4e1 | ok | banknote stack, no symbols |
| D16 | assets/raw/ui/icons/d16_cash.png | gpt_image_2_6 | 0b03839e-94ad-4a97-9461-b4baa4e91584 | ok | transparent |
| D17 | assets/raw/ui/icons/d17_multiplier.svg | gpt_image_2_6 (svg) | 9514c0f3-bfe4-438e-94cc-8f7ef89dcd2b | ok | flame shield badge |
| D17 | assets/raw/ui/icons/d17_multiplier.png | gpt_image_2_6 | 5943ab9b-1c1b-4fbb-889a-463f202904df | ok | transparent |
| D18 | assets/raw/ui/icons/d18_drift.svg | gpt_image_2_6 (svg) | 8e494225-2ffa-42b2-a929-56d762e9b4a3 | ok | generic car drifting with smoke |
| D18 | assets/raw/ui/icons/d18_drift.png | gpt_image_2_6 | 400e9a4e-09e7-4db3-8ccc-d55e75c44046 | ok | transparent |
| D19 | assets/raw/ui/icons/d19_boost.svg | gpt_image_2_6 (svg) | c89d7e64-717a-4b77-9129-48c510c7083c | ok | bolt + speed lines |
| D19 | assets/raw/ui/icons/d19_boost.png | gpt_image_2_6 | 115a670d-f91f-49eb-8048-a37b22341ab7 | ok | transparent |
| D20 | assets/raw/ui/icons/d20_vehicle_health.svg | gpt_image_2_6 (svg) | 37f50e8d-a2a6-4611-8029-cfa437f9e3ef | ok | wrench over generic car |
| D20 | assets/raw/ui/icons/d20_vehicle_health.png | gpt_image_2_6 | 0254a592-e44e-4dfa-ad9c-6c7a7af3d941 | ok | transparent |
| D21 | assets/raw/ui/icons/d21_map_accuracy.svg | gpt_image_2_6 (svg) | d921801c-fdd5-438c-9b7e-4f7c4fc04ab1 | ok | folded map + gauge with check |
| D21 | assets/raw/ui/icons/d21_map_accuracy.png | gpt_image_2_6 | 252e4b0b-5312-4e14-b162-16d6a9ce1d08 | ok | transparent |
| D22 | assets/raw/ui/icons/d22_report_road.svg | gpt_image_2_6 (svg) | 0c13a2b9-8e1d-4bd8-8ddb-d6e0be159c86 | ok | flag on cracked road (road less legible in svg) |
| D22 | assets/raw/ui/icons/d22_report_road.png | gpt_image_2_6 | 9516693e-afbc-4077-8a8a-2868510d721c | ok | transparent |
| D23 | assets/raw/ui/icons/d23_mechanic.svg | gpt_image_2_6 (svg) | d4012ddb-9469-4652-9da6-6a1ed1356a9f | ok | wrench + gear |
| D23 | assets/raw/ui/icons/d23_mechanic.png | gpt_image_2_6 | 05a76646-2e8d-49c0-a66b-9c83cef2e922 | ok | transparent |
| D24 | assets/raw/ui/icons/d24_watch_ad.svg | gpt_image_2_6 (svg) | c8a16469-c192-4fb9-883d-ab21eabf9876 | ok | retro TV + play |
| D24 | assets/raw/ui/icons/d24_watch_ad.png | gpt_image_2_6 | 9fa34ea3-1cc7-4e59-88a6-bf9b1d4a6ece | ok | transparent |
| D25 | assets/raw/ui/icons/d25_continue.svg | gpt_image_2_6 (svg) | aaa320ef-6470-40a2-9fa7-65a2d55ead2d | ok | heart + circular arrow |
| D25 | assets/raw/ui/icons/d25_continue.png | gpt_image_2_6 | 351241f6-3293-4d41-b69c-c21021ba1411 | ok | transparent |
| D26 | assets/raw/ui/icons/d26_pause.svg | gpt_image_2_6 (svg) | 99afd283-4b03-4f60-9114-d6dbd0b7ceb2 | ok | pause in rounded square |
| D26 | assets/raw/ui/icons/d26_pause.png | gpt_image_2_6 | 088ff593-fe99-41bc-a60c-db2d6d31171d | ok | transparent |
| D27 | assets/raw/ui/icons/d27_settings.svg | gpt_image_2_6 (svg) | fcc228bc-e6d6-4f4a-a9a8-365ab134ff1f | failed | stray shading rect spills outside gear (bad clipPath); do not use |
| D27 | assets/raw/ui/icons/d27_settings_v2.svg | gpt_image_2_6 (svg) | d991322f-6b85-423a-888e-c740efd20f54 | ok | regenerated once, clean; thinner outline with cream rim, slightly off-style vs PNG; use this |
| D27 | assets/raw/ui/icons/d27_settings.png | gpt_image_2_6 | 1b776363-dc00-4804-b95a-5caac3521585 | ok | transparent |
| D28 | assets/raw/ui/icons/d28_sound_on.svg | gpt_image_2_6 (svg) | 7cc00a64-33f1-4e13-b37e-0a42895f0536 | ok | speaker + waves |
| D28 | assets/raw/ui/icons/d28_sound_on.png | gpt_image_2_6 | ee1e2d2f-9e25-4e99-ab88-90b81fb20ac7 | ok | transparent |
| D29 | assets/raw/ui/icons/d29_sound_off.svg | gpt_image_2_6 (svg) | b3d1881a-25bc-4517-89ad-e49c84d56b5a | ok | speaker + slash |
| D29 | assets/raw/ui/icons/d29_sound_off.png | gpt_image_2_6 | 7b9fa6b0-db2b-4536-9fe8-f4f0df585d2d | ok | transparent |
| D30 | assets/raw/ui/icons/d30_leaderboard.svg | gpt_image_2_6 (svg) | 1d012c5f-4b9c-49fc-bfcf-4cbee1a2d398 | ok | podium + trophy |
| D30 | assets/raw/ui/icons/d30_leaderboard.png | gpt_image_2_6 | f2b66378-e0e6-40f9-b57d-a6372846d64a | ok | transparent |
| D31 | assets/raw/ui/icons/d31_ghost_car.svg | gpt_image_2_6 (svg) | 7f4297eb-9ce6-4d4a-ad50-4570addbf135 | ok | dashed ghost car with replay arrow; opaque fill, no wheels-through |
| D31 | assets/raw/ui/icons/d31_ghost_car.png | gpt_image_2_6 | 6d4a033a-24cc-4f68-836b-842a640f5270 | ok | genuinely semi-transparent (looks pink over magenta preview); replay arrow |
| D32 | assets/raw/ui/icons/d32_daily_route.svg | gpt_image_2_6 (svg) | 8f66b919-f4d9-460a-88d2-c74a38337b97 | ok | calendar + route line |
| D32 | assets/raw/ui/icons/d32_daily_route.png | gpt_image_2_6 | 3716eb15-9d1c-4d6a-a241-5f03a5aaffd0 | ok | transparent |
| D33 | assets/raw/ui/icons/d33_complaint.svg | gpt_image_2_6 (svg) | d29b34ee-a1f3-4332-8ead-484af1f24c51 | ok | spiky burst bubble + scribble + pen |
| D33 | assets/raw/ui/icons/d33_complaint.png | gpt_image_2_6 | 1c9d18be-537c-4c1e-9394-636ebc4b85cd | ok | transparent |
| D34 | assets/raw/ui/icons/d34_malfunction.svg | gpt_image_2_6 (svg) | 26c26dbb-da99-4e13-8883-31594d6c4bf9 | ok | cracked pin + sparks |
| D34 | assets/raw/ui/icons/d34_malfunction.png | gpt_image_2_6 | 944be5ab-963a-459e-ae27-a0578b644f3a | ok | transparent |
| D35 | assets/raw/ui/icons/d35_shortcut.svg | gpt_image_2_6 (svg) | f541eefe-7455-486c-b2e0-5fc4dcfeefe3 | ok | two buildings + dotted path |
| D35 | assets/raw/ui/icons/d35_shortcut.png | gpt_image_2_6 | 9770c6f0-7c0b-43a5-ae2c-cb8f728f0f23 | ok | transparent |
| D36 | assets/raw/ui/icons/d36_timer.svg | gpt_image_2_6 (svg) | acef4152-1ca4-4ae4-a7e4-af02d71506e0 | ok | stopwatch |
| D36 | assets/raw/ui/icons/d36_timer.png | gpt_image_2_6 | 63508bde-e08b-4713-a271-261121bf2533 | ok | transparent |
| D37 | assets/raw/ui/icons/d37_destination.svg | gpt_image_2_6 (svg) | 66ad392e-df06-46b8-b358-9076bd82ae12 | ok | checkered flag on pin |
| D37 | assets/raw/ui/icons/d37_destination.png | gpt_image_2_6 | 238b64e5-4f8e-4e91-a119-7e8728036ae2 | ok | transparent |
| D38 | assets/raw/ui/icons/d38_pickup.svg | gpt_image_2_6 (svg) | f92db890-48f7-430d-bb21-d80785aa859e | ok | hand + box, clean |
| D38 | assets/raw/ui/icons/d38_pickup.png | gpt_image_2_6 | a2a4ed23-1417-48fb-b00f-83a4e8def6ce | ok | transparent |
| D39 | assets/raw/ui/icons/d39_wrecked.svg | gpt_image_2_6 (svg) | 2691f1ed-1ddc-4138-9249-5a0f109b0ec5 | ok | wrecked car, smoke, tow rope |
| D39 | assets/raw/ui/icons/d39_wrecked.png | gpt_image_2_6 | 6204039f-8a06-4122-9771-22ef0b48373b | ok | transparent |
| D40 | assets/raw/ui/icons/d40_suspended.svg | gpt_image_2_6 (svg) | e1a1f0fa-8968-48a1-8d73-3a171118d84e | ok | ID badge + red X |
| D40 | assets/raw/ui/icons/d40_suspended.png | gpt_image_2_6 | 3630d3ad-87d5-4d25-97a1-17f2414ffec1 | ok | transparent |
| D41 | assets/raw/ui/icons/d41_gamepad.svg | gpt_image_2_6 (svg) | 874949c4-ac92-43e9-ac21-fcb72c93d273 | ok | gamepad, clean |
| D41 | assets/raw/ui/icons/d41_gamepad.png | gpt_image_2_6 | 1378cae0-6226-43e4-a43c-34f89b4eed64 | ok | transparent |
| D42 | assets/raw/ui/icons/d42_wasd.svg | gpt_image_2_6 (svg) | ebb3bed0-ed89-48a8-8daa-264dfacedfe3 | ok | W A S D letters correct |
| D42 | assets/raw/ui/icons/d42_wasd.png | gpt_image_2_6 | 1c7b2e63-03f7-4b5f-abae-4fd645f34c1d | ok | transparent |
| D43 | assets/raw/ui/icons/d43_garage.svg | gpt_image_2_6 (svg) | 3b78b5bf-ce0e-4e15-a2ba-cdd717ac0d9a | ok | garage, clean |
| D43 | assets/raw/ui/icons/d43_garage.png | gpt_image_2_6 | 3d8dc4a3-b9bf-4103-b37d-32f8170cf219 | ok | transparent |
| D44 | assets/raw/ui/icons/d44_horn.svg | gpt_image_2_6 (svg) | 90f083c0-6129-4eb1-babb-e9e08bd77c79 | ok | horn, clean |
| D44 | assets/raw/ui/icons/d44_horn.png | gpt_image_2_6 | bbb14efe-5664-43a4-87d1-946764345b06 | ok | transparent |
| D45 | assets/raw/ui/icons/d45_language.svg | gpt_image_2_6 (svg) | 4e3cd6e3-eb50-459c-ad1d-7b307d2de97d | ok | globe + empty bubble, clean |
| D45 | assets/raw/ui/icons/d45_language.png | gpt_image_2_6 | d7985e78-fa37-4309-a835-70c55601526d | ok | transparent |
| D46 | assets/raw/ui/icons/d46_clip.svg | gpt_image_2_6 (svg) | bd7846a6-4df6-4e2b-a9c4-c89087eb0463 | ok | camera + red rec dot, clean |
| D46 | assets/raw/ui/icons/d46_clip.png | gpt_image_2_6 | cf3deaa6-18ae-4636-95de-71778bf637cb | ok | transparent |
| D47 | assets/raw/ui/icons/d47_share.svg | gpt_image_2_6 (svg) | 026ef40a-24a3-4a0a-b57f-1c28d76a32b5 | ok | share arrow, clean |
| D47 | assets/raw/ui/icons/d47_share.png | gpt_image_2_6 | e8937f7a-d23c-4bcd-b790-268594fcb4f3 | ok | transparent |
| D48 | assets/raw/ui/icons/d48_lock.svg | gpt_image_2_6 (svg) | 4e58b0d3-5c11-41ab-80cb-2a4bd7c60a8c | ok | padlock, clean |
| D48 | assets/raw/ui/icons/d48_lock.png | gpt_image_2_6 | 92b49279-d47c-40a7-94f6-82be6d43f46b | ok | transparent |
| D60 | assets/raw/ui/icons/d60_phone_frame.png | gpt_image_2_6 (quality medium) | 93df9bf3-5ea8-424a-ae3c-0bb7dfa71182 | ok | 752x1344; screen area alpha=0 verified numerically; crack, sticker, suction mount, no text |
| D61 | assets/raw/ui/icons/d61_speech_bubble.png | gpt_image_2_6 (quality medium) | 1791dce1-4087-4007-9ab5-c1368c493701 | ok | 1344x752, true alpha, empty, no text |
| D62 | assets/raw/ui/icons/d62_button_set.png | gpt_image_2_6 (quality medium) | bbfbfc18-a8b8-4aff-a71f-8b8969876b75 | ok | ref B03 (palette only; no pin/scene leak); 1344x752; buttons x3, toggle x2, slider, checkboxes x2, tab; no text |
| D63 | assets/raw/ui/icons/d63_order_card_frame.png | gpt_image_2_6 (quality medium) | 883fe7b0-dce4-4b4e-ba75-e4e4fd4a79c4 | ok | ref B03 (palette only; no leak); 880x1168; portrait slot, package slot, 5 stars, perforated edge, no text |
| O-cast | voice/casting/en_a3ce02fe-4d3e-55bc-b4d4-a4801b9acdb4.mp3 | text2speech_v2 elevenlabs | cd448701-4b67-4a51-acf1-7e897821dc7f | ok | YOLDAŞ candidate Juno EN |
| O-cast | voice/casting/tr_a3ce02fe-4d3e-55bc-b4d4-a4801b9acdb4.mp3 | text2speech_v2 elevenlabs | 2d081214-4c0a-41a5-828d-970a3f3caef2 | ok | YOLDAŞ candidate Juno TR |
| O-cast | voice/casting/en_731b4ffe-e95e-59f4-8c00-81608936091f.mp3 | text2speech_v2 elevenlabs | faee4493-0c9c-4a82-bd22-e6fe3c46aabf | ok | YOLDAŞ candidate Ainsley EN |
| O-cast | voice/casting/tr_731b4ffe-e95e-59f4-8c00-81608936091f.mp3 | text2speech_v2 elevenlabs | a0a6723a-a3f4-4d1a-984d-ed01f77a05be | ok | YOLDAŞ candidate Ainsley TR |
| O-cast | voice/casting/en_a00bc7f3-0236-5e76-ac65-90137ce0f5a4.mp3 | text2speech_v2 elevenlabs | 4b40abda-b21e-4314-b3d4-6840a3434b16 | ok | YOLDAŞ candidate Brielle EN |
| O-cast | voice/casting/tr_a00bc7f3-0236-5e76-ac65-90137ce0f5a4.mp3 | text2speech_v2 elevenlabs | 640a18b5-13f1-4ff6-b481-9a51978854b2 | ok | YOLDAŞ candidate Brielle TR |
| O-cast | voice/casting/en_7367e919-3069-5a0b-939e-dfb1c0fd91b4.mp3 | text2speech_v2 elevenlabs | ecdfdf7e-05a4-4fb1-93e1-27d99948056e | ok | YOLDAŞ candidate Isla EN |
| O-cast | voice/casting/tr_7367e919-3069-5a0b-939e-dfb1c0fd91b4.mp3 | text2speech_v2 elevenlabs | 65ce1d94-e7bd-4cfd-abaf-d50926551d39 | ok | YOLDAŞ candidate Isla TR |
| O-cast | voice/casting/en_bb9db352-f345-59f3-90b3-fa9432bcff91.mp3 | text2speech_v2 elevenlabs | 4a9968eb-0831-45ee-ba99-8cd67aac7079 | ok | YOLDAŞ candidate Kaia EN |
| O-cast | voice/casting/tr_bb9db352-f345-59f3-90b3-fa9432bcff91.mp3 | text2speech_v2 elevenlabs | 0735a580-52c8-4a40-9218-3300c6a57e1b | ok | YOLDAŞ candidate Kaia TR |
| O-cast | - | - | - | STOPPED | Awaiting user pick of one EN + one TR YOLDAŞ voice. Teyze/New Model AI/Coach/Conspiracy/Hungover not yet cast. |
| O-cast | - | - | - | DECIDED | YOLDAŞ EN+TR = Juno a3ce02fe-4d3e-55bc-b4d4-a4801b9acdb4 (user pick). Other characters assigned by agent (swap on request): Teyze=Helena 3c2b83c0-2e0a-5ae8-998a-a5fe71b7eccd, NewModel=Reid 66469f5a-10db-586a-bab1-72f6ee66ba69, Coach=Knox 195e386a-cb61-5c1b-a53b-0e2f0669c408, Conspiracy=Cillian d8ba9f14-8a24-44db-932b-99e16c45bd32, Hungover=Barrett d603a8cd-3fe1-55e0-9245-617a2589131e, RudeHonest=Dylan b847bc29-f184-583a-8ad9-d1f1e16d1a60; passengers abi=Cody 1ffcdbb3-078b-5491-959d-359e3021e917, plaza=Ian 472a562a-4c33-5114-8210-d6ffa1e4e2c5, tourist=Evan f7a46aa0-183a-5327-b554-e71d8c0071bb, customer=Daisy 032386ec-491b-5bdc-81ac-49e9a6a2c89d, mechanic=Landon dc1c0a41-53cd-53af-aec5-ab637840505f |
| O1 | voice/{en,tr}/yoldas/dir_{left,right,straight}.mp3 | text2speech_v2 elevenlabs (Juno) | see voice/_queue.tsv | ok | 6 of ~226 voice lines done; queue ~3-5 min/line |
| E01 | assets/raw/ui/cards/e01_reverse_lr.png | nano_banana_pro (job reports nano_banana_2) | 1aea8b1a-fd0f-4a08-8a0b-eb0cc939fa71 | weak | extra sign text (ONE WAY / NO LEFT TURN) violates no-other-text; regenerating once as _v2 |
| E02 | assets/raw/ui/cards/e02_sponsored_route.png | nano_banana_pro (job reports nano_banana_2) | 4455e2ab-d366-4ecb-bbce-8a5a7bbd888d | ok | ref C01v2; 1k; checked ok (contact sheet) |
| E01 | assets/raw/ui/cards/e01_reverse_lr_v2.png | nano_banana_pro (job reports nano_banana_2) | 84f230fc-2cfb-4099-bd7f-cf6aa2cf0912 | weak | best of 2: title exact, but signs still say ONLY (x4); retry used; regenerate manually if strict |
| E03 | assets/raw/ui/cards/e03_silent_mode.png | nano_banana_pro (job reports nano_banana_2) | 10c07b95-fae5-409c-a81b-0bf0ef2cd303 | ok | ref C01v2; checked ok (contact sheet) |
| E04 | assets/raw/ui/cards/e04_honesty_patch.png | nano_banana_pro (job reports nano_banana_2) | 6e441b74-1a02-4dc1-8d0d-8893ff57b55c | ok | ref C01v2; checked ok (contact sheet) |
| E05 | assets/raw/ui/cards/e05_rhyme_engine.png | nano_banana_pro (job reports nano_banana_2) | d39ba784-7143-46ea-aa92-2a0f49c135d4 | ok | ref C01v2; checked ok (contact sheet) |
| E06 | assets/raw/ui/cards/e06_scenic_mode.png | nano_banana_pro (job reports nano_banana_2) | 1409d54d-b1dd-4ab4-8bf9-39b1a6a1dd24 | ok | ref C01v2; checked ok (contact sheet) |
| E07 | assets/raw/ui/cards/e07_beta_voice.png | nano_banana_pro (job reports nano_banana_2) | fb75a905-8751-4499-84f5-139d07c68626 | ok | ref C01v2; checked ok (contact sheet) |
| E08 | assets/raw/ui/cards/e08_ai_integration.png | nano_banana_pro (job reports nano_banana_2) | cc96d802-ae40-4962-9d32-e6527b153fc4 | ok | ref C01v2; checked ok (contact sheet) |
| E09 | assets/raw/ui/cards/e09_eco_mode.png | nano_banana_pro (job reports nano_banana_2) | 344adb3b-cc60-4d6a-b382-c467cbaadd63 | ok | ref C01v2; checked ok (contact sheet) |
| E10 | assets/raw/ui/cards/e10_dark_mode.png | nano_banana_pro (job reports nano_banana_2) | f8433ce3-f68f-4837-9837-3de207e8731e | ok | ref C01v2; checked ok (contact sheet) |
| E11 | assets/raw/ui/cards/e11_social_feed.png | nano_banana_pro (job reports nano_banana_2) | 7b7c8b28-efeb-44be-9b64-badadf5919fa | ok | ref C01v2; checked ok (contact sheet) |
| E12 | assets/raw/ui/cards/e12_teyze_mode.png | nano_banana_pro (job reports nano_banana_2) | 633efae1-c8b1-4078-86f1-0988afc3bfad | ok | ref C01v2; checked ok (contact sheet) |
| E13 | assets/raw/ui/cards/e13_speedrun.png | nano_banana_pro (job reports nano_banana_2) | fa894cd8-4456-41ac-9226-0627878cceba | ok | ref C01v2; checked ok (contact sheet) |
| E14 | assets/raw/ui/cards/e14_offline_map.png | nano_banana_pro (job reports nano_banana_2) | 143756b6-1323-49a0-92ea-ebd200959ec9 | ok | ref C01v2; checked ok (contact sheet) |
| E15 | assets/raw/ui/cards/e15_card_back.png | nano_banana_pro (job reports nano_banana_2) | 350b6c9c-8eea-4ac0-8e40-083e9d96b588 | ok | ref C01v2; checked ok (contact sheet) |
| F01 | assets/raw/orders/f01_doner.png | gpt_image_2_6 | e6926285-4d5a-4250-89f6-c56764cd18ca | ok | medium; pending sheet check |
| F02 | assets/raw/orders/f02_lahmacun.png | gpt_image_2_6 | 3cfee854-fe40-46b0-9da7-a8d72290ecd9 | ok | medium; pending sheet check |
| F03 | assets/raw/orders/f03_cake.png | gpt_image_2_6 | 88b50b10-5331-4f20-91cd-330bc2bca214 | ok | medium; pending sheet check |
