# Affix team building: the Brief decides the team, equipment is the gamble

**Prototype, 6 October 2026.** Playable in [`prototypes/affix-lab.html`](../../prototypes/affix-lab.html), measured by
`sim/affix-lab.js`, with method and full results in [the lab notes](../testing/affix-lab.md). It tests a direction
that builds on two proposals written the same day, `session-progression-proposal.md` and
`weaver-voyage-walkthrough.md` (uncommitted in the main checkout when this branch was cut), and on
[modifiers](modifiers.md). The kits are lab abstractions of the real characters, not live combat parity. Where this
contradicts [the design record](design-record.md), the record wins until this is accepted.

**Status.** The affix charter below is new and awaits the user's confirmation. The pool has been cut to the eight
cards that satisfy it. Measurements that predate the charter are labelled as such and will be re-run once the pool is
agreed.

---

## The two questions

**1 · Do affixes change how you build a team?** Currency Wars rolls affixes at the start of a match. The aim here is
for them to be the *reason* a session's team differs from the last one: a condition that freezes crew who spend
Aether should make you avoid an Aether team, and enemies that shrug off damage while shielded should send you to a
break team.

**2 · If characters are free to pick, can equipment carry the randomness?** Supply is deterministic (anyone can be
recruited, at a price) and the only random purchase is equipment. Two things have to hold: choosing between a
**character voucher** (team size) and **equipment** (strength) has to be a real decision, and random equipment should
still make sessions differ.

---

## The affix charter

An affix changes **which answer is best**. It never takes away the battle the game is built on, and it never removes
a team type from the game. These rules come from the corpus, not from this prototype. Each cites its source.

### What the game is for

From the [README](../../README.md): *"you spend time tuning a team, then watch it pay off. A follow-up that keeps
chaining. An area attack that clears the board. Enemies dying one after another to a thorn carry they should not have
touched."* From the [design record](design-record.md): the game is about *"reading a situation and answering it
correctly,"* and *"the enemy is a planning puzzle, not a hard counter."* An affix serves that by changing what the
correct answer is. It must not shrink the payoff or remove a whole answer.

### Knobs an affix may turn

| Knob | Examples | Source |
|---|---|---|
| **How shields behave**, never whether they exist | how much a shield soaks, layer count, recovery speed, what a Break triggers | the user's examples; [modifiers](modifiers.md) |
| **The Aether economy** | starting Aether, capacity, generation, costs, a freeze on spending that delays rather than locks out | [Aether proposal](aether-pool-proposal.md); the Brief in `weaver-voyage-walkthrough.md`; the user's example |
| **Ultimate charge rate** | ultimates charge faster or slower | [Aether proposal](aether-pool-proposal.md): ultimates keep their own charge |
| **Status-effect potency and decay** | poison decays faster; marks fade sooner. Never "status does nothing" | [modifiers](modifiers.md) |
| **Healing against barriers** | healing halved, barriers doubled | *Insulated hull* in [run variety](run-variety-proposal.md) |
| **Enemy behaviour from the existing vocabulary**, with a tell and a counter | Channelers, Medics, Standard bearers; the faction rules Molt, Shed, Communion, Protocol | [traits backlog](enemy-traits-backlog.md), [enemy catalogue](enemy-catalogue.md) |
| **Encounter shape within the format's promise** | more or fewer enemies per wave; swarms stay chaff, bosses stay bosses | [run variety](run-variety-proposal.md), [enemy behaviors](../testing/enemy-traits.md) |
| **Enemy stat pressure, at most one** | health, damage or speed | [modifiers](modifiers.md); [run variety](run-variety-proposal.md): check actual pressure, not labels |
| **Tempo** | round limit, Break delay | design record: time is a resource |
| **Explicitly classified direct attacks** | single-target stronger, area weaker | *Concentrated fire* in [run variety](run-variety-proposal.md) |
| **The economy outside the fight** | income, prices, upkeep | the cost category in [modifiers](modifiers.md) |

### Knobs an affix must never turn

| Never | Why | Source |
|---|---|---|
| **Remove shields, or make Breaking impossible** | Chip, Break, exploit is the flow of every battle | the user, 6 October |
| **Target or damage the back row**, by attack, reflection, counterattack or any other means | Formation is a promise. The live resolver's `hit()` blocks all enemy damage to the back row in voyages | [formation and recovery](formation-and-recovery.md); [run variety](run-variety-proposal.md): *"never… invalidate the safe back row"*; [traits backlog](enemy-traits-backlog.md); the user |
| **Cap, shrink or punish the payoff moments**: damage caps, chain caps, penalties for landing hits | The payoff is the point of the game | README; the user |
| **Single out a team type** (a hard counter) | A condition is a planning puzzle; every type keeps a line | design record §7; the user |
| **Stack pressure on one number** | Two cards scaling the same thing make "the gods problem" | [modifiers](modifiers.md); [run variety](run-variety-proposal.md) |
| **Make the answer reachable only by a roll** | *"If the answer might never be offered, there is no answer"* | [modifiers](modifiers.md); [CW teardown](cw-teardown.md) |
| **Untelegraphed or repeating lockouts, hidden scaling, enemies adapting to your build** | Losses must be readable; stuns must be rare, telegraphed and followed by immunity | [traits backlog](enemy-traits-backlog.md); `session-progression-proposal.md` |
| **Make a team inert or a type mandatory** | Depleting Aether *"changes what the team does rather than making it inert"*; mandatory units are what players hate most | [Aether proposal](aether-pool-proposal.md); [explorations](explorations.md) |
| **Break a format's promise**: elites in a Swarm, a Boss turned into a generic fight | Formats are how a voyage stays readable | [run variety](run-variety-proposal.md) |
| **A name that needs a tooltip** | *"A condition name that needs a tooltip has failed"* | `session-progression-proposal.md`; [dictionary](dictionary.md) |

### How the sim enforces it

- **The hard-counter gate blocks cards.** Under an affix alone, each type's best team (its core pair plus any two)
  is measured against its no-affix best. A card fails if any type falls below **0.85 of the median type's change**. A
  uniform tax, where every type falls together, is not a hard counter. The gate was frozen after it independently
  flagged the three cards the user rejected: *Flankers strike the back row* (retaliation at 0.77 of the median),
  *Hits are capped* (hypercarry at 0.82) and the earlier *No shields* (break at 0.80).
- **Every rule card trades.** It has a tax and a gift, and the gift goes to a different type than the tax. The
  freeze example below is why: a gift that lands on the taxed type cancels the card.
- **A card must change the team.** If every type moves together, it is a difficulty knob (`FLAT` in the matrix). That
  is acceptable for the one stat and one shape card; a rule card needs to show its effect in which teams rise to the
  top (`intent`) or in the best team changing (`churn`).
- **Invariants are unit tests.** Under every affix, format and boss, back-row crew take no damage and break teams
  still find shields to Break.

---

## The pool, audited against the charter

| Card | Tax | In exchange | Knob | Gate (23 crew) |
|---|---|---|---|---|
| **Spending Aether can freeze** | Each Aether spent: 12% chance to freeze the spender (next turn 60 AV later, no ultimate), and the pool freezes for 60 AV, losing any Aether gained. Nobody freezes twice in a row | A Break freezes the enemy through its recovery turn | Aether economy | passes (lowest type 0.90 of median) |
| **Shields harden** | Shielded enemies take 85% less health damage (normally 60%) | A Break cracks a layer off every other enemy, down to its last | Shield behaviour | passes (0.97) |
| **Poison withers** | Poison halves after each tick | Every enemy has one fewer shield layer, down to one | Status decay | passes, at the line (0.85) |
| **Shields snap back** | A Break no longer delays the enemy; its shields return 30 AV later | Shields soak less: 50% instead of 60% | Shield recovery | passes (0.89) |
| **Breaks provoke a counterattack** | When an enemy Breaks, it strikes back at once at your front line | Ultimates charge 30% faster | What a Break triggers | passes (0.86, measured before its counterattack moved to the front line) |
| **Healing is halved** | Healing halved | Barriers doubled | Healing against barriers | passes |
| **Enemies hit 40% harder** | Stat: at most one per Brief | — | Enemy stat pressure | uniform |
| **Twice as many, half as tough** | Shape: at most one per Brief | — | Encounter shape | uniform |

**Removed:**

| Card | Rule it broke |
|---|---|
| *No shields, more health* | Shields are never removed |
| *Flankers strike the back row* | The back row is safe; it also failed the gate (retaliation 0.77) |
| *Hits are capped* | Capped the payoff; it also failed the gate (hypercarry 0.82) |
| *Spiked hides* | Penalised every hit landed, the "follow-up that keeps chaining" payoff, and damaged back-row attackers |

**Engine changes that came with the audit.** No enemy damage reaches the back row by any route, matching the live
resolver; this also changes the Reflector and the Mirror, which used to hurt back-row attackers. Provoke's
counterattack lands on the front line.

**Compatibility.** Two kinds of pair never draw together:

- **A card that removes what another needs.** *Shields snap back* removes the Break window that *Spending Aether can
  freeze* gives away.
- **Two cards that touch the same number.** *Shields harden* and *Shields snap back* both set shield soak. *Enemies
  hit 40% harder* and *Twice as many* both scale incoming damage.

A saved voyage whose Brief no longer passes is rerolled from the same seed.

---

## Proposed additions, awaiting confirmation

Each turns a knob the charter allows, comes from the existing design corpus rather than from invention, and must pass
the gate before it enters the pool.

| Card | Tax | In exchange | Knob | Source | Expected lean |
|---|---|---|---|---|---|
| **Deep reservoir** | Every battle starts with no Aether | +3 Aether capacity | Aether start and capacity | [run variety](run-variety-proposal.md); the walkthrough's Brief | Toward builders and reservoirs; away from teams that want a skill on turn one |
| **Short fuses** | Battles are one round shorter | Battles start with 5 Aether | Tempo and Aether start | the walkthrough's Brief | Toward fast teams; away from slow attrition |
| **Concentrated fire** | Area attacks deal 20% less | Single-target attacks deal 25% more | Classified direct attacks | [run variety](run-variety-proposal.md) | Toward carries and single-target breakers; away from area bursts. Must pass the gate: a tax on the area payoff, not a cap |
| **Volatile atmosphere** | Enemies deal 30% more | Crew deal 30% more | Symmetric damage; touches incoming damage | [run variety](run-variety-proposal.md) | Toward teams that strike first, and retaliation, which returns damage taken |
| **Channelers** | Every enemy telegraphs a heavy strike on its fourth turn | A Break cancels the strike and costs the enemy its turn | Enemy behaviour with a tell and a counter | the Channeler in the [traits backlog](enemy-traits-backlog.md) | Toward break, burst and barrier teams |

**A larger option, for discussion.** The Currency Wars screen pairs the bosses with three *factions*. This game's
factions already have readable shared rules with counterplay: Molt, Communion, Shed, Protocol and Refraction, in the
[enemy catalogue](enemy-catalogue.md). A Brief could name the factions you will face, and their rules would *be* the
conditions. The variety would then come from the game's own enemy design instead of a separate modifier list.

---

## The rules under test

| | |
|---|---|
| **The Brief** | Before any choice: 0–4 affixes (the player picks the count, the voyage picks the text, within the category caps and compatibility rules) and the three sector bosses. Affixes are the largest thing on the screen |
| **Requisition** | All 23 crew are always available. Two start free. A **voucher** opens the next berth: 12 / 20 / 30 / 42 gold for berths 3–6. With every berth full, recruiting from the roster opens the next berth in the same click. Releasing someone is free and their equipment returns to the hold |
| **Upkeep** | Each crewmate beyond four costs 5 gold after every battle |
| **Supply** | Three random equipment offers per stop at 5 gold; rerolls cost 2, 3, 4… within a stop. Two slots per crewmate. Selling refunds 2 |
| **Equipment** | Every item names the crew it fits: those its rule measurably helps, measured by `sim/affix-lab.js fits` (Bore Bit fits fifteen crew who hit shields hard; Hair Trigger only the two who make follow-ups). Every item also raises its wearer's output by 15% |
| **Route** | Nine battles: sector 1 Patrol, Swarm, boss · sector 2 Patrol, Elite, boss · sector 3 Swarm, Elite, boss. Every battle sets its own enemy strength, derived from the economy (×0.36, 0.65, 0.6 · 1.05, 1.17, 1.3 · 1.97, 1.59, 1.81; see [the route](#the-route-is-derived-from-the-economy-and-calibrated-on-themed-crews)). Score bands and integrity follow the design record |
| **Fights** | A seeded action-value model. Aether costs, capacity and every spend decision come from the live `aether-rules.js`. Enemies only ever target the front row. A lost fight's report says why in one sentence, and each condition's line says what the battle would have scored without it |

### Six team types, each with its own sustainer

Sustain is a **role inside a team, not a team type**. Every type has engine pieces and a sustainer built for its
engine, following the sustain specialties in `team-roles-and-acquisition-plan.md`. A sustainer can still be borrowed by
another type; it just fits its own best.

| Team type | Engine | Sustainer, and what it protects |
|---|---|---|
| **Aether burst** | Hanae (builder), Arunima (spender), Ivara (reservoir, +2 capacity) | **Veska**: heals, and turns her Refrains back into Aether, so sustaining also feeds the pool |
| **Hypercarry** | Silen (chain striker), Ekene (amplifier), Beatriz (finisher; a kill refunds Aether) | **Daven**: interception. Draws the attacks meant for the carry, behind a barrier |
| **Break** | Wren (shatters on every Break), Sevim (area breaker), Maul (exploits the Break window and extends it) | **Atsa**: whenever a shield Breaks, the most hurt crewmate gains a barrier |
| **Poison** | Nour (stacker), Spore (spread), Dolores (detonates poison through shields) | **Nahana**: steady healing through the long fights poison makes |
| **Retaliation** | Reva (returns what she takes), Tarn (returns what his barrier absorbs) | **Ilka**: opening plating. Every crewmate starts each battle behind a barrier worth 20% of their health |
| **Marks & follow-ups** | Nadira (marker), Aurelio (follows up on marks), Imke (follows up any ally's skill or ultimate) | **Navigator**: healing that grows with every use; overflow becomes barrier |

Each type also has a third engine piece with a different answer to the Brief. Beatriz lands a few big hits where Silen
lands many small ones. Maul lives in the Break window, so *Shields snap back* has a target in the break family. Dolores
cashes poison out before *Poison withers* or the Purifier can take it.

---

## What the work so far taught

These lessons hold whatever the final pool is. Their numbers come from earlier pools and rosters, as labelled.

### An affix only changes the team if it taxes the targeted type's bottleneck

The first *Spending Aether can freeze* froze the spender for 80 AV, with basic attacks 40% stronger in exchange, and the
Aether team kept 99% of its strength (14-crew roster). It froze the wrong person: Arunima's burst lands before the
freeze, and her next turn was going to be a basic anyway while the pool refills, so the **pool**, not her turns, is the
bottleneck. And the gift refunded the tax, because Aether teams basic constantly to build. Freezing the pool for 60 AV
on every freeze, with the gift moved to break teams, took Aether teams from 60% of the top ten to 10%. On the 23-crew
roster it still moves them from 80% to 30%.

### Shields harden needed a gift that rewards breaking often

With *Breaks delay twice as long* as the gift, the card was flat. Every team breaks shields as a side effect of ordinary
hits, so the tax fell on everyone and the gift helped everyone. *A Break cracks a layer off every other enemy* rewards
breaking often rather than breaking at all. On the 23-crew roster it moves break teams from 20% of the top ten to 90%.

### Faster recovery counters the Break *window*, not the Break

With Wren alone, *Shields snap back* barely bit: her shatter pays the moment a shield falls, and shields that come back
sooner can be broken again sooner. `team-roles-and-acquisition-plan.md` predicted exactly that. With Maul, who lives in
the window, the break family's ceiling falls to 0.87 under the card, the clearest effect on any type, and still within
the gate. In the live resolver, whose break payoffs are mostly window payoffs (Vulnerable, Overstrike, the Harmony
chain, cascades), it should bite harder still.

### Free choice exposes mandatory characters first, and the flattening tool must not inflate

On the first pass Hanae was in 92% of the best teams and Reva in 88%, while Arunima, Silen and Sevim never appeared.
The session-progression proposal predicted this.

A single **power** value per crewmate (scaling output, and health more gently) is moved by `sim/affix-lab.js flatten`
until everyone has a team within reach of the best and no single absence costs it much. The tool once raised everyone
else instead of lowering an over-strong character, inflating the roster and making every encounter easier. It now holds
the roster's average power fixed.

On 23 crew, every character has a team within 4% of the best and no ban costs anything. The patches are largest for
the healers Veska and Navigator (about 2.25×) and for Nadira (1.93×) and Sevim (1.53×). Their kits need real work.

### Voucher or equipment is a real choice only with upkeep (14-crew roster, old pool)

Without upkeep, width beat equipment on every Brief. Going from two crew to three nearly doubles a team's breakpoint,
and each body brings actions, health and Aether capacity. With five gold of upkeep per crewmate beyond four, the best
shopping plan depended on the Brief, and equipment and the sixth berth became substitutes. A five-crew team gained 18.7
integrity from equipment, or 11.3 from a sixth crewmate instead, and the two barely stacked.

On the 23-crew roster and the derived route, themed shoppers say the better split depends on the crew and the Brief:

- Break and poison do best at five crew with equipment, which adds 14 to 28 integrity there. Retaliation does at
  four conditions, and carry is even at two and prefers it at four.
- Aether and follow-up need the sixth body.
- At four conditions, five with equipment is the most common answer.
- Equipment adds under 3 at six berths.
- A quarter to more than a third of Briefs don't separate the policies at all.

See the [lab notes](../testing/affix-lab.md#the-route-23-crew-charter-pool). Re-measure on the agreed pool.

### Affixes changed the best team (14-crew roster, old pool)

Across 24 rolled Briefs, the best team differed from the no-affix best by two or more crewmates in 96% of Briefs, with
19 distinct best teams. Re-measure on the agreed pool and the 23-crew roster.

### The route is derived from the economy and calibrated on themed crews

The route used to step by sector (×0.85, then 1.5, then 2.3) and was tuned until the scripted shoppers felt the
voucher-or-equipment trade. Those shoppers recruit the exhaustive search's best team for the Brief, the top fraction
of a percent of team space. A player building around a type is in a different population. The second human playtest
found the result: a poison crew that was the lab's own reference team won all of sector 1, then lost every battle
after it. At sector 2's ×1.5, 4% of all four-person teams could clear its first fight.

Two things made it a wall rather than a slope:

- **Threat grows with the square of strength.** Strength multiplies enemy health and attack together, so ×0.75 to
  ×1.5 is about four times the threat in one step. Nothing a stop can buy closes that.
- **The calibration was stale.** The sector values matched breakpoints measured on an older break team (4 crew at
  1.42). On the 23-crew roster, the reference four-person teams break at 0.47 to 1.12.

`sim/affix-lab.js route` now sets each battle's strength in turn. For each type, a themed crew recruits its core pair
and sustainer, then the best addition from anyone. It shops as the `five` policy does, and every themed crew plays
the same rolled Briefs. Each battle gets the strength at which the median type's themed crew beats it (88% or
better) 90% of the time in sector 1 and 75% after. Earlier battles stay fixed while a later one is set, so each
battle meets what the voyage can afford by then, at the income its earlier results actually paid. The optimizer's
crew is kept as an upper bound: finding the best team should pay, not be the bar.

At two conditions on the new route:

- **Themed crews** shopping sensibly survive 96–100% of voyages.
- **The optimizer** ends near 96 integrity.
- **Score by battle** stays at 0.57 or better for every type. The biggest step is Aether entering sector 2, from
  0.88 to 0.57. That is far from the old wall's 1.0 to 0.17, but Aether is still the type the route serves worst.

**Front-row depth decides a themed crew's strength.** Enemies only strike the front row, and a fight is lost when it
falls, so front-row health is the crew's health bar. Break has three front-row crew and is the strongest themed type.
Aether and Follow-up each have one, and that one is also a damage dealer. When themed crews had to recruit their
whole type before borrowing, Aether beat almost no fight after sector 1. Borrowing a front-row anchor (Ilka, Daven,
Atsa) brought it to about half. The first playtest's notes asked for exactly that: something that soaks the opening
damage so the damage dealers get to act.

### Not yet answered: does random equipment itself make teams vary?

The scripted shoppers pick crew from the Brief, then fit whatever equipment matches; they never change who they
recruit because of what the supply offered. The test: an adaptive shopper that re-plans around its hold, then compare
how much final teams differ across supply seeds within one Brief against how much they differ across Briefs.

---

## First human playtest

One voyage, exported 6 October, before the shield, charter and roster changes:

- **Setup:** Expert, four conditions (*Twice as many*, *Enemies hit 40% harder*, *No shields*, *Healing is
  halved*), opened with Arunima and Hanae.
- **Spending:** both starting items went on Arunima. Hanae was swapped for Daven at the third stop.
- **Battles:** scores of 8%, 3%, 46%, 3% and 4%. The record was lost after battle 5.
- **Gold:** 56 unspent at the end. No berth was ever opened.
- **Ratings:** agency 1, excitement 1.
- **Their reading:** "couldn't get any early wins to build up gold, unable to expand team"
- **Their notes:** "need characters that can apply shield on battle start to help soak early damage to give dps a
  chance to break shields."

| Observation | Response |
|---|---|
| *No shields* removed the battle's core loop | Shields are never removed |
| *Twice as many* stacked with *Enemies hit 40% harder* | Cards that touch the same number never draw together |
| No way to absorb the opening damage | Ilka's opening plating |
| Gold piled up but the team never grew | With every berth full, recruiting from the roster opens the next berth |
| Losses gave no reason | Each loss names it |
| Every opening lost battle 1 | Sector 1 ramps up gently |
| Few ways to answer a Brief | Nine more crew; sustain moved into every type |

### The opening

Two-crew openings used to lose battle 1 almost every time: Arunima and Hanae averaged 16% and avoided a loss 2% of the
time. Sector 1 then ramped ×0.4, ×0.55, ×0.75, measured below on 60 two-condition Briefs before the charter's pool cut
(mean score / no loss). The derived route now opens at ×0.36, ×0.65, ×0.6.

| Opening pair | Battle 1, old (×0.85) | Battle 1, now (×0.4) | Battle 2, now (×0.55) |
|---|---|---|---|
| Arunima + Hanae (the playtest's pair) | 15% / 0% | 60% / 42% | 61% / 50% |
| Silen + Daven | 23% / 0% | 90% / 82% | 84% / 72% |
| Wren + Atsa | 29% / 2% | 88% / 72% | 91% / 80% |
| Nour + Nahana | 13% / 0% | 79% / 58% | 81% / 65% |
| Aurelio + Navigator | 16% / 0% | 73% / 52% | 62% / 55% |
| Reva + Ilka | 23% / 0% | 66% / 8% | 90% / 73% |

## Second human playtest

One voyage, exported 6 October, after the charter and the 23-crew roster, on the old stepped route:

- **Setup:** Expert, four conditions (*Healing is halved*, *Breaks provoke*, *Shields harden*, *Spending Aether can
  freeze*). Opened with Nahana and Nour.
- **Crew:** Spore at the first stop, Dolores at the third, Ilka at the seventh. This is the lab's reference poison
  team, plus Ilka.
- **Spending:** three items, two of them on Nahana, and 14 gold of rerolls at the fourth stop.
- **Battles:** 100%, 100% and 100% in sector 1. Then 17%, 32%, 29%, 56% and 16%. Integrity ran out before the final
  boss.
- **Ratings:** agency 1, excitement 1. No notes.

Replaying the voyage reproduces every score. With every condition removed, the same crew still loses battles 4, 5, 7
and 8, so the route was the problem, not the Brief. At ×1.5, the first sector 2 fight had 4% of all four-person teams
clearing it, and 32% of five-person teams. Two front-row damage dealers (Nour and Dolores) fell in about two enemy
rounds, before Nahana's healing could matter: she healed 6 health in the first sector 2 fight.

| Observation | Response |
|---|---|
| Three perfect wins, then five losses: a wall at the sector 2 boundary | The route is derived from the economy, battle by battle, and calibrated on themed crews |
| The calibration was tuned on the optimizer's team | Themed crews per type are now the calibration population; the optimizer is an upper bound |
| The healer could not act before the front line fell | Not changed yet: front-row depth by type is an open question |
| The sector 2 boss was cleared without conditions but lost with them; *Spending Aether can freeze* alone took it from 100% to 44% | Not changed: one fight. The gate measures the card across encounters |

On the new route, the same crew and items score 100% three times, then 90%, 50%, 41%, 91%, 45% and 100%. That is six
of nine fights beaten (88% or better), with the two Elites and the sector 2 boss lost. With the conditions removed,
it loses only the sector 2 Elite. Expert is meant to be harder; the open question is how much.

## Third human playtest

One voyage, exported 6 October, on the derived route. It was not rated or saved to the session log, so the
five-voyage protocol still counts two.

- **Setup:** Expert, four conditions (*Shields snap back*, *Enemies hit 40% harder*, *Healing is halved*, *Poison
  withers*). Opened with Spore and Dolores.
- **Crew:** Nour at the first stop, Nahana at the fourth, Ilka at the seventh.
- **Spending:** nine items, all fitted to the crew they suit. Two Culture Vessels on Dolores both count in full.
- **Battles:** 100%, 100%, 94%, 61%, 57%, 92%, 100%, 66% and 44%. It finished at 40 integrity. Every loss was
  mild, against the second voyage's 16% to 56%.

Replaying with each condition removed in turn shows what decided it:

| Battle | Played | No conditions | Without *Snap back* | Without *Hit 40% harder* | Without *Healing halved* | Without *Withers* |
|---|---|---|---|---|---|---|
| 3 · Mirror | 94% | 100% | 100% | 100% | 100% | 100% |
| 4 · Patrol | 61% | 100% | 40% | **100%** | 100% | 100% |
| 5 · Elite | 57% | 82% | 56% | **100%** | 57% | 64% |
| 6 · Carapace | 92% | 100% | 90% | 87% | 87% | 78% |
| 8 · Elite | 66% | 100% | 68% | **100%** | 57% | 83% |
| 9 · Purifier | 44% | 100% | 52% | **100%** | 36% | 43% |

**The stat card decided the voyage.** Four battles were losses (battles 3 and 6, at 94% and 92%, cost nothing).
Removing *Enemies hit 40% harder* alone wins all four. Removing any other single card wins at most battle 4, a near
thing. Elsewhere the rule cards were neutral or helped this crew:

- *Healing is halved* doubles barriers, which pays once Ilka is aboard.
- *Shields snap back* thins shields; poison ticks through them anyway.

Across reference teams, the card is a uniform cut with no gift and no favored type, so it is flat by the gate's own
definition. Its breakpoint multiplier was 0.79 for poison, 0.75 for this crew, and 0.87 for both break and carry.
At Expert, then, the difficulty is not four conditions; it is whether the stat card drew.

**The card aimed at poison did not tax poison.** Each card's breakpoint relative to no conditions, whole card
(tax half alone, gift half alone):

| Team | *Poison withers* | *Shields snap back* | *Hit 40% harder* | *Healing halved* |
|---|---|---|---|---|
| Reference poison | 1.01 (1.00, 1.04) | 0.98 (1.00, 1.04) | 0.79 | 0.89 (0.89, 1.00) |
| This crew | 0.90 (0.86, 1.01) | 0.90 (0.90, 1.00) | 0.75 | 1.02 (0.89, 1.05) |
| Reference break | 1.15 (1.00, 1.15) | 0.95 (0.94, 1.01) | 0.87 | 1.08 (1.00, 1.08) |
| Reference carry | 1.13 (1.00, 1.13) | 1.04 (0.96, 1.09) | 0.87 | 1.05 (0.99, 1.05) |

*Poison withers* steers only through its gift, which lifts break and carry. To a poison player it reads as aimed at
them and plays as nothing happening. The reason: poison ticks on the enemy's turn and decays after. The crew
re-applies stacks several times between enemy turns, and Dolores clears them by detonating, so halving instead of
dropping by one rarely matters before the fight ends. The charter's allowed knob, *how fast a status wears off*,
could decay before the tick, or per crew action instead of per enemy turn. Not changed until the charter is
confirmed.

| Observation | Response |
|---|---|
| No wall: losses came as a slope, and the voyage finished | The derived route holds for this crew at Expert |
| One card decided the voyage, and the report could not say which | Each condition's line in the battle report now says what the battle would have scored without it, including when it helped |
| *Enemies hit 40% harder* is a flat cut that decides Expert | Open question 4 |
| *Poison withers* does not tax poison | Open question 6 |

## Fourth human playtest

One voyage, saved 6 October, on the derived route. It is the first rated voyage with notes since the route changed.

- **Setup:** Expert, four conditions (*Spending Aether can freeze*, *Poison withers*, *Shields harden*, *Healing is
  halved*). Opened with Reva and Tarn.
- **Crew:** Ilka at the first stop, swapped for Atsa at the second. Then Wren, Sevim, and Maul at the eighth stop.
- **Spending:** every gold went to berths. No equipment was bought.
- **Battles:** 82% (time ran out at full health), then eight at 100%. It finished at 98 integrity.
- **Ratings:** agency 3, excitement 1.

Their notes, in short:

> it never felt like a disadvantage to go wide over deep. its also hard to judge fun when the battle is instant and
> there is no chance for it to be any different. Its missing that random chance feel of "oh, i just barely won" or
> "if this character was able to move just a little faster i would have won"

The notes also say:

- **Pacing:** you have to grow too fast. They expect either of two arcs:
  - start wide and shallow, then add damage and speed as the challenge rises;
  - start deep with a few crew, then widen as new modifiers demand it.
- **Affixes are only part of the equation.** A player-side modifier that boosts poison and cancels a poison tax is
  the kind of answer that's missing.
- **There is no reason to mix types.** "you don't need to think about if you need a tank mixed into a poison team".

Replaying it reproduced every score, and the measurements agree with every note:

- **No close calls.**
  - Every win ended with 88–100% of the crew's health.
  - Each fight could have been won against enemies 1.4 to 2.6 times stronger.
  - Near any reference team's limit (×0.8 to ×1.2 of its breakpoint), 46% of fights end in a win above 75% health,
    and 0.8% in a win under 25%.
  - The model almost never produces a squeaker.
- **Luck exists but is invisible.** The reference poison crew, on one Elite at its breakpoint, clears 29 of 40
  seeds. A player sees one seed, resolved instantly.
- **Speed barely matters.** Ten percent more speed for the whole crew moves its breakpoint 1%; twenty percent moves
  it 13%. "A little faster" cannot change an outcome.
- **The trade exists but never showed.** For this crew, the same gold buys more strength as equipment than as
  berths, but nothing on the route pressed hard enough to show it. Breakpoint (no conditions):

  | Crew | 0 items | 2 | 4 | 6 | 8 |
  |---|---|---|---|---|---|
  | 3 | 0.39 | 0.72 | 1.05 | 1.13 | — |
  | 4 | 0.83 | 1.07 | 1.25 | 1.38 | 1.51 |
  | 5 | 1.21 | 1.42 | 1.55 | 1.73 | 1.85 |
  | 6 | 1.67 | 1.75 | 1.91 | 2.11 | 2.14 |

- **The Brief missed this crew.** Its conditions were aimed at Aether, carry and poison, and break and retaliation
  are the two types Expert barely touches (see the route section).
- **Types are self-sufficient by construction.** Every type was given its own sustainer, so no crew needs to borrow.
  The live game's departments (2- and 4-piece bonuses) and elements (two weaknesses per enemy) are the reasons to mix
  that the lab dropped.

The lab abstracted away the parts of the game that make team building interesting: watchable fights, departments,
elements and ranks. So it judges affixes in a vacuum, which is what the notes say.

---

## What only play can answer

The model can say the best team changes; it cannot say whether reading the Brief is *fun*, or whether a voucher feels
like a decision. Use the protocol from the session-progression proposal: **five consecutive voyages**, a sentence
before each ("this voyage I'm going to try…") and after ("what actually happened"), and **agency and excitement rated
separately**. The lab's session log shows how many crew carried over from the voyage before.

**Kill criterion, set before testing:** if the fifth voyage's final crew overlaps the first by more than 60% *and* the
five plan sentences read the same, affix-driven variety has failed, whatever the simulation says.

---

## Open questions

1. **The charter.** Confirm or correct it before the pool grows.
2. **The proposed additions,** and whether the Brief should name enemy factions whose rules are the conditions.
3. **Does the derived route feel right?** It needs a human check that losses now come as a slope you can buy your
   way back up, and that the first stop still feels like a choice.
4. **How much harder should more conditions be?** Going from no conditions to two lowers the derived route by
   about 7% of enemy strength (14% of threat), and from two to four by about 13% (25% of threat). The route is
   calibrated at two. The alternative is a route per condition count, so conditions change the best team without
   making the voyage harder, and difficulty becomes its own setting. The third playtest sharpens it: most of
   Expert's difficulty comes from whether *Enemies hit 40% harder* drew, a flat card with no gift that the gate says
   needs a reason to stay.
5. **Front-row depth by type.** Aether and Follow-up each field one front-row crewmate, who is also a damage dealer.
   Is borrowing an anchor the intended answer, or should those types own one?
6. **Should *Poison withers* tax poison itself?** Today its tax costs the reference poison team nothing, and it
   steers only by lifting break and carry through its gift. Decaying before the tick, or per crew action, would
   tax the poison engine directly, within the charter's status knob.
7. **Kit work for the healers and the patched supports.** Veska and Navigator need about 2.25× power, Nadira 1.93× and
   Sevim 1.53×.
8. **The adaptive-shopper test,** the missing half of hypothesis (b).
9. **Should items show which crew they fit?** The design record endorses stating fit; it may also steer every
   purchase toward the obvious match.
10. **Match-wide or per sector?** These affixes hold for the whole voyage, as in Currency Wars.
11. **Carrying it into the live game.** The resolver in `watchable-fight.html` has no event points for these rules.
   The hooks the lab needed map to its Aether spend sites (lines 2279 and 1782), the shield soak (2564), `breakEnemy`
   (1699) and enemy targeting (2529). There is no crew freeze there yet, and every new state field has to stay plain
   JSON for checkpoints.
