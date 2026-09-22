# Field XP

Field levels now grow through repeated small purchases and victory XP. The aim is to leave gold available for packs while letting players invest in additional crew slots earlier.

- Buy 4 XP for 4 gold per click.
- Each victory grants 12 XP; defeats and retreats grant none.
- The next level costs `12 + 8 × (current level − 1)` XP.
- Progress persists and excess XP carries into the next level.
- Existing alternating unlocks remain: an additional crew slot, then a ship slot.
- Stop at 12 crew capacity. Purchases are disabled at the cap or after the voyage ends.

| Reaching level | XP for this step | Unlock | Total XP from level 1 |
| --- | ---: | --- | ---: |
| 2 | 12 | 5 crew | 12 |
| 3 | 20 | 2 ship slots | 32 |
| 4 | 28 | 6 crew | 60 |
| 5 | 36 | 3 ship slots; existing three-star crew gate | 96 |
| 6 | 44 | 7 crew | 140 |

Five wins unlock six crew slots without any gold investment. Advancing sooner or building a larger team requires paid XP. These are initial playtest values, not a full economy balance pass.

Old saves keep their existing level, crew capacity and ship slots, beginning with zero partial XP. Previously resolved battles are not credited retroactively. Pending battle results award XP when returning to Ops; the advanced round and rewards are saved together before the result is consumed. Recovery reports and inbox receipts display earned XP, and inbox receipts list new unlocks.

The existing strip between crew rows contains the level, XP bar, next unlock and purchase button without increasing its height.

Validation: `node tests/unit/field-progression.cjs`, `node tests/unit/crew-progression.cjs`, and the updated `tests/browser/owned-attunement.cjs`. The headless `/tmp/playwright-test-field-xp.cjs` checks purchases, persistence, battle-result idempotency, defeat rewards, inbox receipts, maximum level, and layouts at 1440 and 1024 pixels. It exercises both a normal losing encounter and a controlled victory with boosted test-unit stats; these are integration checks, not combat balance measurements.
