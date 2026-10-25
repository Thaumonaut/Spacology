# Building Lab

Open `prototypes/building-lab.html` through `npm run serve`, or the **Building lab** entry in the playtest library. It generates one seeded building, inside and out, for the fantasy city generator. It is the single-building proof, not the city: every stage is a system that would run for every plot, not a stamped prefab.

URL parameters keep a building on reload: `?seed=6&type=inn&style=harbour&context=corner&view=corner&floors=2` (`floors` is how many storeys to show; leave it out to show the roof).

## Pipeline

Each stage outputs plain data that the next one reads. The plan can be checked as a flat drawing before anything turns 3D.

1. **Plot** (`plan.js`, `makePlot`).
   - Type: shop-house or workshop with the home over it, family home, or a 3-storey inn.
   - Street context: terrace (party walls both sides), corner plot or detached.
   - Frontage, storeys, and an optional upper-floor jetty over the street.
   - Depth is the sum of a front band, the 5 m stair bay and a back band, so rooms come out at sensible depths.
2. **Spine** (`makeSpine`). Real town houses are organised round a stair and a hall, not grown freely, so the spine comes first and stacks through every floor:
   - The stair sits against a wall with a 1 m hall lane beside it.
   - Narrow plots put the spine along one side wall (on a terrace, the party wall). Wide plots put it down the middle with rooms either side.
   - Each flight is 16 risers of 18.75 cm over 3 m. Three-storey buildings switch back on the far side of the lane.
3. **Bands** (`recipe`, `layoutFloor`). Each floor is three bands from the street:
   - **Front:** shop, workshop, living room, common room, or bedrooms upstairs.
   - **Middle:** beside the stair bay, holding baths, stores, studies and offices.
   - **Back:** kitchen-diner, or bedrooms upstairs.

   A band is one room wall to wall, or one room per row beside the spine. Middle rooms only become rooms that need light where their side wall can take a window; on a terrace they become stores and baths instead.
   - Mixed-use ground floors run the hall out to its own street door, so the home upstairs has an entrance beside the shop.
   - Rooms are always rectangles.
4. **Doors** (`placeDoors`). Doors grow outwards from the hall, cheapest first, so every room opens onto it. Leaf rooms (bedrooms, baths, stores, studies) are never walked through. Work pairs (kitchen and dining room, shop and store) may also share a door. The stair opens onto the hall at the foot of each flight and the head of the one arriving.
5. **Openings** (`placeOpenings`).
   - The home's front door; the business door at the end of its frontage, with the rest as shopfront; a back door from the kitchen.
   - Windows spaced along each outside wall, none on party walls.
   - Small windows for baths, stores and halls, and a balcony for an upper living room on the street.
6. **Choosing.** A few variants per floor (room proportions) are scored on room width, area, aspect and fill. Hard failures (an unreachable room, or a windowless room that needs light) are listed in the plan's notes. A floor plan takes about 2 ms.
7. **Voxel shell** (`voxels.js`), at 6.25 cm, i.e. 8 voxels per plan cell and 48 per storey.
   - Walls follow room edges: exterior walls 3 voxels thick, interior walls 2.
   - The exterior face carries the **style**: posts, floor beams, base course, half-timber braces, lattice. Posts and beams stand 1 voxel proud of the plaster.
   - Openings are cut and framed: glazing or shoji lattice, a noren, lanterns, a small tiled eave (hisashi) or an awning, a signboard, flower boxes, shutters, a balcony with brackets.
   - Stairs are solid flights with railings round the void.
   - The roof is a gable or hip height field per footprint rectangle, measured from the wall line. It sags a little between wall and ridge and its eaves flick up, more at the corners. Overlapping rectangles are unioned, so valleys form on their own.
   - Also: a chimney over the kitchen, a voxel bath tub, a cobbled street and a yard.
8. **Furniture** (`furnish`). Each room type has an ordered list of wants, placed into an occupancy map.
   - **Walking space.** Every piece reserves walking space in front of it, as do every door and the stair's foot and head. Footprints never overlap each other or that space.
   - **Walls and windows.** Backs go against solid wall, and tall pieces never go across a window.
   - **Tables** are placed with their chairs as one group, falling back to a smaller table when the room is tight.
   - **Anchors:** wall, corner, centre, beside the previous piece (bedside table, counter run), in front of it (coffee table), tucked (desk chair), on top (lamp, books, pot), wall shelf at 1.4 m, and rug under the group.
   - **Walkability.** A piece is kept only if every door of the room can still reach every other door on foot.
   - **Tub.** The bath tub is a voxel piece built in code, since the kit has none.

A **type** plus a **style** is a building. The four styles (lantern-street machiya, harbour white and blue, storybook half-timber, sky-temple lacquer) change materials, roof form and pitch, eave depth and curve, window treatment and street dressing. A district would choose the style.

## The kit

`tools/voxelize-kaykit.cjs` voxelises 36 CC0 pieces from KayKit Furniture Bits 1.0 and Restaurant Bits 1.0 (Kay Lousberg), vendored with their licences under `kits/kaykit/`.

- KayKit's units are chunky, not metres, so each piece is scaled to a stated real-world size.
- Colours are sampled from the pack's gradient atlas at each triangle's UV, then quantised into palette slots 128–255. Architecture owns 1–127.
- Closed interiors are filled, so a cutaway never shows a hollow shell.

To add a piece, vendor its `.gltf`/`.bin`, add a line to `PIECES` with its size and tags, rerun the tool, and use it in `WANTS`.

## Rendering

`renderer.js` greedy-meshes the volume into one segment per storey plus the roof. The floor buttons hide upper segments for a cutaway without remeshing. Lighting is banded toon light with a cool ambient, plus a 2048² sun shadow map (re-rendered when the cutaway changes) and depth-edge ink outlines.

One building is 4–20 M cells and 50–110 k quads. It meshes in about 0.3–0.6 s on the main thread (see `artifacts/building-generator/metrics.json`). That is fine for one building, but it is **not** the many-buildings path: a city needs instanced kit stamps, sparse bricks and distance LOD, ideally ray-marched (see the voxel discussion in the session that produced this lab).

## Limits

- One building per page, with no neighbours and no terrain slope. Party walls are plain because a neighbour would stand against them. Footprints are rectangles; wings, courtyards and back extensions are the next step.
- Interior doors are open frames, not leaves. Upper-floor fireplaces, attics and basements are not generated.
- Four types and four styles. Room rules are hand-tuned for these; a new type needs its program, extras and furniture wants.
- Furniture comes from a modern-cosy pack. A fantasy kit (barrels, hearths, looms, alchemy benches) would slot into the same `WANTS` rules.

## Tests

- `node tests/unit/building-plan.cjs` covers 180 buildings (4 types × 3 plot contexts × 15 seeds). It checks full coverage, rectangular rooms, every room reachable from the hall through legal doors, leaf rooms never walked through, lit rooms, no openings in party walls, a separate home door on mixed-use buildings, the stacked stair opening onto the hall, and determinism. It prints a sample plan.
- `node tests/unit/building-voxels.cjs` checks the kit decode and the palette. Across 7 buildings it checks that doors are open, windows are glazed, roofs cover the top floor, stairs climb exactly a storey, furniture sits in its own room with walkable doors, and output is deterministic. It also checks the mesher.
- `npm test -- browser/building-lab` builds four styled buildings headlessly and checks for page errors. It saves views and plans to `artifacts/building-generator/`. Set `SPACOLOGY_BUILDING_SHOTS=0` to skip writing them.
