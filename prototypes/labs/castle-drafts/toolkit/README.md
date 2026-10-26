# Town toolkit: first street

Open `prototypes/labs/castle-drafts/toolkit/` on the prototype server. The existing
castle-drafts panel also links here. This is a separate construction workbench;
the city generator has not been replaced.

Use **Street mix** to compare the street compositions:

- Homes & lodging: apothecary, inn, townhouse.
- Craft quarter: two-storey smithy with a full-width covered forge yard, hearth/flue, anvil, workbench and quench barrel; narrow three-storey warehouse with open cargo doors, hoist and a front-facing gable, townhouse.
- Neighborhood: stone chapel with bell tower and rose window, stone-and-dark-timber pub with leaded street windows, wooden frontage, tiled door porch, outdoor tables and a blade sign, stone tower house with a roofed lookout.

- Slum quarter: patched cottage shack, shed-roof lean-to, and narrow wooden tenement.
- Market street: armourer, apothecary, bookseller, general goods and clothing shops with separate display modules and different shells.

- Residential variety: stone cottage with garden bench, wooden weaver residence with drying cloth, merchant residence with stone stringcourses and topiary, and narrow gabled home with a wood store.
- Bakery & flowers: bread-tray bakery, planted florist and bookseller. Existing merchants use individual wall washes, awning colors and finishes; the armourer has a masonry ground floor.

`TYPES` describes the ordinary building types and their default shells. The optional adventurers guild
is tagged `unique: true` and deliberately excluded from neighborhood presets;
a future city adapter should place it as a dedicated landmark rather than random
street frontage. The pub and inn serve different roles: neighborhood gathering
space versus a taller lodging building with a balcony and projecting bay.

Rows are packed from their measured widths with 32 cm between wall footprints. Narrow party sides have blank walls and short side roof overhangs. A continuous paved footway connects the fronts; entrance landings share that surface instead of creating coplanar duplicate slabs. Warehouses have wider, gentler freight access.

The incline slider covers level ground through an 18% grade. Walk mode uses the
same triangle collider as the town. Controls expose door connections and
day/golden-hour lighting. Gentle ground uses a 2 m facade setback. Above 10% grade,
floor datums step in 16 cm increments and the frontage gains stone terraces and
retaining edges. The road has 2.5 m flat junctions at every entrance, with stair
flights between landings on steeper grades. Entrances have separate flat street
and door landings.

## Component contract

`town-kit.js` uses the local `pavement-plan.js` module and is usable through `TownKit` in a browser or `require()` in Node. Dimensions are metres, Y is up and a component's front faces
+Z. Components return `{parts, sockets}` where applicable. `parts` use the existing
CastleRender format, so shading and collision do not need a second renderer.
Sockets are world-space for assembled buildings/entrances and local for individual
components. `transform(parts, x, y, z, rotation)` rotates/translates geometry;
callers must transform socket coordinates too when placing a component manually.
The current street uses unrotated building assemblies.

- `foundation`: level pad, buried stone plinth, floor datum.
- `wallBay`: actual wall cutouts, recessed glass/door panels, frame and sill.
- `roof`: solid pitched shells with dark soffits, a continuous eave closure, vertical-only plaster gables, fascia and ridge.
- `dormer`: fitted window and roof, anchored in the parent roof slope.
- `oriel`: a projecting bay that replaces the parent window with a passage and continues into a cross-gable under the main roof.
- `path`: sloping paving at up to 12% grade, horizontal stair treads above it,
  risers at most 16 cm, stone sides extending into the terrain.
- `entrance`: street connection, flight/ramp, landing and door socket.
- `retainingWall`: reusable sloped stone support between two elevations.
- `building`: composes bays, floor plates, roof and variant details.
- `street`: produces the selected test scene with level building pads, grade-following road,
  connected entrances and optional third-party prop placements. Gentle ground uses a 2 m facade setback. Above 10% grade, floor datums step in 16 cm increments and the frontage gains stone terraces/retaining edges. The road has 2.5 m flat junctions at every entrance, with stair flights between landings on steeper grades. Entrances have separate flat street and door landings.

Paving is partitioned into non-overlapping surface cells. Thresholds, work yards, shop display pads, entrance landings and roads have explicit ownership priorities; only exposed risers receive side faces. Terrain is lowered beneath paving to prevent intersections.

Building shells support front gables, hips, cross-gables, low cottages, jettied upper floors and shed roofs. Store displays and slum repairs are separate additions to those shells.

Flat building cores take precedence over neighbouring transition zones. Geometry
samples the same ground function used by the terrain mesh. Tests probe actual
rendered collision triangles along entrance flights, including the endpoints.
Small terrain-grid interpolation differences outside flat pads are covered by
buried supports, rather than a floating slab.

## Free assets

Four Kenney Nature Kit models are included as compact indexed triangles with
original diffuse colors. Their scene instances are tinted and scaled. See
[assets/SOURCES.md](assets/SOURCES.md) and the supplied CC0 license. These are
starter vegetation/rock props; the architectural kit is parametric.

Regenerate the converted subset with:

```
python3 tools/import-town-nature.py /path/to/kenney_nature-kit.zip
```

Clean plaster (pattern 11) has no projected brick or vertical stain pattern, no per-piece color jitter, and a shared storey-level baked shade span. The shop uses a double-sided perpendicular blade sign and a door-width awning. Chimney shafts embed below the roof height at every contact corner.

## Verification and next integration

`npm test -- town-kit` checks geometric support and walkability at 0%, 5.5% and
18% grades, component dimensions/transforms, and the browser workbench controls,
assets and WebGL rendering. Tests stay headless by default.

Next integration: refine the shell families and add an assembly adapter for CityGen
that preserves its districts and occupancy while replacing building geometry.
The workbench does not yet provide furnished interiors, general-purpose corner roof junctions, production LODs or castle components. Future modular interiors must share the same bay grid, door openings, wall thickness and storey datums; they are not implemented yet. The first milestone is a
small street whose connections can be inspected and tested before wider reuse.


## Dense city preview

Open `toolkit/?preset=city` or choose **City scale · 224 buildings**. This is a density and full-detail rendering test with a city-wide incline control, separate from the older castle city. Sixteen blocks each contain two fully occupied, width-fitted seven-building rows. Frontage joints are 18 cm; remaining block interiors are paved service courts, with eight-metre streets between blocks. All 224 slots are checked, as are collision support at every ground-floor entrance. Large pubs, inns and manors retain proportionally wider lots. The outer quarter includes stacked slum dwellings.

Additional comparisons: **Large buildings**, **Roof & gallery forms**, **Dense slum variety**, and **Window bays & greenery**. Broken-pitch and swept roof shells use matching surface samplers for chimneys and moss. Projecting bays replace their parent opening and have framed side windows. `greenery()` supplies independently selectable climbing vines, roof moss and hanging leaves. `bridge()` supplies covered exterior decks and railings; city bridges connect matching upper front-door sockets across the main streets. Furnished interiors and interior circulation are still future work.

Ordinary buildings now use a full stone ground storey with Tudor timber/plaster above (`stoneStoreys`, default 1); wooden slum variants opt out. Inn balconies follow the upstairs door position, have side guards and visible supports. Headless checks probe the landing width and depth at elevated doors. On steep streets, low ground-floor windows are replaced with masonry where road height would bury them. Blade signs prefer the downhill frontage end; pub tables on slopes use the downhill side and a flat paving pad.

Upper storeys project 45–85 cm per floor toward the street, depending on the shell. Corbels, galleries, balconies and entrance sockets follow those offsets. Downhill signs near door canopies extend beyond the canopy edge, with longer brackets and connected hangers.


**Stepped front wings** compares multi-storey projecting bays, including a twin-wing frontage. **L, courtyard & tower** compares compound footprints with wings of different heights. **Undercrofts & storage** adds masonry arches with recessed entrances and sheltered crates/barrels. Gallery ground floors retreat 65 cm behind the original frontage and their posts align between doorways. Gable infill is inset behind the roof end caps to avoid coplanar edge flicker.

The city incline control changes both street axes. Building floor datums follow their actual entrance location while keeping each shell level. Front-street bridges interpolate between their two landing heights; inclined bridges are open rather than forcing a level canopy onto a sloping deck. Street-edge crates/barrels leave the road centre open. Overhead lanterns and laundry use sagging lines at upper-storey height, with at least 3.4 m beneath the hanging cloth. Tests exercise the full city on level ground and a 12% primary slope, plus street components through 18%. This remains a standalone kit-city test; integration with the original castle-city terrain and districts is separate.


City road edges now use `street-edges.js`: each frontage has a 1.9 m stepped sidewalk with level door landings, risers no greater than 16 cm, and a contrasting stone curb. The 4.2 m central carriageway keeps its uninterrupted slope. Road paving is cut away below the sidewalk rather than overlaid, and thresholds, existing ground floors, display pads and entrance aprons share one surface ownership plan. Flared curb ramps serve street corners and warehouses. Ground props and deck posts follow the new surface; bulky displays are omitted from narrow plots when they would obstruct a door. Geometry and collision tests cover both directions through 18% grades.


## Enterable buildings, then streaming

Open [the interior workshop](interiors/) to walk into the house or apothecary. WASD moves, dragging looks around, and E opens/closes a nearby door. These are physical openings in the existing shell, with connected living/shop and kitchen/stock rooms downstairs, an upstairs bedroom and landing, and a 20-tread staircase. Full floor slabs are replaced by plates with a stairwell opening; the stairs have headroom, a handrail and an upper guard. Door geometry/collision updates separately from the static building. Door closing is blocked while the player occupies the doorway. Furnishings and stock are simple kit modules, not finished bespoke interiors for every older catalog type.

Open [the streaming city](infinite/) to keep walking through generated blocks. `?seed=45256` selects a repeatable town. Every lot in this preview uses a compatible two-storey home/shop shell and can generate its interior on entry. Door state is saved locally and restored near the building when returning after eviction. The older 224-building density preview stays separate.

`infinite/world-plan.js` owns seed/coordinate-based descriptors and shared terrain heights. A bounded worker cache builds canonical shell geometry once per archetype, then places copies and transfers packed GPU data. The active 9×9 block window holds at most 81 settled blocks (1,134 lots): its inner 3×3 is detailed and collidable, with lightweight matching roofs, masonry bases, timber framing, shop canopies and windows outside. Old chunks, interiors, collision entries and GPU buffers are released. Previous LOD geometry stays visible until its replacement arrives. Generation happens in a worker; interiors are added only when used or when approaching a previously opened entrance. Idle views do not redraw unchanged frames.

The first streaming slice is a repeatable grid of four-sided courtyard blocks on rolling hills and shared stepped-sidewalk modules. It does not yet provide organic districts, landmarks/castle integration, interiors for all existing compound shell types, or floating-origin rebasing for extreme distances. Those are extensions of this working streaming foundation.

Verification: `npm test -- town-interiors` checks door clearance, stair openings, headroom and keyboard-driven entry/climbing. `npm test -- town-infinite` checks deterministic negative coordinates, shared boundaries, bounded detail rings, worker streaming, eviction, physical entry and door-state restoration after revisiting.


The streaming layout now uses 40 m cells with 32 m building blocks: five houses per long face and two per side face surround a 14×14 m shared courtyard. Two 1.6 m side passages provide public access. Courts have level terraces, retaining skirts, fountains, trees and benches; gate paths ramp or step between street and courtyard elevations. Four-sided stepped sidewalks use the same ownership plan, with terrain lowered under plots and removed beneath courtyard paving. Global terrain heights remain deterministic and match at chunk seams; building floors snap to 16 cm datums.

Interiors have their own lifetime, independent of chunk residency. Open-door interiors unload beyond 22 m from the oriented building footprint; closed ones can unload beyond 10 m. Occupied buildings are protected. An unloaded building retains its shell and the visible front door state, while furniture, internal walls/doors and interior collision/GPU buffers are released. Previously opened rooms reload inside 10 m. The two radii provide hysteresis, and per-building saved door state survives these swaps. Layout IDs carry a version tag so old plot states cannot attach to different lots.

Partition tops now embed below the upstairs floor surface instead of sharing its plane, removing a source of interior z-fighting. Streamed chunk updates invalidate a single upcoming draw rather than forcing one draw per worker message; walking uses small physics substeps during slower loading frames.

In walking mode, click the scene once to capture mouse look; Escape releases the pointer. Overview mode retains drag-to-orbit controls.

Streaming lots mark adjoining side faces as party walls, including the outer ends of courtyard side rows. Both exterior and interior window generation use those flags, and canonical caches include them. Partition end posts are embedded inside the shell to prevent coplanar exterior seams.

Performance: distant houses are batched by block in the worker, preserving their geometry while reducing the settled city from 1,215 resident GPU meshes to 279. Nearby houses remain separate for interaction and culling. Distant terrain sends no collision buffers; status refreshes at most four times per second. Mouse events are coalesced into animation frames, rendering is capped at 60 FPS, and hidden tabs skip simulation and rendering.

The interior workshop now exposes 36 ordinary-building profiles through `interiors/content-kit.js`, including distinct trade furnishings, one-to-five-storey homes and individually accessible compound wings. Larger profile footprints are intentional; the streaming grid retains explicit two-storey lot descriptors until the next planner can reserve large lots. See [the content roadmap](CONTENT-ROADMAP.md) for circular streets and addresses, unique landmarks, and the first guild delivery loop. Destination metadata is available, but NPCs and quest interactions are not implemented yet.

Floor-plan variants: the workshop provides open, rear-room and entrance-room ground floors; separate bedrooms, smaller bedrooms and open lofts; mirrored stair/entrance sides; and an optional closet for sufficiently large homes. The per-floor SVG is generated from actual geometry, including door swings and stair openings. Closet-facing windows and windows crossing smaller-bedroom dividers are replaced by solid wall bays, while hall windows are narrower. City lots choose ground, upper and stair variants deterministically from their seed. Compact lots and authored compound stair layouts disable incompatible options.
