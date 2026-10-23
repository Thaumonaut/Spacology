# Terrain: Azgaar-style macro map (micro-wilds-14)

The streamed world now sits on a finite macro map per seed (`prototypes/labs/microvoxel-world/macro-map.js`). The map is a port of Azgaar's heightmap templates, climate, depression fill, flux rivers and lakes. The voxel detail (crag, erosion, rock, snow, glaciers, biomes, vegetation) is layered on top. All views were rendered headlessly at 1280x850. `spanN` is the camera span in metres.

## Macro maps

Made with `node tools/render-macro-map.cjs <out.png> --seed N [--map template] --width 1280`. Each map covers 32 x 20 km. The colours follow Azgaar's height scheme, blue lines are rivers, and the red dot is the home start (the world origin).

- `map-seed2718.jpg`: seed 2718, `continents` template.
- `map-seed12345.jpg`: seed 12345, `continents`.
- `map-seed7.jpg`: seed 7, `pangea`.
- `map-seed2718-archipelago.jpg`: seed 2718 with the `?map=archipelago` override.

## Seed 2718 in the voxel world

| File | World (x, z) | What it shows |
| --- | --- | --- |
| `coast-gulf-span2048.jpg` | -1300, 300 | Widest continent view of the west coast near home: a gulf, headlands and the big river running to its mouth. |
| `coast-headland-span2048.jpg` | 2000, 800 | East coast: a sweeping shore and headland, with forest and blossom groves running down to beaches. |
| `mountain-spine-span384.jpg`, `mountain-spine-span2048.jpg` | 10188, -2450 | The highest ground of the eastern continent's spine. Crag detail, rock, snow and ice sit on top of the macro height. |
| `river-mouth-span142.jpg`, `river-mouth-span631.jpg` | -1195, 437 | The map's biggest river: about 30 m wide, with gently shelving sandy banks, flat water that eases to sea level and meets the sea flush. |
| `lake-span299.jpg`, `lake-span631.jpg` | 213, -1728 | A macro lake north of home: flat water at the lake level, with a roughened, shelving shore. |
| `home-start-span142.jpg` | 0, 0 | The home start: open temperate lowland, the stepped massif, the gorge and the ferrite root. |

The app zooms out to about 2 km at most, so the widest views are 2 km continent views.
