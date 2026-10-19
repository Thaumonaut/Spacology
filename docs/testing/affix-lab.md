# Affix lab: how to play it, how it was measured, and what it found

Lab for [affix team building](../design/affix-team-building.md). Model: `prototypes/labs/affix-lab/affix-lab-model.js`, shared by
the page and `sim/affix-lab.js`. Saved results: [`affix-lab-results.json`](affix-lab-results.json) holds the last
complete run (24 Briefs, 2 seeds, with every tuning and economy value recorded). It was made on the 14-crew roster,
before the charter, and will be replaced when the agreed pool is measured.

## Play it

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/prototypes/affix-lab.html`. Choose how many conditions you want, read the Brief, write
the plan sentence, then pick two crewmates. Before each battle you can open a berth, buy or reroll equipment, fit
items, and release crew. Each battle report says, under every condition, what that battle would have scored
without it. After nine battles, rate agency and excitement separately and save the voyage to the session
log. The log shows how many crew carried over from the previous voyage, and **Export sessions** downloads every saved
voyage.

For the five-voyage protocol and its kill criterion, see
[the design doc](../design/affix-team-building.md#what-only-play-can-answer). Use five different seeds.

## Run the measurements

```sh
node sim/affix-lab.js all --briefs 24 --out docs/testing/affix-lab-results.json   # several minutes; policies alone is about 90 s
node sim/affix-lab.js baseline     # reference team per family: breakpoint and how it loses above it
node sim/affix-lab.js roster       # share of the top 20 teams per crewmate, and the cost of banning them
node sim/affix-lab.js matrix       # each affix alone × each family's best team around its core pair
node sim/affix-lab.js intent       # does each affix push the top teams the way its data says it should?
node sim/affix-lab.js churn        # rolled Briefs: does the best team change?
node sim/affix-lab.js policies     # scripted shoppers over full voyages: berths versus equipment
node sim/affix-lab.js route --briefs 24 --seeds 3   # each battle's enemy strength, derived from the economy
node sim/affix-lab.js fits         # which crew each item measurably helps: the fit lists baked into GEAR
node sim/affix-lab.js flatten      # moves each crewmate's power until nobody is mandatory or unusable
node sim/affix-lab.js sweep --grid '[{"foeAtk":2},{"foeAtk":2.4}]'
```

Shared flags:

- `--seeds N`
- `--briefs N`, and `--count N` affixes per Brief, at most 6 (the most a legal Brief holds). A roll can stop short of
  `--count`, so `route`, `policies` and `churn` print and record the range their Briefs actually hold
- `--part tax|gift`: measure one half of every affix
- `--set foeAtk=2.4,Sevim.aoe=1.2,Reva.power=0.9`: combat constants, roster stats and kit numbers
- `--econ startCrew=3,upkeep=7,voucher5=34`: economy. `startCrew` runs from 1 to `maxBerths`, `maxBerths` is at most
  6, and every berth a voyage can open needs a `voucherN` price

A file is written only when `--out` is given, into a folder that already exists. The command comes first, and every flag
is given once, with one value. An unknown flag, a missing value, a repeated flag, a stray word (such as the command after
its flags), or a value the tool cannot use (an unknown condition, a `--part` other than `tax` or `gift`, a count that is
not a whole number or exceeds 6, an `--out` folder that does not exist) stops the run with an error before anything is
measured.

Tests:

```sh
node tests/unit/affix-lab.cjs
NODE_PATH=<a node_modules containing playwright> SPACOLOGY_BASE_URL=http://127.0.0.1:4173 node tests/browser/affix-lab.cjs
```

The browser test runs headless. `SPACOLOGY_HEADED=1` opts into a window, and `SHOTS=<dir>` saves screenshots. It plays
a whole voyage, checks reload persistence, saves two voyages to the session log, and checks for horizontal overflow at
1280, 820 and 390 pixels.

## Method

These rules follow the design record's §10.

- **Score by breakpoint.** A fight is *beaten* at 88% or better, the no-loss band. A team's breakpoint is the highest
  enemy scale at which it beats three fights in four. The scale multiplies enemy health and attack, and is found by
  geometric bisection.
- **Vary the encounter.** The standard set is Patrol, Swarm and Elite, each twice, plus all five bosses, or the
  Brief's three bosses when a Brief is being measured.
- **Search, don't hand-pick.** "Best team" means an exhaustive screen of all 8,645 four-person teams of the 23 crew (at least one
  front-row crewmate). Each is scored by mean battle score at two scales above the reference breakpoints, so the screen
  does not saturate, and the leaders then get full breakpoints.
- **Calibrate first.** Enemy attack ×2.2, enemy health ×0.8 and Arunima at 60% per Aether make reference teams lose
  both ways above their breakpoints (61 wipes and 33 timeouts in the calibration sweep). At the starting values, 87
  of 90 losses were timeouts.
- **Record how fights are lost.** Fights record outcome (cleared, time, wiped) and damage by source (basic, skill,
  ultimate, follow-up, shatter, reflect, poison). The families' engines carry them: poison is 71% of the poison team's
  damage, reflect 63% of retaliation's, the burst skill 69% of Aether's and shatter 35% of break's.
- **Compare rates, not totals.** Fights run until the enemies fall, so total damage measures enemy health. Two
  assertions in the unit tests failed on totals before being rewritten to compare damage per AV.

## Results

The 23-crew roster, the charter and the derived route each changed the game the earlier runs measured. Each
section says which roster, pool and route it comes from. Churn and the matrix will be re-run once the charter and
its pool are agreed.

### Flattening

| Pass | Most picked | Never picked |
|---|---|---|
| First, before any tuning | Hanae 92%, Reva 88% of Brief best teams | Arunima, Silen, Sevim |
| After the first `flatten` | Hanae 54%; Wren, Reva and Ilka 46% | none; lowest are Silen and Nadira at 8% |
| Ilka's opening barrier added | Retaliation in 100% of the no-affix top ten | — |
| After the anchored `flatten` (current) | Sevim and Ilka 46%; Hanae, Wren and Nour 42% | Ekene, 0% |

Flattening now holds the roster's geometric-mean power fixed. The first attempt after Ilka's change raised everyone
else (Nadira to 2.65, Sevim to 2.36) instead of lowering her, inflating the roster about 18%, which would have made
every encounter easier without anyone noticing. Anchored, it lowered Ilka (1.09 → 0.80) and Daven (0.92 → 0.77).
Current power values are in `ROSTER`; Sevim (1.86), Nadira (2.17) and Nahana (1.54) carry the largest patches.

### Affix × type: the hard-counter gate (best team keeping the type's core pair, breakpoint relative to no affix)

`matrix` blocks a card as a **hard counter** when any type falls below 0.85 of the median type's change. A uniform tax,
where every type falls together, passes. The table is the 23-crew run, measured before the charter's audit. The three
cards marked *removed* are out of the pool.

| Affix | Aether | Hypercarry | Break | Poison | Retaliation | Follow-ups | Gate |
|---|---|---|---|---|---|---|---|
| *(no affix breakpoint)* | 1.14 | 1.06 | 1.26 | 1.21 | 1.13 | 1.18 | |
| Spending Aether can freeze | 1.02 | 1.08 | 1.01 | 0.95 | 1.08 | 1.11 | passes (lowest 0.90 of median) |
| Shields harden | 0.98 | 0.95 | 0.98 | 0.99 | 0.96 | 0.97 | passes (0.97) |
| Poison withers | 1.12 | 1.12 | 1.10 | 0.91 | 1.03 | 1.03 | passes, at the line (0.85) |
| Shields snap back | 1.00 | 1.02 | 0.87 | 0.99 | 0.96 | 0.95 | passes (0.89) |
| Breaks provoke a counterattack | 1.02 | 1.09 | 0.90 | 1.03 | 1.06 | 1.07 | passes (0.86); measured when it still struck back-row breakers |
| Flankers strike the back row | 1.50 | 1.34 | 1.27 | 1.34 | 1.03 | 1.46 | **hard counter** (retaliation 0.77); *removed* |
| Spiked hides | 0.98 | 0.93 | 0.96 | 0.93 | 1.05 | 0.91 | passes the gate; *removed* for punishing every hit |
| Hits are capped | 0.87 | 0.75 | 0.85 | 1.00 | 0.98 | 0.95 | **hard counter** (hypercarry 0.82); *removed* |
| Healing is halved | 1.16 | 1.16 | 1.11 | 1.18 | 1.24 | 1.21 | passes |
| Enemies hit 40% harder | 0.84 | 0.83 | 0.83 | 0.79 | 0.84 | 0.88 | uniform |
| Twice as many, half as tough | 0.90 | 0.89 | 0.95 | 0.86 | 0.93 | 0.90 | uniform |

The gate's threshold was frozen only after it reproduced, without being told, the three cards the user had rejected:
*Flankers* (0.77), *Hits are capped* (0.82) and the earlier *No shields* (0.80 on the 14-crew roster).

With 23 crew the core pairs are Hanae + Arunima, Silen + Ekene, Wren + Sevim, Nour + Spore, Reva + Tarn and Nadira +
Aurelio. The other two slots draw on everyone, including every type's sustainer.

Each type's own ceiling moves little, because its two free slots adapt. *Spending Aether can freeze* is flat by this
measure (spread 1.17) even though it pushes Aether teams out of the top ten (`intent`). The Aether pair keeps its
ceiling by bringing different partners, but other teams now beat it. Flat in `matrix` is fine as long as the card
changes the team in `intent` or `churn`.

**The break counters, with Maul in the roster.** *Shields snap back* now taxes the break family hardest of any type
(0.87; it was 0.95 before Maul). Maul exploits the Break window, which faster recovery shortens, whereas Wren's
shatter paid out on the Break itself. *Breaks provoke a counterattack* taxes break to 0.90. A tested variant of snap
back, where reformed shields came back a layer thicker, taxed Aether as much as break and was not kept.

The tax and gift halves can be read separately with `--part`. In the first version of *Spending Aether can freeze*,
the tax alone left the Aether team at 0.98, which is how the bottleneck problem was found.

### Invariants, as unit tests

Under every affix, every format and every boss, including Reflectors and the Mirror:

- back-row crew finish at full health;
- break teams still find shields to Break.

No card may declare that it removes shields. Enemy damage to the back row is blocked in the engine itself, as the live
resolver's `hit()` does.

### Churn: 24 rolled Briefs of two affixes (14-crew roster, pool before the charter)

- The best team differs from the best team with no affixes and the same bosses by at least two crewmates in **96%**
  of Briefs.
- 19 distinct best teams.
- The most common best team (Ilka, Nour, Reva, Spore) wins **13%** of Briefs, just above the 10% target.
- Consecutive Briefs differ by at least two crewmates in **91%** of cases.
- Every Brief has a team that beats 60% of fights at scale 1.
- Appearance in best teams ranges from Ekene at 0% to Sevim and Ilka at 46%.

### Economy: scripted shoppers, 12 Briefs × 6 voyages each (14-crew roster, pool before the charter)

Policies:

- **Wide:** buy berths to six, then equipment.
- **Wide bare:** berths only, never equipment.
- **Five:** stop at five crew and keep buying equipment along the way.
- **Five bare:** five crew, never equipment (measured only at the defaults).
- **Deep:** four crew, then equipment.
- **Lean:** three crew, then equipment.

Every shopper recruits the Brief's best team in order and fits items to crewmates they suit. The table shows Briefs
won, then mean final integrity.

| Setup | Briefs won | Wide | Wide bare | Five | Five bare | Deep | Lean |
|---|---|---|---|---|---|---|---|
| 2 starters, 10 gold, no upkeep | wide 6, five 5, deep 1 | 85.8 | 79.6 | 83.2 | — | 72.4 | 37.2 |
| 2 starters, 12 gold, no upkeep | wide 12 | 95.4 | 89.4 | 88.7 | — | 81.2 | 45.9 |
| 3 starters, 10 gold, no upkeep | wide 12 | 96.8 | 90.5 | 94.4 | — | 82.6 | 45.4 |
| 3 starters, berths 24 / 34 / 46 | wide 10, five 2 | 95.4 | 89.6 | 94.2 | — | 80.9 | 45.4 |
| 3 starters, upkeep 4 | wide 7, five 5 | 94.3 | 89.6 | 94.4 | — | 82.6 | 45.4 |
| 3 starters, upkeep 7 | five 11, wide 1 | 90.6 | 89.5 | 94.4 | — | 82.6 | 45.4 |
| 2 starters, 12 gold, upkeep 5, before the freeze fix | five 5, wide 5, wide bare 2 | 89.9 | 88.7 | 88.4 | — | 81.2 | 45.9 |
| 2 starters, 12 gold, upkeep 5, before the compatibility rule | wide 6, five 5, wide bare 1 | 90.1 | 88.8 | 88.4 | 74.7 | 81.4 | 46.1 |
| 2 starters, 12 gold, upkeep 5, before the shield changes | five 6, wide 5, wide bare 1 | 89.0 | 87.8 | 87.7 | 74.2 | 80.7 | 45.0 |
| **2 starters, 12 gold, upkeep 5 (default)** | **five 7, wide 3, deep 2** | **85.0** | **83.5** | **90.9** | **72.2** | **80.4** | **43.4** |
| 2 starters, 12 gold, upkeep 8 | five 7, wide 4, deep 1 | 84.6 | 84.6 | 88.1 | — | 81.2 | 45.9 |

At the defaults, equipment and the sixth berth compete for the same job, and equipment now edges it: five bare →
five gains 18.7, five bare → wide bare 11.3, and equipment adds only 1.5 on top of six berths. Wide shoppers reach the
integrity cap of 100 on several Briefs, which hides part of equipment's value there. The shield changes, Ilka's barrier
and the re-flattened roster moved this from an even split toward equipment, so upkeep at five may now be slightly high.

The upkeep-8 row predates the shield changes.

The first row's split relied on a forced loss in battle 1: ten gold cannot buy berth 3, so two crew always fight the
opening Patrol alone.

Every row above was measured on the old stepped route (×0.85 / 1.5 / 2.3 by sector), which was tuned until these
optimizer shoppers felt the trade. That route was retired on 6 October; see below.

The compatibility rules changed which Briefs some seeds roll, so results before them are not directly comparable
Brief by Brief. The rules are: no card beside one that removes what it needs, and no two cards touching the same
number (shield soak, incoming damage). *No shields* has since been removed from the pool, because shields are integral
to the flow of battle.

### The route (23 crew, charter pool)

The second human playtest hit a wall at the sector 2 boundary: three perfect wins, then five losses. Replaying it
reproduced every score, and with every condition removed the crew still lost the same sector 2 and 3 fights. Three
measurements found why:

- **The step.** The route went from ×0.75 at the sector 1 boss to ×1.5 for all of sector 2. Strength multiplies enemy
  health and attack together, so that is about four times the threat in one step. At ×1.5, the first sector 2 fight of
  the playtest's seed was cleared by 4.0% of all 8,645 four-person teams and 31.5% of all 33,397 five-person teams.
- **The stale calibration.** The sector values came from a break team measured on an earlier roster (4 crew at
  1.42). `baseline` on the 23-crew roster puts the reference four-person teams at 0.47 (retaliation), 0.57 (Aether),
  0.79 (follow-up), 0.97 (carry), 1.06 (poison) and 1.12 (break).
- **The calibration population.** The scales were raised until the optimizer's shopper felt the trade, but that
  shopper recruits the exhaustive search's best team for each Brief. Themed crews are a different population.

`route` now derives each battle's strength from the economy. One themed crew per type (core pair and sustainer, then
the best addition from anyone) plays every rolled Brief, shopping as `five` does. Each battle in turn gets the
strength at which the median type beats it (88% or better) 90% of the time in sector 1 and 75% after. Earlier battles
stay fixed, so each battle meets the crew, items and income the voyage has actually reached. The baked route comes
from 24 Briefs × 9 seeds × 6 types (1,296 sessions) at two conditions. It was re-derived after the bug check fixed
the shoppers and the item fit lists were widened to every crewmate an item measurably helps. Mean crew and items
count only voyages still under way:

| Battle | Strength | Mean crew | Mean items | Aether | Carry | Break | Poison | Retaliation | Follow-up |
|---|---|---|---|---|---|---|---|---|---|
| 1 · Patrol | 0.36 | 2.3 | 1.3 | 88% | 95% | 97% | 97% | 50% | 80% |
| 2 · Swarm | 0.65 | 2.7 | 2.5 | 72% | 85% | 98% | 83% | 100% | 96% |
| 3 · Boss | 0.60 | 3.1 | 4.0 | 67% | 100% | 100% | 99% | 69% | 81% |
| 4 · Patrol | 1.05 | 3.8 | 5.1 | 33% | 78% | 100% | 80% | 75% | 61% |
| 5 · Elite | 1.17 | 3.9 | 6.4 | 52% | 68% | 100% | 74% | 87% | 80% |
| 6 · Boss | 1.30 | 4.0 | 7.2 | 53% | 64% | 86% | 81% | 80% | 73% |
| 7 · Swarm | 1.97 | 4.6 | 7.7 | 37% | 74% | 100% | 63% | 77% | 77% |
| 8 · Elite | 1.59 | 4.8 | 8.5 | 48% | 68% | 97% | 75% | 88% | 75% |
| 9 · Boss | 1.81 | 5.0 | 9.1 | 48% | 63% | 87% | 80% | 84% | 71% |

At 12 Briefs × 6 seeds, single battles moved by up to 15% between runs, so use the larger sample when re-deriving.
At that smaller sample, the route derived at other condition counts was:

| Conditions | Derived strengths, battles 1–9 |
|---|---|
| 0 | 0.39, 1.04, 0.71, 1.14, 1.33, 1.45, 2.18, 1.77, 1.65 |
| 2 | 0.39, 0.73, 0.57, 1.11, 1.24, 1.37, 2.10, 1.69, 1.74 |
| 4 | 0.29, 0.65, 0.56, 0.97, 1.07, 1.22, 1.59, 1.41, 1.69 |

These rows were re-derived after the bug check, like the baked route. On average over the nine battles, going from no
conditions to two lowers enemy strength by about 7%, and from two to four by about 13%.

Themed strength follows front-row depth. When themed crews recruited their whole type before borrowing, Aether beat
0–6% of the fights after sector 1, because its only front-row crewmate is Arunima.

**Shoppers on the new route.** Mean final integrity, with the share of voyages that survive, over 12 Briefs × 6
voyages. *Best* is the optimizer's crew; the rest are themed crews. A Brief where the leading policies finish exactly
level counts as a tie rather than a win for whichever policy is listed first. Re-run after the bug check, which also
stopped the shoppers buying items nobody could wear and widened item fit to every crewmate an item measurably helps.

Two conditions:

| Crew | Wide | Five | Deep | Lean | Equipment's value at six / five berths | Best policy by Brief |
|---|---|---|---|---|---|---|
| Best | 96.5 (100%) | 96.6 (100%) | 92.2 (100%) | 70.3 (100%) | +2.1 / +10.8 | tie 5, five 4, wide 2, deep 1 |
| Aether | 76.8 (96%) | 51.0 (76%) | 49.8 (82%) | 0.0 (0%) | +1.0 / −13.0 | wide 6, tie 6 |
| Carry | 83.1 (100%) | 83.3 (99%) | 57.9 (97%) | 8.5 (39%) | +1.1 / +13.6 | tie 6, five 4, wide 2 |
| Break | 94.6 (100%) | 97.1 (100%) | 91.6 (100%) | 67.0 (100%) | +1.4 / +14.4 | five 6, tie 5, wide 1 |
| Poison | 79.7 (97%) | 79.9 (94%) | 63.6 (96%) | 0.0 (1%) | +2.7 / +17.0 | five 6, tie 4, wide 2 |
| Retaliation | 82.0 (99%) | 78.1 (96%) | 76.3 (100%) | 31.2 (81%) | +1.3 / +6.1 | wide 5, tie 4, five 3 |
| Follow-up | 84.8 (100%) | 74.5 (97%) | 71.8 (100%) | 3.1 (24%) | +2.2 / +4.7 | wide 5, five 4, tie 2, wide bare 1 |

Four conditions (Expert):

| Crew | Wide | Five | Deep | Lean | Equipment's value at six / five berths | Best policy by Brief |
|---|---|---|---|---|---|---|
| Best | 87.2 (100%) | 89.9 (100%) | 82.9 (100%) | 51.8 (76%) | +2.1 / +15.5 | five 6, tie 3, wide 2, deep 1 |
| Aether | 32.6 (77%) | 15.7 (29%) | 18.5 (45%) | 0.0 (0%) | +0.5 / −9.8 | tie 7, wide 3, wide bare 1, deep 1 |
| Carry | 66.3 (100%) | 68.3 (96%) | 45.3 (90%) | 2.8 (24%) | +1.1 / +19.4 | tie 5, five 4, wide 3 |
| Break | 83.4 (100%) | 92.0 (100%) | 85.2 (100%) | 58.1 (92%) | +1.6 / +21.1 | five 7, deep 2, tie 2, wide 1 |
| Poison | 36.0 (89%) | 54.2 (83%) | 37.0 (89%) | 0.0 (0%) | +0.9 / +28.1 | five 11, wide 1 |
| Retaliation | 80.2 (100%) | 88.6 (100%) | 85.0 (100%) | 38.9 (85%) | +1.3 / +21.1 | five 8, deep 2, tie 2 |
| Follow-up | 56.5 (85%) | 46.1 (68%) | 42.4 (89%) | 1.4 (7%) | +1.9 / +2.4 | wide 5, five 3, tie 2, deep 2 |

Over every Brief and type, the themed crews' best policy was tie 27 / five 23 / wide 21 / wide bare 1 at two
conditions, and five 33 / tie 18 / wide 13 / deep 7 / wide bare 1 at four. What they show:

- **The trade binds, and the answer depends on the crew and the Brief.**
  - Break and poison do best at five crew with equipment at both condition counts.
  - Carry is even at two conditions and prefers five at four. Retaliation prefers six at two and five at four.
  - Aether and follow-up need the sixth body at both.
  - At four conditions, five with equipment is the most common answer.
- **Many Briefs don't separate the policies.** That is 27 of 72 themed cells at two conditions and 18 at four. About
  half of the two-condition ties are crews that finish at full integrity however they shop. Before ties were counted
  as ties, nearly all of them were credited to *wide*, the first policy listed.
- **Equipment is worth little at six berths** (+0.5 to +2.7), and can be a trap at five for a fragile crew. Aether's
  *five* loses to *five bare*, likely because the interleaving shopper delays its fifth berth to buy items.
- **Fewer crew usually trails.** *Deep* (four crew) trails *five* for every crew but Aether at four conditions. At
  four conditions it beats six crew for break, retaliation and poison, which spend the upkeep on equipment instead.
  *Lean* (three) dies in most voyages for Aether, carry, poison and follow-up.
- **Expert splits the types.** Retaliation and break lose little. Aether survives 29–77% of its voyages, depending
  on policy. Two cards probably drive the split, though they were not measured one at a time here:
  - *Healing is halved* also doubles barriers, so it should favor the barrier sustainers (Atsa, Ilka, Daven) over
    the healers (Veska, Nahana, Navigator).
  - *Spending Aether can freeze* is aimed at Aether.

### The opening (23 crew, Briefs rolled before the charter cut the pool)

Re-running the first human playtest's opening showed a two-crew start almost never survives the first battle. Sector 1
Patrol, 60 rolled Briefs each:

| Opening crew | Two conditions: mean score / no loss | Four conditions |
|---|---|---|
| Arunima + Hanae | 16% / 2% | 18% / 3% |
| Arunima + Hanae + Daven | 74% / 45% | 57% / 30% |
| Arunima + Hanae + Ilka | 86% / 72% | 70% / 50% |
| Reva + Ilka + Wren | 93% / 72% | 86% / 63% |

Berth 3 costs exactly the starting 12 gold, so the first stop has a right answer. See the design doc's open questions.

## Human playtests

| Date | Conditions | Opening | Result | Agency / excitement |
|---|---|---|---|---|
| 6 October | Expert: *Twice as many*, *Enemies hit 40% harder*, *No shields*, *Healing is halved* | Arunima + Hanae, both items on Arunima; never opened a berth (56 gold unspent) | Lost after battle 5 | 1 / 1 |
| 6 October | Expert: *Healing is halved*, *Breaks provoke*, *Shields harden*, *Spending Aether can freeze* | Nahana + Nour; Spore, Dolores, then Ilka (the reference poison team); three items | Won sector 1 at 100% each, then lost all five battles after it; integrity ran out before the final boss | 1 / 1 |
| 6 October | Expert: *Shields snap back*, *Enemies hit 40% harder*, *Healing is halved*, *Poison withers* | Spore + Dolores; Nour, Nahana, then Ilka; nine items | Finished on the derived route at 40 integrity; four mild losses, all won without *Enemies hit 40% harder* | not rated |
| 6 October | Expert: *Spending Aether can freeze*, *Poison withers*, *Shields harden*, *Healing is halved* | Reva + Tarn; Atsa, Wren, Sevim, Maul; no equipment | 82%, then eight wins at 100%, each with 88–100% of the crew's health left; 98 integrity | 3 / 1 |

What changed in response is in the design doc's [first](../design/affix-team-building.md#first-human-playtest),
[second](../design/affix-team-building.md#second-human-playtest), [third](../design/affix-team-building.md#third-human-playtest)
and [fourth](../design/affix-team-building.md#fourth-human-playtest) human playtests.

## Decisions from the bug check

A three-iteration bug check (6 October) fixed 20 proven bugs. These choices are not visible in the code, so they are
recorded here with where each one stops applying.

- **The frost card's words were changed, not its behaviour.** The pool freezes for 60 AV, which is the calibrated
  behaviour behind the measurements. Making the pool stay frozen while the spender is frozen would have lengthened the
  tax and moved that balance. If frost is re-tuned, change the words and the freeze length together.
- **Perfect recovery means cleared.** Only a clear scores 1, and every other outcome is capped at .999. A board
  emptied in the same action that downs the last front-liner counts as a clear. Shown percentages round down, as the
  live game does, so a loss never reads 88%.
- **A fast second click on any button is dropped.** One capture-phase guard ignores the second click of a
  double-click. Keying buttons by id was rejected, because Release and Launch put a different button under the
  cursor. The cost: a deliberate fast double tap on Reroll or Voucher counts once.
- **An `--out` into a missing folder is refused before measuring.** It was first refuted as standard command-line
  behaviour. It became a bug once the usage notes promised that unusable values stop the run first.
- **Sessions are seeded by the Brief's position, not its conditions.** The baked route came from the earlier seeding,
  which shared sessions between Briefs with the same conditions. Re-deriving moves single battles by .03 or less.

## Limitations

- **Lab kits, not the live resolver.** Element and weakness are not modelled, which is also a known gap in the older
  sims. Rows are fixed per crewmate, and there is no bench.
- **The shoppers are greedy scripts.** The optimizer knows the Brief's best team; the themed shoppers build
  around one type and fill with the best addition. They show whether the trade binds, not how a person will play it.
- **Equipment-driven variety is untested.** See the design doc's open questions.
- **Few seeds.** `churn`, `matrix` and `roster` screen at one seed per encounter (breakpoints use two); `intent`
  and `flatten` screen at two. Rankings among near-equal teams are noisy. The top-20 share in `roster` is the
  noisiest measure; ban cost and weakness gap are steadier.
