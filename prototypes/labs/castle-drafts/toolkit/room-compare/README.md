# Room-first voxel / asset comparison

Open `toolkit/room-compare/` through the existing server. A linked camera shows the
same room layout as (left) the existing sparse-brick raycaster at 6.25 cm, or greedy-meshed voxels and (right)
Quaternius Standard glTF wall/floor/window/doorway modules. Repeated asset primitives
are instanced and named materials are shared. No CDN or external runtime fetches.

## Input sources

**Claude planner snapshot** is the default. `source/building-plan.js` is an unmodified
read-only copy of the new, untracked `plan.js` in the `voxel-rendering` worktree on
`voxel-polish`. `source/provenance.json` records the original path, SHA256 and copy
time. The browser calls that planner for each seed; no second planner is maintained.
Refresh it from the repository root with:

```
node tools/sync-room-comparison-source.cjs /path/to/voxel-rendering
```

`claude-adapter.js` preserves the selected floor's original 0.5 m cell coverage,
room IDs, door locations and window choices. It does not snap or resize rooms.
Continuous wall runs reserve native 2 m modules where possible; short/awkward
spans and partial floor tiles use visible procedural infill. This is intentionally
an asset-fit experiment, rather than silently stretching doorways to fit a kit.
The status reports native module and infill counts.

Claude output is compared **one floor at a time**, at a common elevation. Stair
bays are reserved flat areas here, not a replacement for Claude's working stacked
stairs. No roof is added to floor slices. The original generator's voxel renderer,
furniture pipeline and full-building traversal are not copied or changed.

**Shared fixtures** are separate small room-graph test cases with L-shaped and
twin-wing exteriors on a 2 m module grid. Seven families include a compact cottage, side hall, central hall, dog-leg hall, open courtyard, offset rear workrooms and twin wings. Home seeds produce 21 structural plans and 12 footprints across the 48-seed regression sample, excluding windows from the comparison. The Next distinct plan control skips window-only reseeds. They have roofs, cutaway and room-plan
views. They establish a simple input contract for other planners and let the kit
be examined without infill. Voxel roofs are simplified envelopes; asset roofs
and gable meshes retain authored detail, so their geometry is not identical.

Export saves the original complete Claude plan (all floors), or the fixture plan.

## Controls and metrics

Drag to orbit, scroll to zoom. Walk mode uses WASD, Shift to run, click to capture
look, and Escape to release. Both cameras and the plan-based collision rules are
shared. Doors are open apertures in this experiment. The fixture roof cutaway and
plan diagram aid inspection; narrow viewports stack the two views vertically.

The voxel build runs in a worker. Both views render only when dirty, at up to
60 FPS, and skip drawing when hidden. Asset and greedy-mesh counts come from Three.js `renderer.info` and include shadow passes. Ray mode instead reports live ray volumes, actual fine-cell size and texture memory; its bounding-box triangle count is not comparable to a mesh triangle count. The ray view uses CastleRender/CastleVox, with static shadow caching and a 1024px shadow map; the asset view uses Three.js, so lighting/material models differ. First asset assembly includes loading; warm assembly
is different. These are single-building diagnostics, not a city-scale benchmark.

## Sources and reproducibility

See `assets/SOURCES.md` and included CC0 license for the free Quaternius subset.
Eleven model files and five resized base-colour textures total about 1.86 MiB.
Geometry/UVs/normals are unchanged; normal/roughness/occlusion maps are omitted.
Three.js is locally vendored with its MIT license.

```
python3 tools/import-quaternius-comparison.py /path/to/Medieval-Village-Standard.zip
npm test -- room-comparison
```

Tests cover connectivity, nonoverlap, actual voxel and imported doorway clearance,
all Claude building types/plots/floors, exact source-grid coverage, valid module
fits, local dependencies, cutaway, walking, export and regeneration.

Scale is measured in metres. The shared camera now uses a 66° vertical field of view and a 1.65 m eye height. An optional 1.8 m reference figure and footprint dimensions help assess proportions. Imported modules retain their original dimensions.

The “Voxel walls + asset roofs” engine previews voxel walls with the original textured Quaternius roof assemblies. It uses greedy meshes at the selected voxel resolution so both materials share one depth buffer. Sparse raycast remains a separate comparison mode. Roofs are currently available on shared fixtures; planner snapshots are floor slices. The fitted roof option replaces the overlapping prefab assemblies with a clipped union.

Fitted tile roofs use the Building Lab upper-envelope idea with exact bounded-plane clipping: buried portions of each roof slope are subtracted against the other slopes, including coplanar ownership. Ridge continuations merge, cross wings form valleys, and gable infill is generated only along exposed exterior walls. Ridge caps, valley channels, fascia and undersides close the fitted assembly. This is a roof-specific union, not a general mesh Boolean engine; it currently applies to the single-storey shared fixtures. Quaternius supplies the tile texture, while fitted geometry is generated locally. The original prefab option remains available.
