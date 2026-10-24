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
