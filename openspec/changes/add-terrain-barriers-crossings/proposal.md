## Why
Jacob asked for terrain that matters: "mountains you can't climb or you need to engineer to cross over", and to start adding the actual gameplay. Today every hex in the streamed world is walkable, so the co-op supply line never forces a geographic decision. Barriers give Exploration, Research and Logistics a shared problem that only geography explains, and give the daily target a reason to push the team outward.

## What Changes
- Streamed world revision `micro-wilds-2`: seeded **massifs** (stepped highland plateaus walled by vertical cliffs), **passes** (saddles where the cliff wall drops to a climbable step) and **gorges** (narrow, deep fault-cut ravines with vertical walls). Bounded catchment worlds are unchanged.
- The hex atlas classifies each hex as passable ground, a **cliff** barrier, a **gorge** barrier, a **pass** or **highland**, and holds a hidden rock competence (sound or fractured) for barrier hexes.
- Co-op loop: Exploration can no longer survey barrier hexes; it can **scout an edge** to measure the barrier and bring back a rock sample. Research studies rock samples to rate the rock. Logistics engineers **crossings** — switchback ramp, cutting or bridge — that take build points over several days and then open the hex to surveying and routes.
- Geology payoff: uplift and gorge incision expose deeper rock, so resource signs on highland and gorge-rim hexes identify as richer **uplift seams**.
- Crew walk hex-by-hex along passable paths instead of straight through cliffs.
- Crossings render as structures on top of the terrain. Terrain voxels are never modified.

## Capabilities
### New Capabilities
- `terrain-crossings`: barrier terrain, scouting, rock study and multi-day engineered crossings in the co-op supply line.
### Modified Capabilities
None formally; `coop-supply-line` gains new intents, hex states and report lines inside this lab.

## Impact
World Lab only (`prototypes/labs/microvoxel-world/`, `prototypes/microvoxel-world.html`), its unit/browser tests, seed survey tool, offline cache and package tool. No terrain modification, persistence, new networking, hydrology routing or Svelte integration. Every number is an illustrative playtest default to be tuned from the seed survey and play.
