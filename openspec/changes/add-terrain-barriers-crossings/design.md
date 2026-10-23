## Context
The streamed generator (`voxel-world-model.js`, `geography(x,z)`) already produces a river, a ridge field and fracture lines from seeded noise; heights are clamped to `heightCells - 28*density` (17 m at 25 cm) so trees fit. Columns store run ends as `Uint8`, so the 96-cell (24 m) column cannot grow without breaking 12.5 cm. The hex atlas summarises 7 points per hex; the co-op session routes with Dijkstra over surveyed hexes using `summary.cost`.

## Decisions
### Terrain (revision `micro-wilds-2`, streamed world only)
| Feature | Generation (illustrative) | Look | Rule |
|---|---|---|---|
| Massif | Low-frequency uplift field above a threshold raises ground in 3 m terraces, up to +9 m | Barren basalt plateau, vertical walls | Wall hexes are **cliff** barriers; the plateau top is **highland** |
| Pass | A saddle field inside the massif rim caps the step at one terrace with a slope | Notch in the wall | Passable at high travel cost; found only by surveying next to it |
| Gorge | A second warped fault field cuts a 3–5 m wide ravine down to 1.5 m, outside rivers and massifs | Narrow slot with vertical walls | **Gorge** barrier; span recorded |
| Rock | Separate noise rates barrier rock **sound** or **fractured** | Not visible | Hidden until Research studies a rock sample |
Massif lift fades smoothly over the 30 m beside rivers (no hard river cut-off), pass zones widen where lift is low so pass mouths meet the lowland, and a raised strip one or two voxels wide is lowered to its higher lower neighbour, so walls never leave free-standing slivers.

Barren barrier ground carries no trees, so massif tops may use the tree headroom (up to `heightCells - 2`). Heights stay inside the existing column budget. The root search rejects sites within 2 hexes of a barrier so day 1 always has open frontier.

### Atlas classification
Each hex samples a 1 m ground grid. A gorge floor makes the hex a `gorge`. A step of 2.5 m or more makes it a `cliff` when less than 85% of the hex remains one walkable patch; a wall clipping a corner can be walked around. A pass-field hit without a blocking step makes a `pass` (cost +2); mostly highland hexes are `highland`. Barriers are judged per hex rather than per edge, so a wall lying exactly along a border can be stepped across between two passable hexes; the seed survey measures how often. Barrier hexes have `passable:false` and infinite travel cost until a crossing exists. `rock` and `span` are stored in the summary but only exposed through role knowledge.

### Role loop additions
| Phase | Exploration | Research | Logistics |
|---|---|---|---|
| Night | **Scout edge**: plan a barrier hex next to surveyed ground (costs 1 supply instead of travel cost) | Rock samples can be hinted like resource signs | Choose which scouted barrier to engineer and which crossing type |
| Day | Crew walk to the edge, measure it, take a rock sample | Study rock samples (shares the 2-study limit with resource samples) | Leftover build points (after any claim) go into the active crossing |
| Dusk | Barrier kind/span to Logistics; rock sample to Research | Rock rating to Logistics | Report shows crossing progress; a finished crossing opens the hex |

### Crossings (illustrative)
| Crossing | Allowed on | Build points | Travel cost after |
|---|---|---|---|
| Switchback ramp | cliff | 4 (6 on fractured or unrated rock) | 4 |
| Cutting | cliff | 7, sound rock only | 1.5 |
| Bridge | gorge | 5 on sound rock, 8 on fractured or unrated | 1.5 |
Building on unrated rock is allowed at the fractured price, so Research saves points rather than gating progress. One crossing is under construction at a time. A finished crossing makes the hex passable: Exploration can survey through it and Logistics can route over it.

### Geology payoff
Resource signs on highland hexes or next to a gorge identify as **uplift seams**: yield 9–11 instead of 5–8, because uplift and incision expose deeper rock. The target curve (6 + 3 per day) stays, so by day 4–5 a barrier crossing is usually the best answer. Unconnected near-camp leads remain, so ignoring barriers costs output, never the session.

### Crew paths and rendering
Crew follow the cheapest passable hex path (same Dijkstra, all known hexes) instead of a straight line. Atlas overlay draws barrier hatching, scouted measurements and crossing glyphs (ramp zigzag, cutting notch, bridge span) with construction progress. A small voxel prop mesh for crossings is a COULD.

### Autopilots
Exploration scouts the cheapest barrier only when no passable frontier carries resource signs. Research studies rock after resource samples. Logistics starts a crossing when no claimable profile is routable and a scouted barrier borders unsurveyed signs or highland; it prefers the cheapest valid type.

### MUST vs COULD
- MUST: generator features and revision bump, atlas classification, scouting, rock study, three crossing types with multi-day progress, routing/survey through finished crossings, uplift seams, crew hex paths, overlay glyphs, autopilots, tests and seed survey report.
- COULD: rockfall incident that halves a ramp line until 1 point repairs it; voxel crossing props; pass discovery hints from Research; crossing tolls on travel time.

## Risks
Noise-threshold barriers may be absent or overwhelming on some seeds, so the seed survey reports coverage, passes and nearest barrier distance; thresholds are tuned until every surveyed seed has a barrier within 5 hexes of camp and at least 3 passable starting frontier hexes. Stepped plateaus raise meshing cost slightly; streaming budgets are re-measured. Existing streaming regressions pin `micro-wilds-1` and are updated deliberately.
