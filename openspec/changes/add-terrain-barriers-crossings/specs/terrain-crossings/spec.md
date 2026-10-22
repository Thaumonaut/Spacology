## ADDED Requirements
### Requirement: Barrier terrain in the streamed world
The streamed world SHALL generate massifs ringed by vertical cliffs, passes through those cliffs and narrow gorges, deterministically from the seed, without changing bounded catchment worlds.
#### Scenario: Same seed, same barriers
- **WHEN** the streamed world is regenerated with the same seed
- **THEN** every hex has the same barrier classification, rock rating and gorge span
#### Scenario: Open start
- **WHEN** a session starts on any seed in the seed survey
- **THEN** the camp has at least 3 passable frontier hexes and a barrier within 4 hexes

### Requirement: Barriers block surveying and routes
Barrier hexes SHALL be impassable to surveying, crew paths and supply routes until a crossing on them is complete.
#### Scenario: Survey refused
- **WHEN** Exploration plans a normal survey on a cliff or gorge hex
- **THEN** the intent is rejected and Scout edge is offered instead
#### Scenario: Crew go around
- **WHEN** crew walk to a hex beyond a barrier with a known pass
- **THEN** they follow passable hexes through the pass rather than crossing the barrier

### Requirement: Scouting and rock study
Exploration SHALL scout a barrier hex adjacent to surveyed ground for 1 supply, handing its kind and span to Logistics and a rock sample to Research at dusk. Research SHALL study rock samples within its daily study limit, handing the rating to Logistics at dusk.
#### Scenario: Rock rating changes the price
- **WHEN** Research rates a gorge's rock as sound
- **THEN** Logistics sees the bridge cost drop from 8 to 5 build points

### Requirement: Engineered crossings
Logistics SHALL start one crossing at a time on a scouted barrier hex adjacent to surveyed ground, choosing a type allowed by the barrier and rock. Unspent daily build points SHALL accumulate into it, and on completion the hex SHALL become passable with the crossing's travel cost.
#### Scenario: Bridge over several days
- **WHEN** Logistics starts a 5-point bridge with 3 points per day and no claims
- **THEN** the dusk reports show 3/5 then 5/5, and from the next night the gorge hex can be surveyed and routed over
#### Scenario: Cutting needs sound rock
- **WHEN** a cliff hex's rock is fractured or unrated
- **THEN** a cutting cannot be started there, and a ramp can

### Requirement: Richer resources beyond barriers
Resource signs on highland or gorge-rim hexes SHALL identify as uplift seams with higher yield than open-ground resources.
#### Scenario: Seam beats nodules
- **WHEN** Research identifies a highland resource
- **THEN** its profile yield is 9 or more
