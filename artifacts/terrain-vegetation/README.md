# Terrain vegetation: trees, scatter and landmarks (micro-wilds-12)

Before/after screenshots of the streamed voxel world, seed 2718, rendered headlessly (Playwright, service workers
blocked) from `prototypes/microvoxel-world.html?extent=infinite&seed=2718`. `before-*` is commit 51df7e1; `after-*`
is this change. The file suffix gives the camera span in metres (span32/41 = site view, 67 = district, 86/142 = wider).

| Spot | World x, z | What to look at |
| --- | --- | --- |
| redwood | -60, 4 | Redwoods end in needle points (the red trunk no longer pokes out of the crown); young, mature and big trees mixed |
| forest | -19, -94 | Species mix: oak, birch groves, spruce, larch (autumn-gold patches), bushes at edges, ferns, red mushrooms, glowing blue flowers |
| boreal | 0, -528 | Spruce, birch and larch with clustered size classes |
| montane | -319, 213 | Spruce and larch |
| tree-of-life / world-tree-coral-wide | -150, -114 | World tree, coral "umbrella pad" variant: raised grassy mound, exposed roots, leaning twisted trunk |
| world-tree-blossom | 290, 326 | World tree, violet/white blossom variant with hanging strands and ruins among the roots |
| town | 254, 218 | Overgrown ruins: trees in courtyards and against walls, climbing ivy, moss at wall feet |
| temple | 206, -69 | Overgrown temple; wildflower drifts in the grassland around it |
| grassland / meadow-flowers | 76, 93 / -23, 118 | Wildflower patches, bush-sized trees, gnarled trees leaning over the lake |
| wetland / lake-edge | -67, -28 / -72.7, -26.4 | Reeds at wet edges, gnarled trees leaning over a stream, logs |
| bamboo-rainforest | -1369.8, 1506.8 | Bamboo grove: tall thin culms with nodes, leaves in the top third |
| savanna | -1570.9, 658.4 | Acacia umbrella trees around an overgrown castle |
| desert / desert-cactus | -248, 599 / -262.6, 526.8 | Cacti |

The script the screenshots came from is a copy of `/tmp/mvshots-scripts/at.cjs` (it screenshots a world x, z, offset
back along the view by a lift, at the listed zoom-out steps).

World trees on seed 2718 after this change (12 within ±2 km, down from 23; minimum spacing 414 m, was 176 m):
(-150,-114) coral, (290,326) blossom, (74,-550) blossom, (-1002,-70) blossom, (999,303) coral, (-588,548) blossom.

## Conifer bough tiers (follow-up)

Spruce, larch and redwood crowns are now stacked bough tiers instead of one smooth cone. `tiers-before-*` is the
merge commit (vegetation + biomes) and `tiers-after-*` is this change. Same seed, same headless setup.

| Spot | World x, z | What to look at |
| --- | --- | --- |
| redwood | -60, 4 | Redwood spires: 5-6 drooping skirts per crown, a small point on top, no trunk above the needles (`-close` is zoomed in) |
| montane | -300, 233 | Spruce (dark) and larch (gold/pale): larch tiers are softer and open |
| cool-forest | 0, -528 | Mixed cool forest: spruce and larch tiers among birch |

Tier geometry, for anything that shades tiers: the crown runs from cell `low` up to `apex` (one past the highest needle
cell), crown height `span = apex - low`. Tiers are counted down from `apex` with period `span / 5.5`.
