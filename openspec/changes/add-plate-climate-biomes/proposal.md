## Why
Jacob, after playing the barrier slice: "i see a lot of bluffs and cliffs but no mountains or forests or oceans", then "can we use plate technonics to make contitnents and mountain ranges and then humitity, tempurature and wind for setting other biomes". The streamed world has one stepped-massif shape, uniform tree scatter and no sea level, so geography cannot yet explain where resources are. A plate → relief → climate → biome chain makes every hex's terrain, vegetation and resources follow from causes players can read.

## What Changes
- Streamed world revision `micro-wilds-3`. Bounded 128 m / 256 m catchments are unchanged.
- **Plates:** a seeded jittered-grid Voronoi of plates (about 640 m), each continental or oceanic with a drift vector. Boundary type comes from relative drift: collisions raise mountain ranges and foothills; ocean-under-continent makes a coastal range and a trench; ocean-ocean makes volcanic island arcs; divergence makes rift valleys and ocean ridges; transform motion leaves fault lines.
- **Sea level, coasts and oceans:** oceanic crust sits below a fixed sea level; continental shelves give beaches and coastlines; the start stays on dry land.
- **Taller streamed columns:** 96 m (384 cells at 25 cm) so ranges have real relief; runs use 16-bit ends; meshing is clipped to each chunk's occupied height; culling uses each chunk's estimated height range instead of the column budget.
- **Climate:** temperature from a seeded latitude axis and altitude lapse; prevailing winds in latitude bands; moisture picked up over sea and carried upwind-to-downwind on a cached coarse grid, rained out on windward slopes, leaving rain shadows behind ranges.
- **Biomes:** Whittaker-style lookup from temperature × moisture plus local overrides (sea, beach, wetland, alpine/snow): tundra, boreal forest, temperate forest, rainforest, grassland, savanna, desert, wetland, alpine. Biomes set surface material and tree density/shape, so forests are dense and grasslands open.
- **Barrier gameplay kept:** the seeded home massif and home gorge stay for the crossing loop; steep range cores classify as cliffs; random noise massifs are removed; random gorges follow rifts and transform faults. Sea hexes are impassable and never frontier.
- **Geology-led resources:** hexes record their tectonic setting; resource signs follow it (ore in collision ranges, volcanic minerals on arcs, evaporites in rifts/dry basins, timber in forests).

## Capabilities
### New Capabilities
- `world-geography`: plate-driven relief, sea level, climate, biomes and setting-driven resources for the streamed world.
### Modified Capabilities
None formally; `terrain-crossings` keeps its rules on the new terrain.

## Impact
World Lab only (`prototypes/labs/microvoxel-world/`, `prototypes/microvoxel-world.html`), tests, seed survey, offline cache and package tool. No persistence, globe/cube-sphere, hydrology routing, erosion simulation or terrain editing. All numbers are illustrative playtest defaults.
