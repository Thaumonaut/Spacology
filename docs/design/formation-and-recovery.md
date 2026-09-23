# Formation roles and downed recovery

Primary damage dealers and protectors deploy in front. Supports deploy in back. Damage/support hybrids and sub-DPS can use either row. `prototypes/formation-rules.js` contains the complete assignment table and updates the shared character metadata.

Arunima deploys in front; Roonie deploys in back. Ivara is a damage / reservoir hybrid; he, Hanae, Quill, Maul and other hybrids can use either row. Back-row crew still use their abilities and generate Aether, but cannot be targeted or damaged by enemy attacks. The prior 18% target weight was inconsistent with the safe-back-row UI and has been removed for voyage battles.

Existing formations are migrated without removing characters or gear. Valid cells stay in place. If a required row is full, a flexible crew member can move to the other row; otherwise the incompatible character returns to reserves. Temporary reserve overflow is preserved and must be resolved before launch. Direct battle links enforce the same migration and launch checks.

## Recovery playtest

Recover is the default alternative to Last Stand. A downed character:

- Counts as a down for encounter statistics and safe-recovery objectives.
- Returns with 50% maximum health, rounded up.
- Removes 50 AV from the remaining battle deadline, without advancing other units' turns.
- Waits at least one normal turn interval before acting again.
- Cannot be downed twice by hits from the same action.

Repeated downs repeat the time cost. If fewer than 50 AV remain, recovery consumes that remainder and the next resolution ends at extraction. The timeline includes fractional-round extraction markers, and the deadline shows recovery time lost. Damage presentation shows zero HP at the lethal impact before restoring health. No starting Aether or ultimate charge is granted by recovery itself.

Voyage settings offer Recover, Last Stand and No Recovery. They do not stack, and changes apply to the next encounter. An existing explicit Last Stand opt-out remains No Recovery until the player selects a mode. With Last Stand or No Recovery, losing the entire front row ends the encounter while back-row crew remain untargetable. The lab's original standalone behavior is unchanged.

The 50% health and 50 AV values are initial playtest choices; they are not a claim to match Currency Wars exactly.

Validation: `tests/unit/formation-rules.cjs`, `tests/unit/down-recovery.cjs` and headless `/tmp/playwright-test-party-rules.cjs`. Browser checks cover saved formations, gear conservation, placement buttons, safe targeting, repeated downs, same-action protection, deadline exhaustion, Last Stand isolation, fractional extraction markers and animated health restoration. Screenshots: `/tmp/party-rules-ops.png` and `/tmp/party-rules-battle.png`.
