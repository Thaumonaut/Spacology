# Copy progression playtest

Prototype rules introduced 2026-09-22:

- One deployable character per name; reserve copies combine automatically. A ★★ copy represents three ★ copies, and ★★★ represents nine. Copies use real reserve slots until combined.
- Six reserve slots, separate from on/off-field capacity. Three matching copies of the same rank combine. ★★★ requires field level 5; earlier copies wait visibly in reserve. Nine total copies is the collection cap.
- ★★: +35% base health, +25% base attack. ★★★: +80% base health, +60% base attack. Gear, placement and harmonies remain attached to the main character through merging.
- Attunement creates one copy of owned crew for **2 crystals**. Discover new characters through packs. Barracks and direct material-paid ranks are removed.
- Basic gear remains 6 scrap; standard advanced recipes remain two ingredients plus 8 scrap. Lumen Conduit costs 12 scrap + 2 crystals (35 opening Energy, +20% ultimate damage). Prismatic Dynamo costs 16 scrap + 2 crystals and occupies a ship slot (all crew start with 30 extra Energy).
- Each successful battle pays one crystal, with the existing 22% bonus chance / four-win pity granting one more. A voyage goal grants one crystal. Every pack theme has the same 8% chance to replace its 4-scrap material receipt with one crystal. These are starting tuning values, not a proven final economy.
- Keep All leaves blocked cards in the open pack. A full reserve can accept a copy if merging makes it fit, or a new character can be deployed straight from a pack into an available team cell. Retrying Keep All can use room freed by earlier merges.
- Only max-rank crew auto-scrap by default. All-owned auto-sell/scrap remains an explicit inventory preference.
- Battle return links open Ops directly, without painting the title screen. Reports remain once-only, and the sixth result opens the voyage summary.

## Existing saves

A one-time migration preserves characters, equipment and money. Existing material-paid ranks are mapped to the corresponding new rank (old ranks II/III map to ★★★); they are not downgraded by the new level gate. Unspent elemental attunements refund their original 12 scrap and 1 crystal each. Reserves above six are retained and shown as overflow; deploy or dispose of surplus crew before launching. The migration runs once, including after reload.

## Checks

1. Obtain two copies of a deployed ★ character. Each occupies reserve space; the third total copy makes ★★ and frees both slots. Gear and board cell stay intact.
2. Collect nine total copies before field level 5: hold a ★★ main and two ★★ copies. Level the field to 5 and verify automatic ★★★ merge.
3. Fill six reserve slots. Verify no character-copy payment or field-to-reserve move succeeds without room. A merge that frees room must succeed.
4. Open a pack with reserves full. Keep All must preserve blocked cards and their saved state after reload. Sell a reserve or deploy directly from the pack, then finish resolving.
5. Inspect a spare copy and sell/dismantle it. A ★★ copy returns three times the value of a ★ copy; other copies, the deployed character and equipped gear are unchanged.
6. Craft both crystal recipes. Verify exact payment, no duplicate output, and actual opening energy/ultimate modifiers in battle.
7. Complete six encounters and continue after each. Ops should open immediately, rewards should never duplicate on reload, and the voyage summary should finish the run.

Automated checks: `tests/unit/crew-progression.cjs`, `tests/browser/owned-attunement.cjs`, `reserve-packs.cjs`, `crystal-controls.cjs`, and `voyage-return.cjs`. All browser tests run headlessly.
