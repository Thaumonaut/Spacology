# Team Aether priorities

Auto reserves the useful affordable burst budget for a living, useful conduit: Arunima first, or an enabled Nour overcharge. Arunima defaults to Full burst unless explicitly disabled. Manual “Save for this skill” takes precedence; Build charges excludes a unit from reservation ownership. Reservations adapt to discounts and a reservoir dying.

The order is:

1. Urgent healing or protection for crew below 30% health.
2. Useful skills that increase the pool, including Hanae at only one charge and Veska with enough Refrains to refund more than she spends.
3. Setup that directly enables the priority attacker: Roonie discounts that attacker, or a charge support readies their ultimate or a refill ultimate. Roonie does not override the reservation for unrelated discounts or reapply an existing discount.
4. The reserved burst; other crew use basics to build charges.

A burst attacker can use one basic to wait for more charges when projected allied actions can fill the pool before their next turn. Never wait two consecutive own turns. Spend available charges sooner when the crew is under pressure, a break window is open, a specimen can be finished, or the next turn would miss the deadline. When the deadline is approaching, other units can also use their useful skills rather than hoard charges.

After the owner's skill, reservations pause for a team-sized count of crew turns. Ready ultimates use their separate charge: emergency healing is selected before refills, and refills before damage when a burst owner is present. Existing ultimate-usefulness checks still apply.

Combat logs state why a basic or skill was selected. The Aether meter tooltip reports the current reservation, and its details explain the rules. This is a bounded heuristic, not a full simulation of all possible future turns; future kits may need their own setup evaluation.

Validation: `tests/unit/aether-rules.cjs`, existing `tests/browser/aether-pool.cjs`, and headless `/tmp/playwright-test-aether-priority.cjs`. Cases cover setup targeting, refill deadlocks, emergency healing/protection, repeated buff prevention, bounded waiting, deadlines/breaks/finishers, manual modes, discounted bursts, owner/reservoir death, ultimate order, default toggle persistence and full resolver rotations. Eight seeded first-encounter runs completed; this is not a full balance pass.

## Storage and enemy health

Capacity is 6 base, plus 1 per living deployed Weaver, plus character capacity passives. Ivara and Aurel each add 2 more. All nine characters with Aether roles count, including Coda, Aurel and Nour. The six-character Weaver team has 14 capacity and starts at 3. Reserves, summons, dead units and duplicate entries do not add capacity. Losing Ivara reduces the cap by 3; excess current charges are discarded. Returning capacity never creates charges.

Arunima scales past 8: at 14 charges she deals 1400% attack, or pays 13 with Roonie's discount for the same multiplier. The planner uses the smallest burst that can defeat all currently visible enemies. Against a durable enemy it can still spend the entire available budget. A basic is preferred when it can finish the target without giving up useful area damage, recovery or refill effects. Damage estimates account for guard pressure, vulnerability, ailments and opening boosts, and deliberately omit follow-up damage.

Offensive ultimates can wait when one or two remaining enemies can be finished by crew basics before those enemies act and before extraction. Urgent recovery/refill ultimates remain usable. Single-target ultimates prefer meaningful damage over extreme overkill on a nearly defeated enemy.

The Ops sidebar displays the deployed team's capacity and a breakdown. Tests additionally cover 14-charge scaling, dynamic discounts, 5-charge versus full-pool attacks, cleanup basics, ultimate target choice and deadline exceptions.
