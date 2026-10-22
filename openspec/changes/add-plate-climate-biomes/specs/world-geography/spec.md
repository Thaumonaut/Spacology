## ADDED Requirements
### Requirement: Plate-driven relief
The streamed world SHALL derive continents, oceans and mountain ranges from seeded plates whose boundary type comes from relative drift, deterministically from the seed and without stored terrain.
#### Scenario: Same seed, same world
- **WHEN** the streamed world is regenerated with the same seed
- **THEN** every column, biome and hex summary is identical
#### Scenario: Collision ranges
- **WHEN** two continental plates converge
- **THEN** ground near their boundary rises into a range far above the surrounding lowland
#### Scenario: Bounded worlds unchanged
- **WHEN** a 128 m or 256 m world is generated
- **THEN** its chunks are byte-identical to the previous revision

### Requirement: Sea level and coasts
Ground below sea level SHALL be filled with water to sea level, and sea hexes SHALL be impassable and never offered as frontier.
#### Scenario: Ocean hex
- **WHEN** a hex is mostly below sea level
- **THEN** its terrain is `sea`, it has no survey, scout or crossing action, and routes avoid it
#### Scenario: Dry start
- **WHEN** a session starts on any surveyed seed
- **THEN** the camp is on dry land with at least 3 passable first-ring hexes

### Requirement: Climate and biomes
Each column SHALL get a biome from temperature (latitude and altitude) and moisture (carried by prevailing wind from the sea, reduced behind ranges), and the biome SHALL set surface material and tree density.
#### Scenario: Rain shadow
- **WHEN** a range lies upwind of a land point
- **THEN** that point is drier than a comparable point on the range's windward side
#### Scenario: Forests and open ground
- **WHEN** comparing forest and grassland or desert biomes
- **THEN** forests carry many more trees per area than grassland, and desert carries none

### Requirement: Geology-led resources
Hex summaries SHALL record tectonic setting and dominant biome, and resource signs SHALL follow them.
#### Scenario: Setting shown
- **WHEN** a player inspects a surveyed hex
- **THEN** the inspector names its biome and tectonic setting

### Requirement: Height within budget
Streamed columns SHALL hold relief up to the taller column budget while lowland chunk meshing cost stays at the previous level.
#### Scenario: Lowland cost
- **WHEN** a lowland chunk is meshed
- **THEN** the dense scratch buffer covers only the chunk's occupied height
