# Anime A/B, round 2: flat banded flowers and far tree billboards

On branch `anime-ab-flags`, built on `voxel-polish` (`ce1af99`). Seed 203749, walk mode at (1079, 1017). Headless, `tools/__ground-shot.cjs` with `PORT=4174 VIEWS=walk WAIT=150 FLAG="ground=paint&flowers=anime&far=lobes"`.

- **A**: defaults.
- **B**: `?ground=paint&flowers=anime&far=lobes`.

| A | B | View |
| --- | --- | --- |
| `north-walk-a.png` | `north-walk-b.png` | Looking north across the plain |
| `north-horizon-a.png` | `north-horizon-b.png` | The north treeline, cropped and enlarged 2× |
| `south-walk-a.png` | `south-walk-b.png` | Looking south toward the mountains and ruin tower |
| `south-horizon-a.png` | `south-horizon-b.png` | The south treeline, cropped |

What changed since round 1:
- **Flowers (`?flowers=anime`).** One flat colour per species (cosmos pink, daisy white, buttercup yellow, violet clusters) and a flat gold centre; no gradients, veins or dotted pollen. They're lit like the trees' leaf cards: a rounded normal against the sun, tree shadow (shadow map) and cloud shadow, in the same three flat bands (cool shadow, the colour, a warm highlight).
- **Far trees (`?far=lobes`).** Levels 1–4 still draw object crowns. From level 5 (8 m columns and wider), trees are no longer stamped into the voxels: each is one low-res billboard (`treeCardsIn` in the model, `treeCardFragment` in the renderer). Broadleaf trees are drawn as overlapping lobes with a scalloped leafy rim over a trunk stub, conifers as drooping tiers. They use the crown band colours and sun lighting, with cloud shadow but no shadow map, and anti-aliased edges. The tree grid is sampled with a stride that keeps a tile near 64×64 samples, and each card grows (up to 3×) to cover the trees it stands for.

Still voxel in both: the mountains (terrain), the giant coral tree landmark, and trees on the nearest tiles (for example, the blocky birch trunks on the right of the south view).
