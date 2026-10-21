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

### Requirement: Inhabited orthographic proof
The lab SHALL provide orthographic close/wide views of the same river catchment with distinct vegetation, a clearing, rock formation, a geographically conditioned resource and animated explorer/worker. It SHALL support touch, keyboard, pause and reduced motion with no external runtime dependency.
#### Scenario: Inspect the root
- **WHEN** the root is selected from either view
- **THEN** the same stable ID, coordinates and geographic reason are shown

### Requirement: Honest fallback
The lab SHALL communicate unsupported WebGL2, worker failures and context loss without pretending the world is ready. Missing chunks SHALL have a loading state. Economy rendering SHALL NOT change voxel truth.
#### Scenario: Rendering unavailable
- **WHEN** WebGL2 cannot initialize
- **THEN** the page displays a useful unavailable message and retains navigation
