# Silen extra-turn checks

Unit coverage lives in `tests/unit/aether-rules.cjs` and `tests/unit/formation-rules.cjs`. Headless combat/UI checks use `/tmp/playwright-test-silen-live-cost.cjs`.

Rising Current now gives immediate extra turns, rather than resolving all damage in one action. Check one direct hit and one payment per resolver call, increasing multipliers, separate skill/turn counters and ultimate charge, timeline EXTRA entries, normal-turn cooldown preservation, and individual animations when stepping. Ready ultimates may interrupt; target death retargets to a living enemy and the next wave inherits the ramp. Actor death, an empty/unavailable pool, disabled extra turns or encounter clear cancels the sequence without another payment. The first extra turn costs 2 Aether, then each costs 1 more than the previous; discounts affect only the opening cost. Each new sequence starts at 200%.

Checks cover spending an affordable portion of a full pool across kills, a discounted opening hit, refill extension, a reservation floor of 8, wave-spawn retargeting, final-enemy basic cleanup, encounter-clear savings, and separate animated attacks against different targets. Regression checks retain the team spending window, separate test-save keys, and existing Weaver kits. Autonomous first-encounter tests check bounded resolution; this is not a full balance pass.

Role-policy cases also check Silen starting with an affordable partial pool, Ivara building Aether at low reserves, surplus/kill/break spending, manual priority, and net-positive refill exceptions.

## Cost comparison, Hard

Before changing combat code, a headless simulation compared the old 1-Aether extra turns, flat 2-Aether extra turns, and rising 2/3/4… costs. Each row used 24 seeded battles with four unranked crew (Silen, Daven, Roonie, Ivara), no gear, and a fixed route. Mean combat time is in action value (AV).

| Battle | Old cost | Flat 2 | Rising 2/3/4… |
| --- | ---: | ---: | ---: |
| Round 7 | 179 AV | 311 AV | 339 AV |
| Round 14 | 278 AV | 370 AV | 357 AV |
| Round 21 | 358 AV | 544 AV | 605 AV |

The rising-cost build reproduced 24/24 wins and full recoveries at all three rounds when run without simulation overrides. These are isolated battle fixtures, not a full-voyage replay. They show a slower Silen chain, but this team still beat every sampled fight cleanly.
