# Building Lab

Open `prototypes/building-lab.html` through `npm run serve`, or the **Building lab** entry in the playtest library. It generates one seeded building, inside and out, for the fantasy city generator. It is the single-building proof, not the city: every stage is a system that would run for every plot, not a stamped prefab.

URL parameters keep a building on reload: `?seed=6&type=inn&style=harbour&context=corner&typology=courtyard&view=corner&floors=2` (`floors` is how many storeys to show; leave it out to show the roof).

## Pipeline

Each stage outputs plain data that the next one reads. The plan can be checked as a flat drawing before anything turns 3D.

1. **Plot** (`plan.js`, `makePlot`).
   - Type: shop-house or workshop with the home over it, family home, or inn.
   - Street context: terrace (party walls both sides), corner plot or detached.
   - Frontage and storeys, plus an optional upper-floor jetty over the street.
2. **Typology** (`chooseTypology`, `BUILD`). Real houses follow a handful of plans that put circulation first; each typology is one. They are chosen per building, weighted by type, plot width and street context:
   - **Side passage:** a passage along one side wall with a straight stair in it, and rooms in a row beside it. The stair sits at the front, middle or back and rises either way. Front and back rooms may run the full width.
   - **Side passage with rear wing:** an L-shaped footprint. The passage ends in a rear wing (kitchen and scullery, sometimes a room above), with a yard beside it.
   - **Central hall:** a hall down the middle with a straight stair, and rooms either side.
   - **Stair hall:** a 2 m entrance hall leading to a U-turn stair at the back. Inns put the common room across the front.
   - **Cross passage:** a passage across the house. Rooms sit side by side along the street and at the back, with a U-turn stair behind a small lobby. Terraces enter by a front lobby; corner and detached plots may use a side-street door.
   - **Cottage:** no ground-floor hall. The front door opens into the living room, which holds the stair; on wide plots a dining room opens off it.
   - **Courtyard:** a U around a courtyard. Galleries run along the outer walls, so every room looks onto the courtyard and party walls do not matter. A stair tower stands in a courtyard corner.

   Every typology keeps the same rules:
   - Rooms are rectangles (circulation rooms may bend).
   - Every room opens off circulation, and leaf rooms (bedrooms, baths, stores, studies) are never walked through.
   - The stair stacks through every floor and opens onto circulation at its foot and head.
   - Mixed-use buildings give the home its own street door.
3. **Stairs** (`stairBay`). *Straight* stairs are one 2×6-cell flight of 16 risers (18.75 cm), for 2 storeys. *U-turn* stairs are a 4×5-cell bay: 8 risers up, a half landing, then 8 back. They stack for any number of storeys, and you enter and arrive side by side.
   **Room programs** (`program`) say what goes on each floor; '?' rooms are dropped when they do not fit. Room splitting is light-aware: rooms that need a window take the slots that can have one, and a dark slot (the middle of a terraced row) becomes a store or bath. On narrow cross-passage plots, rooms that do not fit behind the passage move to the front, though the bath stays at the back.
4. **Doors** (`placeDoors`). Doors grow outwards from the hall, cheapest first, so every room opens onto it. Leaf rooms (bedrooms, baths, stores, studies) are never walked through. Work pairs (kitchen and dining room, shop and store) may also share a door. The stair opens onto the hall at the foot of each flight and the head of the one arriving.
5. **Openings** (`placeOpenings`).
   - The home's front door; the business door at the end of its frontage, with the rest as shopfront; a back door from the kitchen.
   - Windows spaced along each outside wall, none on party walls.
   - Small windows for baths, stores and halls, and a balcony for an upper living room on the street.
6. **Choosing.** Ten variants of the chosen typology are built. Variants differ in band depths, stair position and direction, which rooms run full width, and room proportions. Each is scored on room width, area, aspect and hall size. Hard failures (an unreachable, windowless or misshapen room) are listed in the plan's notes. A whole plan takes 1–2 ms.
6b. **Look** (`sampleLook`). Each style is a distribution, and each building samples its own `plan.facade` and `plan.roof`. A street shares a look without every house being the same.
   - **Facade:** wall hue, timber, and a trim chosen to contrast with the wall; the base course (stone or brick); the timber pattern (posts, grid, braced, cross or none); ground and upper window shapes (rect, tall, arched, paired); glazing (lattice, mullion, small panes); shutters and their colour; flower boxes; door canopy; oriel windows.
   - **Roof:** form (gable, hip, half-hip, gambrel), ridge along the street or gable to it, pitch, eave depth, eave curve, tile; a street-facing cross gable; dormers; a corner turret.
   - **Window grid:** `plan.facade.bays` holds each wall's window-grid phase. Windows, timber posts, braces, jetty brackets and dormers all snap to it, so they line up.
   - **Shape constraints:** the turret only stands on a free corner, and never where a door is. A forced look (`generate(seed, {look: {facade, roof}})`) overrides any sampled part; tests and contact sheets use it.

7. **Voxel shell** (`voxels.js`), at 6.25 cm, i.e. 8 voxels per plan cell and 48 per storey.
   - Walls follow room edges: exterior walls 3 voxels thick, interior walls 2.
   - The exterior face carries the **style**: posts, floor beams, base course, half-timber braces, lattice. Posts and beams stand 1 voxel proud of the plaster.
   - Openings are cut and framed: glazing or shoji lattice, a noren, lanterns, a small tiled eave (hisashi) or an awning, a signboard, flower boxes, shutters, a balcony with brackets.
   - Stairs are solid flights and landings built from the plan's flight list, with railings round every void except where the stair opens onto the hall.
   - **Roofs, one per level.** Each storey's footprint with nothing built above it gets a roof at that storey's height. The main roof is a gable or hip height field per rectangle, measured from the wall line; it sags a little between wall and ridge, its eaves flick up (more at the corners), and overlapping rectangles form valleys on their own. A lower part against a taller block (a rear wing) gets a lean-to; a small free-standing part (a stair tower) gets a hipped cap.
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

- One building per page, with no neighbours and no terrain slope. Party walls are plain because a neighbour would stand against them. Footprints are rectangles, Ls and Us; no curved or angled walls.
- Interior doors are open frames, not leaves. Upper-floor fireplaces, attics and basements are not generated.
- Four types and four styles. Room rules are hand-tuned for these; a new type needs its program, extras and furniture wants.
- Furniture comes from a modern-cosy pack. A fantasy kit (barrels, hearths, looms, alchemy benches) would slot into the same `WANTS` rules.

## Tests

- `node tests/unit/building-plan.cjs` covers over 300 buildings: every type and plot context over 12 seeds, plus every typology forced on every type and plot. It also checks that no typology dominates free choice. Each building is checked for full coverage, rectangular rooms, every room reachable from where you arrive through legal doors, leaf rooms never walked through, lit rooms, no openings in party walls, a separate home door on mixed-use buildings, a stair opening onto circulation on every floor, and determinism. It prints sample plans.
- `node tests/unit/building-voxels.cjs` checks the kit decode and the palette. Across 7 buildings it checks that doors are open, windows are glazed, roofs cover the top floor, stairs climb exactly a storey, furniture sits in its own room with walkable doors, and output is deterministic. It also checks the mesher.
- `npm test -- browser/building-lab` builds one building of every typology headlessly and checks for page errors. It saves the following to `artifacts/building-generator/`:
  - views, cutaways and plans for each typology;
  - close-ups (door, eave, roof corner);
  - plan contact sheets (16 seeds per type);
  - street facade sheets (8 seeds per style);
  - a massing sheet with every roof form and silhouette feature. Set `SPACOLOGY_BUILDING_SHOTS=0` to skip writing them.
