# Enemy traits: future work

Recorded 2026-09-22. Status: brainstorm saved for future design and implementation. These behaviors, timings and priorities are proposals, not finalized balance or implemented features. The existing summoner behavior is documented separately in [enemy summoners](../testing/enemy-summoners.md).

Goal: make target choice and team composition matter through distinct enemy behavior. Each regular enemy should have one clear gimmick, a visible tell, and an accessible counter. Consider two complementary traits for elites later. Map these ideas onto existing catalogue roles where appropriate (especially Mender, Sapper, Bulwark and Anchor) before adding redundant archetypes.

## Candidate behaviors

| Working name | Proposed behavior | Counterplay |
| --- | --- | --- |
| Medic | Every third turn, heals the most injured ally. Limited uses; no revives. | Finish a target before the heal or break the medic before it acts. |
| Disruptor | Charges a strike that delays a front-row character's next action. Cannot delay the same character twice consecutively. | Interrupt the charge or protect the marked target. |
| Venom carrier | Applies stacking poison that ticks on the affected character's turns. | Cleanse, prevent application with a shield, or stop the source before stacks build. Shield prevention is a proposed rule to define explicitly. |
| Hexer | Marks a character so their next skill costs one additional Aether. Mark expires after their next action. | Clear it with a basic attack or pay the extra cost. |
| Aether leech | Periodically steals one shared Aether and visibly stores it. Breaking or defeating it returns the stolen charges. | Recover the charges before the main DPS acts. |
| Bodyguard | Intercepts part of the damage to one linked enemy. Breaking it removes the link. | Break the guard, use area damage, or overwhelm its protection. |
| Standard bearer | Buffs enemy damage or speed while its own shield is intact. | Remove its shield early. |
| Saboteur | Plants a bomb on a front-row character that detonates after their next two actions. Cleansing removes it. | Cleanse or prepare a barrier before detonation. |
| Duelist | Marks one front-row character and repeatedly attacks them for increasing damage. Breaking resets the sequence. | Sustain the marked character and interrupt the buildup. |
| Brood host | Releases weak enemies on defeat unless defeated while broken. | Time the finishing blow during a break window. |
| Berserker | Gains damage below half health but loses shield protection. | Commit to finishing it instead of leaving it wounded. |
| Channeler | Spends a full turn preparing a major attack, with a visible countdown in the turn order. | Break or defeat it before its next turn. |

## Damage-over-time variants

- **Poison:** modest damage that stacks with repeated applications.
- **Burn:** stronger, short-duration damage; reapplication refreshes its duration.
- **Bleed:** damage when the affected character attacks. Cap triggers so it does not disproportionately punish Silen's repeated turns or multi-hit kits.

Before implementing, define stack limits, duration and tick timing, whether shields prevent application or absorb ticks, and how cleansing, downing and recovery interact with each effect. Distinguish an action from each individual hit.

## Fairness and readability

- Prefer action delay over frequent hard stuns. If added, a full stun should be rare, telegraphed and followed by temporary stun immunity to prevent repeated lockouts.
- Preserve the safe back row. Hostile targeting and character debuffs should respect formation rules; shared-pool Aether theft needs its own clear explanation.
- Show intent on enemy cards and the timeline: **HEAL NEXT**, **DELAYING SILEN**, **2 AETHER STORED**. Inspecting an enemy should explain timing and counters.
- Counters must work with automated crew decisions and pre-battle preparation, without requiring reactive manual input. Evaluate AI responses to heal windows, marked allies and interruptible attacks.
- Keep recovery and spawn loops finite. Healing must not create repeated recovery credit; spawned helpers must not recursively spawn or allow reward farming.

## Suggested first batch

Medic, Venom Carrier, Disruptor, Bodyguard and Aether Leech, alongside the existing summoners. This is a suggested starting order, not a scheduled commitment.

Test combinations that create readable priorities: a bodyguard protecting a medic, poison enemies supported by a healer, and an Aether leech holding charges needed by the crew's main DPS. Introduce traits individually before combining them. Check encounter duration, control lockouts, cleanse availability and repeated-turn interactions before increasing complexity.
