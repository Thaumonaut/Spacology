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

Open `toolkit/?preset=city` or choose **City scale · 224 buildings**. This is a level-ground density and full-detail rendering test, separate from the older castle city. Sixteen blocks each contain two fully occupied, width-fitted seven-building rows. Frontage joints are 18 cm; remaining block interiors are paved service courts, with eight-metre streets between blocks. All 224 slots are checked, as are collision support at every ground-floor entrance. Large pubs, inns and manors retain proportionally wider lots. The outer quarter includes stacked slum dwellings.

Additional comparisons: **Large buildings**, **Roof & gallery forms**, **Dense slum variety**, and **Window bays & greenery**. Broken-pitch and swept roof shells use matching surface samplers for chimneys and moss. Projecting bays replace their parent opening and have framed side windows. `greenery()` supplies independently selectable climbing vines, roof moss and hanging leaves. `bridge()` supplies covered exterior decks and railings; city bridges connect matching upper rear-door sockets over service courts. Furnished interiors and interior circulation are still future work.

Ordinary buildings now use a full stone ground storey with Tudor timber/plaster above (`stoneStoreys`, default 1); wooden slum variants opt out. Inn balconies follow the upstairs door position, have side guards and visible supports. Headless checks probe the landing width and depth at elevated doors. On steep streets, low ground-floor windows are replaced with masonry where road height would bury them. Blade signs prefer the downhill frontage end; pub tables on slopes use the downhill side and a flat paving pad.

Upper storeys project 45–85 cm per floor toward the street, depending on the shell. Corbels, galleries, balconies and entrance sockets follow those offsets. Downhill signs near door canopies extend beyond the canopy edge, with longer brackets and connected hangers.
