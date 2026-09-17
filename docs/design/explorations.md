# Explorations — wide brainstorm

Companion to `design-notes.md`. That file is the spine; this one is speculative. Nothing here is a
decision. Things graduate from here into the notes when they survive scrutiny.

---

## 1. What players reliably love

Each with the game that proves it and what it implies here.

**The moment a build comes online.** *Balatro, Slay the Spire, Monster Train, Risk of Rain 2.* The
appeal is multiplicative scaling — watching a number stop being reasonable. Balatro is almost purely
this. Implication: reactions and ladder rungs must multiply, not add, and the moment a build crosses
a threshold should be *visibly* marked.

**Perfect information puzzles.** *Into the Breach.* Every enemy shows exactly what it will do next
turn. Zero combat RNG. Players love that every loss is provably their fault. Implication: our
determinism is already right; the missing half is telegraphing what enemies will do, not just when.

**Discovering interactions the designer "missed."** *Inscryption, Noita, Slay the Spire, Balatro.*
Nothing beats feeling like you broke the game. Implication: don't over-sand the edges. A few
degenerate combos that require real effort to find are an asset, not a bug.

**Recovery from a losing position.** *Darkest Dungeon, FTL, Slay the Spire.* Squeaking by is more
memorable than dominating. Implication: fights need a visible margin, and the design should permit
comebacks rather than resolving early.

**Units with identity.** *Fire Emblem, Darkest Dungeon, Hades, Battle Brothers.* People remember
Dismas. They don't remember "the archer." Implication: named characters with distinct kits beat
generic units, and this is the one thing Currency Wars gets for free that we must earn.

**Short, complete rituals.** *Balatro, Slice & Dice, Vampire Survivors, Dicey Dungeons.* A run that
fits in one sitting and ends cleanly. Implication: 20 minutes, no save-scumming pressure, no dailies.

**Reading a system instead of memorising a table.** *SMT press turn, Into the Breach, Netrunner.*
Implication: the hexagon grid passes this test; a Pokémon type chart would not.

**Unlocks that change rules, not numbers.** *Slay the Spire's ascension, Hades' pact, Monster Train
covenants.* Implication: already load-bearing in the notes. Hold the line.

**Asymmetric knowledge over time.** *Hades.* The world reacts to how many runs you've done. Cheap
emotional stickiness with no mechanical inflation.

---

## 2. What players reliably hate

**Randomness resolving after the last decision.** *XCOM's 95% miss.* The canonical example. Already
solved by determinism.

**Not knowing why you lost.** *Backpack Battles.* This is the diagnosed reason Currency Wars lands
and BB doesn't. Attribution readouts exist for this reason.

**Solved metas.** *TFT between patches, any netdeckable game.* Implication: boss-category-at-run-start
and rotating modifiers exist to fight this.

**Mandatory units.** *Any gacha with a "you need this support" meta.* Already flagged: Goad was
becoming mandatory and got fixed.

**False choice.** Three options where one is obviously correct. Implication: the shop's standing-offer
slot and the tempo-alignment tag both exist to make choices genuinely contested.

**Dead time.** Long animations you can't skip, auto-battler stretches where nothing happens.
Implication: the pacing rules in §10 of the notes.

**Grind gates.** *Summoners War rune farming, stamina systems.* Implication: no stamina, ever.

**Losing progress with nothing to show.** Runs that end with zero carry-forward feel wasteful.
Implication: mastery grid records even failed runs.

**Tutorials that never stop.** *Genshin's opening hours.* Implication: hints should be predictive and
dismissible, never modal.

**FOMO.** Explicitly rejected. Daily seed is optional and permanent; weekly modifiers rotate but
nothing expires.

---

## 3. Gaps — things we have not designed at all

Ranked by how much they'd add.

### 3.1 Enemies have no kits

The biggest gap by a distance. Our enemies are stat blocks that attack. Players have four ability
slots, elements, triggers, engines. Enemies have `atk`.

*Into the Breach* telegraphs the exact attack. *Shogun Showdown* shows the enemy's next three moves.
*Wildfrost* gives every enemy a visible counter and a kit. *Octopath* bosses change behaviour by
phase.

Give enemies the same four-slot structure. An elite with a Trait ("when broken, applies Decay to your
whole team"), a Skill it uses at intervals, and an Ultimate it charges toward. Suddenly encounters
are puzzles rather than health bars, and the boss-category system has somewhere to live.

**This also fixes several other things.** Enemy skill points would give Shock's drain a target.
Enemy elements would let annihilation be something they do to *you*. Enemy ultimates give the
Interrupt trigger a proper job.

### 3.2 Nothing persists between fights within a run

Each fight starts fresh. *Darkest Dungeon* is built entirely on the opposite — HP, stress and
afflictions carry through a dungeon, so every fight is a resource decision about the next one.
*FTL* the same with hull and fuel.

Candidates for carry-through: health, ultimate charge, accumulated Weight, terrain damage, a
character being "spent" for the act. Any of these turns a run from five independent fights into one
continuous attrition curve, which is where the squeaking-by feeling actually lives.

Risk: it makes a bad early fight snowball into an unwinnable run. Mitigate with between-fight
recovery choices (heal vs. upgrade vs. gold — *Slay the Spire*'s campfire).

### 3.3 There is no decision during combat, at all

We removed it deliberately, and I think one small exception is worth exploring rather than assuming.

*Slice & Dice* gives you rerolls. *FTL* pauses. *Bravely Default* lets you bank turns. The minimum
viable version here: **one commit per fight.** A single moment where you can hold a unit's action,
force an ultimate early, or reposition. One button, once, in a fight you otherwise watch.

That may be all the agency needed to convert "reported result" into "my fight." Worth testing before
declaring combat fully automatic.

### 3.4 No sacrifice or cost-now mechanics

*Inscryption* is built on sacrificing your own creatures. *Darkest Dungeon* trades a hero's sanity
for power. We have no mechanic where you pay something you'd rather keep.

Candidates: spend health to skill, consume a token permanently for a burst, sacrifice accumulated
elements for an immediate effect, retire a character mid-run for a permanent team buff.

This is also the missing engine for reflect — a character who damages *itself* to charge the pool.

### 3.5 Positional depth is thinner than it looks

*Darkest Dungeon*'s rank system is much stronger than our exposure grid: abilities are usable only
from certain positions and can only hit certain positions. That single rule generates enormous depth,
and enemy abilities do the same, so shuffling positions is an attack.

Our grid currently only affects targeting order and stat bonuses. Adding "this skill only works from
the front row" and "this skill only hits the enemy back row" would cost almost nothing and multiply
the placement decision.

### 3.6 The enemy doesn't build

Bosses could draft. An encounter that assembles a team from the same tag space you use — with
factions and element counts — is infinite content from existing systems, and it makes the matchup
grid legible in both directions.

### 3.7 No information as a resource

Everything is visible. *Netrunner*, *Battle Brothers* scouting, *FTL* sensors. Consider: enemy
composition hidden until you scout, or a shop item that reveals the next two encounters. Turns
knowledge into something you buy.

### 3.8 No relationships between characters

*Fire Emblem* supports, *Chrono Trigger* dual techs, *Wildermyth*, *Battle Brothers*. Specific pairs
that do something together. Risk: two-card combos are brittle and feel mandatory. Safer version:
pairs that share a faction get a small bond, which we already have via counts.

### 3.9 No time pressure within a run

Nothing punishes slowness. *FTL*'s pursuing fleet is the classic. Could be as light as encounters
getting a modifier for every N turns spent.

### 3.10 No narrative frame

*Hades* proved a roguelite can be emotionally sticky with zero mechanical inflation, purely through
structure. The runic script and sigil wheel are the seed of something here.

---

## 4. Playstyles already latent in the systems

These need no new mechanics — they're combinations nobody has named yet.

**Annihilation control.** Deliberately apply opposing elements to trigger Collapse and strip enemy
statuses. Using the "bad" reaction as a cleanse tool.

**Purity lockout.** Seal a target so it can't gain elements, then pure-stack a single element to
overflow. Requires denying yourself everything else.

**The Weight bomb.** All slow-aligned. Everybody holds, Weight climbs across the whole team, then one
synchronised catastrophic turn. Loses to short fights, terrifying in long ones.

**Follow-up chain.** Several follow-up units triggering off each other's triggers. Needs a chain
limit — but making that limit *a resource you can raise* is a whole archetype.

**Zero-basic.** Everyone skills every turn. Requires a dedicated battery and starves instantly if it
dies. High risk, high tempo.

**Denial stockpile.** Never allow a reaction. Run only non-reacting pairs, accumulate enormously,
overflow once. The patient build.

**Interrupt lock.** Stack Interrupt-trigger units so no boss charge ever resolves. Pure control.

**Exposure gambit.** Put the carry in front on Bluff terrain for the output bonus, keep it alive with
a Void shield that deletes one hit regardless of size.

**Inverted reflect.** Reflect wants the enemy fast; slow-aligned units want gaps. A team that hastes
the *enemy* while its own carries wind up. Genuinely strange and coherent.

**Battery economy.** Two basic-engine generators funding one enormously expensive skill user. The
skill-point equivalent of a mana ramp deck.

**Break metronome.** Everything keyed to break frequency — Ricochet's trait, breaker basics,
break-filled ultimates. A team that lives or dies on break cadence rather than damage.

**Element denial as defence.** Apply Order to enemies purely to annihilate the Chaos they'd otherwise
build. Defensive play through the reaction system.

---

## 5. Mechanics from other games worth stealing

**Bravely Default — Brave/Default.** Borrow turns from your future, going into turn debt. Act four
times now, then skip four. This is the slow-scaling idea generalised and it is superb. Directly
compatible with action value.

**Wildfrost — counters on everything.** Every unit and enemy has a visible countdown to its next
action, and half the game is manipulating those numbers. Almost exactly our turn track, but the
counters are the *primary* interaction rather than a readout.

**SMT — press turn.** Hitting a weakness grants an extra action. Applied here: a *correct* reaction
grants the team a bonus action. Makes coverage immediately rewarding rather than eventually rewarding.

**Octopath — boost points.** Bank a resource to amplify the next action, 1 to 3. Simple, deep, and it
solves the "when do I spend" question elegantly.

**Monster Train — two clans per run.** You pick two factions at run start and combine them. Ours are
emergent; making faction a *run-defining choice* is more legible and more replayable.

**Darkest Dungeon — rank restrictions.** Covered in 3.5. The cheapest large depth increase available.

**Slice & Dice — rerolls as the resource.** A limited pool of rerolls is the only in-combat agency,
and it's enough.

**Inscryption — sacrifice.** Covered in 3.4.

**Grandia — cancel windows.** Attacking an enemy during their wind-up cancels it and knocks them back
on the track. Perfect fit for our telegraphed charges and gives Interrupt real teeth.

**Hearthstone Battlegrounds — tavern tiers.** Shop quality is a resource you invest in. Adds a
spend-now-vs-scale decision the current shop lacks.

**Loop Hero — you build the enemy.** Placing tiles spawns the threats. Terrifying and elegant.
Terrain-as-run-reward is adjacent; letting terrain *summon* is a further step.

**Cobalt Core — three characters, one deck.** Which characters you bring determines the card pool.
Analogous to elements determining reachable reactions.

**Risk of Rain 2 — item stacking with diminishing but never-zero returns.** Keeps late-run pickups
meaningful without infinite scaling.

---

## 6. Wilder ideas, unfiltered

- Characters that permanently change element when they ultimate
- A unit that copies the enemy's last action
- Terrain that an enemy can also stand on and benefit from
- A character whose Weight transfers to allies instead of itself
- Reactions that trigger on *your own* team if you're careless
- An enemy that drafts from the units you didn't buy
- A character with no basic attack at all
- An ultimate that costs the character (they leave the run)
- Elements that decay into other elements over time rather than vanishing
- A boss that copies your formation
- A shop unit that only appears if you've never used its element
- Negative-cost units that damage your own economy
- A "second board" — a parallel fight resolving simultaneously
- Cards/relics that alter the hexagon itself, making two elements adjacent that weren't

---

## 7. What I would chase first

1. **Enemies with kits** — the largest gap, fixes several others at once, uses existing structure
2. **Persistence between fights** — where the attrition tension actually lives
3. **Rank restrictions on abilities** — cheapest large depth increase
4. **One commit per fight** — test before assuming full automation is right
5. **Press-turn-style reaction reward** — makes coverage immediately, viscerally rewarding

---

## 8. HSR teardown — how characters are actually built

### The five-slot skeleton

| Slot | Gated by |
|---|---|
| Basic | nothing; generates a skill point |
| Skill | team skill point pool (max 5) |
| Ultimate | personal energy; usable at any moment, including mid-turn |
| Talent | a condition — this is our Trait |
| **Technique** | **used before combat starts** |

**We are missing Technique.** In a game where the build phase *is* the game, a pre-combat slot may be
the most valuable one on the list — enter with elements pre-applied, a carry pre-advanced, a shield
already up. Turns encounter approach into a decision.

### Why supports outlive DPS

**Action economy beats percentages and never inflates.** Bronya advances an ally; an extra turn is
worth more than any multiplier and worth *more* the stronger the carry gets. Sparkle generates skill
points — a character whose entire concept is fixing an economy. Ruan Mei extends break windows, which
made break teams a category rather than a gimmick.

Those stay good for years; a DPS is crept in one. Damage inflates, "one extra turn" cannot.

**Implication:** our Advance, Surge and Relay buffs are the most dangerous items in the vocabulary.
Rare and expensive.

### Pull calculus, ranked

1. **Removes a constraint you currently live with** (Sparkle → skill point starvation; Fu Xuan /
   Aventurine → removes the dedicated-healer requirement). Strongest reason, and not about power.
2. **Grants actions.**
3. **Enables an archetype that didn't exist** (Firefly turning Break damage into a damage type;
   Acheron building a team shape around debuff counting).
4. **Universality** — every team vs one team.
5. **Raw multipliers** — weakest, first to be crept.

### Teardowns

| Character | Structure | Lesson |
|---|---|---|
| March 7th | free; shields, taunts, freezes, damages | a free unit must be permanently *functional*, never *optimal*. Four jobs means never a dead draft |
| Himeko | attacks additionally when enemies break | a trigger character converts someone else's action into yours; power is a function of your roster |
| Acheron | ultimate charges from debuffs applied by *anyone* | alternative fill source reshapes team building — supports chosen for debuff *count* |
| Firefly | scales off Break damage | repurposing an existing system as a damage source creates an archetype from nothing |
| Remembrance | memosprites take their own turns on the action bar | our Legion archetype, validated |
| Elation (4.0) | see below | a sixth conditional slot |

### Elation — the strongest recent structural idea

Punchline is a **shared pool across all Elation characters**, generated by their actions; each
consumed Punchline raises the multiplier when the **Aha Instant** fires. Aha itself **appears on the
turn order** as an extra participant. Elation Skills *only* activate during that window, firing in
sequence, and the window also cleanses crowd control.

So: a **sixth conditional ability slot** that can only fire during a team-wide window your
composition earns.

**Direct port:** accumulated reactions summon a **Convergence** onto our turn ribbon; during it every
character fires a reaction-only ability. This also fixes a real problem — our reactions are currently
automatic and passive, with no ceremony. Scheduling the big one as a visible event on the track gives
the payoff the frame we've been trying to find a home for.

### Do not copy

Eidolons (paying six times for one character — pure monetisation, no design). Relic substat farming
behind stamina. Numeric power creep. Onboarding: ~93 characters facing a new player at once.

**Our structural advantage:** HSR *must* inflate because it must sell characters. Premium pricing plus
options-not-numbers progression means we can make every character permanently relevant, which HSR
cannot.

### Validation of the axis model

HSR now ships **alternate versions of existing characters on different paths and elements** — Sparkle
returned as Sparxie (Fire/Elation where the original is Quantum/Harmony), plus Aventurine and Silver
Wolf variants. That is exactly the "same character, change one axis" exercise. A studio with a decade
of data is shipping it as product strategy.

---

## 9. The wider Hoyoverse comparison

### Shared DNA

All of them run: **build an invisible meter → break it → get a burst window.** Genshin applies an
aura and reacts. HSR chips toughness and breaks. ZZZ builds Daze to Stun, and separately builds
Anomaly to a proc.

It converts continuous play into a punctuated rhythm. Without it combat is a flat damage race; with
it, every fight has *moments*. Our Guard → Break → Payout is the same idea, which is likely why it
felt right immediately.

### Their real team-building innovation

**Characters contribute while they aren't the active one.** Genshin's off-field application, HSR's
follow-ups, ZZZ's assists. The best team-building feeling in all three comes from a character doing
work on someone else's turn. More important than elements or bursts.

**Missing trigger type — Persistent.** Genshin's off-field application isn't triggered by anything;
it repeats on a timer while the character does nothing. In our terms: applies an element every N
ticks regardless of whose turn it is. Distinct from Standing (a passive rule, not inserted actions).

### Genshin

*Interesting:* the reaction system is genuinely deep; rotation optimisation is a real skill.

*Boring, and instructive:* **a great combat system attached to encounters that never require it.**
90%+ of the content is cleared by hitting things. The depth exists and most players never learn it's
there.

**Sharpest lesson available to us.** Our systems will only feel deep if encounters *demand* them. An
enemy beaten by raw damage teaches nothing — and we currently have several.

### Honkai Impact 3rd

*Interesting:* Ultimate Evasion — perfect dodge triggering a slow-motion burst window. One of the
best action mechanics ever shipped.

*Boring:* the cautionary tale for accumulation. Seven years of stacked systems, valkyrie variants,
gear layers and currencies left it functionally closed to newcomers. Every system was individually
reasonable; the sum is a wall.

Given how much this design has accumulated in one conversation, worth re-reading periodically.

### Zenless Zone Zero

**Anomaly** — a parallel damage path scaling off different stats that doesn't crit. Two characters of
the same element play completely differently depending on which path they're built for. Our
four-engines idea, shipped, and evidence the payoff is large.

**Chain attacks** — the more important one. On a stun or a perfect dodge, the game freezes, shows your
other characters, and you pick one to enter. Structurally: *the game plays continuously, then at
earned moments it stops and asks one question.*

**This is the answer to "one commit per fight."** Applied here: when a Break happens, the fight pauses
and you choose which character responds. Everything else stays automatic. Agency at the moment that
matters. Pairs naturally with the Convergence window — a scheduled team-wide event is the obvious
home for the one decision.

### On the Currency Wars preference — bias check

**Borrowed advantage:** you already love those characters, and CW inherits HSR's entire combat
presentation for free (models, animations, ultimate cut-ins). Most auto-battlers build presentation
from scratch and it ends up a blur. Real, and not copyable.

**Structural advantage, genuine:** PvE so the curve is authored and narrow wins are possible.
Turn-based so causality is readable. Bonds legible at a glance. Embedded in a game already open.

Alternatives, honestly: TFT is PvP so creativity is punished by whatever is strongest. Super Auto Pets
is readable but shallow — tiny board, left-to-right resolution, no windows. Mechabellum is excellent
but heavy and competitive. Backpack Battles is spatial, a different pleasure.

**Verdict:** possibly over-rated slightly because of the characters, but rated highly for reasons
that would still hold if the characters were strangers. The one thing to earn from scratch is
presentation — which is the argument for the polygon notation and the ceremony rules being
load-bearing rather than polish.

**What CW does that other auto-battlers don't:** turn-based resolution with discrete animated actions,
where almost everyone else resolves in a continuous scrum. That single choice is why you can tell
*why* you won. The largest thing to preserve.

---

## 10. Additions to chase from this pass

1. **Technique slot** — a pre-combat ability. Highest value per unit of work
2. **Convergence window** — Elation's shared-pool-to-scheduled-event, giving reactions their ceremony
3. **Chain-attack commit** — the fight pauses at Break and asks one question
4. **Persistent trigger** — off-field application on a timer
5. **Encounters that demand the systems** — the Genshin failure, and we already have it

---

## 11. The HSR roster as a whole — what the shape teaches

### Path is drifting into decoration

A Path bundles four things: a stat skeleton, relic affinity, a Simulated Universe blessing pool, and
a role expectation. **The role expectation has been dissolving for two years.** Nihility was debuffs
until Acheron and Black Swan became carries. Preservation was pure defence until Fu Xuan and
Aventurine contributed damage. Destruction was bruisers until Firefly made it a Break archetype.

The stated taxonomy and the functional taxonomy have come apart. Path is now largely a flavour and
marketing axis in a mechanical costume.

**This validates our four-axis model.** One coarse class label cannot hold ninety characters.
Element × Role × Trigger × Faction gives four independent axes, which is why "DPS chaos follow-up"
and "support void break" coexist without a category fight.

### Paths and the sub-archetypes that emerged inside them

| Path | Promise | Sub-archetypes |
|---|---|---|
| Destruction | bruiser, self-sustaining blast | pure carry (Jingliu) · counter-attacker (Clara, Yunli) · break carry (Firefly) |
| The Hunt | single-target, self-advancing | executioner (Seele) · break specialist (Boothill) · summon-adjacent (Topaz) |
| Erudition | AoE | static AoE (Herta) · follow-up engine (Himeko) · summon carry (Jing Yuan) |
| Harmony | buffs | action-granter (Bronya) · economy fixer (Sparkle) · constraint remover (Ruan Mei) · team event (Robin) |
| Nihility | debuffs, DoT | DoT carry (Kafka, Black Swan) · enabler (Silver Wolf, Pela) · stack-counter carry (Acheron) |
| Preservation | shields, taunt | pure wall (Gepard) · sustain-plus-damage (Fu Xuan, Aventurine) |
| Abundance | healing | reactive (Luocha) · break-healer (Gallagher) · buff-healer (Huohuo) |
| Remembrance | summons with their own turns | summon carry (Aglaea, Castorice) |
| Elation | shared pool, scheduled burst window | too new to have settled |

**Harmony is the path to study.** It holds more distinct *functions* than any other — advancing,
buffing, fixing economies, removing constraints, scheduling team events — and it is the path players
pull from most reliably. Not a coincidence: a carry can only do damage, while a support can attack
any system in the game. **Supports have more design space than carries.**

### The real functional taxonomy (cuts across every path)

Main carry (50–70% of damage) · Sub-DPS (contributes on someone else's turn) · Amplifier (multiplies
the carry) · Enabler (makes an archetype possible at all) · Sustain · Breaker · Summoner.

**Enabler ≠ Amplifier, and the roster treats them differently.** Ruan Mei is an enabler — before her,
break teams were not a category. Robin is an amplifier — she makes existing teams bigger. *Enablers
create content; amplifiers inflate it.* Enablers are what people actually pull for.

**Action for us:** the roster should be roughly evenly split between characters that make new things
possible and characters that make existing things larger. **Our starter eight is almost entirely
amplifiers.** That is a gap.

### Roster shape as a content roadmap

7 elements × 9 paths = 63 cells, filled by ~93 characters. Some crowded, some empty, and **the empty
cells are the release schedule.** When a gap is awkward to fill with someone new, they ship an
alternate version of an existing character to fill it.

Ours is 6 × 4 × 5 = 120 cells. Same logic: empty cells are the pipeline, fillable indefinitely
without adding a single mechanic.

### The four-star obsolescence tax

Most four-stars are functionally retired. The survivors — Asta, Pela, Tingyun — lasted because they
are defined by a *function* rather than a magnitude (speed, defence shred, energy). The rest were
defined by numbers, and numbers got crept.

**Survival criterion:** a character defined by "grants an extra action" is immortal. A character
defined by "+40% damage" has a shelf life. Another argument for options-not-numbers.

### Trailblazer as a design object — steal this

One character existing as Physical Destruction, Fire Preservation, Imaginary Harmony, Remembrance and
Lightning Elation. Same person, five mechanical identities.

**A configurable starter character whose element, role and trigger the player chooses.** Teaches the
axes by making you use them, guarantees a new player can always fill a hole in their team, and costs
one character's art for five characters' function. Worth adding as a ninth slot in the starter roster.

---

## 12. Rarity — what it should actually vary

**Rarity buys breadth, not height.** A common unit does one thing at full strength under one
condition. A rare unit does the same thing at the same strength under more conditions, or in more
teams. Identical peak, different applicability.

### Five ways to spend rarity

| Lever | Common | Rare |
|---|---|---|
| Trigger conditions | fires on break | fires on break *or* ally ultimate |
| Slots that do work | one excellent ability, three filler | three that all contribute |
| **Dual element** | mono — cannot react alone | self-reacting; huge capability jump, zero stat increase |
| **Selectable policy** | fixed AI rule | choose between two or three |
| Faction flexibility | one faction | counts as two, or as whichever is needed |

Selectable policy is unique to our automated format — flexibility as a literal build option.

**Worked example.** *Ricochet* (common): fires on break only, applies Chaos, always targets lowest
guard. *Fulcrum* (rare): fires on break **or** ally ultimate; applies Chaos or Energy, chosen at
draft; targeting policy selectable from three. Fulcrum hits no harder — he fires more often and fits
more teams.

### The consequence, which is the desired outcome

Narrow commons must be built pointing one direction, so a common team **peaks higher in its
specialty and has a lower floor across encounters.** A rare team is consistent and hedged.

**A well-built common team should beat a rare team on the encounter it was built for.** Not a
consolation prize — a real reward for committing. Maps directly onto the mastery grid: a narrow
common build may clear one boss category at a higher tier than any generalist can.

### The Genshin pattern nobody names

The 4-stars that stayed relevant for six years — Bennett, Xingqiu, Fischl, Sucrose, Xiangling — are
**all off-field contributors. Not one is primarily an on-field carry.**

Structural reason: off-turn contribution doesn't compete with the carry, it *serves* whichever carry
you have, so it survives every future release. A 4-star carry is replaced the moment a better carry
ships.

Combined with "supports outlive DPS" from §8: **low-rarity units should skew toward off-turn
contribution.** That is why Genshin's cheap tier stayed healthy and others' did not.

### The Wuthering Waves failure mode

When low-rarity units cannot hold a team slot, the effective roster collapses to the paid tier. Three
things break at once: new players have nothing, build diversity narrows to whatever is currently
sold, and the low tier becomes filler art.

The distinction that matters: **narrow-and-excellent survives; broad-and-weak does not.**

### What rarity means without gacha

Premium, no monetised pulls — so rarity becomes **shop frequency and cost**. Rare units appear less
often and cost more gold. Keeps the exciting-find feeling, removes the pay-to-win coupling. And since
rare means broader, seeing one is "now I have options" rather than "I got lucky and won."

**Honest counterpoint:** Slay the Spire's rares genuinely are more powerful, and that is fine because
runs are short and losing is cheap. Rarity-as-power is only toxic when monetised and permanent,
neither of which applies to us. Breadth is a preference — it produces more distinct builds and makes
the common tier a real design space — but it is not a constraint. Worth testing both.

---

## 13. Monetisation — the gacha question, settled

### The practical fact that decides it

From **June 2026**, PEGI assigns a **minimum PEGI 16 rating to any game containing paid random items**
— loot boxes, card packs, gacha, prize wheels — regardless of content rating. Applies to all newly
submitted titles. Affects storefront placement, parental control defaults and retailer decisions.

Tightening elsewhere: **Brazil** banned loot box sales to under-18s from March 2026. The **EU Digital
Fairness Act** could ban loot boxes in games accessible to minors across member states. *(Check
current status before any decision — this is moving.)*

For a solo dev shipping an iPad game, a PEGI 16 floor plus per-jurisdiction age verification is a bad
trade for a monetisation model.

### The structural fact — the design already ruled it out

Gacha requires new characters to be desirable enough to pay for, which in practice means stronger or
meta-defining. We committed to **options-not-numbers** and **permanent relevance for every
character**. Both cannot be true: if nothing is ever more powerful, there is no purchase pressure.

**The choice was made several rounds ago without noticing.**

Operationally it is also out of reach: a character every six weeks, live ops, accounts, servers,
payments, support, and compliance across a dozen regimes. That is a studio.

### What delivers the same want

The want is *art people are happy to pay for, game stays fair*.

| Model | Note |
|---|---|
| Direct cosmetic sale | pick it, buy it, no randomness — sidesteps loot box regulation entirely |
| Character packs, fixed price | since rarity = breadth, packs add options without power creep |
| Free base, paid expansions | new elements, biomes, boss categories |

All three preserve the thing gacha destroys: **the player sees exactly what they are buying before
buying it.**

### Has gacha run its course?

Commercially, no — Genshin crossed **$10B lifetime spend** by end of 2025, fastest ever.

But the ground shifted. The single-studio monopoly era is over; the market has fragmented into a
competitive ecosystem where **niche appeal and player-friendly monetisation drive success**, and
players reject stamina-gated grinds. **Monetisation fatigue affects roughly a third of active
players**, driving uninstalls and negative reviews.

The economics, plainly: **top 1% of mobile spenders generate ~29% of revenue, top 10% about
two-thirds, and 60–70% of F2P players never pay.** The model is engineered so a small group of heavy
spenders funds everyone else — precisely the overspending problem worth avoiding.

**Read:** gacha is not dead, it is professionalised beyond solo-dev reach, and the competitive
differentiator has shifted toward exactly the fairness we would want anyway. Premium roguelites are a
proven and growing market one person can ship.
