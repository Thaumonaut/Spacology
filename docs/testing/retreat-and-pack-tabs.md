# Retreat and pack inventory checks

Retreat is available in the Ops header and during an active encounter. Confirmation ends the voyage, retains its existing recovery inbox, and discards unclaimed pack cards. An unfinished encounter gives no rewards. The end screen offers a new voyage; a retreated save stays ended after reload and cannot relaunch through the battle URL. The separate Weaver save uses the same behavior.

Take all preserves the currently selected inventory tab. Individual equipment Keep actions still select the relevant inventory category. Crew that cannot fit remain unresolved in the pack.

Headless checks in `/tmp/playwright-test-retreat-packs.cjs` passed:

- Mixed equipment and crew claims with each of the four inventory tabs selected.
- Full reserves leave blocked crew in the pack; repeated Take all does not duplicate equipment.
- Retreat cancellation preserves state; confirmation ends the run and clears the open pack.
- Reload persistence, stale battle-result rejection, inbox access, battle-URL replay prevention, and starting a new voyage.
- Combat cancellation and retreat, no unfinished encounter rewards, and Weaver/main save isolation.
- No browser runtime errors. Ops and combat screenshots were inspected at 1440 × 900.
