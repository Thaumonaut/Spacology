# Team Aether priorities

Auto reserves the useful affordable burst budget for a living, useful conduit: Arunima first, then Silen with Extra turns enabled, then an enabled Nour overcharge. Arunima defaults to Full burst and Silen defaults to Extra turns unless explicitly disabled. Manual “Save for this skill” takes precedence; Build charges excludes a unit from reservation ownership. Reservations adapt to discounts and a reservoir dying.

The order is:

1. Urgent healing or protection for crew below 30% health.
2. Useful skills that increase the pool, including Hanae or Roonie at only one charge and Veska with enough Refrains to refund more than she spends.
3. Setup that directly enables the priority attacker: Roonie discounts that attacker, or a charge support readies their ultimate or a refill ultimate. Roonie does not reapply an existing discount. His +2 net refill can cross the reservation even when no new discount is needed. Ivara now spends 2 on focused damage, respecting the burst reservation and using basics for easy finishes; his ultimate is offensive and keeps its individual charge.
4. The reserved burst; other crew use basics to build charges.

A burst attacker can use one basic to wait for more charges when projected allied actions can fill the pool before their next turn. Never wait two consecutive own turns. Spend available charges sooner when the crew is under pressure, a break window is open, a specimen can be finished, or the next turn would miss the deadline. When the deadline is approaching, other units can also use their useful skills rather than hoard charges.

After the owner's skill, reservations pause for a team-sized count of crew turns. Ready ultimates use their separate charge: emergency healing is selected before refills, and refills before damage when a burst owner is present. Existing ultimate-usefulness checks still apply.

Combat logs state why a basic or skill was selected. The Aether meter tooltip reports the current reservation, and its details explain the rules. This is a bounded heuristic, not a full simulation of all possible future turns; future kits may need their own setup evaluation.

Validation: `tests/unit/aether-rules.cjs`, existing `tests/browser/aether-pool.cjs`, and headless `/tmp/playwright-test-aether-priority.cjs`. Cases cover setup targeting, refill deadlocks, emergency healing/protection, repeated buff prevention, bounded waiting, deadlines/breaks/finishers, manual modes, discounted bursts, owner/reservoir death, ultimate order, default toggle persistence and full resolver rotations. Eight seeded first-encounter runs completed; this is not a full balance pass.

## Storage and enemy health

Capacity is 6 base, plus 1 per living deployed Weaver, plus character capacity passives. Ivara and Aurel each add 2 more. All ten characters with Aether roles count, including Coda, Aurel and Nour. The six-character Weaver team has 14 capacity and starts at 3. Reserves, summons, dead units and duplicate entries do not add capacity. Losing Ivara reduces the cap by 3; excess current charges are discarded. Returning capacity never creates charges.

Arunima scales past 8: at 14 charges she deals 1400% attack, or pays 13 with Roonie's discount for the same multiplier. The planner uses the smallest burst that can defeat all currently visible enemies. Against a durable enemy it can still spend the entire available budget. A basic is preferred when it can finish the target without giving up useful area damage, recovery or refill effects. Damage estimates account for guard pressure, vulnerability, ailments and opening boosts, and deliberately omit follow-up damage.

Offensive ultimates can wait when one or two remaining enemies can be finished by crew basics before those enemies act and before extraction. Urgent recovery/refill ultimates remain usable. Single-target ultimates prefer meaningful damage over extreme overkill on a nearly defeated enemy.

The Ops sidebar displays the deployed team's capacity and a breakdown. Tests additionally cover 14-charge scaling, dynamic discounts, 5-charge versus full-pool attacks, cleanup basics, ultimate target choice and deadline exceptions.

Silen pays 2 for the opening 200% attack; successive immediate extra turns cost 2, 3, 4 Aether and so on (+25 percentage points of attack each). Silen reserves his full pool budget rather than estimating a ceiling from his first target’s health. Each extra turn is a separate resolver action and payment. On a kill he targets the healthiest remaining enemy, carrying the ramp into subsequent waves too. Refills extend the live sequence. He continues while he can afford the next increasing cost above another spender’s reservation floor; an encounter clear ends the sequence without spending any remainder. Roonie discounts only the opening cost, leaving more Aether for a later extra turn. Each turn has its own animation and ultimate-charge award; normal ultimate interruptions remain possible. The timeline shows the next extra turn. The post-burst team spending window begins after the extra turns, so they do not consume teammates’ opportunity to spend.


## Spending by combat role

Main damage dealers use skills aggressively when affordable, while respecting the selected spender's reservation. Silen starts his sustained sequence immediately rather than using a basic to wait for a larger pool. Arunima retains her bounded one-turn wait when it can fund her single large burst.

Damage/support hybrids are conservative sub-DPS in Auto: below 75% of pool capacity, they normally basic to build Aether, including during the post-burst spending window. They may spend to secure a kill a basic cannot achieve, exploit a broken/vulnerable target, or beat the deadline. A near-full pool permits routine skills when no active reservation prevents it. Net-positive refills, useful setup, support actions and urgent recovery bypass this conservation; manual skill priority overrides it. Formation roles supply the policy, so Ivara and other hybrids use the same rule. Character details show the default spending style.
