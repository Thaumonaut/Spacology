# Ops recovery controls and combat readability

Crew can be sold directly from either formation row. Equipped gear returns to inventory. When another copy of that character remains, it is promoted into reserves without increasing occupied reserve slots beyond the existing count.

Pack crew cards use their full height for artwork, with Keep and Sell stacked beside the portrait. The supply strip remains 156 pixels high.

Ship details now expose quick equip, explicit slot replacement, unequip, dismantle and a preview of the next part tier. Upgrading consumes the selected copy and 8 scrap; an equipped part upgrades in place. Each of the six standard ship parts has one II tier. Battle effects and descriptions share `SpacologyExpedition.shipParts`.

Combat damage events record HP and barrier values before and after each hit. Presentation follows those events in resolution order, revealing health loss at each impact rather than repainting final HP repeatedly. Dead attackers and targets cannot generate more hit events. Damage text is at least 32 pixels, bold and outlined, and lasts 1 second. Status text is 15 pixels and lasts 1 second. Text stays upright and fades only near the end. Impact spacing follows attack tempo (100 milliseconds at normal speed, with a 45-millisecond floor); lingering text does not delay attacks. Particle lifetimes and motion use elapsed time so high-refresh-rate screens do not shorten readability.

Last Stand is enabled by default and can be toggled in Voyage Settings for the next encounter. Each crew member survives their first lethal hit at 1 HP, with protection until their next normal turn. It resets when a new battle is built. Ultimate interrupts do not end protection. Later lethal hits can kill normally after protection ends.

Verification:

- Crew progression unit tests, including a full-reserve field sale that promotes a retained copy, passed.
- Aether resource unit tests and the dedicated Weaver burst browser checks passed.
- `/tmp/playwright-test-ops-recovery.cjs`: full-reserve sales from both rows, gear retention, ship copy conservation, quick equip, in-place upgrade, unequip, explicit replacement, settings persistence, and portrait sizing at 1440 and 1024 pixels passed.
- `/tmp/playwright-test-combat-impact.cjs`: upgraded ship effects, Last Stand protection and expiry, disabled mode, no extra damage against a dead target, HP reveal of 100 → 70 → 40 synchronized with the two numbers, readable text lifetime, and completion of a full animated encounter passed without browser errors.

Screenshots inspected: `/tmp/pack-portraits-1440.png`, `/tmp/pack-portraits-1024.png`, `/tmp/combat-readable-impacts.png`.

The follow-up `/tmp/playwright-test-fast-readable.cjs` verifies faster sequential hits, 3.2-second values, and a simulated 120 Hz text lifetime, alongside the full animated encounter.
