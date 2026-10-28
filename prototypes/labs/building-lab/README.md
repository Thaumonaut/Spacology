# Building Lab

Open `prototypes/building-lab.html` through `npm run serve`, or the **Building lab** entry in the playtest library. It generates one seeded building, inside and out, for the fantasy city generator. It is the single-building proof, not the city: every stage is a system that would run for every plot, not a stamped prefab.

URL parameters keep a building on reload: `?seed=6&type=inn&style=harbour&context=corner&typology=courtyard&view=corner&floors=2` (`floors` is how many storeys to show; leave it out to show the roof).

## Pipeline

### Human-scale inspection and corridor clearance

**Walk through building** uses the existing voxel renderer at a 70° vertical field of view, a 1.60 m eye height and a 1.75 m tall / 0.50 m wide body. WASD or arrows move at 1.5 m/s; Shift slows down. Drag to look, or explicitly enable Mouse look; Escape/Exit walk restores the orbit camera and cutaway. On-screen directional buttons support touch. Starts are the resident/business street approach, or an explicitly labelled shown-floor inspection spawn. The latter is not evidence that stairs connect.

Collision sweeps in sub-voxel increments against the actual furnished volume, allowing 0.25 m steps but not flight, wall clipping or stepping off large drops. It checks the current support elevation, not a terrain-style highest-surface map, so stacked rooms stay distinct. Recorded back-door leaves are held open in an isolated inspection copy and rendered open; exiting restores the original volume. Roof/all storeys remain visible during walking. Rebuild exits inspection and discards stale collision data.

Hallways and stair flights reserve **four 0.5 m planning cells (2 m nominal)**, without scaling furniture. Door openings reserve **three cells (1.5 m nominal)**, three-quarters of their previous width; resident entry alcoves keep the full hall width. Finished walls and trim reduce usable clearance. Architect Review defaults to **1.20 m minimum clear hall width**, editable separately from the person radius. This is a design parameter, not a building-code compliance claim. It tests a full-width body envelope through each connected hall component, its bottlenecks and branches against finished walls/trim/furniture. Door thresholds and stair flights retain separate body-clearance tests. End-cap/edge coverage has a sampling tolerance; this is not an exact continuous-width proof. Width failures are hard findings with floor-plan markers. A connected 0.50 m person journey is not a hallway-quality pass; passing the default check does not certify 2 m of unobstructed clearance everywhere.

Each stage outputs plain data that the next one reads. The plan can be checked as a flat drawing before anything turns 3D.

1. **Plot** (`plan.js`, `makePlot`).
   - Type: shop-house or workshop with the home over it, family home, or inn.
   - Street context: terrace (party walls both sides), corner plot or detached.
   - Frontage and storeys, plus an optional upper-floor jetty over the street.
   - Occupied ground-floor depth has a frontage-based budget: 1.4× for homes, 1.85× for shop-houses, 1.75× for workshops and 1.5× for inns, with a 13 m minimum allowance for usable stairs and rooms. Rear wings and ground-floor lot extensions share that allowance; a deep property keeps yard space rather than automatically stretching the building. Upper-floor projections remain separate. Rear-wing plans need at least 10 m frontage; narrow plots use other typologies. An explicitly requested exterior stair tower can increase the allowance to fit its stair/landing module; automatically chosen towers use an internal stair instead when they would force excessive depth.
2. **Typology** (`chooseTypology`, `BUILD`). Real houses follow a handful of plans that put circulation first; each typology is one. They are chosen per building, weighted by type, plot width and street context:
   - **Side passage:** a passage along one side wall with a straight stair in it, and rooms in a row beside it. The stair sits at the front, middle or back and rises either way. Front and back rooms may run the full width.
   - **Side passage with rear wing:** an L-shaped footprint. The passage ends in a rear wing (kitchen and scullery, sometimes a room above), with a yard beside it.
   - **Central hall:** a 2 m hall from the front door to a straight stair in the middle, with rooms either side. The hall stops one landing past the stair: behind it the back rooms run the full width (one room, or two meeting at the hall's end). Beside the stair, the hall is only open in front of it and behind it, so that side holds at most two rooms. When the stair has to stand far back (behind a shop), the upper floors put a full-width front room across the street instead of a long hall.
   - **Stair hall:** a 2 m entrance hall leading to a U-turn stair at the back. Inns put the common room across the front.
   - **Cross passage:** a passage across the house. Rooms sit side by side along the street and at the back, with a U-turn stair behind a small lobby. Terraces enter by a front lobby; corner and detached plots may use a side-street door.
   - **Cottage:** no ground-floor hall. The front door opens into the living room, which holds the stair; on wide plots a dining room opens off it.
   - **Courtyard:** a U around a courtyard. Galleries run along the outer walls, so every room looks onto the courtyard and party walls do not matter. A stair tower stands in a courtyard corner.

   Every typology keeps the same rules:
   - Rooms are rectangles (circulation rooms may bend).
   - Bedrooms and baths are not through-routes. Bedrooms open off private circulation, with only a bath/closet permitted as an additional direct connection; storage may carry service circulation.
   - The stair stacks through every floor and opens onto circulation at its foot and head.
   - Shop-houses and workshops reserve a separate resident street arrival. Where circulation permits, its door sits in a covered 0.5–1 m recess while the business entrance stays on the shopfront. The recess removes real ground-floor cells, preserves the upper storey, and keeps a paved, ungated approach clear of shop windows/shutters and doorstep pots. Stairs and hall connectivity take priority over recess depth. Customer, employee and resident access is role-filtered; a private connecting door is not the home's only entrance.
3. **Stairs** (`STAIRS`, `stairBay`, `chooseStair`). Each kind is a spec in local cells (flights, landings, entry and arrival), placed with an origin and orientation:
   - **Straight:** one 4×6-cell flight of 16 risers (18.75 cm).
   - **Straight with a landing:** two flights with an intermediate landing.
   - **U-turn (dogleg):** up one lane, a half landing, back down the other.
   - **C-shaped:** three flights round two corner landings.
   - **Spiral:** wedge treads make one full turn round a post, with aligned doorway approaches and full-width landings on both floors.
   - **L-shaped:** two flights at a right angle.

   U-turn, C-shaped and spiral stairs arrive on the edge they are entered from, so they stack through any number of storeys; the others are for two storeys. Any kind can stand in an **exterior tower** on the back wall (a bump-out): a landing strip open to the hall, with the stair behind it. The L-shaped stair only stands in a tower, which gives its side arrival a landing.

   The stair is chosen once per building, weighted by what the typology can hold, so scoring never favours one kind.
   **Room programs** (`program`) say what goes on each floor; '?' rooms are dropped when they do not fit. Room splitting is light-aware: rooms that need a window take the slots that can have one, and a dark slot (the middle of a terraced row) becomes a store or bath. On narrow cross-passage plots, rooms that do not fit behind the passage move to the front, though the bath stays at the back.
4. **Doors** (`placeDoors`). Doors grow outwards from the hall through permitted room pairs. Mixed-use buildings also connect the resident-only graph, reusing existing private doors where possible: reaching a pantry through the shop does not count as a domestic route. Bedrooms and baths remain endpoints for unrelated journeys. Shop/workshop rooms sharing a usable wall receive a service door. The stair opens onto circulation at its foot and arrival. Optional business extensions without an employee route from the main business are left as yard, not retained as inaccessible stockrooms.
5. **Openings** (`placeOpenings`).
   - The home's front door; the business door at the end of its frontage, with the rest as shopfront; a usable garden exit where the kitchen or rear hall meets the yard. Open panelled street doors into halls swing over the exterior step rather than across the inside hall.
   - Exterior access is allocated by circulation function, not one extra door per business room. A room/hall with a front entrance does not also get a side entrance. Staff doors are retained only when needed for employee access or resupply; connected workshops/stockrooms share access. Removing redundant openings restores wall/window space rather than just spacing the doors apart.
   - Windows spaced along each outside wall, none on party walls.
   - Small windows for baths, stores and halls, and a balcony for an upper living room on the street.
6. **Choosing.** Ten variants of the chosen typology are built, extending the search to 100 when no feasible candidate exists. Variants differ in band depths, stair position and direction, which rooms run full width, and room proportions. Hard constraints take priority over aesthetic scores: private arrival, staff resupply access, reachable/lit rooms and minimum dimensions. Bathrooms have a 5.25–10.5 m² programme budget and must be smaller than the household kitchen, including upstairs bathrooms. Excess area expands adjacent rooms or becomes accessible domestic utility/storage space; circulation may bend inside an otherwise rectangular extension. Candidates that cannot meet the bathroom budget or retain their primary entrance are rejected, not merely warned about. Other unresolved hard failures still leave the best retained candidate reviewable, not silently certified.
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
   - **Roofs, one per level.** Each storey's footprint with nothing built above it gets a roof at that storey's height. The main roof is a gable or hip height field per rectangle, measured from the wall line; it sags a little between wall and ridge, its eaves flick up (more at the corners), and overlapping rectangles form valleys on their own. Roof rise is budgeted to **65% of the wall height below that level**, including curved corners and ridge trim. Over-wide roofs reduce their effective pitch instead of growing taller than the occupied building or being sliced off at the ridge; smaller roofs keep their sampled pitch, and gambrels keep their two-slope profile. Dormers and narrow turret/spire accents remain separate features. A lower part against a taller block (a rear wing) gets a lean-to; a small free-standing part (a stair tower) gets a hipped cap. Lower roofs cannot overwrite the upper footprint. A finished ceiling closes the top-storey rooms below the roof; top-floor cutaways omit it while full-building walkthroughs retain it.
   - Also: a stove-connected chimney only where its shaft/connector clear openings and upper footprints, a voxel bath tub, a cobbled street and a yard. Stove contact uses an actual solid kit voxel, not the model's empty bounding-box corner.
8. **Furniture** (`furnish`). Each room type has an ordered list of wants, placed into an occupancy map.
   - **Scale.** Vertical resampling raises beds, seating, cabinets, tables and worktops without enlarging footprints. Kitchen worktops are 1.125 m, dining tables 0.9375 m and tall kitchen cabinets 1.875 m; low coffee tables stay low. These are stylised proportions for the 1.6 m walkthrough eye height, not building-code standards.
   - **Shop checkout.** A dedicated 2 m (or compact 1.5 m) freestanding timber counter has a till and ledger, customer approach and separate staff standing space. Both sides must be reachable; generic kitchen units no longer satisfy the sales-counter review. Internal and service-door centres belong in the rear 40% of the shop's depth, with placement favouring the 80% depth line. The public street entrance stays at the front. Runs with no eligible rear opening are rejected rather than putting a staff door beside the customer entrance.
   - **Distinct exterior entrances.** Place the resident entrance before choosing the farthest shopfront door position. Separate exterior door apertures need at least a 0.5 m wall pier, including around corners; service doors try another slot rather than overlap an entrance. A kitchen reached from its own yard door does not receive a duplicate cut. Review reports overlapping/crowded exterior doors separately from the intentional shop/resident pair.
   - **Hall planting.** Halls of at least 18 m² may receive narrow planters, with an additional planter above 25 m². Placement requires the configured clear width in front and alongside; tight corridors remain empty rather than sacrificing circulation. Finished hallway-width review still checks the result.
   - **Walking space.** Every piece reserves walking space in front of it, as do every door and the stair's foot and head. Footprints never overlap each other or that space.
   - **Walls and windows.** Backs go against solid wall, and tall pieces never go across a window.
   - **Tables** are placed with their chairs as one group, falling back to a smaller table when the room is tight.
   - **Anchors:** wall, corner, centre, freestanding sales counter, beside the previous piece (bedside table, counter run), in front of it (coffee table), tucked (desk chair), on top (lamp, books, pot), wall shelf at 1.4 m, and rug under the group. Hall doors are centred on their shared wall span to the nearest planning cell, except shop connections which follow the rear-door rule; other service-room door positions retain their operational routing preference.
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

### Architectural review (not an automatic quality stamp)

Open **Architect review → Review this building** in the lab. This is an opt-in, read-only audit of the current plan and final furnished voxel volume. Changing the building clears stale findings and overlays. The route selector draws sampled paths in red; a dashed red room outline denotes a blocked target, not a claimed obstruction location.

- Programme profiles cover home, shop-house, workshop/home and inn. They require essential room types and fixtures, test entrance-to-room/customer/service journeys and bedroom-to-bath journeys, and prohibit unrelated private rooms as transit. Room balance and excessive circulation are design warnings, not rules that suppress whimsical massing.
- Navigation samples actual standing surfaces in the material volume, including stairs. The default game body is 0.5 m wide, 1.6 m high, with a 0.25 m step and 0.125 m horizontal sampling. `BuildingLab.review({body:{height:1.8}})` or the pure `BuildingReview.review(plan, building, options)` can override the profile. This is a sampled cylindrical-clearance model with a step allowance, **not** continuous movement simulation or real-world accessibility certification.
- Required fixtures are checked separately from decorations. Final kit materials are compared with expected stamps to expose possible clipping/overlap; same-material ownership cannot be recovered from the flattened volume. Rugs/decorations may intentionally overlap, so partial mismatches are warnings to inspect. Floors and exposed roof coverage use plan-cell-centre probes, which cannot prove watertightness or detect every small crack.
- Back doors retain their closed leaves in the rendered building. For navigation only, the reviewer copies the volume and removes recorded leaf materials at their exact bounds; other obstructions remain. A blocked recorded doorway is a hard defect, and neither plan nor source voxels are mutated. This checks open-state clearance, **not** hinge swing or interactive door operation. Legacy unrecorded leaves remain explicitly unverified.
- Backyard service routes use actual exterior doors and connected unbuilt cells on the lot (or the public street), not imaginary room links through private kitchens or neighbours' plots. Narrow pinches between walls are excluded. Candidate selection checks this coarse network; finished voxel navigation still has the final say about body clearance.
- A recessed entrance is checked through to its original street mouth, not merely to a point inside the alcove. Its exterior label does not waive headroom or body clearance.
- No load-bearing/structural-physics rules are imposed. Floating wings or impossible silhouettes are allowed if the programme and usable walking surfaces work. Style, visual artefacts and fantasy/anime appeal remain human/agent visual judgement. A clear automated report still says **needs visual review**, never “architect approved”.

Generate reproducible evidence headlessly (no visible windows):

```sh
npm run review:buildings -- --shots
npm run review:buildings -- --cases tools/building-review-cases.json --detail 3 --shots
npm run review:buildings -- --type home --style fairytale --count 4000 --detail 3 --out output/home-review
npm test -- building-review
```

The default batch plan-screens 24 seeds in one shared fairytale language, retains the user's exact seed 550298 configuration first, and voxel-reviews at most three prioritised cases. `--shots` adds exterior/rear/roof views, a furnished cutaway and plan/route overlay for **every floor**, plus compact contact sheets. Full-resolution originals and JSON journeys are retained beside `review.md` in ignored `output/building-review/`. `--detail` changes the number of full voxel reviews; it does **not** claim every member of a 4,000-plan cohort has been voxel- or visually reviewed. `--strict` exits 2 on programme/voxel flags or generation failures; ordinary reporting exits 0 even when it diagnoses defects.

Original requested options are retained separately from resolved attributes. Do not force an auto-selected typology/type into a reproduction URL: those options change random-number consumption and can produce a different building. Capture generation checks browser/Node review equality before accepting evidence. Failed seeds are reported, not silently substituted.

Diversity compares full layout, roof/massing and facade-rhythm fingerprints, ignoring seed IDs, material palettes and furniture variants. Coarse structural families expose template concentration. Distinct fingerprints do **not** prove perceptual uniqueness: a 0.5 m plan change may be distinct in data but look nearly identical. Review contact sheets for meaningful differences and common visual grammar before accepting thousands of homes.

The retained case list includes the linked baseline, an explicit-options replay regression and a generator exception. It records review inputs rather than repairing or hiding generator defects. Resolve them in subsequent generator work and keep the cases as regression inputs.

- `node tests/unit/building-plan.cjs` covers over 300 buildings: every type and plot context over 12 seeds, plus every typology forced on every type and plot. It also checks that no typology dominates free choice. Each building is checked for full coverage, rectangular rooms, every room reachable from where you arrive through legal doors, leaf rooms never walked through, lit rooms, no openings in party walls, a separate home door on mixed-use buildings, a stair opening onto circulation on every floor, and determinism. It prints sample plans.
- `node tests/unit/building-voxels.cjs` checks the kit decode and the palette. Across 7 buildings it checks that doors are open, windows are glazed, roofs cover the top floor, stairs climb exactly a storey, furniture sits in its own room with walkable doors, and output is deterministic. It also checks the mesher.
- `npm test -- browser/building-lab` builds one building of every typology headlessly and checks for page errors. It saves the following to `artifacts/building-generator/`:
  - views, cutaways and plans for each typology;
  - close-ups (door, eave, roof corner);
  - plan contact sheets (16 seeds per type);
  - street facade sheets (8 seeds per style);
  - a massing sheet with every roof form and silhouette feature. Set `SPACOLOGY_BUILDING_SHOTS=0` to skip writing them.
