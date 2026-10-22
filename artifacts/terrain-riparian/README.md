# River corridor ecology: before / after

These screenshots compare micro-wilds-13 (`before-*`) with the riparian-corridor change (`after-*`). All views use seed 2718 and were rendered headlessly at 1280x850. Each place has a close view (span 32 m) and a zoomed-out view (the span is in the file name).

Open a place with `prototypes/microvoxel-world.html?extent=infinite&seed=2718&cx=<floor(x/8)>&cz=<floor(z/8)>&lx=<x mod 8>&lz=<z mod 8>`.

| Name | World x, z | What to look for |
| --- | --- | --- |
| desert | 1232, 6330 | A desert stream. From afar it now reads as a green oasis ribbon of floodplain grass, palms and acacias that fades into the dunes. Close up: lilies on the calm water, and cattails and reeds on the mud. |
| temperate | 128, 128 | A river through a wildflower meadow. Weeping willows and alders line the banks, with lusher floodplain grass. |
| jungle | -2462, 262 | A warm, wet river near the coast. The banks read as "wetland" in `biomeOf`, so the corridor style comes from climate instead. Big trees lean out over the water trailing vines, and lilies sit in the shallows. |
| mountain | 1400, 330 | A montane creek in forest. Alder and willow scrub grows along the creek. |
| creek | 2337, 1150 | A steep subalpine creek next to a glacier. It shows cobble and gravel banks, and stone boulders (mossy near the spring pool) in the fast reach. |
| lake | 216, -288 | A lake in a meadow. Drifts of lily pads with pink blooms, cattails in the still shallows, and willows, alders and floodplain grass on the shore. |

## Notes

- The corridor is a layer added after the biome is chosen. `geography()` returns `riparian` (0-1), `corridor` (`dry`, `temperate`, `jungle` or `cold`), `fast`, `calm` and `splash`. Biome choice, heights and water are unchanged. The benchmark reports "world data identical" against the old model.
- Water is drawn opaque, so you cannot see a rocky bed through it. Fast reaches show cobbles on their banks and boulders that stand out of the water instead.
- Sand and gravel bars on the inside of bends are not built. The generator has no cheap measure of channel curvature. The existing sandy banks on larger rivers stay as they were.
