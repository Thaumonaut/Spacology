# Voyage — design record

Everything settled, everything measured, and everything still open. Working title.
A premium auto-battler for iPad, no gacha, no monetisation, played before sleep.

---

# 1 · What this is and why

## The origin

"Currency Wars without its frustrations." A roguelite auto-battler where you assemble a
crew, choose where to take them, and watch the fight resolve. Solo project, free or
premium, no accounts, no server, shipped on itch or Steam.

## The reason it exists

This question took twenty sessions to answer properly and the answer reframed the design.

The game is about **reading a situation and answering it correctly.** Not optimisation —
Currency Wars is already an optimisation game, where you build the strongest engine. This
is a *reading* game: look at what is in front of you, and bring the right answer.

That matters because it is a real skill, it transfers, and it is teachable to a six-year-old
if the vocabulary is visual rather than textual. A child can learn "the green one cannot hurt
the green one" long before he can read "matched elements chip shields faster".

## What makes it fun, stated plainly

Four things, and every system should serve at least one:

1. **Kits sharp enough to interact in ways nobody planned.** The reflect carry paired with
   a barrier healer became a story because thorns and barriers are different mechanisms
   that happened to multiply.
2. **Conditions that forbid rather than tax.** "Enemies have 60% more health" does not send
   you looking. "Ailments do nothing here" makes you open the roster and read it differently.
3. **The build visibly coming online.** A moment where it clicks and you watch it happen.
4. **Losing in a way you can read.** You lost, you know why, you have a new hypothesis.

Things that serve none of those — rarity ladders for their own sake, gem synthesis,
equipment reroll economies — are texture that makes a run feel busy. They were cut.

## The monetisation position

The design forecloses most monetisation by construction, and that is a feature. Gacha
rosters, energy gates and power purchases are the exact frustrations the project set out
to fix; you cannot fix them and sell them. That leaves premium, possibly free-to-try with
a paid unlock, expansions later.

---

# 2 · The shape of a voyage

## Structure

A **voyage** is a run: **14 legs**, ending when you run out of legs or run out of
integrity. Between legs you are in the **ops room**, which is where the decisions are.

The store is not a shop between fights. **The ops room is the game**; the fight is the
answer coming back. Time spent there is not a cost.

## Destinations

Each leg offers **three destinations**, each a named world carrying its own **danger
rating (1–5), rolled independently every time.** A voyage might offer an easy Cairn beside
a punishing Phomous; the next voyage inverts it.

**Choosing where to go is choosing your difficulty.** That is the whole difficulty system —
there is no rank slider, no menu. A beginner takes danger 1 and 2 all the way down. An
expert takes 4s and 5s because the returns are worth it.

Worlds: Cairn, Phomous, Maelstrom, Verge, Bastion, The Hollows.

## Data integrity

**Replaces ship/hull integrity entirely.** You are a survey vessel recovering data the Null
took. Integrity starts at **70%** and you are trying to **raise** it. Zero ends the voyage.
Whatever you finish on is your score.

This is better than a draining health bar because you are recovering something rather than
spending it, and because it merges the fail state with the rating — after winning stops
being in doubt, you are still optimising.

---

# 3 · How a fight is scored

## Points, not win or lose

**Every enemy carries points** — chaff 1, shielded 2, elites 4. The percentage of the
board's points you take decides the outcome. This replaced the binary win/lose entirely and
is a much better resolution: it makes the round limit meaningful and it rewards getting
close.

| Score | Band | Integrity | Pays |
|---|---|---|---|
| **100%** | Perfect recovery | **+3 to +13%** | 100% |
| **88%+** | Slight shortfall | **nothing lost** | 75% |
| 68%+ | Small loss | −2 to −6% | 55% |
| 42%+ | Mild loss | −5 to −13% | 35% |
| 18%+ | Heavy loss | −8 to −16% | 20% |
| under 18% | Total loss | −13 to −25% | 8% |

All deltas scale with the world's danger, so a rout on an extreme planet costs far more
than one on a quiet shelf. Every band pays *something*, so a bad leg does not spiral you
into an empty hold.

**Measured distribution:** 48% perfect, 20% total loss, ~30% spread across the middle.

**Known weakness:** the "slight shortfall" band fires about 2% of the time. Landing between
88 and 99% is rare because points come in chunks of 1–4 — you tend to either clear the board
or fall well short. Giving chaff fractional values would make the free-shortfall outcome
something you can aim at.

## Shown during the fight

A gauge in the status column fills as you kill, with tick marks at each threshold and the
88% line marked heavier. It recolours across bands and reads "heavy loss if it ends here".
So when the round limit closes in, you can see which threshold you are fighting toward and
whether one more kill is worth it.

---

# 4 · The ops room

## The economy, measured

| | |
|---|---|
| Starting gold | ~70 |
| Packs opened per voyage | ~17 (1.2 a leg) |
| Cards kept / stripped | ~59 kept, ~110 stripped |
| Roster ceiling | **16 aboard** |
| Field | **12 slots (two rows of six), 8 free** |
| Upkeep beyond 8 | 7g a leg each — a full field costs 28g a leg |
| Average fielded | 8.8 |
| Refresh | **first free each leg**, then 9g, 15g, 21g |

Upkeep is what makes eight the natural number and twelve a deliberate expensive choice.

**Interest was rejected** — it rewards *not* spending, which works against the store being
the interesting part. A streak rewards playing well instead.

## Streak

Built on legs that cost nothing — 88% or better. **9 gold a step, cumulative, capped at
five.** Five clean legs in a row is 135 extra gold, about two extra packs. Anything that
costs integrity resets it to zero.

This makes choosing a danger-4 world on a four-streak a real decision: you are risking 45
gold a leg as well as integrity.

## Consignments

**Three packs offered per leg**, themed two ways:

- **By mechanic** — Rot & Bloom, Marks & Answers, Shields & Reflect, Tempo & Follow-up,
  Mend & Barrier
- **By element pair** — Order & Chaos, Growth & Void, and so on

Two different ways to slice the same pool, so aiming a purchase is not always the same
kind of decision.

**Each pack shows its actual rarity composition before you buy**, as a bar chart, plus a
line naming the best card inside: "shows 1 PRIME". You never buy blind.

**Fit is stated against your crew** — "you have Ash and Pyre aboard" or "nothing aboard
plays this way". The game does the cross-reference.

### The central tension

**The prime is in the wrong pack.** Take the strong card off-theme, take the right theme
with nothing special in it, or pay to look again and risk the offer getting worse. That
sentence is the whole store, and it is surfaced explicitly when it occurs.

## Rarity

| Tier | What it means | Power | Strip value |
|---|---|---|---|
| Common | one clear job, done reliably | 10 | 2 |
| Uncommon | a second property, usually small | 16 | 4 |
| Rare | changes how a tag plays | 26 | 8 |
| **Prime** | **a rule of its own** | 44 | 16 |

The jump that matters is rare to prime. A prime is not a bigger number — which is why it
is worth rerolling for, and why taking one off-theme is a genuine mistake.

**Odds climb with the voyage:** roughly 0.6% per card early, 3.8% late; deep packs (rare,
double cost) run 8.5%. Measured: **24% of packs carry a prime**, about 4 primes seen per
voyage, a typical crew ends with two.

## Opening a pack

Ten cards (eight for deep packs). Each is a **character, a fitting, or salvage**, with a
coloured spine so you know the type before reading it.

**Tap once to keep, again to strip, nothing happens until confirm.** A running tally shows
keeping, stripping, gold, and shards by element. No card dies to a stray tap — which is
what lets a pack be this big without being frightening.

Each character card states its pairing with your existing crew. Each strip states its value
in a named element: "strip → 8 void".

**The roster ceiling is enforced here.** The header reads "room for 3 more", turns red when
over, and the confirm button disables with a line telling you what to do.

### Why ten and not three

Keeping three of ten feels like curation. Stripping two of three felt like waste — which
was the original complaint about the Currency Wars shop.

## Salvage, crystals, promotion

Stripped cards give **shards of that card's element**. **24 shards make a crystal.**
Crystals promote a crewmate one rarity: **1 crystal to Uncommon, 3 to Rare, 6 to Prime.**
Only one promotion per visit.

Three shards trade for one of another element, so you are never stranded holding the wrong
colour — without that, element randomness stacks on tag randomness and a run can dead-end.

## Fittings

Equipment gets no separate system and no separate screen. It arrives in the same pack,
triaged by the same gesture, and says which crew it suits. Seven of them, phrased in
existing vocabulary so a fitting is never a new rule:

Ranging Sight (area attacks reach one more) · Slow Fuse (ultimate charges 25% faster) ·
Ballast Plate (barriers 30% larger) · Tuning Fork (one extra stack per application) ·
Counterweight (draws fire twice as often) · Bore Bit (shreds shields 40% faster) ·
Recoil Spring (follow-ups hit 30% harder)

## Team strength

A single number in the rail, updating as you field people, broken out into **crew power +
tag bonuses + pairings + fittings.** Every destination states what it needs against what
you bring, so "am I ready" is a number rather than a feeling.

---

# 5 · Crew

## The two axes

A character carries a **tag** (what it does) and an **element** (what it scraps into, and
what enemies are weak to). Deliberately independent: **you pull for tags, you scrap for
elements.** A card that is wrong on one axis is still useful on the other.

## Six tags, two tiers each

| Tag | At 2 | At 4 |
|---|---|---|
| **Hull** | barriers 45% larger | AMMUNITION — what a barrier swallows is returned to the attacker |
| **Blight** | one extra stack per application | BLOOM — an entity joins the turn order and detonates the board |
| **Drive** | crew act 12% sooner | RELAY — a kill advances the next crewmate |
| **Ordnance** | 20% more damage | OVERSTRIKE — a breaking hit lands twice |
| **Assay** | shields shred 60% faster | DISSECTION — a break costs two turns |
| **Crew** | healing 50% stronger | RELIEF — the first to fall is brought back |

The entry tier is splashable. **The deep tier changes a rule, not a number.**

**Stated anti-synergy:** Assay delays enemies; Blight needs them to act. A team running both
fights itself. This gives both archetypes a reason to exist.

## Six elements

order · chaos · growth · void · decay · energy

**Enemies have two weaknesses, not one.** Six elements against a crew means roughly 89%
coverage for a diverse team, which makes coverage a planning tradeoff rather than a
checklist. A weakness hit chips shields at full rate; anything else at 20%.

## The applier/spender rule

**No applier ships without a spender.** This is a content rule, not a hope — it came
directly from Banners of Ruin's documented failure, where only one archetype had both the
cards that applied an effect and the cards that cashed it in.

## Pairings

Derived from kits rather than authored twice:

mark → onmark · seed → deton · spread → deton · shred → onbrk · bait → mend · bait → over ·
guard → bait · charge → nuke · push → react · sweep → react

The pool averages 5.8 partners per character with only three that pair with nothing.

## The character sheet

Answers two questions. *How do they play?* — damage, healing, draw, ultimate, and a plain
list of what the kit does. *Where do they go?* — front or back with the reason.

And **"plays with" names actual crew you own**, green for gives, gold for wants. If nothing
pairs it says what to look for: "Look for someone who detonates rot." That turns the store
into a search rather than a shrug.

---

# 6 · Combat

## Core

Action-value turn order. Shields in layers, weaknesses, break, vulnerability, ultimates that
fire as **interrupts** rather than consuming a turn. Follow-up attacks that cascade.

**Break:** delays the enemy 35% of an action value, applies +35% damage taken, and the broken
unit loses its turn and reforms on its own next turn.

**Multipliers are bucketed** — additive within a category, multiplicative across: defence
stripped, power, crit, volume. Peak measured at 61× against additive's 8.8×.

## Shared Aether

Regular skills spend a team-wide Aether pool; basic attacks replenish it. Ultimates retain individual charge and remain interrupts. The first playable values are 3 starting charges, 6 capacity, +1 per basic and 1–3 per skill. Generation happens once per basic action, not per hit or follow-up. The pool persists across waves and resets at the next encounter.

Aether Weavers can increase basic generation, increase capacity, or spend extra charges for stronger skills. The initial implementation and tuning limits are recorded in [the Aether proposal](aether-pool-proposal.md).

## Placement, and what testing concluded

Three sessions of grid testing, and the honest finding: **placement is the weakest depth
axis in the project.**

| Axis | Swing |
|---|---|
| World conditions | **4.7×** |
| Tag thresholds | 2× |
| Terrain + line of sight | 1.45× |
| Placement on a grid | 1.20× |
| Placement on flat ground | 1.08× |

**Grid size makes no difference** — 1.06× at 2×3, 1.08× at 3×8, with enemy count held
constant. And wider grids make placement matter *less*, because units spread across columns
and blockers rarely line up with what they would protect.

**Terrain does earn its cost, for one specific reason:** it makes the correct layout
map-dependent. Across ten rolled maps the best layout was frontline five times and backline
five times. On flat ground there is one right answer you learn once.

**But of the terrain effects, only line of sight does real work.** Ridges stopped 12.4 of 87
shots a fight; evasion accounted for 1.9. If terrain is ever built, build it around blocking
and elevation, not stat modifiers.

**What shipped instead:** twelve slots in two rows, gaps allowed, and **at battle start the
empty slots close up** — relative order is what survives. Front row takes the hits, back row
is sheltered while the front stands. That gets most of the value at a fraction of the cost.

## What was learned about the grid UI

**The heatmap was an oracle.** Colouring squares by quality handed the player the answer with
the reasoning stripped out — you follow a gradient instead of solving anything. Replaced with
**consequences**: dragging someone lights up the enemies who can see them from that square,
tags the ones who just lost sight, and states it in a line. The reasoning becomes the
interface.

## Presentation

The animation work is the one area where this project is genuinely ahead of Currency Wars,
whose combat is functional but not theatrical. Call-and-response staging, cards flying from
ribbon to stage, cascade rattle, the turn track physically shoved when an ultimate cuts in,
trailing ghost health bars.

**A grid battle view was built and rejected.** Shots drawn as lines across two fields gave
*information* where the card stage gives *performance*. For a game you watch rather than
play, performance is the point.

---

# 7 · Enemies and worlds

## Eight archetypes that discriminate

Four more were cut for moving every build equally.

| Archetype | Effect | Punishes | Rewards |
|---|---|---|---|
| chaff | numerous, disposable | nothing | everything |
| bruiser | slow, heavy | mild tax | — |
| warden | enormous shields, soft body | direct damage | Blight (1.50) |
| cleanser | sheds 45% of ailments a turn | DoT builds (0.79) | non-DoT |
| reflector | returns 34% of each hit | cascade/chain (0.77) | heavy hits |
| anchor | strengthens all others | slow clears | fast AoE |
| bulwark | guards a neighbour | single-target burst | — |
| quickstep | acts twice as often | setup teams | — |

Spread 0.77 to 1.66 relative, with only 3 of 126 matchups below 0.80. **The enemy is a
planning puzzle, not a hard counter.**

## Enemies place themselves

Enemy kits choose their own ground, greedily, in order of how strong their opinions are.
Over 40 rolled maps: Lance chose ridges 49 times, Mortar chose thicket 38 times, Bastion
chose marsh 44 times.

The Mortar hiding in thicket is the one worth noting — it lobs over everything, so it gives
up nothing by standing where it cannot be shot. Nobody authored that; it fell out of the kit
and the terrain disagreeing about what cover costs.

## Conditions

The difficulty content, and the system with the largest measured swing.

### The rule that prevents unwinnable stacks

**Stat modifiers multiply with each other. Rule modifiers do not.**

Health ×1.6 with damage ×1.45 with speed ×1.25 is a wall no build clears. But "ailments
wither", "shields reform at once" and "follow-ups cannot chain" are three separate problems,
each individually answerable.

So the pool is **capped by category**:

| Category | Touches | Max in a stack |
|---|---|---|
| **Stat** | health, damage, speed | **1** |
| **Rule** | what is correct | 3 |
| **Shape** | encounter composition | 1 |
| **Cost** | the run outside the fight | 2 |

Without the cap, **10% of four-modifier stacks contain two or more stat modifiers.** With
it, none — by construction.

### Every rule condition is a trade

Not "back row takes double" but "back row takes double, front row deals 40% more." A
beginner takes the gift and ignores the cost; an expert builds around both. This also stops
a stack being pure subtraction.

Examples: *Sterile ground* — ailments wither, but shields are a layer thinner. *It reknits
itself* — shields reform at once, but a break lands twice. *No clean water* — healing halved,
barriers doubled.

### Counterplay must be reachable

Currency Wars has strategies that remove affixes, but whether you are offered one is luck. A
modifier whose only answer is a card you may never see is unanswerable; you just do not know
it yet.

Two fixes: **show the conditions before the draft**, so you build the answer instead of
hoping for it; and **one guaranteed removal at a price** somewhere in every voyage.

### Difficulty is the count, not the magnitude

Conditions carry weights; a stack's weight is the sum. Zero conditions for a beginner, four
or five for someone who has been losing on purpose for a fortnight, drawn from the same pool.

---

# 8 · What Currency Wars actually does

A systems teardown, with verdicts. Full version in `cw-teardown.md`.

## Worth taking

| System | Why |
|---|---|
| Fixed node spine, variable content | Replay without a map generator; losses stay comparable |
| Interest vs win-streak tension | The whole economy in one line |
| **On-field / off-field split** | A ten-person roster, a four-person fight |
| **Different empowerment by position** | One character is two characters |
| Frontline / backline as a binary | Most of positioning's value, little of its cost |
| Opt-in difficulty for a perk | Player-authored ceiling |
| Squad HP as score and fail state | One number for "did I win" and "how well" |
| Ascension gates | A wall you choose to attempt |

## Worth avoiding

| System | Why |
|---|---|
| Stacking stat affixes | The gods problem |
| Unremovable party debuffs | Removes agency without opening an alternative |
| Random counterplay to affixes | If the answer might never be offered, there is no answer |
| Five rarity tiers + gems + synthesis | Vocabulary cost far above decision value |
| Danger-arrow labelling | Treating the symptom rather than the disease |

## A correction worth recording

An earlier read of this teardown called *Massive Layoffs* and *Struggle Protocol* the best
ideas in the mode. That was wrong — those systems are *startling to describe* and unfun to
play, a desperation button you press twice a run and resent both times. Evaluating a system
for elegance rather than for the experience it produces is a failure mode worth naming.

The shop lock was also wrongly praised: it preserves a bad offer, and the original grievance
was never "I found something good and could not hold it" — it was "I spent everything
rerolling and the thing I needed never appeared."

---

# 9 · Interface

## Two principles, both from the source

**Into the Breach:** "Sacrifice cool ideas for the sake of clarity every time." They cut
weapons they could not convey. Everything is known except three things: shop contents, next
spawn, and intent beyond the current turn.

**Marvel Snap:** the cards always take precedence in the visual hierarchy; the UI exists to
highlight the cards. Every element has to pass that test.

## Layout

One skeleton, two phases, so nothing moves under your hands when a leg begins.

- **Left column** — fighting: turn order, recovery gauge, round, purse. Shopping: gold,
  integrity, strength, leg, capacity. Same place, same shape.
- **Middle** — the only region that changes. Fighting: enemy ranks and the stage.
  Shopping: consignments and the bay.
- **Tray** — identical in both. Where the crew always is, where dragging always happens,
  where the strip target lives.

## Layers the board carries

Enemy intent above each card · weakness pips lit or dim by whether anyone aboard can exploit
them · shields as concentric rings and ailments as corner dots, countable without text ·
the recovery gauge with band marks · a context strip naming world, danger, live conditions
and active tags · charged crew marked READY · the acting card naming its ability.

## Deliberately kept off

Numeric stats on cards (they live in the sheet; on the board they compete with the cards) ·
a settings bar (pause belongs in a corner) · element colour on crew cards (tag colour already
does that work) · damage previews for your own crew (you do not choose their targets, so it
would be noise).

## Touch

**44px minimum.** The inspect affordance is an invisible 44px corner zone with a small glyph
inside it, so the target is thumb-sized while the card stays clean. The rest of the card
remains draggable. An earlier 15px dot inside a draggable element was a spec violation, not
a preference.

**Keep and Strip are explicit buttons.** Tapping a card to destroy it is the kind of thing
that gets done by accident once and then never trusted again.

## Visual direction

Four were mocked: survey instrument, card table, star chart, bold poster. **Settled between
instrument and chart** — the chart's calm surface and free colour, the instrument's density.
Colour stays reserved for state, because green is a tag, red is an enemy and amber is
whoever is acting.

Terrain, where it appears, reads as **surface texture rather than colour**, which is what
frees colour to mean something.

---

# 10 · How this was tested

The methodology matters more than any single result, because most of these findings were
initially wrong.

## Rules that came out of failures

1. **Calibrate the encounter first.** A plain team should win about two thirds and be able
   to lose both ways. Uncalibrated tests saturate at 100% and hide everything.
2. **Score by breakpoint, not win rate.** Win rate saturates; the difficulty a build still
   beats does not.
3. **Sweep every scalar, never sample one.** A ward mechanic read as worthless at 0.09 and
   worked at 0.30.
4. **Record how fights are lost.** Wiped and timed-out need opposite fixes.
5. **Score interest separately from power.**
6. **Vary the encounter as well as the team.**

## Bugs that produced confident wrong answers

Worth recording because they were all silent:

- **Enemies had no action value field**, so `av` was undefined, arithmetic made it NaN, and
  they never took a turn. An eleven-round fight with zero enemy actions read as "placement
  does not matter".
- **Target selection returned NaN** for units without shield fields, so enemies selected no
  target and dealt no damage — 100% win rates everywhere.
- **Grid size was confounded with enemy count**, because enemy count scaled with grid area.
  The "bigger grids are worse" finding evaporated when enemies were held constant.
- **Coin cards made packs self-funding**, so shopping was free and a run opened 42 packs.
- **The forge was a tide, not a decision** — stripped cards produced enough crystals to
  promote an entire crew to Prime, which is why nobody ever lost.
- **Two health economies fought each other.** Crew health carrying between fights *and* ship
  integrity meant 28 of 60 runs died not from the hull but from the whole crew grinding to
  zero, invisibly. Collapsing to one pool took completion from 12% to 95% in a single change.

## Current balance

| | |
|---|---|
| Voyages completing | 52 of 60 home, 8 lost |
| Legs run | 13.9 |
| Median final integrity | 33% (range 0–76%) |
| Packs per voyage | 17 |
| Average fielded | 8.8 of 12 |
| Crew rarity mix | 3.9 common, 3 uncommon, 6.2 rare, 2.4 prime |

---

# 11 · Vocabulary

**Promotion rule:** a term is only Universal if two or more characters can produce it.

**Universal** — Speed, Action Value, Advance, Delay, Layer, Shield, Weakness, Soak, Shred,
Break, Broken, Reform, Vulnerable, Charge, Ultimate, Follow-up, Harmony, Drain, Reflect,
Down, Recovering, Round limit

**Archetype-specific** — Fracture (Blight), Survey (Assay), Stored (Hull)

**Deliberately not used** — *Null* (reserved for the antagonist), *Stagger / Toughness /
Weakness Break* (HSR's words), *Buff / Debuff* (never on screen)

---

# 12 · Still open

## Decided but not built

- Conditions are designed and capped but **not verified solvable**. Every legal stack needs
  at least one team that beats it. The pairs most likely to need a compatibility rule are
  *enemies act sooner* combined with anything that closes an engine.
- **Calls** — two or three player interventions per fight, at moments you choose. The turn
  track is already the interface for it. Currency Wars has nothing here.
- **The off-field split** — CW's best idea, where a benched character has different rules
  and cannot be targeted. Currently the bench is just reserves.

## Genuinely unresolved

- **Does the fight still read without the full staging?** A grid battle view was built and
  rejected for being informational rather than theatrical. But the card stage and a spatial
  puzzle pull in different directions and that tension is not resolved.
- **Is ten cards per pack too much reading?** Possibly not, if the ops room is the game —
  but it has not been timed.
- **Terrain, at all.** It works and it is measured. It is also the most expensive thing
  proposed and the third-weakest axis.
- **Sound.**

## Process note

Three separate times in this project, a system was patched three or four rounds deep before
anyone asked what the screen was *for*. The store was rebuilt from mockups only after being
called a mess. **Mock it up and review comparable games before building** is a rule that
earned itself here.

---

# 13 · Files

## Current prototypes

| File | What it is |
|---|---|
| **ops.html** | The full economy loop — packs, triage, crew, forge, launch, integrity. Playable end to end. |
| **voyage.html** | The run wrapped around the real animated combat. Destinations, scoring bands, streak, character sheets. |
| **watchable-fight.html** | The combat prototype at full ceremony. The best asset in the project. |
| **placement-lab.html** | Grid placement with consequence-based feedback and self-placing enemies. |
| **grid-lab.html** | Field size, team size, terrain and layout comparison. |

## Design mockups

`board-styles.html` (four visual directions) · `board-dressed.html` (every combat layer
annotated) · `store-dressed.html` (ops room beside the fight) · `pack-opening.html` ·
`pack-select.html` · `store-layouts.html`

## Documents

`cw-teardown.md` · `modifiers.md` · `store.md` · `dictionary.md` · `synergy-deep-dive.md` ·
`roster-design.md` · `pipeline-notes.md`

## Simulation and test

`ops-smoke.js`, `voyage-smoke.js`, `session-smoke.js` (headless full-run harnesses) ·
`engine.js`, `ladder.js`, `counters.js` (breakpoint and matrix tools) · `designer.js`,
`composer.js`, `evaluator.js`, `pipeline.js` (procedural character search) ·
`roster.js`, `synergy.js`, `pool.js` · `battle-tests.xlsx`

## Superseded

`run.html` (rebuilt combat instead of reusing the animation — a mistake) ·
`session.html` (right idea, wrong direction of merge) · `battlefield.html` (grid combat,
rejected) · earlier animation tests

## Pack equipment and compact rewards

Keep and Take All add every gear or ship copy to inventory, including items already equipped. Copies appear as inventory quantities; equipping, replacing, removing, combining, and dismantling move or consume one copy at a time. Equipped gear actions refer to the inspected owner and slot. Prime resolution bonuses remain unchanged, and crew duplicate preferences apply only to crew.

Open pack rewards share the store’s 156px supply strip. Compact cards keep their name, thumbnail, Keep and disposal buttons; clicking a card opens its full details. Opening a pack does not change the field height or position. Inventory and departure stay visible at supported tablet and desktop heights.
