## Implementation
- [x] Record bounded scope, representation and prototype defaults.
- [x] Implement deterministic geographic fields, compressed voxel columns and stable provenance.
- [x] Implement border-aware greedy meshing and worker transfer.
- [x] Implement bounded renderer/cache, orthographic controls and voxel actors.
- [x] Register standalone lab and explain measured/estimated budgets.
- [x] Correct screen-space drag direction and add an opt-in 12.5 cm density comparison at unchanged physical scale/cache limits.

## Verification
- [x] Verify determinism, compression roundtrip, occupancy, seams, meshing coverage and cache bounds.
- [x] Verify headless desktop/phone controls, layout, animation, errors and fallback.
- [x] Record reproducible cold/warm generation and memory/geometry benchmark.
- [x] Verify four-axis/diagonal drag, finer run reconstruction, metre-scale features, density persistence and stale-result rejection; benchmark equal physical coverage at both densities.
- [x] Keep prior LOD geometry visible during streaming and test an atomic whole-view handoff without clearing the terrain.
- [x] Run relevant tests and release/Pages checks; open a separate PR.
- [ ] Human visual approval and real-device performance gate (not automated).
