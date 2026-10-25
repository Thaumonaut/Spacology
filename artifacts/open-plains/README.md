# Open plains and a dithered treeline (micro-wilds-29)

Before and after JPEGs of the streamed world (seed 2718), captured headlessly at 1280x800.
- "Before" is `voxel-polish` at 27e2765 (micro-wilds-28).
- "After" is `open-plains` (micro-wilds-29).
- `spanN` is the map camera span in metres. `walk` is the Walk view (`&walk=1&trees=objects`), facing SW.

| Shot | URL (`/prototypes/microvoxel-world.html?seed=2718&extent=infinite` + ...) |
| --- | --- |
| plainA-span3000, plainA-span1000, plainA-walk | `&cx=-475&cz=-225&lx=4&lz=4`: a ~7 km² lowland wildflower plain in the south-west |
| plainB-span3000, plainB-walk | `&cx=894&cz=291&lx=4&lz=4`: a ~4.5 km² grass valley between forested ranges |
| treelineA-span1500 | `&cx=1087&cz=-75&lx=4&lz=4`: forest climbing into parkland and rock |
| treelineB-span1500 | `&cx=-225&cz=-413&lx=4&lz=4`: forest edge against the snowline |

What to look for:
- **Plains.** Before, the lowland was oak woodland plus a shrub every few metres. After, it is open green meadow. You see lone trees, a few copses and bush clumps, wildflower drifts, grass tufts and half-buried boulders. In plainB the valley floor is open and the forest stays on the flanks.
- **Forest edges.** Where forest meets a plain, it thins over a wide, noisy fringe. You see tongues, clumps and stragglers instead of a line.
- **Treeline.** The upper forest thins through subalpine parkland into scattered clumps before the rock and snow. The thinning is irregular, at several noise scales (treelineB).

## Coverage (seed 2718, 40x40 km around the origin, 400 m grid, 1668 land samples)

"Open" means no tree of 3 m or taller within 10 m of the sample. "Forest" means 4 or more such trees within 10 m.

| | before | after |
| --- | --- | --- |
| all land: open / forest | 35% / 29% | 54% / 14% |
| vegetated land (excluding rock, snow, ice, beach, desert): open / forest | 12% / 40% | 38% / 19% |
| plain biomes (grassland + flowers + pinkgrass), share of land | 10% | 19% |
| grassland: open / forest | 8% / 41% | 67% / 8% |
| flowers: open / forest | 5% / 40% | 64% / 8% |
| montane: share of land, open / forest | 21%, 4% / 62% | 13%, 12% / 40% |
| alpine meadow: open / forest | 22% / 16% | 39% / 7% |
| boreal, redwood, wetland, rainforest | forested | unchanged |

- The trees left in grassland are mostly riparian willow and alder along rivers, overgrown ruins, copses and ancients.
- Boulder blocks on the plains went from about 70 to about 550 per km² in the lowland.
- On plains next to the mountains, the mountain boulder clusters (about 3200 per km²) give way to the plains' erratics (about 560 per km²), so plains stay easy to cross.
