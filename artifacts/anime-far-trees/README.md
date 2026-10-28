# Distant trees: A/B (`?far=lobes`)

Goal: trees away from the viewer keep the anime crown look, instead of turning into stepped voxel blocks.

- **A**: the current trees (default). Trees are voxels at every level. Away from the viewer the crowns are built from 0.5–4 m columns: stair-stepped silhouettes, voxel speckles, and the rectangular skyline.
- **B**: `?far=lobes`. On levels 1–4 (0.5–4 m columns, nodes 16–128 m), trees are drawn as object crowns, using the same lobe/tier/trunk objects and anime lobe shader as `?trees=objects`. They aren't stamped into the voxels. Only the nearest level (0) stays voxel. Clumps thin out by level: at level 4 each tree keeps at most 8, spaced evenly through the crown and enlarged to keep its volume. Twigs drop from level 2 and limbs from level 4; trunks stay.

Headless capture with `tools/__ground-shot.cjs` (`OUT=anime-far-trees FLAG=far=lobes VIEWS=walk WAIT=120`). Seed 203749, standing at (1079, 1017) looking north at (1079, 1217):

| A | B | View |
| --- | --- | --- |
| `north-walk-a.png` | `north-walk-b.png` | Walk mode across the meadow toward trees ~40–80 m away |
| `north-crop-a.png` | `north-crop-b.png` | The distant trees, cropped and enlarged 2× |

GPU memory once streaming settles (same spot, 384 MiB budget): A 276 MiB, B 288 MiB, both at full detail (level 0).

How we got here:
- **Levels 3–6 first.** This pushed a valley view over budget: A was already at 369 of 384 MiB. The stream dropped the whole view one detail level, so that B shot was unusable. Level 6 also made 13k clumps and ~0.7 s of generation per tile.
- **Levels 3–4, then 2–4.** No visible change at this spot, because the blocky trees ~60 m out sit on level 1.
- **Levels 1–4.** This is the version shown.

Not done yet:
- **Levels 5+ (8 m+ columns)** are still voxel canopy, which is mostly behind haze.
- **Conifers** at the valley spot looked the same either way. Whether conifer crowns come through as capped clumps or uncapped tiers is still to be checked.
- **The handover** from level-0 voxel trees to level-1 object crowns happens where level-0 tiles end. It could pop while walking, which a still screenshot won't show.
- **Second spot.** Your screenshot's skyline (forest a few hundred metres away) still needs a shot from a spot like that.
