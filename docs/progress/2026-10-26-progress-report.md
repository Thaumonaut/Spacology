# Spacology progress report, 2026-10-26

This is a snapshot of where the project stands after a week of parallel work. It is built from the `progress-review` branch: `worldgen-integration` (about 20 feature branches merged) with the `anime-ab-flags` branch merged on top. The full feature list, with evidence for each item, is in [2026-10-26-progress-inventory.md](2026-10-26-progress-inventory.md).

## Where the code is

- **Newest committed code:** `progress-review`. It holds everything in `worldgen-integration` plus the latest anime-look work.
- **Uncommitted work outside it:** the `voxel-rendering` worktree (branch `devin/1793023015-building-review`) has 10 uncommitted files for a building-lab review tool. Nothing else is uncommitted. Every other worktree was saved as `CHECKPOINT`/`CHORE` commits at 04:31 today.
- **Not found anywhere:** making **trees objects by default**. Object trees exist and look good, but on every branch they are still opt-in via `?trees=objects`. No branch, stash or orphaned commit makes them the default.

## Where each area stands

| Area | State |
|---|---|
| Terrain, mountains, volcanoes | Strong. Real-world range styles (Alps, Cascades, Rockies, Himalaya, Andes), five volcano types, eroded rock, open plains. Open issue: valleys are still V-shaped, and the world is about one third of real scale with a rescale pending. |
| Rivers, lakes, coasts | Strong. Rivers flow with slope, rapids, estuaries, waterfalls. Not clear whether the fractal-river and coastline studies feed the default world. |
| Biomes and ground | Strong. Many biomes with blended borders and river corridors. Painted ground is opt-in and has an unchecked tile-edge seam. |
| Trees | Voxel trees are the default. Object trees (anime crowns, conifers, bushes) are opt-in and marked "under evaluation". Far-tree crowns and billboards are opt-in. |
| Grass and flowers | Grass is good, and its budget no longer thins as the world loads. Anime flowers (pink stars, white lilies, bent stems, clusters, style menu) are opt-in and still being tuned. They are sparse on open plains because the generator places few flowers there. |
| Atmosphere | Strong. Layered fog by altitude, clouds and cloud shadows, soft sun shadows, ink outlines, 10 km curved horizon. |
| Streaming and performance | Strong. Packed meshes and grass, uploads spread across frames, generator work off the main thread, device-based GPU budget. GPU frame-time comparisons between variants haven't been run yet. |
| Walk, crew, co-op | Working: first-person walk with jump, swim and collision; crew; hex atlas; three-player co-op supply line. |
| Ruins, castles, cities, buildings | In-world ruins are on. Castle drafts, city drafts, the city slice and the building lab are separate study pages, not yet in the world. City street views are too heavy for phones. |
| Game app and mini-games | The ridge expedition app embeds three station games; 13 station games are in the playtest library. Nine design questions are open (see `docs/design/three-teams-and-station-games.md`, section 10). |

## Tests

Run on `progress-review`, headless, with `node tests/run.cjs`. The run reached its 2-hour time limit after all the unit tests and 37 of the 70 browser files.

- **Unit tests:** all but three pass. The three failures were already there before this work:
  - `coop-session`: also fails on `voxel-polish` before the anime work.
  - `microvoxel-crystal-material` and `microvoxel-structures`: `docs/worldgen-integration.md` says they "remain present and failing against the integrated default".
- **Browser tests: failures that are also on `main`.** These are stale tests, not new breakage:
  - `art-gallery-filters` expects 30 characters and finds 38.
  - `enemy-balance` and `enemy-pressure` call a function, `cancelSessionAutostart`, that no longer exists.
  - `aether-pool`, `gear-details` and `formation-regressions` wait for a "Continue voyage" button that is now hidden. `tests/browser/README.md` already lists this stale assumption for two similar tests.
  - Checked on `main` too: all of these fail there, except `gear-details`, whose check on `main` didn't finish before its time limit. It fails the same way as the others (waiting for the hidden button).
- **Browser tests: microvoxel world.** `camera`, `motion`, `shadows` and `streaming` failed or timed out. The likely cause is the test setup, not the code: these tests launch headless Chromium without GPU flags, so it falls back to software rendering, and the streamed world never finishes loading that way. Launching with GPU flags, still headless (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`), loads the same views in seconds.
- **Not run:** the remaining 33 browser files, the game app checks (`npm --prefix game run check`, `npm --prefix game test`) and the release gate.

## What to work on next

In suggested order. The first group makes progress measurable; the second turns the best experiments into the default world; the third is new features.

**1. Make the tests trustworthy**
1. Launch the microvoxel browser tests with GPU flags, still headless, so they finish in minutes instead of timing out.
2. Update or retire the stale browser tests: the hidden "Continue voyage" button, the removed `cancelSessionAutostart`, the roster count.
3. Decide on the three failing unit tests: fix them or rewrite them for the integrated world.
4. Run the full suite, the game app checks and the release gate to get one clean baseline.

**2. Promote what's ready**
1. Make trees objects by default. This was never committed; needs a performance check and a look at the near/far handover.
2. Pick the anime-look flags to keep, fix their known issues (the ground tile-edge seam; conifers and level 5+ for far trees), then make them the default.
3. Run the bug-hunter pass owed on the anime work before anything merges to `main`.
4. Measure GPU frame time for the default world against each variant, on desktop and on a real phone or tablet.

**3. Build next**
1. Denser flower drifts on open grass: a generator change, so meadows read as carpets of colour.
2. The terrain rescale to real scale, then wider U-shaped glacial valleys.
3. Bring castles, towns and building-lab buildings into the streamed world, starting with one town.
4. Gameplay hooks the World Lab still lacks: editing the world, pathfinding and roads, construction, discoveries, and the hand-off to Research.
5. Answer the open questions in the three-teams design doc, starting with why gear assembly isn't fun.
