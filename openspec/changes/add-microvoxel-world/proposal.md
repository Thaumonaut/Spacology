## Why
Jacob approved building a bounded microvoxel world before persistent Logistics. Prioritize efficient voxel data and rendering while proving fantasy geography, orthographic presentation and moving voxel characters.

## What Changes
- Add an isolated World Lab with seeded non-editable 0.25 m material voxels, a river catchment, clearing, rock formations, vegetation and a geographically conditioned root deposit.
- Compress vertical material runs, greedily mesh visible faces in a worker, stream camera-visible chunks into a bounded cache, and use coarser *render-only* sampling at wider zoom.
- Show walking/carrying articulated voxel characters and inspect voxel-derived ground.
- Expose generation, geometry/data bytes, cache bounds, draw counts and frame percentiles; test determinism and optimization invariants.

## Capabilities
### New Capabilities
- `microvoxel-world`: bounded shared-world representation and rendering proof.
### Modified Capabilities
None. Existing world generator, voyage, route planning, PR #6 and Supply Run remain separate.

## Impact
Standalone static page and grouped lab implementation; focused tests, benchmark, library registration. No external renderer/runtime download, terrain editing, full planet, production architecture, persistent construction, power or minigame integration. Camera tilt, voxel size and budgets are prototype defaults awaiting visual/device approval.
