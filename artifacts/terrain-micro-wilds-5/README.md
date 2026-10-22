# Streamed terrain: micro-wilds-4 → micro-wilds-5

Headless captures of `prototypes/microvoxel-world.html?extent=infinite&seed=2718` (1280×850).

| File | What it shows |
| --- | --- |
| `before-home-384m.png`, `before-home-631m.png` | micro-wilds-4 around the root: broad grey basalt sheets break up the grassland and plateau. |
| `after-home-492m.png`, `after-home-1km.png`, `after-home-2km.png` | micro-wilds-5 around the root. Rock is confined to cliff rims, gorges and small outcrops. Rivers sit in valleys. The continent view has 128×128 hill-shaded columns per tile, mottled forest, sky isles with ground shadows, and crystal clusters. |
| `after-range-234m.png`, `after-range-2km.png` | A collision range near chunk (-137, 14): forested foothills, then rock, then snow on peaks up to about 200 m. |
| `after-sky-isle-142m.png` | A sky isle over forest near chunk (-8, -29). Its shadow on the ground shows the gap beneath it. |
| `zoom-trees-142m.png`, `zoom-trees-384m.png` | Continent-view canopy samples the same trees as the voxel view, so scattered grassland trees stay scattered when you zoom out. |

Reproduce: serve with `npm run serve`, open the URL above with `&cx=…&cz=…&lx=…&lz=…`, then zoom out with −.
