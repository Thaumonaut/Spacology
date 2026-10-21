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
- **THEN** its previous meshes remain drawable until the new visible set is ready, before an atomic LOD handoff, without a blank terrain frame

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

### Requirement: Honest fallback
The lab SHALL communicate unsupported WebGL2, worker failures and context loss without pretending the world is ready. Missing chunks SHALL have a loading state. Economy rendering SHALL NOT change voxel truth.
#### Scenario: Rendering unavailable
- **WHEN** WebGL2 cannot initialize
- **THEN** the page displays a useful unavailable message and retains navigation
