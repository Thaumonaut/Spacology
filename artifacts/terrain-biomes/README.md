# Terrain biomes: greener land, new biomes and coherent regions

Streamed world `prototypes/microvoxel-world.html?extent=infinite&seed=2718`. All shots are headless Playwright at 1280×850
with the service worker blocked. The `before-*` shots are from commit 51df7e1; the `after-*` shots are from this change.

## Views

| File | View (`cx`, `cz`, zoom-outs) | Shows |
| --- | --- | --- |
| `before-home-close.png` / `after-home-close.png` | home 0, 0, close | Ground at the ferrite root: plain grass before, wildflower meadow after |
| `before-home-far.png` / `after-home-far.png` | home, ~380 m span | Home valley |
| `before-home-wide.png` / `after-home-wide.png` | home, ~1 km span | Region view: brown dirt blotches before; tonal greens, meadow and autumn woods after |
| `before-west-grass.png` / `after-west-grass.png` | -312, 125 | Coast that was beige `dry` steppe; now golden/green grass and meadow |
| `before-south-warm.png` / `after-south-warm.png` | -250, 275 | Warm south |
| `before-northeast.png` / `after-northeast.png` | 188, -188 | Was lowland tundra and boreal; now temperate |
| `after-flowers.png` | 6, 0 | Wildflower meadow (buttercup and violet patches in green) |
| `after-autumn.png` | 21, -78 | Autumn woodland: gold and rust canopies over gold litter |
| `after-blossom.png` | -36, 198 | Blossom grove: violet-pink canopies over petal-strewn grass |
| `after-fen.png` | 9, -108 | Mossy fen (moss, sphagnum and peat runnels) beside autumn woods |
| `after-pinkgrass.png` | 225, 0 | Rosegrass prairie: pink grass that thickens toward water |
| `after-golden.png` | -231, 0 | Golden savanna with scattered trees |
| `after-bamboo.png` | -198, 87 | Bamboo grove (dense canopy over a dark jungle floor) |
| `after-heath.png` | 144, -297 | Heather moor |
| `after-desert-wide.png` | 144, 780, ~800 m span | One of the rare, large deserts, about 6 km from home |
| `after-badlands.png` | -852, 84 | Badlands: clay/ochre strata banded by height |

## Land shares, 6 × 6 km around home (seed 2718, 20 m samples, land only)

| | Before | After |
| --- | --- | --- |
| Tundra | 21.5% | 0.5% |
| Snow | 7.1% | 1.1% |
| Boreal | 12.2% | 2.0% |
| Grassland | 14.9% | 20.5% |
| Temperate forest | 5.7% | 17.8% |
| Hot/dry (desert, badlands, savanna, golden savanna, steppe) | 12.7% | 17.0% |
| New: wildflower meadow, autumn, blossom, fen, heath, rosegrass, golden savanna, bamboo | none | 7.1, 2.6, 1.8, 1.4, 2.4, 2.1, 5.0, 1.4% |

Deserts and badlands are now confined to a few large arid basins (none within about 2 km of home). The nearest desert on seed
2718 is about 6 km out.
