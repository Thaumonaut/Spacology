## ADDED Requirements
### Requirement: Phase-based co-op loop
The lab SHALL run a shared night/day/dusk cycle in which each phase advances only when every human seat is ready, and autopilots fill unclaimed roles.
#### Scenario: Solo player
- **WHEN** one player claims a single role with no peers
- **THEN** the other two roles act by autopilot and the day cycle completes without waiting on them
#### Scenario: Waiting for a teammate
- **WHEN** one human seat is ready and another is not
- **THEN** the phase does not advance and both players see who is still planning

### Requirement: Role-private knowledge with phase handoffs
Each seat SHALL see only its own knowledge plus results handed to it at phase turns. Nothing SHALL change in another seat's view during a phase.
#### Scenario: Survey reaches Research
- **WHEN** Exploration surveys a lead hex during the day
- **THEN** Research receives its sample only at dusk, and Logistics cannot claim it until Research identifies it

### Requirement: Supply line delivery
Logistics SHALL be able to claim an identified hex, route it to camp over surveyed hexes and place an extractor whose daily yield counts toward a rising daily delivery target, reported at dusk. Missing the target SHALL reduce the report outcome, not end the session.
#### Scenario: Second line meets a target the root cannot
- **WHEN** the target exceeds the root yield and a connected extractor adds enough yield
- **THEN** the dusk report shows the target met with each line's contribution

### Requirement: Peer-to-peer rooms
The lab SHALL let a host create a room code and peers join it over peer-to-peer connections without a game server; terrain SHALL be regenerated from the shared seed rather than transmitted.
#### Scenario: Join a room
- **WHEN** a peer enters a valid room code
- **THEN** it loads the host's seed and world mode, claims a free seat and receives only its seat's view
#### Scenario: Connection unavailable
- **WHEN** signaling or peer connection fails
- **THEN** the lab explains the failure and solo play remains available
