# Enemy behaviors

Implemented 2026-09-23 from the [traits backlog](../design/enemy-traits-backlog.md). All twelve proposed behaviors are playable, along with Scorcher and Bloodletter variants for burn and bleed. Existing summoners retain their two-call limit.

## Catalogue and encounters

Existing roles carry the matching behavior: **Mender → Medic**, **Sapper → Disruptor**, **Bulwark → Bodyguard**, **Anchor → Standard bearer**, and **Bruiser → Berserker**. Venom Carrier, Hexer, Aether Leech, Saboteur, Duelist, Brood Host, Channeler, Scorcher and Bloodletter are new catalogue roles, available in each of the seven existing factions. Their plates reuse the closest existing faction silhouette; dedicated variant artwork is future work. No new factions were added.

Voyage composition is seeded by the voyage seed, node and wave. The first survey introduces one Medic in wave one and one Summoner in wave two. Sector one uses at most one specialist per regular wave. Sector two and three use up to two, with an additional designated elite at elite nodes. Sector-one elites are Bodyguards, sector-two elites Standard bearers, and sector-three elites Berserkers. Each enemy has a single behavior rather than stacking elite traits.

| Available from | Behaviors |
| --- | --- |
| Sector 1 | Medic, Disruptor, Venom Carrier, Bodyguard, Aether Leech, Summoner |
| Sector 2 | Hexer, Standard bearer, Saboteur, Duelist, Berserker, Scorcher |
| Sector 3 | Brood host, Channeler, Bloodletter |

Swarms remain weak chaff only, ambushes remain Quicksteps, and bosses keep their dedicated two-phase kit. Treasure carriers and all spawned chaff are excluded from trait behavior, including passive auras and death spawning.

## Timings and limits

An **active enemy turn** excludes turns spent broken and the basic attack made while reforming. Breaks cancel charges, duel buildup and guard links, and refund stored Aether. Reforming attacks normally; a new special action must wait until a later turn.

| Behavior | Rule and counter |
| --- | --- |
| Medic | Every third active turn, heals the most injured living ally for 25% maximum HP, capped at missing health. Two uses, no self-healing or revives. Interrupt or finish the patient. |
| Disruptor | Mark for a full turn, then 70% attack and +30 AV delay. Cannot select its last delayed target. Each crew member has 100 AV of delay immunity; barriers prevent the delay. A lost target wastes the stored strike. |
| Venom Carrier | Every second attack applies poison. Barriers block application. |
| Bodyguard | Automatically links to another enemy, preferring a Medic. Intercepts 35% of single-target health damage; this transferred damage is not reduced by guard a second time. Links cannot chain. Area attacks bypass protection. |
| Aether Leech | Every second active turn steals one shared charge instead of attacking, up to two stored. Break/death refunds once, capped by current pool capacity; overflow is lost and recorded in the log. No back-row target is selected. |
| Hexer | Every second attack hexes a front-row target. Next skill costs +1 Aether after discounts; a basic, skill or ultimate clears it. AI checks the increased cost before spending. |
| Standard bearer | Other enemies deal +20% damage while any of its shield remains. Multiple banners do not stack. Break the bearer. |
| Saboteur | Every third attack plants a nonstacking bomb. Existing bombs cannot be refreshed. Cleanse it or shield the detonation. |
| Duelist | Uses a warning turn to mark a front-row target, then repeatedly attacks it: 100%, 120%, 140%, capped at 160%. Break resets; acquiring a new target always requires a warning. |
| Brood host | On death, releases up to two chaff unless broken. Same stats and row cap as summoner children; no recursive births or extra recovery points. Children remain after the host falls and must be cleared to win. |
| Berserker | At or below 50% HP permanently loses all guard and gains +40% damage. Existing breaks remain; healing does not remove rage. |
| Channeler | One full warning turn followed by a 220% strike against the marked front-row target. Break cancels; losing the target wastes the charge. |
| Scorcher | Every second attack applies burn. |
| Bloodletter | Every second attack applies bleed. |

## Crew conditions and cleansing

Effects only apply to living, nonsummoned **front-row** crew. Any barrier or shelter present when the attack lands blocks new conditions, even if that attack exhausts the barrier. Existing barriers absorb later condition damage as normal. Conditions continue after the source dies.

Timers advance **after scheduled crew turns**, never for each hit, follow-up, ultimate, or Silen's immediate extra turns. This prevents repeated-hit and extra-turn kits from multiplying damage ticks. Bleed uses the same scheduled-turn boundary, but only deals damage if the crew member attacked during that turn.

| Condition | Damage | Duration / stacking |
| --- | --- | --- |
| Poison | 3% maximum HP per stack | 3 scheduled turns; up to 3 stacks; reapplication refreshes duration |
| Burn | 6% maximum HP | 2 scheduled turns; reapplication refreshes, does not stack |
| Bleed | 4% maximum HP after an attacking turn | 3 scheduled turns; at most one tick per turn; reapplication refreshes |
| Bomb | 18% maximum HP when the timer reaches zero | Detonates after 2 scheduled turns; no refresh or stacking |
| Hex | Next skill costs +1 shared Aether | Clears after the next action, including a basic or ultimate |

Crew with a healing action, including Veska, automatically prioritize a **field cleanse** when someone has harmful conditions. It removes all conditions from one ally, prioritizing imminent bombs and stacked poison, restores half the healer's normal heal (10 for Veska), builds basic Aether, and consumes the healer's turn. It does not require Aether, so a Leech cannot disable this counter. Healing ultimates cleanse every living crew member they heal. Barriers and Aether discounts are preserved by cleansing.

Downing clears conditions before recovery. Damage ticks use the usual barrier, Last Stand and recovery rules; one downing per action is preserved. A bomb cannot survive recovery and immediately down its victim again.

## Readability and AI

Enemy cards and the first upcoming timeline entry show live intent, target names, heal timing, stored Aether and aura state. Crew cards show conditions and remaining turns. Enemy inspection explains the role, exact rules and automatic counters. Combat logs record charges, applications, cleanses, intercepted damage, refunds and births.

Target scoring gives additional priority to charged enemies, loaded Leeches, linked Bodyguards, active Standard bearers and Medics approaching a heal. Direct healing and charged attacks still respect the normal action queue and break rules.

All counters, target IDs, stored charges, ailment timers and links are plain saved combat data and survive a combat checkpoint. Existing saves acquire behavior fields lazily; there is no voyage reset or save migration requirement.

## Verification

```sh
node tests/unit/enemy-traits.cjs
node tests/unit/aether-rules.cjs
SPACOLOGY_BASE_URL=http://127.0.0.1:4173 node tests/browser/enemy-traits.cjs
```

The browser script runs headlessly by default. It exercises the actual combat resolver, rather than only the isolated rules: charging and interruption, automatic cleansing, tick recovery, bodyguard interception and area bypass, finite brood spawning and unchanged recovery credit, victory gating, Aether refunds, intent rendering, animated presentation and saved state.

A full 21-node voyage is also exercised with a strengthened fixture crew to verify route completion, all encounter formats, rewards and persistence. This verifies mechanics and integration, not final difficulty tuning. Playtest Standard voyages with ordinary crews for encounter duration and target readability before treating the numbers as settled balance.
