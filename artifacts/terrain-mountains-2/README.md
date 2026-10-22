# Mountains 2: eroded ranges, stratovolcanoes, snow and glaciers

Streamed world, seed 2718, headless Chromium at 1280×850. `before-*` is the baseline (e6839e2). `after-*` is this change. The span in each file name is the camera span in metres.

| Shot | Page parameters |
| --- | --- |
| `*-range-*` | `?extent=infinite&seed=2718&cx=-128&cz=16&lx=4&lz=4` |
| `*-volcano-*` | `?extent=infinite&seed=2718&cx=225&cz=285&lx=4&lz=4` |
| `after-peak-*` | `?extent=infinite&seed=2718&cx=292&cz=-60&lx=4&lz=4` (a cone on a range in the cold north) |
| `hillshade-range-*` | Node top-down hillshade (500 m box at x -1120, z 240). Plain grey, so you see the landform without biome colours. |

## What changed

- **Eroded-terrain filter** (Clay John / Fuse, with Rune Vision's refinements), new function `erodeAt`. Three octaves (56, 28 and 14 m cells), each sampling a 3×3 grid of jittered cells.
  - Each cell lays a wave whose crests run downhill. Blending the cells makes branching gullies and spurs.
  - Normalized gullies: the summed (cos, sin) pair is read as an angle on the unit circle.
  - Straight gullies: a softened triangle wave, `asin(0.95·cos)`. Gully sides are straight and arêtes are sharp, but no crest is a one-voxel fin.
  - Stacked fading: each octave fades with the slope carved so far, so summits, cirque floors and valley bottoms stay smooth.
  - Each octave's gradient feeds the next, so finer gullies run down the walls of the coarser ones.
- **Gradient trick base** (`cragAt`): the existing gradient-damped fBm now returns analytic gradients in metres. It accounts for the domain warp and the octave rotation. Its broad first two octaves (`cragLow`) steer the erosion. The slope is now exact and costs one crag evaluation instead of three.
- **Ranges**: the collision crest wanders off the straight plate boundary, so a range winds instead of following a ruled line. The crest is rounded slightly.
- **Volcanoes**: a wider summit crater with a sharp rim and a small lip, bare rock inside and no ice. The cone carries only a light share of the crag noise, so it reads as a clean concave cone. Barrancos are carved by the erosion filter and stop short of the crater.
- **Zonation**: montane forest → subalpine → green meadow → rock and snow.
  - Snow lies only where the slope is under a limit that rises as it gets colder. Steeper cold ground is rock.
  - Snow lies lower in gullies than on spurs, so it runs down couloirs in tongues instead of following a contour.
  - Rock knolls and spur crests break through meadow and subalpine ground.
  - Snow is a 1 m layer, so steps in snowfields are white down the riser instead of zebra-striped.
- **Glaciers**: they fill hollows below the broad landform, but their thickness is capped (thicker along creases). They keep the gully shape instead of becoming flat sheets. Cold glaciers are snow-topped, and warmer tongues show blue ice.
- **Budget**: a soft summit ceiling holds peaks under about 240 m. Before, a cone on a range hit the 249 m column clamp. `nodeBound` headroom was raised to cover eroded spurs.

## Known issue (outside this change)

Trees stand on snow, glacier and alpine rock in every shot. `treeStyle('snow' | 'glacier' | 'alpine')` falls back to `TREE_STYLE.default`, whose `density: .25` takes precedence over the `TREELESS` set in `makeTree`. The fix belongs to the vegetation code: use a base density of 0 when `barren`.
