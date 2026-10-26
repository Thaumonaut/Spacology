# Worldgen integration worktree

`worldgen-integration` starts from `voxel-polish` and merges every local branch
tip, including the castle/city and building labs. Source branches are unchanged.
This is an integration checkpoint, not a claim that every experimental generator
can run as the default world simultaneously.

## Look around

From this worktree, run `NODE_PATH=/Users/jek/Documents/Personal/Projects/Spacology/Spacology/node_modules npm run serve`.
The local server prints its URL. These paths are useful starting points:

- `/prototypes/worldgen-integration.html` - the field board comparing the
  three runnable worlds and linking the building/city labs (also in the
  playtest library).
- `/prototypes/microvoxel-world.html?extent=infinite&seed=2718` - the current
  world, with Walk, View flags (ground, flowers, far trees, grass) and live
  Performance measurements.
- `/prototypes/microvoxel-world.html?gallery=1&walk=1` - prop specimens.
- `/artifacts/integration-variants/devin-1792601000-microvoxel-world/standalone.html`
  - anime/crystal world as packaged from its original branch.
- `/artifacts/integration-variants/ruins-anime/standalone.html` -
  ruins/castles world as packaged from its original branch.
- `/prototypes/building-lab.html` - interiors, plot plans and voxel buildings.
- `/prototypes/labs/castle-drafts/toolkit/index.html` - town/city toolkit.
- `/prototypes/labs/castle-drafts/toolkit/city-study/index.html` - city study.
- `/prototypes/labs/castle-drafts/toolkit/infinite/index.html` - streamed city.
- `/prototypes/labs/castle-drafts/toolkit/room-compare/index.html` - room
  comparison.

Both packaged variants load and render headlessly from this branch; their
crystal-material and ruin-structure unit tests pass on their original
branches. They are separate experiments, not a claim that their incompatible
models have been combined into the default world. The branch-specific version
of each conflicting file is retained under
`artifacts/integration-variants/<branch>/<original-path>`; for example, the
older local-drainage model is also at
`prototypes/labs/microvoxel-world/voxel-world-model-local-drainage.js`.
Those copies are references, not interchangeable drop-ins for the running
page: some models depend on different macro maps, materials and workers.
Conflicting screenshots/metrics remain side by side instead of replacing
the newer captures.

## Verify

Use `NODE_PATH=/Users/jek/Documents/Personal/Projects/Spacology/Spacology/node_modules`
for tests from this worktree (dependencies were installed at the repository
root). `npm test -- microvoxel-world-launch` is the headless startup check;
`npm test -- --unit microvoxel terrain-crossings building town city room`
checks the affected unit modules. `node tools/benchmark-lod.cjs` samples LOD
generation, and the in-page Performance panel reports live rendering costs.
The integration-specific world revision is `micro-wilds-32-integration` (with
matching worker cache keys), so old generated meshes cannot share its identity.

Verified here: the core world unit test and `terrain-crossings`, plus headless
`microvoxel-world-launch`, `microvoxel-world-crossings`,
`microvoxel-world-streaming`, `building-lab` and `town-infinite` browser
tests. The standalone package builds with the matching inline worker.

Performance takes precedence in the active default: the `voxel-polish`
renderer/streamer retains packed indexed terrain, per-frame upload budgets,
worker-based node generation and bounded GPU caches. A fixed 320-node
`benchmark-lod.cjs --against <branch>` run (seed 2718, 0.25 m cells) measured
15.9-16.3 ms/node here, versus 16.4 on `voxel-polish`, 23.7 on the
anime/crystal branch and 18.3 on `ruins-anime`. Those models generate
different terrain, so these are workload comparisons, not same-output
speedups. `?far=lobes` remains opt-in: a 35-node L5 sample used fewer terrain
bytes (156 KiB versus 600 KiB), but took longer to generate (42.7 versus
36.5 ms/node); GPU timings and appearance need separate evaluation.

Known gaps at this checkpoint: `microvoxel-crystal-material` expects
the packaged anime/crystal renderer, and `microvoxel-structures` expects the
packaged ruins/castles generator. Their tests remain present and failing
against the integrated default, rather than being disabled. Other browser
journeys and GPU/frame-time comparisons between variants have not been
validated yet.
