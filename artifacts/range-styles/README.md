# Range styles: Alps, Cascades, Rockies, Himalaya, Andes and old ranges (micro-wilds-30-ranges)

Each mountain range in the streamed world now has a **style** modelled on a real range. The style is chosen when the
macro map is built. Young styles have **pyramidal peaks**: flat triangular faces, straight sharp arêtes that meet at
the summits and run along the crest, and steep planar slopes. Only old, worn ranges stay rounded.

> **These comparisons are pre-rescale.** The world is still at about 1/3 of real scale: the tallest crest is about
> 1.9 km above the sea and ranges are 3-5 km wide. The world is about to be rescaled to real size, which will
> invalidate the size-dependent numbers below (relief, range, peak density, drainage density and window framing).
> Do not tune against them. The scale-free metrics are the useful part: hypsometric integral, slope shares, crest
> sharpness and the curvature ratio.

## What changed (generator)

- **Styles** (`macro-map.js` `RANGE_STYLES`, `STYLE_PREFS`, `styleFor`). Major ranges take the least-used style,
  preferring their kind's list: spine → himalaya / andes / alps; coastal → andes / cascades; interior → rockies /
  alps. Branches inherit their parent's style. Secondary and minor ranges are `old`. Each style sets:
  - the cross-profile `H (1 - q^pa)^pw`. Young styles use a tent (pa = 1), which gives a sharp crest over planar
    flanks. Rockies use a block (pa 2.6: flat top, steep front). Old ranges use a dome.
  - height, width and apron multipliers. Himalaya is 1.6x as tall and 1.35x as wide.
  - baked raster parameters: `age`, `glac`, `dis`, `basin`, `plat` (altiplano) and `pyr` (pyramids), plus the
    crest direction.
- **Pyramidal peaks** (`voxel-world-model.js` `pyramidAt`). There is one candidate summit per 650 m cell. Each is a
  3- or 4-face pyramid with planar faces of 0.42-0.85 m/m on top of the range slope. Edges are aligned with the
  local crest, so arêtes run summit to summit and down the flanks as spurs. The pyramids join as a max-union. They
  are floored into flat trough floors where the range is glacial, and V notches elsewhere. They replace the rounded
  broad-ridge fbm, weighted by `pyr`.
- **Sharp crest kink.** The range core is baked on a 100 m raster and spline-sampled, which rounded every crest over
  about ±150 m. Three more rasters restore it: signed distance to the crest, its absolute value, and the crest slope.
  The sampler adds `KS (B(AD) - |B(SD)|)`. After this change, summit profiles are linear (planar) to within about
  10 m of the top.
- **Valley network** (`carveValleys`, at bake time). The range raster is noise-perturbed into sub-massifs, then routed
  by priority flood and D8. Each channel cell carves a valley whose depth grows with the square root of the drained
  area. The profile is U where glacial and V otherwise. Four passes. This adds about 100 ms to map generation.
- **Erosion.** A coarse 168 m octave on big relief. A concave wave on young and glacial ranges (sharp crest, flat
  floor) and a convex wave on old ones. `dis` scales gully depth. Pyramidal ranges get 60% shallower gullies, so
  their faces stay planar. Old ranges get softer crag and fewer cliff bands.
- **Layout and plains.** Fewer secondary ranges (A/48, at most 6), minor ranges (A/24, at most 8) and branches (1-2
  per major). Apron reach is K about 1.5 half-widths, capped at 3 km. Rockies basins and the Andes altiplano flatten
  hills.
  - Land with under 30 m of macro relief within ±1 km went from 6.2% to 18.9%.
  - Volcano positions moved with the layout. The cone shapes are untouched.
- **Home.** The start levels the range apron (`raHome`), because the macro layout moved the home cell onto a gentle
  ramp.

## Images

- `<style>.png`: 12 km of shaded relief at 30 m/px. Real reference(s) on the left, ours on the right (seed 2718).
- `alps-closeup.png`, `himalaya-closeup.png`: 3 km at 7.5 m/px around the highest summit. Real data is 30 m
  resampled. The alps close-up shows the planar triangular faces and a straight crest.
- `<style>-view.png`: standing-eye silhouettes, 1.7 m above ground. Real is on top, ours below (`view.cjs`, a CPU
  column renderer).
  - `himalaya-view.png` shows the pyramidal summits best.
  - Some of the other views are older or badly framed: the eye picker improved during the work, and the alps,
    cascades and himalaya views were re-rendered last.
  - None were captured in the WebGL app. A headless Walk screenshot (`walk-shots.cjs`) did not finish streaming in
    5 minutes under software GL.

## Numbers (pre-rescale, seed 2718, 30 m)

Our rows cover only that style's own range ground. Ground whose dominant range has another style, volcano cones and
lowland are masked out, because the real windows are all range. Real windows are 20 km (Front Range 30 km).

Our rows were measured after the pyramids and glacial floors went in, but **before the crest-kink fix**, so our crest
sharpness is, if anything, understated. The cascades and andes windows had too little pure ground for drainage
metrics; those are shown as "–" or "Infinity".

"Crest sharpness" is the curvature across divides at the 30 m stencil (−d²h/dx², the larger of the E-W and N-S
values, on single-cell catchments steeper than 15°), as p50 / p75 in 1/km.

| style | area | HI (land) | slope mean ° | >40 % | crest sharpness p50/p75 | ridge/valley curv. |
|---|---|---|---|---|---|---|
| alps | **ours** | 0.31 | 30.9 | 31 | 11.9 / 19.2 | 0.72 |
| alps | bernese | 0.50 | 27.4 | 21 | 4.2 / 7.7 | 2.71 |
| alps | matterhorn | 0.48 | 25.6 | 15 | 3.9 / 7.0 | 2.72 |
| cascades | **ours** | 0.48 | 41.8 | 56 | 13.3 / 20.3 | – |
| cascades | north-cascades | 0.50 | 32.4 | 27 | 9.2 / 18.0 | 1.49 |
| rockies | **ours** | 0.32 | 27.0 | 17 | 10.0 / 15.3 | 0.81 |
| rockies | tetons | 0.32 | 25.1 | 15 | 9.1 / 18.2 | 2.54 |
| rockies | front-range | 0.32 | 18.0 | 1 | 5.8 / 9.4 | 0.77 |
| himalaya | **ours** | 0.22 | 32.0 | 33 | 12.2 / 19.4 | 0.86 |
| himalaya | khumbu | 0.36 | 29.2 | 27 | 7.5 / 12.2 | 2.34 |
| andes | **ours** | 0.40 | 30.5 | 15 | 10.3 / 14.2 | – |
| andes | cordillera-real | 0.35 | 19.8 | 6 | 4.9 / 8.6 | 1.98 |
| old | **ours** | 0.38 | 23.3 | 6 | 9.2 / 13.1 | 0.69 |
| old | smokies | 0.47 | 24.8 | 2 | 8.6 / 12.2 | 0.86 |

The full table is in [table.md](table.md): slope shares, relief, drainage, pits, peaks and open-plain share. Raw
values are in [metrics.json](metrics.json).

- **Crests.** Young ranges are now as sharp as, or sharper than, real ranges at 30 m (11.9-13.3 vs 3.9-9.2 1/km),
  where before they were blunter than real (study: ridge sharpness 6.9-7.2 vs 11). Old ranges match the Smokies
  (9.2 vs 8.6).
- **Hypsometric integral.** Measured on range ground only, it is 0.31-0.48, close to real 0.32-0.50 (the study
  reported 0.16-0.25, but that measure included lowland). Himalaya is low (0.22 vs 0.36) because its window
  includes the tapering ends of a short spine.
- **Slopes.** Ours are steeper than real (more than 40° on 31-56% vs 15-27%). This is a consequence of 1/3 scale
  with real-like faces, and should ease after the rescale.
- **Valleys** are still V-sharp where pyramids meet (ridge/valley ratio 0.7-0.9 vs real 2.3-2.7). The glacial
  floors only form between pyramid bases. This is the main open discrepancy.

## Timing (per `geography()` sample, warm caches, interleaved A/B in one process, best of 12 rounds; `bench-ours.cjs`)

| | voxel-polish | range-styles | ratio |
|---|---|---|---|
| mountain | 5.60 µs | 5.50 µs | 0.98 |
| foothill | 4.72 µs | 4.85 µs | 1.03 |
| lowland | 3.93 µs | 2.95 µs | 0.75 |
| erosionAt per drainage node | 2.33 µs | 3.55 µs | 1.52 |

Earlier runs on a loaded machine gave mountain ratios of 1.03-1.10. Map generation is about 100 ms longer because
of the valley carve. The drainage-node cost (paid when streaming bakes new 2 km drainage tiles) is about 1.5x,
because of the pyramids and the coarse octave in `erosionAt`.

## Tools (`tools/terrain-study/`)

| command | what it does |
|---|---|
| `node fetch-real.cjs matterhorn north-cascades front-range khumbu cordillera-real` | Fetches the new reference tiles. |
| `[SS=3] node styles.cjs all` | Picks windows (best range of each style over the seeds in `SEEDS`), samples them, analyzes and renders. Window choice is now multi-seed; the committed numbers are the earlier seed-2718 windows. |
| `node styles.cjs closeup` | Renders the close-ups. |
| `node styles.cjs view` | Renders the standing-eye silhouettes. |
| `node styles.cjs mask` | Rebuilds the style masks. |
| `BASE_DIR=<dir with old model files> node bench-ours.cjs` | Timing A/B. |
| `node scan-ours.cjs` | Lists ranges with their styles. |
| `experiment.cjs` | Dropped the `rangepw`, `apronhills` and `bigamp` patches, whose target code no longer exists. |
