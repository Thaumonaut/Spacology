# Anime cliffs: A/B round 1 (mesher)

Question: do the cliffs read as melted because of how Surface Nets builds the mesh?

- **A**: the current terrain (default).
- **B**: `?cliffs=fine`. Each Surface Nets vertex sits where the unrounded ground height (`colSurf`, recorded in `column()` / `roughRock`) crosses the voxel edge, instead of at the midpoint. There is no relax pass, and normals come from the gradient of the unrounded ground. Seams between tiles stay closed: every shared vertex lands at the same position on both sides.

Headless captures, seed 2718. The cliff is at world (1472.4, −3568.2) and the valley floor at (1521.9, −3518.8). Reproduce with `tools/__cliffs-shot.cjs` (serve the repo first).

| A | B | View |
| --- | --- | --- |
| `subalpine-walk-a.png` | `subalpine-walk-b.png` | Walk mode, 12 m back from the valley point, facing the cliff (`BACK=12`) |
| `subalpine-map-a.png` | `subalpine-map-b.png` | Close map view, 5 m scale bar, 25 cm render |
| `subalpine-range-a.png` | `subalpine-range-b.png` | Zoomed out, 50 m scale bar, 1 m render (`ONLY=map TAG=range ZOOM=9`) |

## Result: no visible difference

B moves 22,010 of the 22,794 vertices in the cliff tile, but only by 0.11 blocks on average (about 3 cm), and 0.47 blocks at most. None of the three views changes visibly. The mesher is not what makes the cliffs look un-anime.

What the shots do show:

1. **Speckled rock colour.** Rock tones (pale, dark, warm, lichen) are picked per voxel cell by `rockTone` hashes and lichen noise. Anime rock is one flat tone per stratum band, lit in 2–3 bands.
2. **Stair-stepped material edges.** Grass, snow and rock are chosen per voxel column (`surfaceNets`, material per quad), so their borders are pixel staircases rather than painted curves.
3. **Jittery cliff shape.** `roughRock`'s `chip` noise (0.9 and 2.1 cycles/m) makes the height jump between neighbouring columns. Anime cliffs are large flat faces.

Suggested round 2, using the same harness and camera: (a) one rock tone per stratum and no lichen speckle; (b) grass, snow and rock chosen per pixel in the shader. Shape changes (facets and terraces in `roughRock`) come after, if those two aren't enough.
