## ADDED Requirements

### Requirement: E1 Equal or opposite elements
The game SHALL allow only identical elements or the established opposed pairs Order/Chaos, Growth/Decay and Energy/Void.

#### Scenario: Unrelated elements cannot clear
- **WHEN** Order and Growth are selected on a clear row
- **THEN** neither element is removed and the game explains the incompatible pairing

### Requirement: E2 Unobstructed eight-direction sightline
A pair SHALL share a row, column or 45° diagonal, or connect along the horizontal reading-order path across row boundaries, with no occupied intervening cell. Wrapped horizontal matching SHALL work forwards and backwards. Gaps SHALL remain transparent and retain their columns within surviving rows. Arbitrary bends, toroidal diagonal/vertical wrapping and individual-tile gravity SHALL NOT occur.

#### Scenario: Even a compatible blocker obstructs
- **WHEN** two compatible endpoints have any element between them on their line
- **THEN** the pair is rejected and the board is unchanged

#### Scenario: Gaps permit distant diagonal pairing
- **WHEN** compatible endpoints share a 45° diagonal containing only empty cells
- **THEN** both endpoints clear without moving other cells unless a whole row becomes empty

#### Scenario: Reading order wraps between rows
- **WHEN** Order in the third position of one row and Order in the last position of the next row have only empty reading-order cells between them
- **THEN** they can pair in either selection order even though they share no geometric diagonal or column

### Requirement: E3 Finite board and reserves
The trial SHALL use eight columns and 24 fixed rows, eight visible, starting with 4½ occupied rows (36 elements) and four 36-element reserves. A deal SHALL append after the last occupied cell, preserving internal gaps and existing coordinates. Dealing SHALL remain available while matches exist. Clearing the board SHALL win with reserves unused. No pairs and no reserves SHALL expose exhaustion without a fifth deal.

#### Scenario: Larger opening and fixed capacity
- **WHEN** a new board starts
- **THEN** four rows and the first four cells of row five are occupied, all 192 slots exist, and the board window shows rows 1–8
- **AND** scrolling reveals the remaining rows without shrinking touch targets

#### Scenario: A stuck opening can receive a batch
- **WHEN** no legal pairs remain and reserves are available
- **THEN** Deal remains enabled and the next 36 cells after the last occupied element are marked as its destination

#### Scenario: Append starts mid-row
- **WHEN** the last remaining element is in column three and a batch is dealt
- **THEN** the new batch starts in column four of that same row and earlier holes stay empty

#### Scenario: Last reserve is consumed
- **WHEN** the fourth reserve is dealt
- **THEN** reserves show zero, Deal is disabled, and any remaining legal pairs are still playable

#### Scenario: Board clears early
- **WHEN** the final occupied pair clears with reserves remaining
- **THEN** the game finishes successfully without forcing another batch

### Requirement: E4 Recoverable interaction and sightline assistance
The game SHALL support tap selection/deselection, invalid-pair feedback, undo of removals/deals, same-seed retry and optional hints. Selected sightline guidance SHALL default on, with an opt-out. Directional controls SHALL locate offscreen partners without matching or changing selection. There SHALL be no visible timer or assistance penalty. Hints SHALL be described as legal moves, not guaranteed winning moves.

#### Scenario: Distinguish targets and obstructions
- **WHEN** an occupied tile is selected with guidance on
- **THEN** compatible targets have a + marker and visible incompatible targets have a distinct dashed outline and × marker
- **AND** empty cells on clear paths light up, including reading-order wrapping, but tiles beyond a blocker are not highlighted as partners

#### Scenario: Locate a distant wrapped partner
- **WHEN** a selected element has a compatible reading-order partner outside the board window
- **THEN** the target and intervening clear path are highlighted and a directional control reveals the target while preserving selection

#### Scenario: Undo reserve exhaustion
- **WHEN** the player undoes a deal before explicitly finishing an exhausted attempt
- **THEN** the exact prior board and reserve count return

### Requirement: E5 Deterministic verifiable layouts
The same seed SHALL produce the same opening and reserves. The opening SHALL require reserve material. The full puzzle SHALL have a clearing witness executable through the normal validator after dealing all four batches into the untouched opening, including row collapse. Generation SHALL favour removals that expose subsequent matches and reduce incidental adjacent matches throughout the solution. This SHALL NOT imply every legal move or deal timing is winning.

#### Scenario: Replay the full puzzle witness
- **WHEN** all four reserves are dealt before matching and the recorded full-puzzle witness is applied
- **THEN** every move is legal and no elements remain

#### Scenario: Reserve dependency is real
- **WHEN** the opening is generated
- **THEN** at least one compatibility family has an odd number of elements, so removing equal/opposite pairs alone cannot clear it

#### Scenario: A three-step dependency rather than three free pairs
- **WHEN** a layout's unlock chain is checked
- **THEN** the second pair is blocked until the first clears, and the third is blocked until the second clears
- **AND** verification checks chains available during opening play as well as the full recorded solution

### Requirement: E6 Accessible prototype boundary
Core actions SHALL be usable by tap or keyboard at phone/tablet portrait and landscape sizes without horizontal document overflow. Elements SHALL use names and distinct glyphs in addition to colour. The trial SHALL reuse MiniGameKit without changing other games' default timer/fallback behavior and SHALL NOT mutate voyage state or claim connected material rewards.

#### Scenario: Phone play
- **WHEN** the trial is opened at 320px portrait width
- **THEN** tiles are at least 44px square and the board, Deal, Hint and Undo remain reachable
- **AND** the board can pan horizontally when eight columns cannot fit, without horizontal document overflow or obscuring rows with action buttons

### Requirement: E7 Whole cleared rows move the board up
After a match, each newly empty row SHALL be removed and all rows below SHALL shift upward, preserving column positions and internal gaps. The board SHALL retain 24-row capacity by adding empty rows at the bottom. Undo SHALL restore the entire pre-collapse board and cleared-row count. Row movement SHALL be visible with reduced-motion support.

#### Scenario: Remove a middle row
- **WHEN** a match removes the final elements in row three
- **THEN** rows one and two stay unchanged, row four moves to row three with its gaps intact, and later rows follow
- **AND** no element falls into a gap within another row

#### Scenario: One match clears two rows
- **WHEN** the endpoints are the last occupants of two different rows
- **THEN** both rows disappear, surviving rows retain their order, and Undo restores both rows and every original coordinate
