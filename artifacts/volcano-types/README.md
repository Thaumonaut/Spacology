# Volcano types vs real volcanoes

Revision `micro-wilds-30-volcanoes` gives every volcano one of five real-world types (`MacroLib.volcanoSpec` /
`volcanoCone` in `prototypes/labs/microvoxel-world/macro-map.js`). Each type is compared here with a real example,
measured with the same code (`tools/terrain-study/volcano-types.cjs`, metrics from `metrics.cjs`) on 30 m grids
(AWS Terrain Tiles for the real ones; the generator's `geography()` with 3×3 sub-samples per pixel for ours).

Each image: **real** (left) | **ours in the world** (a volcano of that type on some seed) | **ours, cone alone**
(the cone function by itself, size class 1500 m, on flat ground). Panels are at their own scales (our world is about
half real scale), each ~2.3 base radii wide; the white bar is 1 km. Shaded relief, sun from the north-west.

| type | real | ours (seed, vent x/z) | file |
|---|---|---|---|
| fuji | Mt Fuji | 181, (4853, −2819) | [fuji.png](fuji.png) |
| rainier | Mt Rainier | 107, (4726, 486) | [rainier.png](rainier.png) |
| helens | Mt St Helens | 26, (−12186, 4082) | [helens.png](helens.png) |
| caldera | Crater Lake | 71, (8738, −643) | [caldera.png](caldera.png) |
| shield | Mauna Loa (90 km at 90 m) and Kilauea summit | 30, (4799, −7049) | [shield.png](shield.png) |

## The types

- **fuji**: symmetric stratovolcano. Base radius 4.4 H, flanks H(1 − r/R)^2.6 (concave: ~23° high up, 6–7° at the
  foot), a small crater with a flat floor, steep inner wall and sharp rim, shallow radial ribs, one to three flank
  cinder cones. Light crag and erosion texture, so it stays smooth.
- **rainier**: glaciated giant. Base radius 4.4 H, exponent 2.4, about 10 % elongated, deep radial glacial ribs with
  crisp crests (sharper rib wave) starting just under the summit, a lumpy summit of two or three knobs. Snow and ice
  may lie from ~45 % of its height (Fuji ~72 %).
- **helens**: breached cone. The cone (4 H, exponent 2.2) is truncated at 0.78 H; a horseshoe crater (rounded back
  wall behind the vent, steep walls under a crisp rim, arms diverging toward the breach) is cut down to 0.35 H below
  the cone at the vent, its depth easing out by 0.45 R so the floor runs out onto the flank. The breach faces the lowest
  ground around the volcano (sea or valley, away from ranges). A lava dome stands in the crater; a hummocky debris apron
  (10–60 m) fans out beyond the breach.
- **caldera**: Crater Lake. Base radius 4.5 H; a rim at 0.3 R (varying ±10 % with angle) and 0.26 H high (±10 %);
  inside it the walls fall as cliffs (crisp rim edge, ~65° under it, easing into a talus foot) to a flat floor at
  0.04 H; outside, gentle slopes (Hr((1 − r/R)/(1 − rr))^1.2, ~5°). The world fills the caldera with a level lake at
  0.15 H above the vent's base (the ground under the caldera is eased to that base so the whole rim stands above the
  water); a cinder-cone island (Wizard Island) stands out of it. The macro map sees the cone the caldera collapsed
  from, and no macro river or lake forms inside the rim; local drainage ends in the lake.
- **shield**: Hawaiian shield. 0.4 of the size class high (440–720 m) on a base of 12 heights, flanks H(1 − r/R)^2
  with a flattened summit (~8° high, 2–4° low), an elliptical summit caldera, two to four pit craters along two
  rift-zone ridges, four to six flank cinder cones, very little crag texture.

All types: cones bury the rolling hills under them and, up their flanks, much of any range they stand on (most under
shields and calderas). Coastal cones raise the sea floor as before.

## Measurements

Same metrics as `artifacts/real-terrain` (median height per 250 m ring about the vent; base radius where the profile
is within 5 % of its drop; concavity p of h = H(1 − r/R)^p; flank slopes at 20–80 % of R; median slope within 0.6 R;
ribs on a circle at 0.5 R). "Cone alone" isolates the shape; "in the world" includes ranges, hills, sea, erosion and
drainage around a real placement, so it is noisier (and for the shield example, a range and the sea inside the
window dominate the in-world row).

| type | example | H m | base R m | R/H | p | slope 20/40/60/80 % R (°) | median slope < 0.6 R (°) | ribs at 0.5 R (n, depth m) |
|---|---|---|---|---|---|---|---|---|
| fuji | Mt Fuji | 2867 | 11125 | 3.88 | 1.47 | 21.8 / 15.6 / 9.0 / 6.1 | 16.3 | 16, 132 |
| **fuji** | ours, cone alone | 1256 | 4875 | 3.88 | 1.37 | 22.3 / 17.3 / 11.7 / 7.0 | 18.7 | 12, 55 |
| **fuji** | ours in the world | 1023 | 4125 | 4.03 | 1.46 | 23.0 / 16.4 / 10.9 / 6.6 | 20.5 | 17, 114 |
| rainier | Mt Rainier | 3064 | 11375 | 3.71 | 1.67 | 25.6 / 18.9 / 9.6 / 8.2 | 24.9 | 17, 435 |
| **rainier** | ours, cone alone | 1309 | 4875 | 3.73 | 1.33 | 22.1 / 16.6 / 12.0 / 7.7 | 20.6 | 15, 76 |
| **rainier** | ours in the world | 1106 | 4375 | 3.96 | 1.27 | 21.3 / 15.7 / 15.5 / 9.7 | 24.1 | 12, 220 |
| helens | Mt St Helens | 1484 | 7625 | 5.14 | 1.39 | 27.6 / 15.7 / 8.6 / 4.8 | 19.7 | 30, 104 |
| **helens** | ours, cone alone | 923 | 4875 | 5.28 | 1.06 | 4.2 / 17.4 / 12.7 / 7.9 | 17.5 | 10, 54 |
| **helens** | ours in the world | 705 | 4125 | 5.85 | 1.08 | 12.0 / 11.7 / 9.8 / 8.0 | 18.2 | 14, 140 |
| caldera | Crater Lake | (lake) | – | – | – | – / 4.6 / 2.1 / 2.1 | 5.8 | 18, 237 |
| **caldera** | ours, cone alone | (lake) | – | – | – | – / 5.4 / 5.0 / 4.5 | 5.5 | 11, 36 |
| **caldera** | ours in the world | (lake) | – | – | – | – / 7.2 / 5.4 / 5.1 | 7.1 | 19, 100 |
| shield | Mauna Loa | 3366 | 41125 | 12.22 | 1.27 | 7.0 / 5.8 / 2.6 / 2.7 | 6.1 | 7, 176 |
| **shield** | ours, cone alone | 525 | 5875 | 11.18 | 1.27 | 7.3 / 6.2 / 4.7 / 3.1 | 6.3 | 24, 7 |
| **shield** | ours in the world | 325 | 3375 | 10.40 | 1.97 | 13.6 / 2.6 / 0.2 / 1.6 | 21.6 | 7, 174 |

Type-specific:

| | caldera across | rim − lake (wall) min / median / max m | outer slope | caldera / base diameter |
|---|---|---|---|---|
| Crater Lake | 9.7 km | 155 / 343 / 600 | 4.6° | 0.32 |
| ours, cone alone (H 1500) | 4.1 km | 121 / 160 / 205 | 5.4° | 0.31 |
| ours in the world (seed 71) | 4.8 km | 144 / 197 / 245 | 6.7° | 0.32 |

| | crater depth below highest rim | rim radius | breach (azimuths with rim < floor + ¼ depth) |
|---|---|---|---|
| St Helens | 637 m (0.43 H) | 1125 m (0.15 R) | 75° |
| ours, cone alone | 434 m (0.47 H) | 900 m (0.18 R) | 85° |

(The in-world St Helens row of the breach metric is not reliable: measured from the macro vent, the dome right beside
it reads as the rim. See [metrics.json](metrics.json) for everything.)

What matches: Fuji's and Rainier's R/H (3.7–4.0 vs 3.7–3.9) and flank slopes within ~2–3° at every radius (the
terrain study's main volcano finding: before, R/H 2.9–3.0 and 21–23° at 60 % R); St Helens' broad base (R/H 5.3 vs
5.1), crater depth (0.47 vs 0.43 H) and breach width; Crater Lake's proportions (caldera/base 0.31 vs 0.32, outer
slope 5.4 vs 4.6°, walls 120–205 m against 155–600 m real, i.e. about half scale like the rest of the world); Mauna
Loa's profile (R/H 11.2 vs 12.2, p 1.27 vs 1.27, slopes 7.3/6.2/4.7/3.1 vs 7.0/5.8/2.6/2.7°).

What does not (yet): concavity p of the strato cones stays 1.3–1.4 against 1.5–1.7 (a higher exponent mostly shrinks
the measured base radius); Rainier's real glacial valleys are deeper (0.14 H) than our cone alone (0.06 H), though the
world's erosion brings ours to ~0.2 H; ours are ~half the real sizes throughout (the whole world is), so calderas are
~4–5 km across rather than 8–10 km.

## Frequencies (200 seeds, `volcano-scan.cjs`)

464 volcanoes, 2.3 per map (2 maps with none): fuji 32.8 %, rainier 24.1 %, helens 17.9 %, caldera 9.9 %,
shield 15.3 %. Types come from a hash of the position, weighted by setting: shields ×2.2 within ~4 cells of the coast,
×0.4 inland, ×0.5 next to a range core, and dominant on island maps (volcano, high and low island, archipelago,
shattered); calderas commoner inland.

## Cost

Per-sample cost (`time-ab.cjs`: `erosionAt`, i.e. tectonics with the cones, crag, gradient lattice and erosion; old and
new generator alternating in one process, best of 4 passes; the machine was busy, so absolute numbers drift):

| seed | volcano flanks (6 km box per vent) | grid across the map |
|---|---|---|
| 2718 | 32.0 → 34.1 µs (+7 %) | 10.3 → 10.6 µs (+3 %) |
| 26 | 43.9 → 42.8 µs (−2 %) | 22.9 → 24.7 µs (+8 %) |

The cone function itself costs 190–330 ns per call (old 150 ns): Fuji/Rainier ~190, breached ~225, caldera ~240,
shield ~330 (rifts, pits, cinder cones). Volcano fields are filled into the relief sample instead of copied
(`{...t}` spread), which pays for most of it on flanks. The map-wide rise is mostly the wider cones (base radius 4.4 H
instead of 3 H covers ~2× the ground).

## Rerunning

```sh
node tools/terrain-study/fetch-real.cjs fuji rainier st-helens crater-lake mauna-loa kilauea
node tools/terrain-study/volcano-scan.cjs 200          # type counts and clear examples per type
SS=3 node tools/terrain-study/volcano-types.cjs sample # ours in the world (examples listed in the script)
node tools/terrain-study/volcano-types.cjs ideal       # cones alone
node tools/terrain-study/volcano-types.cjs analyze     # table + metrics.json
node tools/terrain-study/volcano-types.cjs render      # these PNGs
node tools/terrain-study/time-ab.cjs <old dir> prototypes/labs/microvoxel-world   # A/B per-sample timing
```

Note: `artifacts/real-terrain` describes `micro-wilds-29`; its `ours-volcano*` areas (seed 2718 vents) no longer
match this revision's volcanoes.
