## Implementation
- [ ] Taller streamed columns: `Uint16` run ends, y-clipped meshing, per-chunk height ranges for culling and picking.
- [ ] Plates: jittered Voronoi, crust types, drift, boundary classification and relief; sea level, shelves, coasts; start bias; revision `micro-wilds-3`.
- [ ] Barriers on new terrain: keep home massif/gorge, remove noise massifs, rift/transform gorges, `sea` terrain kind.
- [ ] Climate grid: latitude temperature, lapse, banded winds, upwind moisture and rain shadow.
- [ ] Biomes: lookup and overrides, new materials and palette, biome tree density and conifer shape, water to sea level.
- [ ] Atlas and play: hex biome/setting, sea never frontier, setting-driven resource signs, inspector and legend text.
- [ ] Seed survey: biome mix, sea/range distances, open start; README, offline cache, package.

## Verification
- [ ] Unit: determinism, finite worlds byte-identical, plate boundary relief, sea and coast, rain shadow, biome coverage, sea impassable, open start.
- [ ] Browser: streaming, crossings, co-op, motion, launch suites pass; mountain chunk meshing within budget.
- [ ] Headless screenshots: coast, range, forest, desert.
- [ ] Strict OpenSpec validation; release, offline Pages and package checks.
