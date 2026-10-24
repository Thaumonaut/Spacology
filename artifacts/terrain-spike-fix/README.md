# Mountain faces up close: comb teeth fix (micro-wilds-23)

Headless renders of seed 2718, `prototypes/microvoxel-world.html?extent=infinite&seed=2718&cx=1806&cz=-120` (close) and
`&cx=1812&cz=-125&lx=4` (far, the tallest peak). `before-normals-*` is micro-wilds-21; `after-*` is this change.

| File | What to look at |
| --- | --- |
| before-normals-span67 / after-1-span67 | Steep snow and rock faces: 1 m comb teeth and washboard stripes become clean ledges and risers |
| before-normals-span32 / after-0-span32 | Same, closer |
| after-far-0-span1330, after-far-1-span3592 | The distant ridge-and-gully look is unchanged |

Cause: crag bands took their period from noise (2.5-6 m) and divided the absolute height by it. At 1.5 km the band count
is ~400, so a 0.1% change in period slid the steps a whole band sideways every metre or so. Bands now have a constant 4 m
period (riser sharpness varies instead), break into ramps over about a third of steep ground, and start at a steeper
slope; spur-crest blocks are smooth knuckles instead of per-metre hash. Lighting normals now come from the exact
(unquantized) ground height, and riser vertices use the ground normal instead of falling back to blocky occupancy normals.

Walkability on the eight highest-relief mountain sites (25 cm moves rising more than the walker's 0.55 m step):
8.5% blocked before, 1.6% after.

## Softer cliff bands (micro-wilds-24)

`before-bands-user-spot-span142` / `after-bands-user-spot-0-span142`: the alpine slope at chunk -115, -57 (from a user
screenshot). Bands still cut a near-vertical riser every ~3 m on any slope over ~32°, which the 50 cm mesh drew as rows of
dark comb teeth. Bands now start at ~44° and full strength near 55°, pull 70% (was 90%) of the way to the step, and their
risers are softer (step exponent 1.6-2.8, was 2-4.5). Blocked 25 cm moves on the highest mountains: 1.6% -> 0.5%.

## Rock without dangling teeth (micro-wilds-25)

`after-rock-0-span32`: roughRock no longer builds overhanging lips under each 1.1 m stratum (the smooth mesh drew them
as hanging teeth), cuts ledges about half as deep, and uses the warm stratum tone and orange lichen much more rarely.
Close-up rock is now smooth and walkable but plain; fine rock detail is planned as a normal map rather than geometry.
