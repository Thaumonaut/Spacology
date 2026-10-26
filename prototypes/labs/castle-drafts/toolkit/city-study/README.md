# Fantasy capital and plan review

Open `toolkit/city-study/`. This finite exterior prototype shares the townhouse mesh builder. Enterable interiors and the infinite streamer remain separate prototypes.

## Streets and density

Main avenues, the central bazaar, river/canal crossings, quays and landmark access are reserved **before** neighbourhood cells and housing plots. Secondary roads follow the original cell edges. The renderer, classifier and collision audit use the same clipped road polygons, including every fragment where a road passes around an estate.

A home requires at least **90 m² of plot area, 7 m minimum plot width, 48 m² of ground-floor area**, and a **4.8 × 7.2 m furnishing core separate from the stair** across its floors. Area alone cannot qualify a narrow strip. Irregular Voronoi plots are distinct from building envelopes. Acute plots receive street-aligned quadrilateral envelopes; broad quadrilateral and chamfered outlines are retained. Three-sided main floors and annexes are rejected. Corner tails merge with neighbours into L-shaped or offset-wing houses. Attached wings absorb further remnants; appropriately sized workshops occupy remaining service plots.

The default seed has 797 homes, 115 attached wings and 65 small workshops/storage buildings. **about 5% of buildable plot area remains unoccupied**; roads, water and planned public spaces are accounted for separately. The largest preset has about 2,080 homes and around 4.7% unused buildable plot area. Counts vary by seed. The small presets retain enough physical space for their street infrastructure.

Local streets are 3.6 m wide and main routes are 6.5–10 m wide. The central bazaar has 44 stalls, a fountain, clear avenues and level paving. Five districts vary heights, roof profiles and palettes. The royal castle reuses the earlier `CastleGen` rings/city mockup and its mesh parts, preserving the concentric terraced fortifications. Other landmarks are secondary district buildings.

## Building geometry

L-shaped and offset cross-wing forms retain their return wings on upper floors. Their roof assemblies use a clipped upper envelope: joined sections own each surface rather than stacking intersecting roofs. City roofs have nominal 20 cm thickness and 48 cm eaves, clipped where private side clearance is needed. Chimneys choose positions on an actual roof patch.

Sky bridges attach to 2.2 m wide balcony landings, with matching upper doors, side rails and supports. The upper-door cutout now uses that door’s coordinates; far and near facades both retain it. River/canal bridges share deck heights and ramps with the walking surface.

## Reviewing the result

**Plan review** distinguishes dashed plot outlines from solid building footprints, and shows exact main/local road polygons, home and workshop footprints, the bazaar, leftover areas and the occupancy audit. Click a home to inspect its furnishing core, stairs and sample furniture. The panel can focus the frontage or balcony connection and export the plan as SVG. The audit checks minimum rooms, building/road overlaps, house overlaps, workshop conflicts, balcony doors and unused-plot percentage.

**Visit** focuses a district, landmark or the central bazaar. **Walk streets** starts there; WASD moves, click captures the mouse, and Escape releases it. Walking starts clear of the fountain. Every walking entry point checks collision and relocates a blocked start to nearby clear ground. Doors are static in this exterior preview.

## Rendering and verification

Far houses are batched by material/district and retain facade details. Nearby chunks replace them lazily. Detailed stones render near the camera; indexed terrain and continuous paving share the planned geometry. Static shadows and idle rendering avoid repeated work. Batched vertex colours are retained for the reused castle.

`npm test -- district-city city-scale-lod circular-city-study dense-city-study townhouse-shape-study townhouse-plots townhouse-whimsy townhouse-trim room-roof-field city-neighborhoods`

Pure checks exercise multiple seeds, density, minimum usable plots, attached wings, road collision detection and connected balcony doors. Headless browser checks cover plan review, core inspection, the capital and metropolis, walking, LOD, regeneration and legacy baselines. `?topology=rings&rings=3` retains the earlier ring-road baseline; `?layout=grid` retains the older dense grid.

Quaternius CC0 roof textures and Three.js MIT code retain source/license records in `../room-compare/assets/SOURCES.md` and `../room-compare/vendor/three/`.

## Outdoor frontage

`frontage-plan.js` fits covered work bays inside a home's plot, beside a street-facing wall. The default capital has 206 bays: small forge and carpenter stations, net-mending benches, weaving racks, booksellers, apothecaries and potting tables. Their bench and post collision shapes are planned with the geometry. Placement excludes carriageways, existing buildings and 1.8 m door approaches.

Nearby facade dressing is enabled by default, adding timber detail, planted windows, greenery and lanterns within the existing bounded near-detail cache. The small service buildings now have actual street-facing open bays, visible work benches and wall collision segments, rather than opaque door decals on blank sheds. Their interior ground remains the sampled outdoor terrain.

**Visit → Outdoor workshops → Walk streets** starts near an example frontage. Plan review displays the covered-bay footprints and includes their access checks in the audit. The street-life checkbox includes the frontage additions.
