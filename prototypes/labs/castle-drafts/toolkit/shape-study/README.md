# Plot & shape study

Open `toolkit/shape-study/` from the roof comparison's **Plot & shape study** link.
This is a separate exterior massing experiment, not a replacement for the enterable kit.

- 5–9 m frontage, 12–20 m depth; straight or tapered parcels.
- 2–4 main storeys (tower forms add a raised tower level), stone ground floor, timber-framed plaster above, first-floor jetty brackets.
- Canted bay, upper-only oriel, octagonal corner turret, rear stair tower, lower rear service wing, stepped front projection.
- Every component is clipped to the parcel clearance polygon. Components are joined into one footprint per floor, with buried wall segments removed. The stone base and upper floors can have different outlines.
- Floor cutaways and a plan view show the connected footprint, stair reservation, entrance and rear yard. Neighbour shells reveal the spacing.
- JSON export preserves plot, component polygons and union boundaries for future room/roof generation.

Detailed rooms, functional stairs, operable doors and city streaming integration are not part of this study yet. The optional roofs are silhouette previews; they do not implement the full room-aware attic and roof junction pipeline. Lower service-wing roof completion is still pending. Window openings are cut in the shell; glass is opaque preview glazing. Reserved stair space is an initial constraint, not a validated stair route.

The user supplied these architectural references; they are linked for context, not redistributed as assets:

- [Rye houses: projecting upper floors](https://c8.alamy.com/comp/G0TXEA/medieval-tudor-houses-in-the-old-town-of-rye-G0TXEA.jpg)
- [Illustrated house: corner turret and projecting bays](https://i.pinimg.com/originals/ab/c9/c3/abc9c323560b8c56260e250ed1e4638f.jpg)

`npm test -- townhouse-shape-study` covers connected footprints, parcel clipping, buried-wall removal, exposed entrance, stair reservation, controls, floor cutaways and export.

## Storybook styling and trim repair

Restrained storybook adds steep curved tile roof silhouettes, swept turret caps, finials, diamond spandrel framing, warm glazing, window flower boxes, climbing foliage, a warm entrance lantern and a pointed door canopy. Plain study and roof cutaway remain selectable. Roof polygons underneath raised towers are subtracted before triangulation. The tile texture is the existing licensed Quaternius CC0 texture from the comparison subset.

Horizontal timber is a continuous mitered ring rather than overlapping boxes. Wall infill terminates at the timber bands; posts are unique per corner and stop beneath the top band. Floor faces have their own height instead of sharing the wall cap plane. Unit coverage verifies ring top area and absence of duplicate cap triangles; browser coverage checks style/roof controls and buried tower roof removal.

Additional user-supplied visual references (linked, not redistributed):
- [Fantasy street house with greenery](https://i.pinimg.com/originals/8f/00/02/8f0002133e1f20bc4157a883cb4e6c1b.jpg)
- [Tall fantasy houses and swept rooflines](https://i.pinimg.com/originals/8f/1e/5c/8f1e5c25b304976908ce138c4c1cca7d.jpg)
- [Steinhardt city-map reference](https://www.artstation.com/artwork/n0xdbX)

## Whimsical silhouette pass

Whimsical silhouettes is now the default. This changes the plot-constrained floor polygons as well as the roof:

- A narrower stone base with two progressively projecting upper-storey footprints; the rear stair reservation remains aligned.
- Larger canted/oriel rooms and growing turret footprints, clipped to parcel clearance.
- An off-centre main ridge, strongly swept concave eaves, unequal front/bay peaks and a roof-height variation along the street-to-rear direction.
- Long bent tower spires, crooked masonry chimneys and projecting lancet attic windows.
- Curved support brackets anchored to the nearest actual wall of the storey below.

The **Facade dressing** toggle removes ivy, flower boxes and lanterns without reverting the massing, for silhouette review. **Restrained storybook** and **Plain study** preserve the earlier proportions for comparison. This remains an exterior experiment, not a replacement for the production interiors.

`npm test -- townhouse-whimsy townhouse-trim townhouse-shape-study` covers the new usable floor area, plot/entrance clearance, stair reservation, trim and browser interactions.

## Plot contexts and roof choices

The plot selector now includes street rows, tapered rows, chamfered corners, skewed street bends, alley-front wedges, cul-de-sac fans, street-to-alley parcels and fork/junction wedges. Street/alley edge metadata controls the approach route, entrance orientation, facade dressing and neighbouring shells. Roofs and footprints clip to the actual clearance polygon; a stacked stair reservation is fitted inside every floor. Through plots share a rectangular outline but have both street and rear alley frontage. Cul-de-sac frontage includes a turning court in the context preview.

These initial plot presets are convex. Concave dog-leg/backland parcels and assembling adjoining plots into a coherent city block are still future work.

Roof choices: swept gable, unequal twin gables, mansard, gambrel and hipped. Mansard/hipped forms follow distance to the actual footprint edge. Roof and spire height scale with storey count, including reduced two-storey roofs. Main roof domains exclude the raised tower before eaves are expanded, avoiding the stray tile/verge rings that appeared on the tower wall. Exposed fascia is closed and attic infill meets the roof underside.

`npm test -- townhouse-plots townhouse-whimsy townhouse-trim townhouse-shape-study` checks plot clipping, full door width, clear access routes, timber validity, roof choices and shorter two-storey roofs.
