## Context
The streamed world (`micro-wilds-2`) regenerates every column from `(seed, x, z)`; nothing is stored. Any new geography must stay a pure, local function so chunks, the worker, the atlas and every co-op peer agree without sending terrain.

## Decisions
### Plates without a global simulation
Plate sites sit on a 640 m grid jittered by hash. A point looks at the 3×3 neighbouring sites, takes the nearest two, and gets its plate, the neighbour plate and an approximate boundary distance `(d2 − d1)/2`. Each plate has a hashed crust type (continental ≈ 60%; the plate under the start is forced continental) and a drift vector. Boundary normal `n` points from plate to neighbour; convergence `c = (v_own − v_nbr)·n`, shear `s` the tangential part.

| Boundary | Rule | Relief |
|---|---|---|
| Continent–continent, `c > 0` | collision | Ridged range up to ~75 m above sea within ~140 m of the boundary, foothills beyond |
| Ocean→continent, `c > 0` | subduction | Coastal range on the continental side, trench on the oceanic side |
| Ocean–ocean, `c > 0` | arc | Scattered volcanic islands along the boundary |
| `c < 0` | divergence | Rift valley on land (−6 m, gorges allowed), ridge under sea |
| `|s|` dominant | transform | Fault line; gorges allowed |

Crust blends across a 120 m shelf at continent/ocean boundaries, giving coasts. Large-scale fBm and domain warp break up straight Voronoi edges. A start bias keeps the first 60 m around the origin at least 3 m above sea.

### Height budget and cost
`heightCells` becomes 384 (25 cm) / 768 (12.5 cm) for the streamed world only; sea level 14 m; ground capped below the top to leave tree headroom. Column runs move to `Uint16` ends when `heightCells > 255` (finite chunks keep `Uint8`, byte-identical). `meshChunk` scans the runs for the chunk's top occupied cell and allocates the dense halo only up to that (+1), so flat lowland chunks cost the same as today. The renderer culls with a per-chunk height range (coarse 5×5 ground samples plus tree headroom, cached) instead of the full column budget, and ground picking starts from that range.

### Climate on a cached coarse grid
Climate is evaluated on a 32 m grid and bilinearly interpolated; each grid value is cached in a bounded map (pure function, so caches never disagree).
- Latitude axis: seeded angle; latitude offset seeded so the start is temperate-ish but seeds differ (cold, temperate, warm).
- Temperature `T = base(lat) + broad noise − lapse × (elevation − sea)`; lapse exaggerated so high peaks reach alpine/snow.
- Wind: prevailing direction alternates by 2.5 km latitude band (westerlies/easterlies) with a seeded twist.
- Moisture: march 10 steps of 48 m upwind. Over sea moisture recharges to 1; over land it decays slowly, and each rise in elevation along the path rains out a share (`windward` precipitation boost); descending leaves a rain shadow. Rivers and wet corridors add local moisture.

### Biomes and vegetation
Lookup by `(T, moisture)` with overrides: below sea → sea; within 3 m of sea level near coast → beach; wet low ground → wetland; high and cold → alpine/snow. Each biome gives surface/sub-surface materials (new `snow`, `needle`, `dry` grass materials; palette grows to 24 entries) and tree density (forest ~0.85 of grid cells, grassland ~0.08, desert 0), crown shape (round broadleaf vs narrow conifer) and size.

### Barriers and the crossing loop
The home massif and home gorge remain so every seed keeps an early crossing decision. Noise massifs are removed. Random gorges are limited to rift and transform zones. Steep range cores (2.5 m steps across the hex) classify as cliffs through the existing walkable-share rule. A new terrain kind `sea` is impassable, not scoutable and never frontier.

### Settings and resources
`geography` returns `setting` (`collision`, `subduction`, `arc`, `rift`, `transform`, `craton`, `shelf`, `ocean`) and `biome`. Hex summaries carry dominant biome and setting; resource sign kinds follow setting/biome. Yields and the identify/claim loop are unchanged.

## Risks / Trade-offs
- Taller columns raise worst-case meshing cost in mountain chunks; y-clipping keeps lowland cost flat. Measured in the streaming tests and the 12.5 cm drag test.
- Coarse climate grid can show 32 m interpolation; acceptable at strategy scale.
- Voronoi plates are a stylised model, not geophysics.
- Some seeds may start far from any coast or range; the seed survey reports nearest sea, range and biome mix.
