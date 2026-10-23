# Structures, settlements and dungeons for the microvoxel world

Status: design brief (2026-10-23). Owners: terrain/generator session (placement, layout, voxels), rendering session
(materials, look, Walk interiors), open for Codex on well-bounded phases. Builds on `voxel-fog` /
`devin/1792601000-microvoxel-world` (`prototypes/labs/microvoxel-world/`).

## Goal

The world should feel lived in and old at the same time. Anything from **a single shack in a field to a whole city**
can stand in it, either **lived in** (roofs, smoke, fields, roads, people) or **abandoned to any degree** (overgrown,
crumbling, buried). Some buildings and all **dungeons** are only fully explorable on foot in Walk mode.

Tone (see `world.md`): mistpunk, wet, green, mossy and quiet; places look worked-in, not grand. The audience (relaxed
drop-in co-op) wants places worth wandering, not combat arenas: a dungeon is a cool, quiet, glowing place to find
things, not a gauntlet.

## The size ladder

One generator covers every size. Each rung is built from the rung below it, so a city is made of districts made of
plots made of buildings.

| Size | Footprint | What it is | Placement (macro map) |
| --- | --- | --- | --- |
| Shack | 3–5 m | A single room, a lean-to, a hut, a shrine | Anywhere habitable; fields, forest edges, shores |
| Homestead / farm | 30–120 m | A house, a barn, sheds, fenced fields, an orchard, a well | Flat fertile ground near water and roads |
| Hamlet | 100–200 m | 4–10 buildings around a crossroads or a mill | Road junctions, river crossings |
| Village | 200–400 m | 15–40 houses, a green, a chapel, a smithy, fields around | Fertile valleys, coasts, along roads |
| Market town | 400–800 m | Streets, a square, a hall, workshops, a low wall or ditch | River mouths, fords, road hubs |
| Castle | 80–400 m | Keep, curtain wall, towers, gatehouse, bailey | Hills, spurs, river bends (`raised` sites) |
| Castle town | 0.8–1.6 km | A castle above a walled town, suburbs and farms outside | A hill over a river crossing |
| City | 2–4 km | Districts, several walls (old and new), harbour, cathedral, markets | Major river mouths and bays, at most a few per continent |

Larger rungs are rarer and placed first, with exclusion radii; smaller ones fill in between. Every site has a
**culture** (building style, palette, roof shape) from the region of the macro map, so neighbouring towns share a look
and distant ones differ (`world.md` peoples, e.g. Vellin towns, can map onto cultures later).

## Living and ruined: one decay value

Every site is generated **intact** and then given a `decay` from 0 to 1 that the voxeliser applies:

| decay | State | What changes |
| --- | --- | --- |
| 0 | Lived in | Roofs, doors, glazing, chimneys with smoke, gardens, crops, fences, carts, lanterns, crew/NPCs |
| ~0.3 | Abandoned | No smoke or people; fields gone to meadow, gardens overgrown, some roofs holed |
| ~0.6 | Ruined | Roofs gone, upper walls crumbled in stone courses, rubble, vines, moss, trees in rooms |
| ~0.9 | Buried | Wall stubs and foundations, mounds, a tower stump; mostly landscape |

The look already exists for the ruined end (masonry courses, stepped crumbling, rubble, hanging vines, fuzzy moss,
grass in cracks, biome tint). Decay is per building with noise, so a lived-in village can have one ruined barn and a
ruined city can have one standing tower.

## Building kit (generator primitives)

Today's ruins use `box`, `ring` and `path` parts tested per column. Extend that into a small kit:

- **Shell:** wall (with door and window openings), round tower, buttress, gable end, floor/slab, stair (straight,
  spiral), arch, column, battlement.
- **Roof:** gable, hip, lean-to, conical (towers), flat with parapet; tiles, thatch, shingle or slate by culture.
- **Plot dressing:** fence, hedge, wall, gate, well, cart, haystack, woodpile, crop rows, orchard rows, garden beds,
  graveyard, market stalls, banners, lanterns.
- **Ground:** road (dirt, gravel, cobble, paved), plaza, field (ploughed, crops, fallow), bridge, quay.

Materials to add (append to `MAT`; never renumber): timber, plaster, roof tile, thatch, slate, cobble road
(existing `cobble`), ploughed soil, crops (props like flowers/stalks: wheat, maize, cabbages), fence posts (props),
window glass/glow (emissive at dusk), door wood. `masonry` (93) already exists.

Props, not voxels, for anything thinner than a block (fences, crops, lanterns, banners, cart wheels), using the
existing instanced-object path (`flowers`, `stalks`, `ferns`).

## Layout

- **Shack, homestead:** a single plot template rotated to the slope and road.
- **Hamlet to city:** grow from the road network (see `three-teams-and-station-games.md`, route planning): main roads
  come first, then streets branch off them, plots fill the frontage, back lots become gardens and yards. Walls follow
  the built-up edge; old walls stay inside newer ones in cities.
- **Castles:** keep on the high point, curtain wall along the hill contour, towers at turns, gatehouse toward the
  road, bailey buildings inside.
- **Farms around settlements:** fields on gentle slopes within walking distance, hedges and lanes between them; the
  field pattern fades out into wild land with distance.
- Sites must respect water: no building in rivers, bridges where roads cross them, mills on rivers, quays on coasts.

## Interiors and Walk mode

Interiors are only worth building once Walk can enter them. Needed in Walk (`microvoxel-world.js`):

- **Standing on floors:** the eye follows the highest walkable surface *below the eye*, not the column top, so you can
  walk under a roof, along a wall walk, or down a stair.
- **Collision:** walls block movement (probe the voxel column ahead at knee and head height); doorways 1 m+ wide are
  passable.
- **Stairs and steps:** steps up to ~0.5 m climb; ramps and stairs are walkable surfaces.
- **Roofs from above:** in the map view, the existing Peek cut also cuts roofs (anything above the local floor under
  the cursor), so interiors stay readable overhead.
- **Interior light:** rooms darker and cooler; doors and windows let light in; lanterns and hearths glow (bloom).

## Dungeons

Underground places reached from the surface, explorable only on foot.

- **Entrances:** a stair under a ruined chapel or tower, a cave mouth in a hillside, a well shaft, a collapsed cellar.
  The map shows only the entrance.
- **Layout:** rooms and corridors 5–30 m down, a graph of 5–40 rooms; crypts, cisterns, mines, natural caverns and
  ley-crystal grottos. Generated per site, deterministic from the seed, carved as air pockets in the column fill.
- **Look:** cool and quiet; crystals and glowing mushrooms as light; water seeping and pooling; roots through the
  ceiling under forests; mist pooled in the low rooms (the fog layers apply underground too).
- **Rendering:** when the walker is underground, sky and sun light are replaced by the dungeon's own light and the
  fog colour by a cave tint; the overhead map stays unchanged.
- **Content hooks:** finds, crew tasks, ley-line nodes; no combat requirement.

## Rendering

- Masonry, timber, plaster and roofs each get a stylised treatment in the main shader (like the masonry courses):
  readable from the map, detailed in Walk.
- Lived-in signs: chimney smoke (soft drifting cards), lit windows at dusk, banners and laundry swaying in the wind,
  crops waving like grass.
- Biome and culture tints apply (plants on and around buildings take the biome palette).
- Far views: a city 3 km across must read at continent zoom: roofs as a warm patchwork, walls as lines, roads as pale
  threads. Distant buildings use the coarse LOD voxels, with roof colour preserved.

## Performance

- **Part index:** today each column tests every part of the nearest ruin. Bucket parts into a coarse spatial grid
  (e.g. 16 m cells) per site, and look sites up on several scales of site grid (shack grid 60 m, village 400 m,
  city 4 km), so a column tests only the few parts that can touch it.
- **Site cache:** keep the existing LRU for site records; city records are large, so build their part grids lazily by
  district.
- **Props budget:** crops and fences can be very numerous; thin them with distance like the grass tufts budget.
- **Interiors and dungeons** only voxelise detail (furniture, props) at the finest levels.

## Phases

1. **Kit and decay (generator):** part index, the building kit, decay applied to the existing ruin sites, plus the
   shack and the homestead rungs. Acceptance: the same site renders lived in and ruined; column generation time stays
   within 10% of today's.
2. **Walk interiors (rendering/UI):** floors under the eye, wall collision, stairs, Peek cuts roofs. Acceptance: walk
   into a house, up a tower stair onto a wall walk, and back out; headless test.
3. **Countryside:** hamlets, villages, farms, fields and roads tied to the macro map. Acceptance: a 10 km drive
   passes several farms and a village on roads.
4. **Dungeons:** entrances, carved rooms, dungeon lighting and fog. Acceptance: enter, explore 10 rooms, leave.
5. **Castles, towns and cities:** castle, market town, castle town, then city. Acceptance: a castle town ~1.5 km
   across streams without stalls and reads clearly from the map view.

## Open questions for the user

- Who lives in the lived-in places: the crew's own people, local peoples (cultures from `world.md`), or both? This
  decides building styles and whether NPCs walk around.
- Should decay follow history (regions abandoned after events) or just be scattered for variety?
- How common should settlements be? A rough target: a farm every 1–2 km in fertile land, a village every ~5 km, a
  town every ~15 km, a city or two per continent.

## Files

- `prototypes/labs/microvoxel-world/voxel-world-model.js`: site grids, kit, layout, decay, dungeons (generator).
- `prototypes/labs/microvoxel-world/macro-map.js`: settlement placement, cultures, roads.
- `prototypes/labs/microvoxel-world/voxel-renderer.js`: materials, roofs, smoke, window glow, underground light.
- `prototypes/labs/microvoxel-world/microvoxel-world.js`: Walk floors, collision, stairs, Peek through roofs.
- Tests: `tests/unit/microvoxel-structures.cjs` (determinism, decay, part index), `tests/browser/microvoxel-world-interiors.cjs`.
