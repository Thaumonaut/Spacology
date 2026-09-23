# Characters, swaps, and ranked rewards

Every owned character can be inspected, equipped, deployed, merged, or sold. A duplicate has the same controls and card appearance as any other character. Only one instance of each named character can be deployed across the two rows.

Dropping a reserve character onto an occupied, compatible field slot swaps them. The displaced character returns to reserves; both retain their own rank and equipment. This works with six occupied reserve slots. Dropping another instance of the deployed character onto that character swaps their ranks and loadouts. Invalid moves leave the roster untouched.

Three characters of the same name and star rank still merge automatically. Three two-star characters require field level 5 to merge. The surviving character retains their equipment, and equipment from the consumed characters returns to inventory. Selling also returns the sold character's equipment. Reserve space, rather than a lifetime limit of nine copies, limits acquisition.

For initial balance testing, winning survey encounters 1, 2, and 4 awards one random character in the recovery inbox. Each has a **15% chance of arriving at two stars** (internal rank 1); otherwise they arrive at one star. Name and rank are saved with the battle receipt, so inspection and reload do not reroll them. Keep and Sell are single-use actions. Full reserves leave the reward pending; two-star rewards merge normally and sell for 9 gold.

## Compatibility

Existing saves keep their name-keyed deployed roster. Additional instances retain reserve IDs, and equipment can be keyed by those IDs. A shared character resolver exposes both through the same controls. Deploying an additional instance exchanges its rank and equipment with the name-keyed instance, preserving the existing battle interface. Aether policy remains per named character because only one can be deployed.

## Verification

- `node tests/unit/crew-progression.cjs`: acquisition conservation, full-reserve swaps, rejected-move rollback, equipped merges and sales, ranked rewards, and direct pack deployment.
- Existing headless browser suites: `owned-attunement.cjs` and `reserve-packs.cjs`.
- Headless UI checks: native drag-and-drop for same-name and different-name swaps; duplicate equipment controls; save/reload; invalid-row rejection; full-reserve reward claims; two-star reward persistence; single-use Keep/Sell.
