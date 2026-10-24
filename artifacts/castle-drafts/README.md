# Castle drafts

Standalone castle design page: `prototypes/labs/castle-drafts/` (open `/prototypes/labs/castle-drafts/?seed=1`).
CastleGen outputs simple parts (boxes, towers, cones, domes, gables, bridge bays, the crag), the same shapes the world
generator will later voxelize; CastleRender draws them with a soft anime cel look for fast iteration.

| File | What to look at |
| --- | --- |
| v1-seed1 | First pass: crag too wide and low, castle flat |
| v2-seed1 | Taller sheer crag, castle stacked in tiers up to a spired keep (~400 m across, ~500 m tall) |
| v2-grid | Seeds 1-9 side by side (grid mode, shores hidden) |
| v3-island / v3-hill / v3-cliff | Seed 4 in each seat: a big wooded island around the crag; a mainland hill castle (~540 m); a gorge crag with a high viaduct to the mainland cliff |

## Interiors and Walk (v4)

Press **Walk** on the page (WASD, mouse look after clicking the view, Shift run, Space jump, F fly, Esc exit).
Buildings are hollow: halls and the keep have storeys, doors, windows and stairwell ramps; the keep's ground floor is a
columned grand hall; wall towers have spiral stairs to the wall-walk with doors onto it and into the courtyard; walls
have gate openings; ramps climb from tier to tier along the terrace faces; island gate towers climb the cliff inside.
Collision is the castle mesh itself (rays against a grid of triangles), so whatever is drawn is solid.

| File | What to look at |
| --- | --- |
| walk-island-0-spawn | Walk start on the island bridge, castle ahead |
| walk-hill-1-walked | After running 12 s up the (now conical, ~20-25 degree) hill to the outer wall |
| walk-hill-2-keep | Inside the keep's grand hall: columns, lit windows, the stairwell ramp |
| walk-hill-3-tower | Top of a wall tower's spiral stair, at the wall-walk (climb verified 170 -> 202 m) |

## Layouts (v5)

| File | What to look at |
| --- | --- |
| v5-spur | Spur: a chain of walled baileys stepping up a long ridge to a square donjon with hanging turrets and a spire tower |
| v5-palace | Palace: domed main block, wings and pavilions on an upper terrace, grand stair, gardens, outer ring wall |
| v5-cluster | Cluster: a tight pile of halls of many heights on a narrow crag, turrets, one tallest tower |

## City (v6)

Mode **city**: a seeded walled city (~1.7 km, ~2,000 buildings): central plaza with fountain and statue, radial avenues to
gatehouses, ring streets and lanes, a river in a walled channel with arched bridges and water gates, a castle on its hill,
and a cathedral on the plaza. Every building is a random type for its district (house, shop, inn, smithy, warehouse,
chapel, tower house, guildhall, market hall, bathhouse, barracks) with plaster and roof colours of its own.
Buildings stream in 160 m tiles: tiles around the walker get full interiors (rooms with partitions, storeys and stairs,
furniture by type: tables and hearths, beds, shop counters and shelves, inn bar and tables, forge and anvil, crates,
pews and altar, columns); the rest draw as closed shells.

| File | What to look at |
| --- | --- |
| city2-0-overview / city2-1-low | Seed 2 from outside the walls and low over the roofs |
| city2-3-cathedral | Cathedral nave: columns, pews, altar |
| city2-3-inn / -shop / -house / -smithy / -market | Interiors by type (Walk placed inside each) |

## City life (v8)

| File | What to look at |
| --- | --- |
| v8-city2-1-low | Seed 2 low over the roofs: ~3,000 buildings, back-lot clusters on alleys, castle on its hill with its road |
| v8-city2-2-plaza | Walk start on the plaza: cobbles, Tudor timber framing, oil lanterns, market stalls, the guildhall arcade |

Hero buildings always spawn on the plaza (cathedral opposite the castle, guildhall with arcade and clock tower, grand
market hall). Secondary plazas with fountains sit where some avenues cross ring streets; 2-4 parks have ponds, trees,
gravel paths and benches; stalls line the avenues near the plaza; lanterns every 26 m along avenues and rings. A slum
sector against the wall is shacks in tight clusters. Surface patterns (timber framing, roof tiles, cobbles, stone
courses, plaster grime, planks, grass) are drawn by the shader and fade out with distance.

## Doors, culling and people (v9)

| File | What to look at |
| --- | --- |
| v9-city2-plaza | Townsfolk on the plaza and streets for scale; the stats line (meshes drawn, triangles, shadow triangles) |
| v9-city2-*-door | A closed building: painted windows and a door panel; E opens it (interior loads, shell leaves its tile) |

Plaza in Walk: 123 of 378 tile meshes drawn after frustum culling, 196k triangles (+250k in the shadow pass). Overview:
340 of 378, 404k. Interiors are no longer built for whole tiles: only for buildings whose door was opened, unloaded at
80 m. Props (stalls, lanterns, people, park trees) draw within ~380 m. Walk 4.2 m/s, run 8.5 m/s, with a head bob.

## Terrain and river (v10)

| File | What to look at |
| --- | --- |
| v10-hilly | Seed 2, hilly: the walls and roofs follow the ground; the river leaves through a water gate between stone quays |
| v10h-1-low | Low over a hilly city: the castle hill with its road, streets laid on the slopes |

Terrain: flat, rolling (~10 m relief) or hilly (~25 m). The river sits in a valley that eases down to quays at 4.5 m
(water at 0); plazas, ponds and a level castle are flattened into the ground. Buildings stand on their highest corner
with a plinth to the lowest (up to ~6 m on hilly ground). Interiors are parked (?interiors=1 re-enables doors).

## Layout feel (v11)

| File | What to look at |
| --- | --- |
| v11-2-plaza | A human-scale plaza (~130 m) framed by 4-5 storey terraced houses, stalls, lanterns, people |
| v11-1-low | ~4,000 buildings: terraced inner streets, taller toward the centre, chimneys, hipped and gable-front roofs, bending avenues and wobbling rings |

## Cathedral and street plan (v12)

| File | What to look at |
| --- | --- |
| v12-cathedral-front | West front from the plaza: spire-crowned piers, five pointed portals, tall windows, rose window, stepped gable with spirelets, statues |
| v12-cathedral-three-quarter | Nave over aisles with flying buttresses and pinnacles, transept, crossing spire with gilded statue, the through road and stalls |

Streets are no longer a uniform hub: one main road runs gate to gate through the plaza, one road leads to the castle,
2-3 short streets reach the first ring, and ring bands have their own staggered connectors. Only the 2-3 avenue
crossings nearest the plaza get bridges, each square to the river; other streets stop at the quay.

## Crossings and castle scale (v13)

| File | What to look at |
| --- | --- |
| v13-city2 | Top-down: the main road bridges the river square to it; the castle (~360 m, palace layout) dwarfs the cathedral |
| v13-city6 | Oblique: main road gate to gate across the river bridge; castle grounds ~520 m |

## Linked castles and moat rivers (v14-v15)

| File | What to look at |
| --- | --- |
| v14-linked-* | Linked castles: satellite crags with keeps and spire towers joined to the ring castle by high viaducts |
| v15-moat3 / v15-moat6 | Moat cities: the river sweeps round two thirds of the walls; gate roads bridge it |

## Street-level town (v16)

| File | What to look at |
| --- | --- |
| v16-shop | Market street: jettied half-timbered storeys over stone ground floors, steep roofs, shutters and flower boxes, awnings, stalls, kerbs |
| v16-lane | Residential street: dormers, chimneys, door steps and wall lanterns, raised footways |
| v16-inn | Inn frontage: striped awnings, crates and barrels, hanging signs |
| v16-plaza | Plaza from the walker: guildhall arcade, tiered fountain off-frame, the castle hill without floating trees |

Detailed buildings only build for the 3x3 tiles round the walker (or the view when zoomed in); farther tiles keep simple
shells. Street views run 330k-750k triangles (+600-850k in the shadow pass) under SwiftShader; next step for speed is
instancing the window/shutter/flower pieces.

## Anime pass (v17)

| File | What to look at |
| --- | --- |
| v17-shop / v17-lane / v17-inn / v17-plaza | Golden-hour light, ink outlines, real timber frames, eaves and barge boards, mullioned windows with sills, shutters and trailing flower boxes, quoins, arched doors, potted plants, ivy, bays, balconies, corner turrets |

Cost at street level: 0.4-1.25M triangles (+0.85-1.4M shadow). Too heavy for phones; the fix is instancing the repeated
pieces (window, shutter, flower box, beam, pot) and dropping detail pieces from the shadow pass beyond ~60 m.

## Small voxels (v18)

| File | What to look at |
| --- | --- |
| v18-shop / v18-lane / v18-inn / v18-plaza | Buildings and props near the walker as 25 cm voxel models (each in its own rotated grid), greedy-meshed; per-voxel texture in the shader (tone, stone courses, roof tile rows, plank grain, plaster grime, faint voxel edges) |

Cost: ~2.8k triangles per building (fewer than the mesh version), ~11 ms per building to voxelise and mesh on the main
thread, so a 3x3 tile ring takes a few seconds the first time. Next: a Web Worker for voxelising, then the castle in
chunked voxels. Voxel size selector: 12.5 / 25 / 50 cm or off.

## Fixes (v19)

| File | What to look at |
| --- | --- |
| v19-market | Market halls: an arched stone arcade on the street half with stalls and crates, a walled storehouse with cart doors behind (no more stilts) |
| v19-park | Park and boulevard trees grown by the voxel world's own tree generator (oak, birch, alder, spruce, gnarled, willow) |

Bridges: decks are flush with the quays and gates are cut wherever a road meets the wall; a walker test crosses every
bridge on seeds 2, 3, 6 and 7 (was blocked by a 1.3 m step and by walls where re-routed roads met them). The panel folds
away (H, the X, or entering Walk) to a small button. Houses on sloping ground get a cellar door in the plinth; others
sometimes a slanted cellar hatch.

## 6.25 cm ray-marched voxels (v20)

| File | What to look at |
| --- | --- |
| v20-shop / v20-lane | Buildings within 95 m ray-marched at 6.25 cm: smooth-stepped roofs, fine frames, sills, flowers |
| v20-close | Close up: the arched door top and leaves at 6.25 cm |

Each building is a sparse model: a 25 cm coarse grid (empty / solid / brick) with 4x4x4 bricks of 6.25 cm voxels only
where the surface passes; big walls snap to the coarse grid so only sloped roofs, round parts and detail need bricks.
Drawn as one box each; the fragment shader steps coarse cells then brick voxels and shades with the shared lighting
(shadows via a coarse-only march in the shadow pass). A pool of workers voxelises (~0.3 s per building) and models swap
in when ready. Street views: ~0.32M triangles (was 1.25M at 25 cm meshes), 30 ray models, ~120 MB of voxel textures.
