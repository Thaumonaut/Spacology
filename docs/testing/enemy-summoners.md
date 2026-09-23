# Enemy summoners

Summoners enter the regular encounter roster after the opening encounter, with at most one per wave. The first survey in the 21-node voyage includes one in its second wave. Swarm, ambush and boss encounters retain their dedicated enemy compositions.

Each summoner spends its turn calling one weaker faction enemy, then attacks on its following turn. It has two calls for the entire battle. A full row saves the call and causes a normal attack instead. The row limit is the encounter's normal field size plus two, capped at seven including any treasure carrier. The card displays **SUMMON NEXT**, **ATTACK NEXT**, or **CALLS SPENT**; breaking takes precedence in its status display.

Reinforcements have 35% of their summoner's maximum health, 70% of its attack, and one shield layer with 60% of its shield strength. They inherit its base speed, element and weaknesses. They wait a full action interval after spawning, cannot summon, and remain after their summoner dies. They must be defeated to clear the wave but add no recovery points. Breaking a summoner interrupts calling; its recovery turn attacks normally.

Faction variants: Brood Reliquary, Spore Nursery, Prism Loom, Tide Hatchery, Ember Broodmother, Assembly Nest and Echo Nursery. These initially reuse the faction's anchor artwork; their reinforcements use its chaff artwork.

## Verification

Run `node tests/unit/enemy-summoning.cjs` for call limits, alternating attacks, row capacity, full-row retry and intent, break/death guards, child stats, unique IDs, non-recursion and faction definitions.

Headless browser verification exercises the actual battle resolver and animated call: natural generation in the first survey, two calls separated by attacks, delayed child action, break interruption, child attacks, unchanged recovery points, and victory only after the last reinforcement dies. Verify the reinforcement appears in the enemy row and action timeline, and inspect its card for its rules.
