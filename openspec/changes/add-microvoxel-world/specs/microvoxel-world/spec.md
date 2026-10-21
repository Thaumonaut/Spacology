## ADDED Requirements
### Requirement: Stable voxel world
The lab SHALL retain stable world identity, authoritative material occupancy, ground and root-deposit provenance for a seed independent of chunk request order, zoom and cache eviction. Terrain SHALL NOT be editable.
#### Scenario: Regenerate a chunk
- **WHEN** a chunk is evicted and generated again in any request order
- **THEN** its voxel runs, exact ground queries and root deposit remain unchanged

### Requirement: Bounded efficient rendering
The lab SHALL compress voxel data and generate visible surface meshes outside the main thread, reuse buffers for animation, and bound/dispose cached resources. Metrics SHALL identify what is measured and what is estimated.
#### Scenario: Pan and zoom repeatedly
- **WHEN** the camera changes the visible chunks or render resolution
- **THEN** the queue prioritizes the current view, residency stays bounded, and LOD does not mutate world truth
#### Scenario: Cross a render LOD threshold
- **WHEN** a complete view zooms to a different render step
- **THEN** previous meshes remain drawable until the new visible set is ready, or yield to their own replacements under cache pressure, without a blank terrain frame; settled views have one LOD and repeated zoom cycles finish within the cache budgets

### Requirement: Inhabited orthographic proof
The lab SHALL provide orthographic close/wide views of the same river catchment with distinct vegetation, a clearing, rock formation, a geographically conditioned resource and animated explorer/worker. It SHALL support touch, keyboard, pause and reduced motion with no external runtime dependency.
#### Scenario: Inspect the root
- **WHEN** the root is selected from either view
- **THEN** the same stable ID, coordinates and geographic reason are shown
#### Scenario: Drag the landscape
- **WHEN** a finger or cursor drags an unclamped terrain view in any screen direction
- **THEN** a fixed terrain landmark moves by the same screen displacement, without vertical inversion

### Requirement: Measured finer-density comparison
The lab SHALL offer 25 cm and 12.5 cm authoritative voxel cells with the same physical catchment, chunk volumes, feature scale and resource identity. The 25 cm baseline SHALL remain the default. Metrics and exports SHALL identify density, and cache limits SHALL remain unchanged.
#### Scenario: Compare cell sizes
- **WHEN** density changes at a fixed camera position
- **THEN** finer voxel ground regenerates, camera framing and resource X/Z remain fixed, obsolete replies cannot populate the view, and measurements restart for the new density

### Requirement: Bounded regional comparison
The lab SHALL optionally extend the 128 m catchment to a 256 m region without changing existing material data or the surveyed root for a given seed and cell size. Only the visible portion SHALL stream into the unchanged caches. Both seed and footprint SHALL be reproducible after reload, and metrics SHALL identify the selected footprint.
#### Scenario: Extend the map across the old border
- **WHEN** a player chooses the regional footprint and pans beyond 128 m
- **THEN** terrain remains available beyond the former boundary, existing chunks remain byte-identical, and old-footprint/LOD or density worker replies cannot populate the new footprint
#### Scenario: Survey multiple seeds
- **WHEN** the same seed, cell size and footprint are regenerated in a different chunk order
- **THEN** geographic samples, root provenance and voxel runs agree; the survey distinguishes actual seeded variation from shared authored river/fault geography

### Requirement: Honest fallback
The lab SHALL communicate unsupported WebGL2, worker failures and context loss without pretending the world is ready. Missing chunks SHALL have a loading state. Economy rendering SHALL NOT change voxel truth.
#### Scenario: Rendering unavailable
- **WHEN** WebGL2 cannot initialize
- **THEN** the page displays a useful unavailable message and retains navigation

### Requirement: Opt-in floating-origin streaming experiment
The lab SHALL retain both finite footprints and offer a separate deterministic streamed generator. Logical position SHALL use signed 8 m chunk coordinates and local offsets in [0, 8). The explorer SHALL remain at render X/Z zero while terrain moves beneath it. GPU coordinates SHALL remain local, not grow with travel. Generated voxel, mesh and vegetation caches SHALL remain bounded regardless of distance. No world-wide visited-chunk collection SHALL be retained.
#### Scenario: Travel across signed chunk boundaries
- **WHEN** the user drags, uses arrows or jumps to distant positive or negative chunks
- **THEN** chunk normalization preserves continuous displacement, nearby chunks stream from seed/revision/coordinates, terrain sampling and selection use logical coordinates, and the explorer stays at local X/Z zero
#### Scenario: Return after eviction
- **WHEN** the user returns to a previous logical location after distant travel or reload
- **THEN** material runs regenerate identically without saving the terrain; URL state retains mode, seed, density and compact logical position
#### Scenario: Reach the numeric guardrail
- **WHEN** travel would exceed signed chunk magnitude 16,777,215
- **THEN** navigation clamps at the documented guardrail rather than silently wrapping noise or using unsafe positions; the experiment does not claim literal mathematical infinity, hydrological realism or complete persistence
