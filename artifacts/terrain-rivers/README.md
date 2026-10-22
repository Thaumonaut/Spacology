# Rivers, streams, lakes and waterfalls (micro-wilds-12 drainage pass)

Headless captures, seed 2718, `prototypes/microvoxel-world.html?extent=infinite&seed=2718&cx=…&cz=…&lx=…&lz=…`.
`before-*` is commit 51df7e1; `after-*` is this change. The `*-map-*` files are top-down maps rendered in Node from
`geography()`: blue is river water, teal is lake water, white is foam and magenta is a spring.

| Files | Place (world x, z) | Shows |
| --- | --- | --- |
| `before-comb.png`, `after-comb.png` | 1100, -2930 | Comb teeth: short, straight, parallel creeks running into a lake or the sea are gone. |
| `before-comb2.png`, `after-comb2.png` | 2460, 1200 | The same on a coastal slope. Only the stream fed by a sky-isle waterfall is left. |
| `before-cut.png`, `after-cut.png` | -4867, 132 | A flat lake sheet with channel grooves through it becomes a clean river confluence. |
| `before-mid.png`, `after-mid.png` | 150, -250 | Home lowland, 809 m span. The river meanders, runs into the lakes and out again, and tributaries join it. |
| `before-peak.png`, `after-peak.png` | -1450, 430 | A lake that drowned a valley, with channels showing through it, shrinks to its basin. |
| `after-fall.png` | 442, -806 | Falls at a real step: a steep reach dropping onto a gentler one. |
| `before-map-6km.png`, `after-map-6km.png` | -3000..3000 | Fewer puddle lakes, and no short creeks along the coasts. |
| `before-map-lake-800m.png`, `after-map-lake-800m.png` | -300..500, -500..300 | The groove inside the lake is gone, and the river flows through the lakes. |

Measurements (6 km × 6 km window around the origin):

| Measure | Before | After |
| --- | --- | --- |
| Channels entering the sea | 141 | 57 |
| …of which drain under 20 nodes (comb teeth) | 94 | 9 (all fed by isle falls) |
| Lake nodes | 330 | 91 |
| Lake water samples | 11719 | 3805 |
| Water standing above dry land (`floatwater.cjs`, 3 km window) | 0.01% | 0.01% |
| Stream or river courses whose water rises more than 0.3 m downstream (3 km window) | 4 | 1 (0.75 m) |
| River cuts deeper than 10 m below the landform (12 km window) | 9 | 0 |
| `tools/benchmark-lod.cjs --against` | 7.50 ms/node | 7.60 ms/node (0.99x) |
