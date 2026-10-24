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
