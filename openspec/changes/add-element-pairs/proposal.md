## Why

Jacob approved a focused elemental variant of number matching: remove identical or opposite elements along an unobstructed cross or diagonal. Test whether this finite solitaire activity is enjoyable before assigning a permanent station or inventing material-processing outputs.

## What Changes

- Add a mobile/tablet playable matching trial with six existing elements, eight straight sightlines plus horizontal reading-order wrapping, blockers, empty spaces and no gravity.
- Start with 4½ filled rows on an eight-column, 24-row board with eight rows visible. Four reserve batches each append 36 elements after the last occupied cell, not filling internal gaps. The larger dimensions/4½-row opening/eight-row window follow Jacob's playtest feedback; eight columns and 36-element reserves are prototype sizing choices. Clearing the board wins immediately; no moves and no reserves ends the attempt, with an undo/retry opportunity.
- Replace independently clearable openings/batches with one full-puzzle clearing witness and a genuine reserve dependency. Reduce incidental adjacent matches without changing element compatibility.
- Following further playtest feedback, remove fully cleared rows and move intact rows below upward. Generate chains where removing a blocker exposes the next pair, using the real collapse rules; measure opening chains as well as the full solution. Preserve partial-row gaps and exact undo.
- Provide undo, hints, default-on selected sightline/partner highlighting, offscreen match navigation, explicit invalid-move feedback and deterministic retry.
- Reuse the station checkpoint's MiniGameKit, seeded RNG, result/ratings/export protocol and Aether glyphs. Add opt-in untimed/no-auto shell settings without changing existing games.
- Keep the trial in the hub's Reserve section; Research is a candidate home, not a new mandatory department dependency.

## Capabilities

### New Capabilities
- `element-pairs`: finite, sightline-based matching with identical/opposite elements and four reserve deals.

### Modified Capabilities
None. Existing station rules and voyage mechanics remain unchanged.

## Impact

New model, HTML/CSS/controller and focused unit/browser tests. Two optional MiniGameKit shell settings and one hub registration. No Svelte, combat, worldgen, approved visual reference, scheduling or reward changes. This independent trial does not approve or implement the larger connected-investigation proposal.
