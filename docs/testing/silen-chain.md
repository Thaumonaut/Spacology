# Silen extra-turn checks

Unit coverage lives in `tests/unit/aether-rules.cjs` and `tests/unit/formation-rules.cjs`. Headless combat/UI checks use `/tmp/playwright-test-silen-sustain.cjs`.

Rising Current now gives immediate extra turns, rather than resolving all damage in one action. Check one direct hit and one payment per resolver call, increasing multipliers, separate skill/turn counters and ultimate charge, timeline EXTRA entries, normal-turn cooldown preservation, and individual animations when stepping. Ready ultimates may interrupt; target death retargets to a living enemy and the next wave inherits the ramp. Actor death, an empty/unavailable pool, disabled extra turns or encounter clear cancels the sequence without another payment. Discounts affect only the opening cost. Each new sequence starts at 200%.

Checks cover spending a full pool across kills, a discounted fourteen-turn sequence, refill extension beyond the opening budget, a reservation floor of 8, wave-spawn retargeting, final-enemy basic cleanup, encounter-clear savings, and separate animated attacks against different targets. Regression checks retain the team spending window, separate test-save keys, and existing Weaver kits. Autonomous first-encounter tests check bounded resolution; this is not a full balance pass.

Role-policy cases also check Silen starting with an affordable partial pool, Ivara building Aether at low reserves, surplus/kill/break spending, manual priority, and net-positive refill exceptions.
