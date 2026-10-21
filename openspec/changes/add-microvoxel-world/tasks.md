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
- [x] Keep prior LOD geometry drawable during streaming, prioritize requested meshes under cache pressure without coverage loss, and regress repeated portrait zoom cycles without starvation.
- [x] Add an opt-in 256 m region, verify 128 m material continuity, measure bounded streaming beyond the previous border, and survey multiple seeds without claiming macro geography is finished.
- [x] Run relevant tests and release/Pages checks; open a separate PR.
- [ ] Human visual approval and real-device performance gate (not automated).

## Floating-origin experiment
- [x] Add opt-in seeded signed-chunk terrain and normalized chunk/local coordinates; cap vegetation memoization.
- [x] Anchor an explorer at render origin, stream local terrain, retain logical selection/root identity, and expose travel/URL state.
- [x] Regress negative boundaries, distant precision, order-independent regeneration, finite-mode continuity and cache residency; package the same implementation.
- [x] Explain blocked source-file worker startup; regress safe launch guidance and form-free modal/generation/travel actions in a restricted packaged preview.
