# Volcano fixes: ribs, summit-only snow, no flank pits

Before and after JPEGs of the streamed world (seed 2718, map view), captured headlessly at 1280x800.
- "Before" is `voxel-polish` at 3271aad (micro-wilds-27).
- "After" is `volcano-fixes` (micro-wilds-28).
- `spanN` is the camera span in metres.

| Shot | URL |
| --- | --- |
| volcano-a-span4000, volcano-a-span7000 (whole cone) | `?seed=2718&extent=infinite&cx=-316&cz=-928&lx=4&lz=4` |
| volcano-a-flank-span1000 (upper flank, ~1.2 km south of the vent) | `&cx=-316&cz=-775` |
| volcano-b-span3000 | `&cx=938&cz=-597` |

What to look for:
- **Pits.** The before span-7000 and span-4000 shots show the "holes": white-walled pits on the north flank with green floors.
  - They were not voids. They were terrain cut down to sea level. The macro map's cone was narrower than the world's (R = 1.8 H vs 3 H), so macro rivers, river mouths and delta fans were routed across ground the macro map thought was low.
  - The world then carved river valleys down to the river level (about 13 m) through 300 to 450 m of cone. Sea floor under coastal cones also showed through as pockets of sea.
  - In the after shots the pits are gone.
- **Ribs.** Before, the flanks were a fine comb of erosion streaks. After, each cone has 10 to 18 major radial ribs with deep V gullies between them. The ribs meander a little and widen downslope, and on the lower flanks they branch.
- **Snow.** Before, snow covered the cone to its base. After, snow and ice sit only on the upper ~30% of the cone height. The lower edge is ragged: lower in the gullies, bare on the rib crests.
  - Below the snow, mid-slope ground is bare rock, and gullies are gravel scree with stones and boulders.
  - The lower flanks are alpine meadow.
- The left-hand lake in volcano-a-span7000 lies at the cone's foot against the neighbouring range. It is a macro-map lake that was already in the macro map before this change (about 3.2 km from the vent).
