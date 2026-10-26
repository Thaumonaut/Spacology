# Worldgen integration worktree

`worldgen-integration` starts from `voxel-polish` and merges every local branch
tip, including the castle/city and building labs. Source branches are unchanged.
This is an integration checkpoint, not a claim that every experimental generator
can run as the default world simultaneously.

## Look around

From this worktree, run `NODE_PATH=/Users/jek/Documents/Personal/Projects/Spacology/Spacology/node_modules npm run serve`.
The local server prints its URL. These paths are useful starting points:

- `/prototypes/microvoxel-world.html?extent=infinite&seed=2718` - the current
  world, with Walk, View flags (ground, flowers, far trees, grass) and live
  Performance measurements.
- `/prototypes/microvoxel-world.html?gallery=1&walk=1` - prop specimens.
- `/prototypes/building-lab.html` - interiors, plot plans and voxel buildings.
- `/prototypes/labs/castle-drafts/toolkit/index.html` - town/city toolkit.
- `/prototypes/labs/castle-drafts/toolkit/city-study/index.html` - city study.
- `/prototypes/labs/castle-drafts/toolkit/infinite/index.html` - streamed city.
- `/prototypes/labs/castle-drafts/toolkit/room-compare/index.html` - room
  comparison.

The branch-specific version of each conflicting file is retained under
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

Known gaps at this checkpoint: `microvoxel-crystal-material` still expects
the alternate crystal renderer; `microvoxel-gallery` finds undeclared
landmarks; `microvoxel-structures` assumes a ruin distribution from its
source branch; and `terrain-crossings` expects the other branch's revision
label. Their tests remain present and failing, rather than being disabled.
Other browser journeys and cross-variant benchmark comparisons have not
been validated yet.
