# Biome edge blending, meandering borders and lily pads

Seed 2718, `prototypes/microvoxel-world.html?extent=infinite&seed=2718`, headless Chromium at 1280x850. `before/` is
b60fed9; `after/` is this change. Suffix `-0` is the close view (span about 67 m), `-1` the mid view (about 384 m);
`crease-2` is a far view (about 1700 m) for checking coarse LOD nodes.

Because the warp moves borders, a pair of shots does not always show the same border at the same spot. Where a border
moved, the `after` shot is taken at that pair's new position (found with the same search).

| Shots | World (x, z) before → after | What to look at |
| --- | --- | --- |
| `crease-*` | 3.87, -124.29 (cx=0, cz=-16) | The reported "crease": the straight diagonal redwood/flower-meadow line now meanders, with trees and ground mixing across it |
| `forest-grassland-*` | 94, -328 → 69, -236 | Forest to grassland: trees thin out and mix instead of stopping at a line |
| `grassland-steppe-*` | 671, -648 → 699, -561 | Green grass to steppe: speckle at the border becomes patches further in |
| `autumn-forest-*` | 89, -525 | Autumn wood to mixed forest: gold and green canopy and litter interleave |
| `forest-blossom-*` | -380, 669 | Forest to blossom grove |
| `savanna-golden-*` | -1812, -191 | Savanna to golden grassland (low contrast; included as a warm-climate case) |
| `lilies-*`, `after/lilies-fine-0` | 216, -288 | Lily pads: before, scattered single voxels; after, round pads 0.65-1.2 m in drifts, a pink bloom on about a third |

`maps/` holds top-down biome maps rendered in Node (`node maps/biome-map.cjs <model.js> out.bmp cx cz span px [surface]`,
1 pixel per cell sampled; `surface` applies the dithered pick):

- `*-crease`: 600 m around (0, -150). Before, the redwood edge runs as a straight north-south line for about 300 m.
- `*-region`: 1.5 km around (-100, -200).
- `*-3k`: 3 km around the origin.

## How it works

- **Meandering borders.** Lowland biome decisions read the climate fields at a domain-warped position. The warp has
  two octaves: about 240 m wavelength with about 85 m amplitude, and about 90 m wavelength with about 65 m amplitude.
  The second octave runs on rotated axes, so neither octave lines up with the 32 m climate grid. Some borders are steps
  between climate cell rows, and those read as long straight lines; the warp breaks them up.
  - The warp reaches `biomeOf` only through region()'s jt/jm offsets. biomeOf applies those offsets only in its lowland
    branch, so the sea, shore, snow, glacier and mountain zonation still use the column's own climate.
- **Blend band.** `geography()` evaluates `biomeOf` again at four points 10-24 m around the warped position. To keep
  this cheap, the climate there is extrapolated from the gradient within its 32 m cell.
  - Each re-evaluation keeps the column's height, its wet, steep and mountain flags, and its region jitter. Only the
    climate moves.
  - It counts only results in the lowland branch. So water and sea edges, the shore, snow, glaciers and mountain
    zonation never blend.
  - A riparian corridor is a layer, not a biome, so it is never a blend partner.
  - New fields: `biome2` (the commonest other biome) and `blend` (the share of samples in another biome: 0.5 on the
    border, falling to 0 about 10-24 m away).
- **Dither.** `pickBiome(g, x, z, f)` returns `biome2` when `blend` beats a threshold. The threshold combines a
  ~20 m clump noise with a per-cell hash, so the border is fine speckle and further in only clumps pass. The noise is
  white or at least 20 m in period, so it cannot alias into stripes at any LOD.
  - Ground uses it per 50 cm cell: the turf palette, sub-soil, worn dirt and scatter.
  - Trees use it per 3 m tree cell, which sets species, density and extras.
  - The under-canopy floor follows the sheltering tree's own biome.
- **Lily pads.** Each 1.6 m cell holds at most one disc of 0.32-0.6 m radius. Its centre is inset so the disc is never
  clipped square. Larger pads get a narrow notch. A drift-strength gate makes the clusters. About a third of the pads
  get a 2x2 bloom at the centre. Pads appear only on calm, still water, as before.

Benchmark (`node tools/benchmark-lod.cjs --against b60fed9`, same process): 10.58 → 11.27 ms/node (+6.5%).
