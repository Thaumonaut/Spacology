# Shared Aether — combat proposal

This records the initial proposal and earlier implementation passes. Current capacity, health-aware spending and priority rules are in [Aether priorities](aether-priorities.md).

Status: first playable implementation. The user confirmed shared Aether for regular skills, with individual ultimate charge retained. Costs and Weaver assignments are initial tuning values, not a finished balance pass.

## The decision

Give the deployed team one Aether pool. A basic attack funds a later skill, including another character's skill. A roster must balance generation, spending, and when its expensive effects become available.

Use **Aether** for the resource and **charges** for its integer units. Avoid calling it Energy: Energy is already an element and the prototype also uses individual ultimate charge.

Confirmed: Aether pays for regular skills; individual charge still pays for ultimate interrupts.

## First rules to test

| Rule | Starting proposal |
| --- | --- |
| Shared capacity | 6 charges |
| Encounter start | 3 charges |
| Basic action | Costs 0; generates 1 charge after resolution |
| Regular skill | Costs 1–3 charges; consumes the character's normal turn |
| Ultimate | Existing individual charge and interrupt timing |
| Empty pool | Use the character's basic; never skip the turn |
| Wave transition | Preserve the pool; no free refill |
| New encounter | Reset to the starting amount |

Generate once per completed basic action, regardless of hit count or targets. Follow-ups, counters, damage-over-time, summons, and ultimate hits do not generate Aether by default. Avoid a feedback loop in which a chain creates the fuel for more chains.

Basics should still express character identity: a small mark, a light application, modest guard pressure, or another useful low-cost contribution. Skills hold the substantial healing, spreading, control, and burst effects. Depleting Aether changes what the team does rather than making it inert.

## Automatic spending

Keep choices in preparation; combat remains automatic. Put a short **Aether use** setting in character details, initially under an optional disclosure:

- **Build:** prefer basics to fund allies; allow an emergency defensive skill.
- **Auto:** use the skill when its effect is useful and the budget permits.
- **Save for this skill:** make this character the team's single reservation target.

Only allow one reservation target initially. Other elective skills must leave enough charges for that target; emergency healing/protection may override it. Release the reservation when the target dies or its skill has no useful target. After the reserved skill fires, give other ready useful skills a spending opportunity before reserving again. This behavior needs simulation before becoming a default.

Do not use roster order to choose who gets all the resource. Show a short reason in the action log: **Basic · +1 Aether**, **Skill · −2 Aether**, or **Basic · saving for Maul**. The latter is an example of policy wording, not a finalized cost assignment to Maul.

## Aether Weavers

Treat this as a build identity spanning three kinds of kit. The first playable assignments are Coda (Gatherer), Aurel (Reservoir), and Nour (Conduit).

- **Gatherer:** its own basic generates 2 instead of 1. A separate limited support effect could increase an ally's next basic yield.
- **Reservoir:** adds 2 team capacity. Extra capacity does not grant free starting charges or improve generation. It lets the team bank a burst.
- **Conduit:** can spend an additional 1–2 charges to strengthen its own skill. Preview total cost and the exact added effect; never silently spend the whole pool.

These roles should work independently and combine into a recognizable Aether Weaver team. Do not give a free unconditional team-wide generation multiplier to every Weaver: that risks making the type mandatory in every roster. A generator needs a damage/utility opportunity cost, and extra capacity needs a spending payoff to matter.

Existing basics, gear, and optional ship effects must keep a non-Weaver roster viable. Weaver synergies should fund a burst or sustain more demanding skills, rather than being required to cast at all.

## Small UI

- One shared **Aether 3 / 6** pip meter near the battle turn track.
- On crew details: **Basic +1** and **Skill −2**, beside the corresponding effects.
- On a Conduit's skill: **−3**, expanding to **−4: [extra effect]** when overcharge is configured.
- In Ops, a compact team hint such as **Heavy spending — basics will fund your skills**. Avoid a numerical sustainability score until it accounts for speed, skill usefulness, reservations, and generation caps.

No permanent extra management panel. Put resource choices and explanations on the crew card, following the compact gear inspector direction.

## Integration and validation

The resolver now separates light, resource-generating basics from the existing full kit action, which is the paid regular skill. Existing `kit.skill` descriptions are displayed as ultimates, and several lore kits still use borrowed combat implementations. Define the basic/skill/ultimate boundary for a small representative roster before migrating every character.

Implemented: a 3/6 starting pool; Coda gains 2 per basic; Aurel adds 2 capacity while alive; Nour can opt into a +1-cost, +35%-damage overcharge. Regular skills cost 1 for designated support kits, 3 for area kits, and 2 otherwise. Direct damage skills use 150% attack; basics use 75% and apply one stack/mark when appropriate. The first reservation policy pauses for a team-sized number of allied turns after its recipient casts. Emergency healing can override a reservation.

Initial smoke check: 12 seeded first encounters each for a mixed non-Weaver team, a Weaver team, and a heavy-spending team. Outcomes were 9/12, 11/12, and 12/12 wins respectively. Every composition used both basics and skills. These are small encounter checks, not whole-voyage balance evidence.

Next tuning step: compare economy and survival across the voyage. Keep all resource changes in the resolver and emit the change in its event; animation only displays it.

Verify costs are paid once, empty pools fall back to basics, multi-hit attacks generate once, pool caps hold, reservations cannot deadlock, dead crew cannot generate, waves do not refill, and replays reproduce the resource history. Compare generator-heavy, mixed-cost, and spender-heavy teams at multiple speeds. Measure the share of turns using basics, skill starvation by character, wasted generation, damage, survival, and encounter duration. Tune costs and basic strength together before replacing the default combat loop.

## Dedicated six-character roster

Hanae, Ivara, Arunima, Roonie, Veska and Daven now have dedicated basic/skill/ultimate/passive kits, full draft biographies and portraits. See [Aether Weavers](aether-weavers.md). Coda, Aurel and Nour retain their existing prototype traits.

The subsequent Currency Wars-inspired burst pass gives those six stronger 125% basics and explicit skill/ultimate refills. Arunima can spend the current pool capacity, reaching 1400% at 14 charges; Hanae's skill restores a net 4 and Roonie's restores a net 2. Roonie's ultimate restores 6; Hanae's restores 4. Ivara is now a single-target sub-DPS with extra capacity. Full current values and safeguards are in the Weaver document. The original 75% basics and +1-cost overcharge above still describe the other prototype kits.
