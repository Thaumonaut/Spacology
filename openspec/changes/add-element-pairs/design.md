## Context

The existing station framework now lives on `station-games-checkpoint` (`6c5669b`). This port reuses its grouped shell rather than recreating a separate game framework. Element oppositions are documented in `docs/design/README.md`: Order/Chaos, Growth/Decay, Energy/Void. Existing Aether element names/glyphs are reused directly; matching is new logic.

## Goals / Non-Goals

Goals: a finite, readable touch puzzle; meaningful reserve choices; observable obstruction rules; recoverable choices; deterministic seed retry; mechanically verified full-puzzle layouts.

Non-goals: concentration/neutralization recipes, materials, planet evidence, co-op handoffs, timers, escalating stages or an automatic fallback. No deductions or rewards are claimed to be connected to the voyage.

## Decisions

### D1. Preserve gaps, eight rays and reading-order wrapping
A legal pair is identical or opposite, aligned horizontally, vertically or on a 45° diagonal, with every intervening cell empty. Horizontal lines also wrap in reading order across row boundaries in either direction: all flattened cells between endpoints must be empty. This is not toroidal column/diagonal wrapping. A compatible intervening element still blocks. Partial-row gaps retain their columns; fully cleared rows now collapse as described in D6, superseding the earlier fixed-coordinate rule at Jacob's request. No arbitrary bends or individual-tile gravity. Selected guidance defaults on with an opt-out: compatible targets use a bright border and +, visible incompatible targets use a dashed border and ×. Empty paths light up. Directional buttons reveal offscreen partners without clearing them or changing selection.

### D2. Finite reserve rows
Jacob requested a 4½-row opening, approximately 24 total rows and eight visible rows, with more columns. Eight columns is the prototype choice: the opening contains 36 elements, with 192 fixed slots. Four deterministic batches of 36 elements each are a proposed sizing default, making 180 total elements (22½ rows) before any removals. Each appends immediately after the last occupied cell, preserving internal holes and prior occupied coordinates. The next batch footprint is dashed, beginning mid-row when appropriate. Deal can be used while matches remain and adds new partners; it cannot obstruct an existing pair between old endpoints. The board can be cleared before all reserves are used. If no pair remains, the UI distinguishes needing a reserve from exhaustion. Exhaustion leaves Undo and Retry available until explicitly finishing the attempt. Undo restores coordinates, capacity and reserve count; assistance has no score penalty.

### D3. Generate unlock dependencies, not just a solvable order
The first playtest found the independent opening clear too easy; the second still found too many immediate neighbouring pairs. Version 3 constructs geometry across all 180 elements using stable element identities and the actual row-collapse helper. After each removal it prefers newly exposed non-adjacent pairs, then other long matches, then a starter pair. Consecutive occupied elements always offer a geometric reading-order fallback, so no backtracking or arbitrary adjacent-pair fallback puzzle is needed. Record witness positions after every collapse, then assign each identity pair one compatible family.

Aggregate incidental visibility edges over the entire removal timeline, penalising adjacent matches more strongly than distant ones. Add extra weight for opening adjacencies. Eight seeded colour-optimisation starts select the lowest-cost assignment after enforcing odd opening-family parity through a cross-boundary witness pair. Element variants are drawn from the selected families. This keeps reserve material necessary without an artificial gate, and verifies the full witness with normal match validation. Arbitrary shifted appends and other choices can still lose. Hints remain legal moves, not a solver; logs record generator version so seeds can be interpreted across revisions.

Tests measure newly exposed pairs with surviving coordinates remapped through each row collapse. They check actual three-step chains during opening play, plus long moves and consecutive unlocks along the full solution, rather than counting a witness's mere existence as depth. Early/late deal policies and ordinary greedy play are also sampled. None of these checks proves human enjoyment.

### D4. Reuse shell with opt-in behavior
Add `timed: false` (no clock/target display or over-target judgment) and `auto: false` (no skip/fallback button). Other callers keep their existing defaults. Use normal result logging, optional ratings and exports. Only trial history, not voyage state, is recorded. In-progress boards are session-local; reload restarts the seed. Hints/undo are not penalties. No separate persistence or element-chemistry system is introduced.

### D5. Mobile/tablet composition
Use the established teal/ivory/gold instrument language. The board window holds eight rows; a row-range indicator tracks vertical position. All 24 rows remain present after removal, deal and undo. Eight columns fit 390px portrait; narrower phones pan within the board while preserving 44px targets and avoiding document overflow. Hint, Undo and Deal sit below the board without overlaying rows. No drag-only or hover-only actions are required. Element glyphs and names accompany colour. Keyboard buttons, arrow navigation, Escape deselection, visible focus, status announcements, safe areas and reduced-motion support are included. The two approved workspace originals are untouched.

### D6. Whole-row collapse, not tile gravity
On a valid removal, identify rows that just lost their last occupied cells. Delete those rows together, shift later rows upward as intact eight-cell rows, and pad the bottom back to 192 cells. Pre-existing empty future capacity is not a cleared line. Return original cleared-row indices and survivor shifts for presentation and tests; track cleared rows in state so undo restores the count as well as geometry. The UI briefly animates surviving tiles upward, announces the row clear, recomputes sightlines from the new state, and honours reduced motion. An undo snapshot retains all state fields. Single-tile gaps never fill by gravity, and deals still append after the actual last occupied cell.

## Risks / Trade-offs

- Three compatibility families impose a genuine floor on easy matches: every full 2×2 contains a compatible neighbouring pair because diagonals count. Generation can reduce shortcuts and create dependencies, not remove this mathematical constraint. If still too easy, discuss a rule change rather than covertly changing compatibility or sightlines.
- Random choices can create dead ends. Free undo and same-seed retry are deliberate; hints are not a solver.
- Four 4½-row reserves and eight columns are testable sizing defaults, not a claim to reproduce Spider Solitaire's dealing rules.
- The shared shell records elapsed time as telemetry but hides time/target scoring for this game. Board progress is not autosaved.

## Verification

Model checks cover all six-by-six pairings, all eight directions, blockers, arbitrary slopes, invalid moves, non-mutation, finite deals, terminal states and generated clearing witnesses. Headless retained browser tests exercise actual taps/clicks, selection, rejection, hints, undo/removal/deal, terminal behavior, retry, ratings, export and viewport access. Re-run hub and existing station regressions after the shared shell change. Human playtesting is still needed to judge depth and pacing.
