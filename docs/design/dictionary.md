# Player-facing combat language

Use familiar game terms for mechanics. Keep Aether, character move names, enemy names, and team trait names as Spacology's own vocabulary. Explain a special term when the player first encounters it, rather than asking them to learn a second word for a common action.

| Say in the game | Meaning | Avoid in general UI |
| --- | --- | --- |
| Enemy | A target on the opposing side | Specimen, except in story and taxonomy |
| HP / health damage | Damage to health | Unqualified “damage” when shield damage is meant |
| Shield / shield damage | Enemy protection and progress toward a Break | Guard, guard pressure, shred |
| Barrier | Temporary health protection on crew | Shield when referring to a crew barrier |
| Break / Broken | Removing the enemy's last shield layer / its exposed state | Several names for the same shield event |
| Weakness | Element that removes an enemy's shield faster | “Soft to” without stating the effect |
| Mark | A target flag used by follow-ups and other abilities | Survey stack; Survey is also a voyage objective |
| Status effect | A condition such as poison, burn, bleed, hex or bomb | Ailment and condition used interchangeably |
| Damage over time (DoT) | Repeated damage from poison, burn or bleed | Calling every status effect a DoT |
| Cleanse | Remove status effects | Cure, purge and field cleanse for the same action |
| AoE | An attack that hits every enemy | Area, sweep and whole-line as competing category labels |
| Multi-target | One chosen enemy plus another target | AoE when the attack does not hit everyone |
| Splash | Full damage to one enemy and reduced damage to nearby enemies | AoE if position matters |
| Bounce | A fixed number of hits that can move between enemies | Follow-up or extra turn for the same action |
| Follow-up attack | An extra attack triggered by another action | Chain, answer or second swing as a generic label |
| Team bonus | A bonus unlocked by deploying crew with matching traits | Harmony as the only explanation |

**Aether** is the shared resource generated mainly by basic attacks and spent on skills. **Ultimate charge** is separate and belongs to each character. Use those full names together when explaining costs so “energy” or “charge” cannot refer to either pool.

**Action Value (AV)** is the turn timer. Lower AV acts sooner; Advance removes AV and Delay adds AV. A round is 100 AV. Display “AV” in compact combat UI and spell it out in help text.

An enemy with any shield layer takes **60% less health damage**. Matching its Weakness removes shield faster. A Break removes the last layer, delays the enemy and makes it **Vulnerable** (+35% health damage) until it recovers. In the current combat rules, recovery restores its shield and it attacks on that turn; some team bonuses can make it skip turns first. Avoid the old wording that every Break automatically denies an entire turn.

**Fracture** is a named damage-taken stack: each stack adds 12% damage taken, up to 12 stacks in the live resolver. It is not a DoT. Where space allows, show “Fracture · +12% damage taken per stack.” **Blight** is a team trait name, not a synonym for every status effect or every DoT. **Survey** is the voyage objective; combat targets carry **Marks**.

Poison, burn and bleed are DoTs because they can deal damage after scheduled turns. Bleed triggers only after an attacking turn. Bomb is delayed damage, not a DoT. Hex raises the next skill's Aether cost and deals no damage. Cleansing removes these status effects. Extra turns, ultimates and follow-ups do not advance their timers.

The combat implementation still uses older identifiers such as `frac`, `survey`, `shred`, `ailments`, `aoe` and `SpacologyWeavers`; rename display copy independently of saved-state keys and rules. Character and story prose can still use scientific language. Future splash and bounce skills should use the labels above when they become playable, with visible target order and hit counts.
