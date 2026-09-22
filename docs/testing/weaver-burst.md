# Weaver burst and refill pass

The six Weavers now use 125% basic attacks with increased base attack stats. Arunima's Full burst spends 3–8 Aether for 300–800% attack against each living specimen. Hanae's skill costs 1 and restores 5; Hanae/Ivara/Roonie ultimates restore 4/6/4 once per cast. Veska's healing skill returns consumed Refrains as Aether, up to 3. Daven's barrier skill also attacks for 225%.

`node tests/unit/aether-rules.cjs` passed both the existing resource tests and new burst/refill cases. Headless browser checks in `/tmp/playwright-test-weaver-burst.cjs` verified:

- 8 charges produce 800% attack; a 3-charge cast produces 300%.
- Roonie's discount produces the same maximum damage for 7 charges, leaving 1.
- A 2-charge reservation limits Arunima to spending 6.
- Hanae pays 1 before gaining 5; at zero she uses a basic instead.
- Refill ultimates trigger on a low shared pool while allies are healthy, consume individual charge, and restore Aether once rather than once per ally or hit.
- Overflow caps at 8; no extra basic count is recorded for skill/ultimate refills.
- Veska's Refrains refund correctly and Daven's skill deals damage and grants barrier.
- The team can refill between two full bursts. UI labels show the new variable costs and net-positive skill.

`/tmp/playwright-test-weaver-pacing.cjs` ran 12 seeds at each of encounters 1, 3 and 6 using the six-character, level-5 test preset without additional gear or rank upgrades. All 36 runs finished within the simulation action guard, used basics and skills, and kept the pool in bounds. Later encounters exercised refill ultimates and full bursts autonomously. [Raw results](weaver-burst-pacing.json).

| Encounter | Wins | Observation |
| --- | --- | --- |
| 1 | 12/12 | Clears before ultimates charge; representative run uses 5 basics and 9 skills. |
| 3 | 12/12 | Refill ultimates occur naturally; representative run uses 7 basics, 13 skills and 2 ultimates. |
| 6 | 0/12 | Unupgraded, unequipped team times out; representative run uses 11 basics, 32 skills and 12 ultimates. |

Before this pass, the same first-encounter seed check gave 8 wins and 4 timeouts. The older assertion that every first encounter must use an ultimate no longer applies: these encounters now end before individual charge fills. Targeted ultimate tests and later-encounter checks cover that behavior instead. These are isolated encounters, not a progression-balanced full-voyage test.
