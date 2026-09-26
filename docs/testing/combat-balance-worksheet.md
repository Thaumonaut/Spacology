# Combat balance worksheet for Jev

Use this to compare crew and enemies in the **current playable build**. The goal is a roster in which different attack shapes and support effects solve different encounters, and a Hard loss can be traced to a choice the player could have made differently. Numbers below are a measuring method and prototype starting points, not final balance targets.

## First, check what is actually playable

The displayed kit is not always the combat implementation. The [session loader](../../prototypes/watchable-fight.html) temporarily maps many named characters onto older combat actors. For example, Dolores's displayed skill promises a detonation that splashes adjacent specimens, but her current combat actor is Pyre, whose regular action is a focused hit. Idris's displayed swarm is currently Mote's whole-line attack. Ranging Sight and Survey Lance already add a weaker hit on another enemy, but they do not use adjacent positions or create a character's own blast skill. Mark each tested move as **implemented**, **partially implemented**, or **description only**. Balance what happens in the battle, then separately note where the kit needs implementation.

## A quick calculation before simulation

For each hit on each target, estimate displayed health damage as:

`round(attack × move multiplier × other damage bonuses × (1 + 0.35 if broken + 0.12 × fracture stacks) × (0.40 if shielded else 1))`

This omits some traits, gear, rounding order and effects that change partway through a multi-hit action; use the live resolver for final comparisons. Ordinary non-Weaver basics have a `0.75` move multiplier; Weaver basics have `1.25`. Generic single-target skills gain a further `1.5` Aether damage multiplier, while dedicated Weaver kits set their own multipliers. Regular combat actions wait `10,000 / combat speed` Action Value (AV) before acting again. A character whose displayed speed is 10 normally has combat speed 100 and waits 100 AV. Immediate extra turns and ultimates need separate accounting.

Example: a 12-attack character's ordinary basic into an intact shield deals about `round(12 × 0.75 × 0.40) = 4` health damage. The same basic after a break deals about `round(12 × 0.75 × 1.35) = 12`. That low shielded number can be appropriate **if** the action also earns useful Aether, removes guard, applies a condition, or sets up another attacker. Record those effects next to the damage number.

Do not add guard damage, healing and Aether into one invented “power score.” Keep these columns separate:

| Character and move | Target pattern | Health damage, shielded / broken | Guard removed | Aether spent / gained | Ultimate charge | Healing / barrier | AV advanced or delayed | Trigger or setup required |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example: basic, 12 attack | One | 4 / 12 | Measure in game | 0 / +1 | Measure in game | 0 | 0 | None |

For repeated ordinary actions, `damage per 100 AV = damage per action × 100 ÷ (10,000 / combat speed)`. This is a rough throughput comparison, not a substitute for checking when a kill, break or refill occurs. For an enemy, use the same timing formula with its actual post-scaling speed and attack damage to estimate incoming pressure. A boss's heavier third attack, summons, status effects and broken turns must then be added as separate events.

## Attack shapes to prototype

These percentages are **starting hypotheses for the same action cost and cooldown**. Their purpose is to create matchup tradeoffs. Compare actual health and guard outcomes with one, two, three and four enemies before adopting any of them.

| Shape | First prototype | Strong when | Weak when | Candidate |
| --- | --- | --- | --- | --- |
| Focused | 250% on the chosen target | One dangerous foe or boss | Several simultaneous threats | Beatriz / Ivara |
| Blast | 160% on the chosen target, 50% on each immediate neighbor | A priority target has nearby escorts | A lone boss or enemies spread apart | Dolores |
| Bounce | Four hits at 55% each, retargeting after a kill | Several shields or enemies with low remaining health | Repeated hits on one armored boss | Idris |
| Sweep | 65% on every enemy | Several weak enemies or broad mark setup | A lone high-health enemy | Stella / Yusuf |

For a three-enemy formation, these begin at 250%, 260%, 220% and 195% total attack respectively. Total damage is only a first check: focused damage can prevent an enemy turn, blast requires positioning, bounce can break a shield during its sequence, and sweep can apply effects broadly. Avoid giving bounce one full ultimate-charge award, condition application or guard break per hit by default; that can make it dominate even when its raw damage is modest. Specify each move's per-action and per-hit effects separately.

For deliberate play, the player should be able to predict targeting. Give enemies stable, visible positions for blast. For bounce, choose a visible rule such as “marked target first, then the living enemy with the most guard; ties go left to right.” Repeats on a lone target can use reduced damage if needed. A hit that kills its target should seek another living enemy rather than disappear.

## Test grid

Run every proposed change through the **actual battle resolver**, with the same saved state and random seeds before and after. Change one rule at a time. Start with at least 20 paired seeds for each fixture; widen the sample only when results are noisy or close to a decision boundary.

| Fixture | What it tests |
| --- | --- |
| One shielded boss | Single-target value, repeated-hit concentration, guard break timing |
| Three enemies in a visible line | Focus versus blast versus bounce versus sweep |
| Four weak enemies across waves | Overkill, retargeting and whether any hits are wasted |
| One protector plus two fragile enemies | Whether targeting and splash offer counterplay |
| One cleanser or condition-resistant enemy | Whether an alternate team route remains viable |
| Early voyage, few upgrades | Whether the character works before a full synergy engine exists |
| Late voyage, earned upgrades | Whether synergies become automatic wins |

Record: wins, timeouts, crew downs, full recoveries, elapsed AV, enemy actions, damage to health, guard removed, Aether spent/generated, useful healing/barrier, and how often each move fired. Report the median and spread, plus a few representative battle logs. Do not infer a player win rate from one scripted lineup.

For crew comparisons, swap one character into the **same team and encounter**, holding gear, rank and seed fixed. Then repeat in a second team that supports a different strategy. A character who improves every measured outcome in every matchup may be too generally strong; a character who loses everywhere and contributes no unique break, control, economy or protection needs work. Check the whole team as well as the individual move: a weak-looking support hit may fund a powerful ally.

For enemy comparisons, hold the crew fixed and vary one enemy stat or behavior. Ask which visible counter the player could have chosen in Ops. A tougher enemy should change the best preparation or target order, not merely add time to every fight. Record whether a loss came from an inspectable weakness, a resource tradeoff, a timing mistake, or an unpredictable outcome.

## A result Jev can send back

```text
Build/version:
Character or enemy changed:
Exact rule changed:
Team, rank, gear and Aether settings:
Enemy fixture, difficulty and voyage round:
Seeds and number of fights:
Before → after: wins / full recoveries / downs / median AV / enemy actions:
One representative fight where the choice mattered:
One fight that felt unfair or automatic:
Does another team or attack shape now have a reason to be chosen?
```

The existing [browser balance harness](../../tests/balance/round-timeline.cjs) shows how to run seeded fights through the real resolver, but its scripted teams and older round fixtures need updating for this worksheet. Use the current voyage save and verify that every tested character's displayed kit matches its combat action before drawing conclusions.
