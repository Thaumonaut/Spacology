# Roster and enemies, built from the research

21 characters, 6 tags, 8 enemy archetypes, 6 planet conditions.
Files: `roster.js` (all data), `synergy.js` (the model), `search.js` (find combos).

## The rules this roster follows

**Two tiers per tag.** Entry at 2 is mild and splashable. The tier at 4 changes a
*rule*, not a number — Riot's "binary scaling", where the deep tier defines what the
team does rather than how hard it hits.

| Tag | at 2 | at 4 |
|---|---|---|
| **Hull** | barriers 45% larger | **Ammunition** — damage a barrier swallows is returned to the attacker |
| **Blight** | one extra stack per application | **Bloom** — an entity joins the turn order, dragged forward by Blight actions, detonating every ailment when it acts |
| **Drive** | crew act 12% sooner | **Relay** — a crew kill immediately advances the next crewmate |
| **Ordnance** | 20% more damage | **Overstrike** — a hit that breaks a shield lands a second time |
| **Assay** | shields shredded 60% faster | **Dissection** — break costs the enemy two turns |
| **Crew** | healing 50% stronger | **Relief** — the first crew member to fall is brought back |

**Every applier ships with a spender.** The Banners of Ruin failure is an archetype
with cards that apply a mechanic and nothing that spends it. Audited:

| Tag | appliers | spenders |
|---|---|---|
| Blight | Ash, Cinder, Sump | Pyre, and the Bloom itself |
| Assay | Quill, Vitre | Ledger, Maul, Nettle |
| Hull | Wex, Ferrule | Tarn, Mire |

**One board-level payload.** The Bloom is the only tag bonus that puts something on
the turn track. It is the most watchable shape available because the payoff is
visible approaching.

**One named anti-synergy.** Assay delays enemies; Blight needs them to act so
ailments tick. A team leaning on both fights itself. Stated openly so both
archetypes have a reason to exist.

**Enemies only earn a name if they discriminate.** Four archetypes were cut for
moving every build about equally. Three kept, three added, all written against a
specific build.

## Results

Breakpoint — the difficulty multiplier where a team stops winning three in four.

| team | open | murk | hive | fortress | bloom | cascade | spread |
|---|---|---|---|---|---|---|---|
| Blight | 3.38 | 2.24 | 3.92 | 3.77 | **4.69** | 4.53 | 2.1× |
| Ordnance | 2.15 | 0.90 | **4.23** | 2.96 | 3.05 | 3.94 | **4.7×** |
| Assay | 2.28 | 1.49 | 2.98 | 2.59 | 2.43 | 3.07 | 2.1× |
| mixed, no deep tag | 1.58 | 1.10 | 2.30 | 1.89 | 2.00 | 2.70 | 2.5× |
| Drive | 1.30 | 0.86 | 2.04 | 1.54 | 1.69 | 2.24 | 2.6× |
| Hull | 1.10 | 0.66 | 1.45 | 1.73 | 1.34 | **1.89** | 2.9× |
| Crew | 0.62 | 0.40 | 0.75 | 0.95 | 0.71 | 0.88 | 2.4× |

## What holds

**Deep tags beat no deep tag.** The mixed team with no tier-4 sits mid-table at 1.58,
below four of the six committed builds and above two. Commitment pays, but not
automatically.

**Worlds move things a long way.** Ordnance swings 4.7× between murk and hive — it is
the best team on the board in one and near-worst in another. That is the planning
pressure, and it is the meta dial: rotate the planet mix and the answer changes with
no balance edit.

**The detonator wants to wait.** Firing the Bloom on a timer scored *worse* than
firing it late, because detonating clears stacks before they grow. It now holds until
the board carries fourteen stacks. A greedy spender is anti-synergistic with its own
engine — worth remembering for any future payoff mechanic.

## What does not hold yet

**Crew is not a build.** At 0.40–0.95 it is below the floor everywhere. Correct, in
fact: a team of five supports with nothing to support *should* lose, and this is the
same result the earlier testing gave for shields with no carry. Crew should be a
splash tag, and Relief at four members may not deserve to exist.

**Hull underperforms at 0.66–1.89.** Three slots on Wex, Ferrule and Tarn is 29 direct
damage against Ordnance's 62, and the reflect has to make that up before it profits.
It is the strongest team on the cascade world, which is the right shape — it just
needs the floor raised. Next lever: the reflect should trigger on barrier *expiry* as
well as on damage, so the shielders contribute even on turns Tarn is not struck.

**Blight is the current meta**, topping five worlds of six. Not a problem by itself —
over-performers get cycled — but worth noting it is the archetype to watch.
