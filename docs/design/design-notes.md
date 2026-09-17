# Untitled tactics game — design notes

Working doc. Nothing here is final. Verdicts are a current read, not a decision.

**Reference points:** Honkai Star Rail's Currency Wars (draft-and-watch, Bonds, PvE curve), Magic
the Gathering (tokens, board state), Clair Obscur: Expedition 33 (telegraphing).
**Explicitly not:** Backpack Battles (spatial packing), TFT (PvP ladder), AFK Journey (real-time).

---

## 1. What the game is trying to feel like

Pulled from what actually lands, in the player's own words:

- Building a team that overcomes a challenge, and finding a combo that pays off enormously
- Squeaking a win by a narrow margin
- Big numbers and heavy effects over graphical fidelity
- Wanting the game to point out synergies without solving the build for you
- Complex kits are fine; complex *explanations* are not
- Played before bed, so no reflex demands and no FOMO

**Diagnosis of why Currency Wars lands and its neighbours don't**

| Comparison | The difference |
|---|---|
| vs Backpack Battles | Systems reasoning, not spatial packing. Different cognitive pleasure entirely |
| vs Backpack Battles | Turn-based combat is readable — you can point at *why* you won |
| vs TFT | PvE curve can be tuned to allow a narrow win; a PvP opponent never will |
| vs AFK Journey | Dread needs arithmetic. "Three turns until break" is tension; a real-time blur isn't |
| vs all | Ultimate animations give the payoff its own frame. Ceremony, not fidelity |
| (uncopyable) | Attachment to characters you already know from the parent game |

---

## 2. Load-bearing decisions

Reversing any of these invalidates a lot of what follows.

**Combat is *mostly* deterministic.** *Revised — see §3c.* The original rule (no variance at all) was
stronger than the problem required. The real constraint is that **randomness must resolve before your
next opportunity to respond**, not before your last decision — and Calls plus chain-attack moments
mean responses now exist throughout a fight. Variance is a per-source property (Fixed / Tight / Wide /
Wild), telegraphed enemy intent is allowed, and hidden rolls that decide outcomes with no warning are
not. Seeded replays and offline balance simulation both survive; the forecast gets *more* honest.

**Crit is a gauge, not a roll.** "Focus" fills per action and spends at 100. Crit rate becomes
Focus-per-action — 25/action is the old 25%. Keeps the build-toward-a-ceiling feeling, adds timing
as a design surface, telegraphs the big hit. *Designed, not yet built into the bench.*

**Tags are machine-readable data, not prose.** Every ability declares what it applies, consumes,
and amplifies. Synergy highlighting, auto-generated kit summaries, Bond bonuses and shop hints all
fall out of one table.

**Three levels of tag.** Archetype (which resource) · Function (Enabler / Amplifier / Payoff) ·
Requirement (what it needs from the team). A unit reads as `Burn · Payoff · needs 2 appliers`.

**Function tags are advice, not law.** *Revised.* The original rule — every archetype must fill
Enabler / Amplifier / Payoff — was too restrictive. Three mandatory slots per archetype means a
six-slot team can only run one or two archetypes, so the comp is decided before you start. It was a
gate, not a choice.

Now every gate is a slope. Every ally action chips guard and applies a trickle of stacks, and a
break with no Payoff unit still burns stacks off at a baseline rate. A missing role slows you down
instead of switching you off. The tags still tell you what a unit does; the game no longer requires
the set.

**Every archetype needs a shared resource** that its Enabler writes to and its Payoff reads from.
Burn has the stack counter, Reflect has the charge pool, Shatter has the Guard bar. A chain without
one produces units that never touch each other. *Found the hard way — see §8.*

**Action-value turn order.** Speed is a mechanic, not a damage stat. Advancing allies, delaying
enemies, and cramming actions into a break window only exist because turns are discrete objects.

**Counters scale your rate, never zero it.** Halved output is a puzzle; zeroed output is a loading
screen. No enemy is ever immune to an archetype.

**Build direction comes from counts, not requirements.** Two axes, both permissive. Each unit has
an Archetype (which resource) and a Faction (which cross-cutting bonus), and thresholds trigger on
how many you have. Counts reward commitment without mandating a shape — going 4-deep on one axis or
2/2/2 across three are both real builds.

**Behavioural enemy categories, not elements.** "It attacks constantly" obviously pairs with "I
profit from being attacked." No lookup table to memorise.

**Progression unlocks options, never numbers.** No permanent stat upgrades, ever. Makes power creep
structurally impossible rather than something to keep re-balancing.

---

## 3. Combat loop

One loop, three dials:

```
Apply  →  Pressure  →  Break  →  Payout  →  (guard regenerates)
stacks    guard drains  enemy      stacks
build                   delayed    detonate
```

- **Stacks** control how big the payout is
- **Guard** controls when you're allowed to cash out
- **Speed** controls how many actions fit inside a cycle

Draft tension: pure appliers build stacks they can't spend; pure breakers detonate nothing; speed
multiplies whichever you're short of.

---

## 3b. Ability framework and the element system

### Kits are trigger → effect

The archetype label was doing too much work as a *category*. The atom of design is the pair:

```
WHEN <trigger>  →  DO <effect>
```

Triggers: on action · on break · on kill · on being hit · when an ally detonates · while a target is
marked · at an HP threshold · when an element reacts.
Effects: apply element · damage · strip guard · heal · shield · advance · delay · grant energy ·
amplify · summon.

Every ability is one or two pairs with a number attached. Complex kits stay explainable because the
one-line summary *is* the trigger and the effect.

**Archetype becomes a readout, computed from what a kit touches, not a slot you're assigned to.** A
unit with `on break → apply Chaos` counts toward both without being locked to either. This is the
answer to "the function tags feel too restrictive."

### Basic / Skill / Ultimate

Every character has the same three slots and differentiates by how it fills them.

- **Basic** — free, always available. This is the baseline trickle from §2, given a name and made
  into something characters can differ on.
- **Skill** — costs one skill point from a **team-wide pool** (cap ~5). Basics generate a point.
- **Ultimate** — personal energy, fills from acting and from taking hits, spends at 100.

The team-wide skill pool is the important part. A team of six skill-hungry units starves itself, so
you need basic-attackers to feed them. That's a composition constraint you feel rather than one the
game enforces — an economy replacing the old Enabler/Amplifier/Payoff gate.

Unexploited character axes this opens: units that generate two points on a basic, units whose skill
costs two, units that let an ally skill for free.

Ultimates carry the effects too strong to happen often, and they telegraph, which is where the
ceremony and the Expedition 33 lesson both land.

### Primordial elements

Six primitives, drawn as polygons with increasing side counts (Order 3 → Energy 8). A combination is
the two shapes overlaid, so **an enemy's status can be rendered as overlapping outlines and read
without a legend.** That's the UI answer and the visual identity in one move.

Ten derived elements from fifteen pairs, five pairs producing nothing.

| Family | Order-side | Chaos-side |
|---|---|---|
| Tempo | **Gravity** (Order+Void) — pushes target down the track | **Wind** (Void+Growth) — advances an ally |
| Sustain | **Wood** (Order+Growth) — binds, grants block | **Life** (Growth+Energy) — heals, restores tokens |
| Spread | **Water** (Order+Chaos) — spreads elements to other enemies | **Shock** (Decay+Energy) — chains damage, strips guard |
| Over time | **Poison** (Decay+Chaos) — ticks, pierces shields | **Plague** (Growth+Chaos) — ticks and spreads itself |
| Burst | **Light** (Order+Energy) — clean burst, cleanses | **Fire** (Chaos+Energy) — the big detonation |

Ten names, five jobs. Nobody memorises a chart; you learn them by seeing one resolve.

**Asymmetry worth keeping.** Order, Growth, Chaos and Energy each react with four others. Void and
Decay react with only two. Void's pair is both tempo; Decay's pair is both over-time. Four
generalists and two focused specialists, which is better texture than a smooth table. Decide whether
this was deliberate before smoothing it.

**Null pairs stockpile rather than cancel.** Non-reacting elements accumulate. A Void/Decay board
builds an enormous reserve doing nothing until a third element arrives and cashes it all at once.
That converts five dead cells into a patient, high-variance archetype and fixes the specialist
penalty without removing the asymmetry.

**Elements replace archetypes; factions are untouched.** A unit's identity is which element it
applies and when. Burn, Shatter, Reflect and Legion become descriptions of element behaviour rather
than categories. The two-axis count structure survives intact: Element × Faction.

**Deferred:** reaction chaining (will loop, miserable to debug — one reaction per application);
applying elements to allies (Order-as-shield doubles expressiveness and complexity together).

**Staged rollout option:** ship Order, Chaos, Growth and Energy first — four generalists, six
reactions, four of five families, and zero null cells. Void and Decay arrive later as an expansion
that introduces the stockpile mechanic.

**Fiction:** the constructed script and sigil wheel are worth keeping. Fiction is the only substitute
for the borrowed character attachment Currency Wars gets for free, and this is more distinctive than
anything on the §6 fiction list.

### Element roster discipline

**Elements are verbs, not nouns.** Water is *spread*. Fire is *big burst*. Naming the job instead of
the substance answers most "should we add X" questions on its own.

Claimed verbs: Gravity delay · Wind advance · Wood bind/block · Life heal · Water spread elements ·
Shock chain and strip guard · Poison tick and pierce · Plague tick and self-spread · Light clean
burst and cleanse · Fire big burst.

**Rejected additions and why**

- *Ice* — freeze is either skip-a-turn or slow, and Gravity owns both. If a real lock effect is
  wanted, make it a character ability.
- *Stone* — armour and block; Wood has it.
- *Metal* — pierce; Poison has it.

**Cost argument:** each new primitive adds one pair per existing primitive. Six→seven adds six
cells, seven→eight adds seven. The table grows quadratically while tuning capacity does not. Fifteen
pairs is already at the edge for one person.

Stone could go in the empty Order+Decay cell (petrification is evocative) but filling nulls costs
the stockpile mechanic. Worse trade.

**Rule for future elements:** name the verb in three words. If something has it, skip. If it's new,
try it as a character ability first — a character costs one data row, an element costs a row *and* a
column. Currently unclaimed verbs worth considering: **lock**, **drain**, **copy**.

### Purity / overflow

Same-plus-same should produce a real outcome, not just a bigger number. Mono-element is otherwise
strictly worse than mixed, since reactions need two elements.

When one element reaches a high threshold **with no other element present on the target**, it
overflows:

| Pure | Effect |
|---|---|
| Order | target is locked, loses its next action |
| Chaos | Guard shatters permanently instead of regenerating |
| Void | target removed from the turn track for several ticks |
| Decay | maximum health reduced, not just current |
| Growth | the target's own regeneration inverts against it |
| Energy | enormous raw damage |

The constraint is the point: purity means refusing elements that would otherwise help. First
mechanic in the design where **restraint is the skill**.

It also rescues Void and Decay — reacting with only two others each is a liability in a
reaction-based system, but it makes them the natural purity elements. Weakness becomes speciality.

**Unifies with the stockpile idea.** One element alone, or two elements that refuse each other, both
build toward a threshold and pay out. One rule, two cases: *accumulation without reaction overflows.*

**Co-op stake:** a partner's element contaminates your purity, so "going pure Void, don't touch it"
becomes something to negotiate at the pledge step.


### Verb classes and status ladders

Two classes of verb:

- **Payload verbs** act on a target (freeze, poison, restrain)
- **Modifier verbs** act on the system (conduct, insulate, seal, catalyze)

Modifier verbs are worth more per unit of complexity — each multiplies the interest of everything
else rather than adding to the pile. Metal-as-conduct beats Metal-as-armour for this reason.

**Ladders.** Restrain and freeze aren't different verbs, they're one verb at two intensities.
Formalising that turns a list of statuses into five learnable axes.

| Ladder | rung 1 | rung 2 | rung 3 | rung 4 |
|---|---|---|---|---|
| Suppression | Slow | Restrain | Disarm | Freeze |
| Exposure | Mark | Fragile | Sunder | Doom |
| Attrition | Bleed | Poison | Plague | Wither |
| Conduction | Trickle | Spread | Conduct | Cascade |
| Vigor (ally) | Regen | Empower | Haste | Surge |

Twenty statuses, five things to learn. UI reuses one icon per ladder with a level indicator rather
than twenty symbols.

**The element pair picks the ladder; the reaction size picks the rung.** A small Wood reaction is
Slow, a large one is Freeze. *This is the answer to "is Ice different from Water"* — Ice is Wood that
landed hard. Keeps the distinction, costs no new row or column. Also gives every element free
scaling: it gets more interesting as the build gets stronger, rather than doing the same thing
bigger.

### Modifier verb shortlist

| Verb | Effect |
|---|---|
| Conduct | reactions reach further |
| Insulate | blocks spread — the counter to conduct |
| Seal | target can't gain new elements (protects or ruins a purity build) |
| Catalyze | reactions fire at a lower threshold |
| Anchor | elements stop decaying |
| Volatile | elements decay fast but react much harder |
| Transmute | convert one element on a target into another |
| Purge | strip elements from a target |

**Anchor / Volatile are the sleeper pair** — opposites on one axis producing two archetypes. Anchor
makes stockpiling and purity work; Volatile makes fast spend-it-now aggression work.

**Hold Transmute back.** Forcing any reaction on demand flattens the coverage puzzle. Fine as a rare
ultimate, dangerous as a common effect.

### Unclaimed payload verbs

**Drain** — steal skill points or energy (nothing else attacks the resource economy) ·
**Link** — damage to one enemy is shared with another · **Banish** — temporary removal, tempo not
deletion · **Veil** — an ally can't be targeted · **Overflow** — immediate extra action, the most
expensive effect in the game.

### Discipline

A new status must sit on a ladder or be a modifier. If it is neither, it is a character ability.
**Cap the ladders at five** — six is where the player stops holding the vocabulary in their head and
every status becomes a tooltip.


### Ally buffs

**Buffs are not symmetric with debuffs.** Debuffs spread naturally with the number of enemies; buffs
concentrate, because a buff on a weak unit is wasted. Left alone, the optimal play is always to stack
everything on one carry and the game becomes "identify the carry" — which is in direct tension with
wanting to build a *team*.

Fixes, worst to best:

1. Diminishing returns per unit — works, feels like a tax
2. Inverse targeting (buff whoever contributed least) — fine as one character, weird as a rule
3. **Make distribution the optimisation.** Some payoffs scale with how many allies are *currently
   buffed*, not how large any one buff is. Funnelling becomes mathematically wrong rather than
   discouraged, and spreading becomes a skill.

**Buff shapes** (matters more than the numbers)

| Shape | Fit |
|---|---|
| Instant (advance, grant energy) | excellent — resolves now, can't be misplayed |
| **Charge** ("next attack empowered", consumed on use) | **excellent — lands on whoever acts next, so it spreads on its own** |
| Conditional ("+40% while broken") | excellent — free to balance, teaches the system |
| Timed | good — creates a window to build toward |
| Stacking | good in long fights only |
| Aura | weak — a stat in a costume |

**Targeting policy is the character.** Since the AI picks, the picking rule *is* the kit. Print it on
the card. Five distinct units from one effect: buffs whoever acts next / the highest-damage ally /
whoever isn't buffed yet / the ally whose element is missing / the slowest ally.

**Vocabulary**

| Axis | Buffs |
|---|---|
| Turn order | Advance · Haste · Surge (extra action) |
| Damage | Empower · Sharpen (next attack only) · Resonance (scales with element types on board) |
| Focus | Kindle (+Focus now) · Attune (gain rate up) · Overcharge (banks past 100) |
| Defense | Shield · Ward · Veil (untargetable) |
| Resource | Feed (energy) · Tithe (free skill point) · Relay (ally skills without spending) |
| Elements | Amplify (+1 application) · Widen (second type) · **Escalate (reaction rung +1)** |

*Escalate* is enormous given that reaction size picks the ladder rung — it turns a Slow into a Freeze
with no damage increase. Changes the *kind* of outcome, not the amount. There should be very few.

*Resonance* is the distribution mechanic in disguise: rewards breadth over stacking.

**Focus finally has a home.** The gauge designed in §2 and never built belongs here. "+30 Focus" is
instant, visible, and creates a timing puzzle — a support dumping Focus into an ally right before
the break window does something no percentage crit buff can.

**The inversion worth stealing:** delaying your *own* unit on purpose. "Delay this ally 40, they act
with +100% damage" pushes a detonator behind the appliers. Makes the turn track a two-way tool
instead of a one-way race, and it's the kind of effect that feels clever the first time it clicks.


### The full element grid — working version

Arrange the six primitives on a hexagon so true opposites sit across from each other:
**Order · Growth · Energy · Chaos · Decay · Void**, returning to Order. Oppositions are
Order/Chaos (structure vs instability), Growth/Decay (accumulation vs erosion), Energy/Void
(force vs absence).

Three behaviours, all readable from position. **Neighbours fuse · opposites annihilate · distant
pairs resonate.**

|  | Order | Growth | Energy | Chaos | Decay | Void |
|---|---|---|---|---|---|---|
| **Order** | — | Crystal | Light | *Collapse* | Stone | Gravity |
| **Growth** | Crystal | — | Life | Plague | *Cycle* | Wind |
| **Energy** | Light | Life | — | Fire | Shock | *Null* |
| **Chaos** | *Collapse* | Plague | Fire | — | Poison | Rift |
| **Decay** | Stone | *Cycle* | Shock | Poison | — | Rust |
| **Void** | Gravity | Wind | *Null* | Rift | Rust | — |

**Neighbours fuse readily** — low threshold, fire often.

| Pair | Element | Job |
|---|---|---|
| Order + Growth | Crystal | elements propagate along a lattice to nearby enemies |
| Growth + Energy | Life | damage dealt returns to the team as healing |
| Energy + Chaos | Fire | the big detonation |
| Chaos + Decay | Poison | ticks, pierces shields |
| Decay + Void | Rust | permanently reduces max health and guard |
| Void + Order | Gravity | delays the target on the turn track |

**Distant pairs resonate reluctantly** — high threshold, build slowly, hit harder.

| Pair | Element | Job |
|---|---|---|
| Order + Energy | Light | damage that ignores guard and shields |
| Growth + Chaos | Plague | a tick that spreads itself to new targets |
| Energy + Decay | Shock | chains between enemies, drains skill points |
| Chaos + Void | Rift | banishes the target temporarily |
| Decay + Order | Stone | frozen, but takes reduced damage while stoned |
| Void + Growth | Wind | displaces enemies between rows, advances allies |

**Opposites annihilate on contact** — both consumed, sum dealt as damage, plus a signature.

| Pair | Effect |
|---|---|
| Order ↔ Chaos — *Collapse* | strips every status, shatters guard |
| Growth ↔ Decay — *Cycle* | the consumed amount converts to team healing |
| Energy ↔ Void — *Null* | target drops off the turn track for a beat |

**Emergent property, not designed:** every ladder ends up with one easy member and one hard one —
Gravity/Stone, Rust/Light, Poison/Plague, Crystal/Shock, Life/Wind, Fire/Rift. Two build tempos per
ladder for free.

Annihilation *wastes* accumulated elements, so coverage is now about avoiding wrong reactions as
well as enabling right ones. This is what gives the co-op pledge real stakes.

**Costs:** fifteen behaviours instead of nine. Six ladders, breaking the earlier five-ladder cap.
Pure stockpiling is gone (distant pairs now pay out eventually). Large tuning surface for one person.

**Gains:** no dead cells, so no draft is silently wrong. Two thresholds create fast/slow archetypes
per ladder. Purity untouched — a lone element still never reacts. Still one sentence, not a chart.

**Reduced variant, kept for comparison:** neighbours fuse (6), opposites annihilate (3), distant
pairs never react and stockpile (6). Nine behaviours. Simpler, preserves pure stockpiling, loses
Light/Plague/Shock/Rift/Stone/Wind as elements — though those verbs survive as buffs and higher
ladder rungs.

**Shipping plan:** build all fifteen in the sim, ship neighbours and opposites first (nine
behaviours, every element still reacts with three others, game is complete), add resonances as a
second layer once players know the wheel. Decide with data, not in advance.

### Characters as points in a tag space

Depth is many outcomes from few rules; memorisation is many arbitrary facts. The grid is derived
from a hexagon, so it is depth — hints teach it. *Bedtime play means low-stakes and no reflex
demands. It does not mean shallow.*

A character is **Element × Role × Trigger × Faction**, plus the verbs its abilities use.

**Each primitive is an adverb.** Order is fixed and predictable. Growth escalates. Energy is
immediate and converts to tempo. Chaos is all-or-nothing. Decay is front-loaded and permanent. Void
negates rather than reduces. Apply those to any verb and one verb becomes six characters:

| Element | Shield | Heal | Advance |
|---|---|---|---|
| Order | fixed absorb, persists until spent | fixed amount each turn | permanent speed increase |
| Growth | starts small, grows while unbroken | heals more the longer the fight runs | gets faster every turn |
| Energy | absorbs, converts absorbed into speed | instant burst, nothing over time | large immediate jump |
| Chaos | holds fully then shatters for damage | nothing until an ally is low, then enormous | acts twice, then loses a turn |
| Decay | starts enormous, shrinks each turn | heals now, reduces max health | fast now, slower later |
| Void | deletes one hit entirely, any size | undoes damage already dealt | skips the enemy's turn instead |

**Trigger** is the axis HSR proves matters and we had missed:

| Trigger | Fires |
|---|---|
| Cadence | on its own turn only — the default |
| Follow-up | additionally, when a condition occurs elsewhere |
| Reactive | when hit, or when an ally is hit |
| Interrupt | immediately before a telegraphed enemy action |
| Standing | never acts; permanent effect |

Follow-up matters more here than in HSR because action value is the spine — a follow-up unit inserts
extra actions into the track, the most valuable thing anyone can do. Cost: weak turns of its own.
Interrupt is new, and it exists because we built telegraphed boss charges.

**Rarity = breadth, not height.** Commons are narrow-and-excellent; rares fire under more
conditions, fit more teams, and may be dual-element or policy-selectable. A common team peaks higher
in its specialty; a rare team is more consistent. Low-rarity units should skew toward *off-turn*
contribution — that is the property that kept Genshin's 4-stars alive for six years. Without gacha,
rarity is expressed as shop frequency and cost. (Full reasoning: explorations §12.)

**One element per character** is a hard rule: a single-element unit cannot react alone, so
composition is structural rather than encouraged. **Dual-element characters are the chase** — a
Chaos/Decay unit self-reacts into Poison unaided. Large capability jump, zero stat increase, so the
no-power-creep rule holds.

### Starting roster

Eight characters, all six elements, every trigger class introduced once.

| Name | Element | Role | Trigger | Kit |
|---|---|---|---|---|
| Lattice | Order | Guard | Cadence | Basic damages, 1 Order. Skill shields the most exposed ally. Ultimate shields all, Order to every enemy |
| Ricochet | Chaos | Damage | Follow-up | On any enemy break, attacks immediately for 2 Chaos. Skill applies 3 Chaos to one target |
| Piledriver | Energy | Break | Cadence | Basic chips guard. Skill heavy guard damage + 2 Energy. Ultimate breaks instantly |
| Salve | Decay | Sustain | Cadence | Basic damages, 1 Decay. Skill heals the weakest ally all at once. Ultimate turns field Decay into healing |
| Trellis | Growth | Support | Standing | Ally buffs grow 10% per turn survived. Basic applies 1 Growth. Ultimate applies Growth to all |
| Hush | Void | Control | Interrupt | When an enemy starts charging, acts immediately: 2 Void and a delay. Skill delays and applies Void |
| Backlash | Chaos | Support | Reactive | When any ally is hit, 1 Chaos to the attacker. Skill draws attacks onto itself |
| Plumb | Order | Damage | Cadence | Basic damages, 1 Order. Skill deals fixed damage no buff or debuff can alter. Ultimate scales with field Order |

**Gap flagged from the HSR roster survey:** the starter eight are almost entirely *amplifiers*
(they make existing things bigger). Almost none are *enablers* (they make an archetype possible at
all). Enablers are what people actually value. Rebalance the eight.

**Also missing:** a configurable character — the Trailblazer pattern. One unit whose element, role
and trigger the player chooses. Teaches the axes by use, always fills a team hole, one character's
art for five characters' function. Add as a ninth starter slot.

**Everyone damages on their basic.** Role describes the skill and ultimate, not a limitation — the
March 7th principle. No draft is ever a pure liability.

**All fifteen grid cells are reachable from the starter roster.** The whole wheel is discoverable on
day one with free characters.

**So unlocks add combinations, never elements.** A second Void unit with a different role and trigger
is a genuine new toy that expands nothing you must learn. Content scales without complexity scaling,
and a year-two character never invalidates a starter. Roster ceiling: 6 elements × 4 roles ×
5 triggers = 120 slots, filled at whatever rate they can be authored.

**Hints should be predictive, not definitional.** Not "Poison ticks damage" but:
`Adds Chaos. Your board carries Decay → Poison.` and critically
`Adds Order. Two enemies carry Chaos → will annihilate, clearing your stacks.`
The grid can now make things worse, so warning players before they undo their own work matters more
than teaching vocabulary.

**Legibility, not comprehension, is the real constraint.** Twelve derived elements across six enemies
holding up to three each is a lot of state to parse while watching. This is why the polygon notation
matters — overlaid shapes read as their combination without a lookup. Not decoration; the thing that
makes the depth affordable.


### Ability slots — what each is for

| Slot | Gated by | Purpose |
|---|---|---|
| Basic | nothing | keeps the economy running, baseline element flow |
| Skill | a shared resource | the thing you can't always do; scarcity is competitive |
| Ultimate | personal accumulation | the event — changes the fight's shape, gets the ceremony |
| Trait | a condition, not a resource | who the character is when not acting |

Making **Trait a real slot absorbs the entire Trigger axis** — follow-up, reactive, interrupt and
standing all just describe what kind of trait a character has. One fewer concept, same expressiveness.

Design rules:

- ~~A basic should never be a build's main damage source.~~ **Wrong — rule stated at the wrong
  level.** The concern (nobody spends points, economy dies) is a property of a *roster*, not of a
  character. Correct version: every character is net-positive, net-neutral or net-negative on skill
  points, and a viable team needs the sum to work. An economy, not a gate.
  **Basic-scaling characters are the supply side of the skill economy** — they generate points and
  rarely spend them, which is what makes a skill-hungry carry possible. Structurally necessary.
  Tension this creates: all basic-scalers floods with unused points, all skill-users starves, and the
  ratio is a real draft decision.
- A skill should be roughly 3× a basic — worth the point, without making basics feel like waiting.
- **An ultimate must do something a skill category cannot.** Not more damage — a different *kind* of
  effect: field-wide, rule-changing, converting, granting an action. A big skill is not an ultimate.
- The trait should be the reason you draft them. If the character is describable without it, it's wrong.

**No fifth slot.** Four slots across ~120 characters is already ~480 authored abilities, and every
extra slot makes the AI's choice less predictable, which costs the legibility everything depends on.
Depth comes from **varying the gate**, not adding slots.

| Slot | Gate variations |
|---|---|
| Basic | generates 1 or 2 skill points · hits one or all · applies 1 or 2 elements · self-buff riders |
| Skill | costs 0/1/2 points · **costs elements instead** · costs health · *generates* points · free while a condition holds |
| Ultimate | costs 60/100/180 · different fill source · banks past full and spends double |
| Trait | which condition fires it, and how often it may |

**Skills that pay with elements** — spending three Chaos off the board rather than a skill point
creates a real tension between spending now and building toward a reaction. Wires the skill economy
into the element system instead of running it alongside.

**Ultimate fill sources as a character axis** — same ultimate, different unit:

| Fills from | Comes online in |
|---|---|
| Own actions and hits taken | any team (default) |
| Element applications anywhere | element-heavy teams, early |
| Reactions occurring anywhere | teams that actually fuse, mid-fight |
| Damage taken by allies | defensive and reflect teams |
| Allies spending skill points | skill-hungry teams |
| Enemy breaks | shatter teams |

Makes the Feed buff situationally valuable rather than universally good. Show ultimate charge as a
second bar on the turn track.

**Worked example — every slot keyed to one idea:**

`Ricochet — Chaos · Damage · Follow-up · Foundry`
- **Trait**: on any enemy break, attacks immediately for 2 Chaos, without using her turn
- **Basic**: one hit, 1 Chaos, +1 skill point
- **Skill** (1 pt): three hits on the lowest-guard enemy, 1 Chaos each
- **Ultimate** (100, *fills from breaks anywhere*): 4 Chaos to all, then every Chaos on the field
  attempts a reaction

Weak where nothing breaks, absurd where things break constantly. Change one slot and she's a
different character: own-action ultimate fill → reliable generalist; skill costing 3 Chaos → a Chaos
*consumer* competing with her own team; trait moved to Interrupt → boss specialist.

**Authoring format** — fully data-driven, no per-character code:

```
Ricochet
  trait: { on: enemyBreak, act: [hit 1, applyChaos 2], costsTurn: false }
  basic: { cost: none,         act: [hit 1, applyChaos 1, gainSP 1] }
  skill: { cost: {sp: 1},      act: [hit 3, applyChaos 1, target: lowestGuard] }
  ult:   { cost: {energy:100}, fills: enemyBreak, act: [applyChaos 4, all], then: forceReaction }
```

Everything discussed — grid, ladders, buffs, triggers — is reachable from this structure without
adding fields.


### Four engines, four support economies

A character's damage can come from any slot. Each engine wants a different kind of support — this is
what a support character actually *is*.

| Engine | Wants | Fed by |
|---|---|---|
| Basic | more turns | speed, advance, extra actions |
| Skill | more points | batteries, cost reduction, free-skill effects |
| Ultimate | more energy | energy grants, charge rate, matched fill sources |
| Trait | more triggers | whatever fires it — breaks, hits taken, ally ultimates |

"Increase their speed" is therefore not a generic buff. It is the specific support a basic-engine
carry needs and nearly worthless to an ultimate-engine carry.

**Replaces the old team check.** Not "do you have enabler, amplifier and payoff" but:
**does your carry's engine have a feeder?** One question, informative rather than restrictive,
dictates no shape.

**Worked example — a basic engine**

`Piston — Energy · Damage · Cadence · Foundry`
- **Trait**: Momentum on each consecutive basic, max 6. Each stack is +18% damage and +8 speed. Does
  not decay.
- **Basic**: one hit, 1 Energy, +1 skill point
- **Skill** (1 pt): spends all Momentum for one heavy strike
- **Ultimate** (100, fills from her own basics only): six hits at current Momentum

She accelerates as she chains, so speed buffs compound with a growing multiplier — Haste on Piston is
worth several times what it is on anyone else. Her skill is a real dilemma (big hit, resets the
engine), so the AI's spend policy is itself a character trait, and one an item should be able to
change. Net point generator, so she funds someone else's expensive skill.

### Methodological note

Twice a proposed constraint felt principled but was merely restrictive, and both times the fix was
moving the rule **up a level** — character → team, team → roster. (Enabler/Amplifier/Payoff, and the
basic-attack rule.) Apply that test to anything else asserted here. **The five-ladder readability cap
is the next most suspicious.**


### Implementation cost

This is a rewrite of the sim's action system, not a patch. Actions become data — trigger, effect,
magnitude, cost — rather than hardcoded `if (u.act === 'apply')` branches. Roughly a day. Worth it:
every character afterwards is a data row instead of a code branch, which is also the precondition
for shop hints and auto-generated kit summaries.


---

## 3c. Semi-automatic control, AI behaviour, and variance

### The framing that clarifies everything

**"A roguelike sports game."** You recruit, set tactics, watch, and get a small number of in-match
interventions. Football Manager, not an RTS. The tension is whether the setup was right, plus the two
moments you can still do something about it.

### Three layers of control

**Layer 1 — the tactics board (set before the match, no in-fight input)**

- *Targeting*: finish the weakest · pressure the strongest · hit the most elementally loaded · focus
  the unbroken · focus my mark
- *Stance*: aggressive (skills whenever points allow, ultimates immediately) · conservative (mostly
  basics, banks points and energy) · balanced (skills when efficient, holds ultimates for breaks)
- *Ultimate policy*: fire at 100 · hold for next Break · hold for Convergence · hold until an ally is low

**Stance is an economy dial wearing a personality costume.** Skill points are a shared pool, so an
aggressive team drains it and a conservative one banks it. Six aggressive units starve themselves.

**Layer 2 — Calls. Two per fight, usable any time. The substitution budget.**

| Call | Effect |
|---|---|
| Focus | redirect a unit's targeting for its next few actions |
| Hold | a unit skips its next turn — banks Weight, waits for a window |
| Fire | force an ultimate immediately, below cost, at reduced effect |
| Shift | swap two units' positions |
| Stance | flip a unit or the team to a different stance |

Two is the number that makes them matter. Unlimited = playing manually.

**Calls should be buildable** — a relic granting a third, a character whose trait earns one on Break,
terrain refunding one. *Agency itself becomes a build axis*, which no auto-battler currently does.

**Layer 3 — moments the game gives you free.** On Break, the fight pauses and asks which unit
responds. Costs no Call. ZZZ's chain attack: *the game chooses when you get to choose*, so you are
never watching for an opportunity, only occasionally asked a question at the best instant. Same at
Convergence — you pick firing order.

### AI behaviour — priority lists (FF12 Gambits)

Ordered condition→action rules, top to bottom, first match wins. Beats bespoke per-character code
(doesn't scale to 120) and utility scoring (good behaviour, unexplainable).

```
Grist
1. Momentum < 5 and a mob is alive     → basic the weakest mob
2. Momentum >= 5 and an elite is alive → skill the largest enemy
3. Momentum >= 5, nothing big to hit   → hold
4. otherwise                           → basic the nearest
```

Adapts to encounters for free: against a solo Colossus rule 1 never fires and he falls through to 4.

*Conditions*: self state (Momentum, Weight, energy, health, element charge) · team state (skill
points, allies alive/health) · enemy state (broken, guard %, health, elements carried, tier, count) ·
fight state (turn number, boss charging, Convergence pending).
*Actions*: basic · skill · ultimate · hold, each with a target selector.

**Three to six rules per character.** Longer and nobody reads it. FF12 allowed twelve and lists became
spaghetti players feared to touch.

**Stance filters the list rather than replacing it** — aggressive drops conserve rules, conservative
inserts them. One authored list, three behaviours.

**The log must name the rule that fired**: `Grist basics the mob — Momentum 3/5`. This is what makes
the AI teachable instead of a black box, and it is the best character-debugging tool available.

**Compute the defaults, don't guess them.** Deterministic-enough combat plus a millisecond sim means
you can brute-force every plausible rule ordering against every encounter and ship the winner. FF12's
designers had to guess; we don't. Balance signal too: if one ordering wildly dominates, the character
has a solved line and isn't interesting yet.

**Directives** — rule cards found as loot, slottable into any character's list (`focus the marked
target`, `never skill below 2 points`, `hold while the boss charges`, `prioritise enemies carrying
Order`). Tuning behaviour becomes loot, not homework. Never gate baseline competence behind them —
FF12's mistake was selling basic gambits.

**The division:** *the AI handles tactics, the player handles strategy.* If you want to write a rule
that decides something strategic, that is a stance setting or a Call, not a priority line.

### Variance — revised from pure determinism

The old rule was too strong. The real constraint:

> **Randomness must resolve before your next opportunity to respond** — not before your last decision.

Calls and chain-attack moments mean you now have decisions throughout a fight, so far more variance is
admissible while every loss stays diagnosable.

**Three tiers**

- *Free* — no lead time; can't decide a fight alone. Damage swings, turn-order tiebreaks, which of two
  equally exposed units is hit
- *Telegraphed* — rolled hidden, revealed one action ahead. **The good tier.** Enemies have a *deck*:
  you know the pool, you see the next intent, not the one after. Slay the Spire's intent system
- *Pre-committed* — resolves before the fight. Field generation, shop, modifiers, composition
- **Never** — a hidden roll deciding an outcome with no warning and no response available

**Small variance is self-targeting.** ±8% is invisible in a fight won by 300% and decisive in one won
by 5%. Variance automatically concentrates its effect at the margin. No system needed.

**Nothing is lost.** Seeded replays still work. Balance simulation gets *better* — a thousand runs
gives a win *rate*, so a 94% team and a 51% team stop looking identical. **And the forecast becomes
honest**: under pure determinism "coin flip" was a lie, since the answer was exactly knowable.

### Variance as a per-source property

Four named profiles, tagged on the card:

| Profile | Range |
|---|---|
| Fixed | exact, no roll |
| Tight | ±10% (default) |
| Wide | ±40% |
| Wild | 0.3× to 3× |

**The decision rule:** high variance is correct **when you're behind** (you lose either way, so the
downside is free); low variance **when you're ahead** (variance can only take away a sure thing).

**This makes the forecast an instruction rather than information.** `Likely loss` → swap in the Wild
unit. `Likely win` → swap it out. A Wild character's value flips with run state instead of being
flatly good or bad. Best use we have found for the forecast.

**The counterintuitive part:** variance does not stack. Six Wild sources average out toward the mean;
one Wild source doing 70% of your damage stays swingy. **A gambling build must concentrate variance in
a single carry; a consistent build can spread freely.** A real difference in team shape falling out of
statistics rather than a rule.

**Variance meets the ladders.** Reaction size picks the rung, so a Wild source sometimes converts a
Slow into a Freeze. Qualitative swings, not just bigger numbers — a much better reason to gamble.

**Never roll zero.** Wild is 0.3× to 3×, not 0×. Same principle as counters scaling rate rather than
zeroing it.

**Manipulation effects** (unusually satisfying, and a design space of their own):

- *Settle* — take the average instead of rolling. Huge when ahead, worthless when behind
- *Insist* — reroll any below-average result once. Strong and feels great every time
- *Banked variance* — a low roll stores its shortfall and adds it to the next. Unpredictable per
  instance, fair over time. Possibly the most interesting
- *Amplify* — widen the range without changing the average. Pure gambling as an item

**Presentation:** show the range on the card (`40–320`), not the average. Animate the number through
the range before it lands — the half-second of not knowing is the entire appeal, and it is free
tension in a fight you are watching.

### PvP — still no, but two shapes survive

Facing another player's team means facing the same characters you already own, optimised. Facing a
designed encounter means facing something new. PvE has strictly more variety available.

- **Shared daily seed** — same field, shop and modifiers, one attempt, compare results. Competition
  without facing another roster. Free, given seeded runs
- **Player-designed encounters** — you build an *enemy* team with the enemy kit system; others fight
  it. Other players' creations as monsters rather than mirrors. Turns enemy-kit work into UGC. Needs a
  reference-team validity check so nothing unbeatable ships. **The only version of PvP that adds the
  crazy-enemy-appears feeling rather than removing it.**

### Sports framing — vocabulary and two missing features

- **Scouting report** before each match: opponent style, key threat, one recommended counter. The hint
  system, framed as something a coach receives. Natural home for the biome announcement
- **Match ratings** post-fight instead of damage percentages — `Ricochet 8.4, four break responses`
  reads better than `61%`, and it can rate a support who dealt no damage

Shop = transfer window · formation and policies = tactics board · turn ribbon = match clock · mastery
grid = trophy cabinet · modifiers = away conditions. A fiction option lurks here (factions as clubs,
runs as seasons) that clashes with the runic direction — hold as an alternative, not a plan.

---

## 3d. Defence layers — Ward, Resistance, Health

**Governing principle: imposed effects degrade, chosen effects disable.** Losing a turn because an
enemy decided so is miserable. Losing protection is tense but you keep playing. So being broken by an
enemy strips your elemental protection and nothing else; breaking *yourself* can cost a turn, because
you signed up for it.

### The three layers

| Layer | Behaviour | Source |
|---|---|---|
| **Ward** | flat absorb, any damage type, temporary | Shield payloads |
| **Resistance** | typed reduction, persistent, has its own pool | innate to every unit |
| **Health** | the real thing | — |

Damage resolves Ward → Resistance → Health. Ward absorbs before Resistance is touched, so a shielded
hit does not deplete the pool.

### Resistance derives from the wheel — no new data

A unit resists its own element and its two hexagon neighbours, and is **vulnerable** to its opposite.

| Relation | Damage taken |
|---|---|
| own element | **60%** |
| adjacent (2) | **80%** |
| distant (2) | 100% |
| **opposite** | **125%** |

Average across all six is ~91%, so it is mild in aggregate and sharp per matchup — which is the point.
It also means a mono-element team is uniformly exposed to one thing, a real cost balancing the
reaction benefits of committing.

**Prerequisite: enemies must carry an element.** Currently Husk = Chaos, Warden = Order,
Colossus = Energy. Without this, resistance never applies at all.

### Tuned values

```
RES_POOL = 0.85    // resistance pool as a fraction of max health
RES_DOWN = 2.0     // time units unprotected once depleted, then it refills in full
```

Chosen from a 3×3 sweep of pool size against recovery time. Measured on a five-unit team:

| Encounter | Breaks per fight | Damage cut | Broken uptime |
|---|---|---|---|
| Skirmish (single element) act 1 | 1 | 24% | low |
| Skirmish act 3 | 3 | 23% | low |
| Vanguard (mixed) act 1 | 2 | 12% | low |
| Vanguard act 3 | 8 | 10% | 14% worst case |

Breaks scale with difficulty, uptime stays under 15%, and the cut is meaningful without dominating.

### The finding that fell out: element-matched tanking

Taunting concentrates every hit on one unit, so **that unit's element decides whether taunting helps
or is catastrophic.** Measured against all-Chaos enemies:

| Tank | Relation | Raw damage taken | Cut |
|---|---|---|---|
| Backlash (Chaos) | own | **280** | 21% |
| Cairnstone (Order) | opposite | **406** | 2% |

Same fight, same role — 45% more damage taken for holding the line with the wrong element. Nobody
designed that; it falls out of the wheel. Taunting with the wrong element is now a trap worth
learning.

### Self-break — the Destruction archetype

Shatter your own Resistance for a spike, then lose your next action and stand unprotected.

```
skill: base × 2.2  +  3.0% of target max health   · skip 1 action · resistance down 2.0
ult:   base × 2.6  +  5.5% of target max health   · skip 1 action · resistance down 2.0
```

The percentage component is what gives it identity: negligible against a 145 hp mob, substantial
against an 1,850 hp boss. It is an anti-boss tool that is merely fine elsewhere.

Measured against an equivalent plain damage unit in the same slot:

| Encounter | Damage ratio |
|---|---|
| Skirmish act 1 | 1.17× |
| Skirmish act 3 | 1.57× |
| Vanguard act 3 | 1.20× |
| Colossus act 3 | **2.03×** |

Roughly even against mobs, decisively better against bosses, at the cost of four to ten lost turns
per fight. An earlier tuning at ×3.0 and 5% reached 2.3× on Skirmish too, which made it simply the
better unit everywhere — the percentage term had to come down to keep it specialised.

**Why the cost reads well:** the skipped turn is visible on the turn ribbon *before* it happens, so
you watch the consequence approach. And it needs a team — supports who restore Resistance or advance
it up the track are its natural partners, which makes it an archetype rather than a solo trick.

### Display

Do not draw a third bar; the crew cards are already tight at twelve berths. **Tint the card outline
with the unit's resistance element and desaturate it as the pool depletes** — a broken unit has a
grey border. Readable at any density, costs no vertical space.


---

## 4. Archetypes

| Archetype | Dial it plays | Wants | Status |
|---|---|---|---|
| Detonation | Stacks | Big guard windows to cash out in | built |
| Shatter | Guard | Frequent breaks, enemies knocked down the track | built |
| Reflect | Enemy actions | The enemy attacking constantly | built |
| Legion | Action count | More bodies on the track than the enemy has | built |
| Tempo | Speed | To act repeatedly and deny enemy turns | partial |
| Decay | Time | The fight to last as long as possible | named only |
| Burst | Setup turns | To end it before the enemy gets going | named only |
| Attrition | HP | To still be standing when the timer runs out | named only |

Reflect inverts the tempo dial: it *wants* the boss fast, so hasting an enemy becomes a real play.
Detonation and Decay look alike but pull opposite ways — one hoards to spend at a moment, the other
wants the clock to keep running.

### Faction axis

Factions cut across archetypes, so any archetype can belong to any faction. That's what makes
varied builds possible: three Foundry can be a Burn amplifier, a Shatter enabler and a flex unit.

| Faction | At 2 | At 4 |
|---|---|---|
| Foundry | guard damage +25% | breaks last 2s longer |
| Choir | all allies +8 speed | +20 speed, everyone starts part-charged |
| Thorn | pool gain +25% | pool gain +60%, cap +140 |
| Wake | ally health +15% | health +30%, allies self-heal each action |
| Cipher | stacks applied +20% | stacks +45%, detonations splash |

Archetype counts give resource-specific bonuses at 2 / 3 / 4 — Burn scales stacks then detonations,
Shatter scales guard damage then broken-target damage, Reflect scales the pool, Legion scales tokens.

**Finding:** mono-faction teams clear 1–2 of 6 encounters; teams where faction and archetype line up
clear 4–5. Faction alone doesn't carry you, which is the two-axis system doing its job.

**Universal units** (added because a good game needs glue). Archetype-agnostic, work in any team.
Design rule: **universals raise your floor, specialists raise your ceiling.** Universals are
additive and flat; specialist payoffs are multiplicative. Also the answer to "the shop never offers
what I need" — a universal is never a wasted buy.

Current six: Verge (plain damage), Tithe (all allies +15%), Sable (marks a foe for +25% taken),
Salve (heals the weakest), Bastion (taunt with 40% mitigation), Pace (team-wide advance).

Universals have no archetype tier of their own. Each one counts as +1 toward whichever archetype you
already lean into hardest — mechanically expressing "fits any team" rather than just claiming it.

### Matchup grid — this is the endgame

|  | Swarm | Fortress | Ramper | Executioner |
|---|---|---|---|---|
| Detonation | weak — stacks split | strong | fair | strong |
| Decay | strong | strong | weak — too slow | fair |
| Shatter | fair | strong | strong | fair |
| Reflect | strong | weak — no attacks | fair | strong |
| Tempo | weak — too many actors | fair | strong | strong |
| Burst | weak — overkill | fair | strong | fair |
| Legion | strong | fair | fair | weak — cleared out |
| Attrition | strong | fair | weak — outscaled | weak — one-shot |

Each cell records your best difficulty tier. Eight archetypes × five categories = 40 cells of chase
from content you'd build anyway. Adding a ninth archetype adds five cells for the price of one.

---

## 5. Placement

3×2 grid. Back-row units are covered by whoever stands directly below them in the same column;
covered drops exposure from 82 to 28. Three front slots and four-plus units means you can never
cover everyone, so placement is choosing who's expendable.

Rows carry the archetype bonuses: front ×1.5 guard damage, back ×1.6 payout, ×1.2 stacks applied.

**Exposure is a targeting order, not a dice roll.** The enemy always attacks the most exposed unit.
No miss chance — that would break determinism and feel awful in a fight you can't intervene in.

**What would kill this system:** more columns, or partial cover. Once exposure reads 67 instead of
28 or 82, players stop reasoning and start guessing. Keep the rule to one sentence.

Bulwark and Goad *want* exposure, which is what stops "hide everyone" from being correct.

### Terrain

Tiles modify whoever stands there — they never gate who can stand there. Gating is constraint
satisfaction, which is paperwork. Placed once before the run and expensive to change, so terrain is
a thesis statement about the team you intend to build.

Elemental affinity comes free by amplifying a *stack type* rather than adding a taxonomy:
"Emberfield: Burn stacks from this slot count double."

Best version is drafting tiles as run rewards — you start on plain ground and build the battlefield
over three acts. Terrain becomes an option unlocked, not a stat increased.

**Revised again — biome is per RUN, not per encounter.** *(Earlier drafts had it per-battle with a
one-fight reveal. Wrong twice: biome is set by the planet you choose at run start and holds for the
whole run unless a card changes your layout.)*

This also removes machinery that was over-built. The reveal-timing mechanism existed to stop terrain
being randomness-after-decision — unnecessary when nothing is hidden in the first place.

**What the fix buys:** the run gets an identity at the moment you choose, so every shop decision for
twenty minutes is measured against it. Planet choice becomes the biggest decision in the run, which is
correct for the first decision. And the layout-change card becomes precious, being the only escape
from a commitment made at the start.

Two rules keep it from being a tax:
- Fields **favour, never require** — Highlands makes Order better, not everything else worthless
- The obvious read should not always be right — a field dense in Order is also the easiest place to
  trigger Order/Chaos annihilation, so a Chaos team can exploit it

**The cadence**

| Layer | Set when | Changes |
|---|---|---|
| Planet → biome | run start | only via a card |
| Your ship layout | run start, from the biome | only via a card |
| Unit placement on that layout | before each battle | freely |
| Enemy terrain | each battle, from the biome's pool | every fight |

Your half is a fixed board you learn to use well; their half rotates within the planet's theme;
placement is the per-battle decision that remains.

Cut for now: enemy-side terrain, terrain that changes mid-fight.

---

## 6. Direction space

Verdicts are a current read.

### Session shape
| Direction | Read |
|---|---|
| **Roguelite run, 3 acts, ~20 min** | **DECIDED** |
| Single-fight daily puzzle, fixed board | ~~open~~ **dead** — a puzzle has one solution, so a wrong read is failure with no partial credit |
| Campaign with persistent roster | probably not |
| Endless escalating survival | dead (superseded by unbounded difficulty tiers within the run structure) |
| Async submit-a-team gauntlet | probably not |

### Persistence
| Direction | Read |
|---|---|
| Nothing at all | open |
| **Characters unlock as options, never stats** | **DECIDED** |
| Characters free, gear is the collection | **open — likely best for a solo dev** |
| Permanent stat upgrades | dead |
| Mastery grid records only | leaning |
| A personal deck of run modifiers | unexplored |

### Automation
| Direction | Read |
|---|---|
| Fully automatic | superseded |
| Auto + 1–3 manual interrupts | folded into Calls |
| **Auto + tactics board + 2 Calls + given choice moments** | **DECIDED** (§3c) |
| Manual turn-by-turn | closed early |
| Auto + one hold/fire toggle on the payoff | open |

Conditional rules: each unit gets slots like `if guard < 20 → detonate / else → apply`. You program
a team rather than command one. Keeps combat hands-off, makes kits expressive, turns "understand
the kit" into something you author. Also the most work on the board.

### Placement
| Direction | Read |
|---|---|
| Two rows, no movement | live fallback |
| Three lines with movement | shelved |
| 3×2 grid with column cover | current build |
| Terrain tiles with adjacency | current build |
| Free-form adjacency graph | probably not |
| Units that reposition themselves mid-fight | open — movement as personality, not input |

### Economy
| Direction | Read |
|---|---|
| Rotating shop, reroll, interest | **working assumption** — forced by the run decision |
| Standing slot that always covers your gap | open — kills "the shop screwed me" |
| Draft 1 of 3, no currency | open |
| Fixed catalog, escalating prices | open |
| Fluctuating market | probably not |
| No shop; run is about modifiers | dead with the puzzle branch |

### Difficulty and freshness
| Direction | Read |
|---|---|
| Unbounded difficulty tiers, one rule per tier | leaning |
| Archetype × category mastery grid | leaning |
| Boss category announced at run start | leaning — best anti-mono-build tool found |
| Daily seed, one attempt | open, cheap, high value |
| Weekly rotating modifier set | open |
| Branching map with route choice | unexplored |
| Modifiers chosen as a wager for better rewards | unexplored |

### Fiction
| Direction | Read |
|---|---|
| No fiction — pure mechanism | dead |
| Abstract geometric | folded in — the sigil notation |
| Finance / corporate warfare | probably not — too close to source |
| Standard fantasy party | probably not |
| **Sci-fi ship exploring primordial worlds** | **DECIDED** — see §12c |
| Ecology — units as organisms | unexplored, fits behavioural categories well |

Fiction matters more than it looks: it's the only substitute for the borrowed character attachment
Currency Wars gets for free.

### Business
Premium one-purchase leans best given everything above. Gacha monetisation actively conflicts with
every anti-frustration decision made so far.

---

## 6b. Co-op

**The constraint:** nobody presses buttons during a fight, so collaboration lives in the build and
the fight is the shared payoff. Upside: deterministic combat means a fight is a seed plus two team
definitions. No netcode, and nobody has to be online at the same time.

| Direction | Read |
|---|---|
| Shared board, 3 slots each, one shop | real negotiation, slow turn-taking, passenger risk |
| **Two teams, one field, shared pools** | **strongest — the synergy chain crosses the player boundary** |
| Relay: A plays act 1, hands off to B | cheap, fits bedtime play, good "what did you leave me" hook |
| Lend a unit to a friend's run | **cheapest to ship — no server needed at all** |
| Separate runs, shared mastery grid | barely co-op |
| Both draft one shop, picks deny | semi-competitive, conflicts with the anti-PvP stance |
| A owns roster, B owns placement | clean split, B likely feels like a passenger |

### Coalition (the one to build properly)

Two players, two teams, one field. Element pools, skill points and reflect charge all merge. Your
partner's Chaos plus your Energy makes Fire — neither of you can do it alone. No new mechanic, just
a wider scope on pools that already exist.

Side effect worth having: the specialist elements become viable. Void reacting with only Order and
Growth is a real cost across six slots and fine across twelve. Co-op opens builds solo can't
support, which is the right relationship between the modes — differently shaped, not easier.

Resolves asynchronously. Submit a team, the fight runs, both get the same replay.

### The pledge

Before the draft, each player commits to one element. One piece of information, sent once, shapes
both drafts. Make the pledged element carry a bonus and abandoning it carry a cost, and the pledge
becomes a promise with stakes rather than a chat message.

### Failure modes

- **Freeloading** → the attribution readout already exists; make it the shared post-fight screen and
  scale rewards to contribution
- **Trivialising solo content** → faction and element tiers count *per team*, not per field. Only
  the resource pools merge, so co-op widens the range of reactions rather than doubling bonuses
- **The carry problem** → partly fine, that's how people teach each other. Cap it with encounters
  that need both teams functional, e.g. two simultaneous pressure sources
- **Scope creep** → accounts, friend codes and server-held run state are real infrastructure a solo
  dev doesn't have on day one

### Do not build

Real-time synchronised combat (breaks the automated premise, adds netcode). Competitive PvP
(already rejected — punishes creativity). Anything requiring both players online at once (kills
bedtime play).

### Cheapest first step

Unit lending. Mark one character as available, a friend's run drafts it at a discount, you get
something when they clear. No simultaneous play, no shared combat model, no matchmaking beyond a
friend code. Can ship as a pasted text blob before any server exists.

Coalition is nearly free to *test* in the bench — a twelve-slot team with shared pools is a config
change, not new code.


---

## 7. Run modifiers

Three rules, derived from what makes them annoying in Currency Wars:

1. **Every modifier must be somebody's dream.** If no archetype wants it, it's a difficulty slider
   in a costume. Delete it.
2. **Reveal before the draft.** Revealed early it's a puzzle; revealed mid-run it's a punishment.
3. **Change rules, not numbers.** "+30% enemy HP" changes nothing. "Enemies revive once at 20%"
   changes everything, at the same difficulty cost.

| Modifier | Taxes | Rewards |
|---|---|---|
| Enemies act 30% more often | Control, sustain | Reflect |
| Guard regenerates twice as fast | Burst | Decay, sustained chip |
| All enemies start shielded | Burst | Decay, guard-strippers |
| Front line takes double damage | Brawler formations | Backline, movement |
| Interest doubled, shop costs doubled | Fast aggressive drafts | Patient economy |
| Enemies never attack the back line | Reflect (starved) | Fragile backline carries |

---

## 8. Findings from the bench

Things the simulation surfaced that weren't obvious on paper.

**A team with no Payoff loses every encounter with zero damage dealt.** The tag grammar has real
teeth — it isn't decorative.

**Taunt plus reflect was silently broken.** Goad drew every attack, charge landed on Goad, Bulwark
never charged and idled the entire fight. The enabler was starving the payoff. Fixed by making
charge a team pool. This is the origin of the shared-resource rule in §2.

**Absolute taunt makes a party unkillable.** Now taunt only holds while the taunter is above 40%
health, which gives it a natural expiry and creates a late-fight collapse.

**Reflect clears the busiest encounter, and that's correct** — the most attackers is Reflect's
dream. The fix wasn't nerfing it, it was adding `Colossus`: one enormous slow enemy that starves
the pool. Every archetype needs a hostile top-tier fight, not just a friendly one.

**Universals at 3/6 encounters, specialists at 4/6.** The floor/ceiling split is holding.

**Synergy bonuses required a full rebalance.** Layering counts on top of tuned numbers made every
specialist team clear everything, including the previously-unbeaten Colossus. Enemy health and
damage went up roughly 45% and the baseline trickle came down. Worth expecting whenever a
multiplicative layer gets added.

**The no-payoff team went from 0/6 to 1/6** after gates became slopes. Still clearly the worst team
on the board, but it can now scrape the easiest encounter, which is the intended difference between
a weak build and a broken one.

**Colossus is currently unbeaten by every team tried.** Left in deliberately — an unsolved top tier
is the point of unbounded difficulty.

**Watch for dead turns in the log.** A unit with nothing to do on its own turn isn't finished.
Mirrorplate and Goad both read as "supports" doing nothing until they were given real actions.

---

## 9. Teaching, without a tutorial

Ranked by value per unit of work:

1. **Damage preview before the fight.** Nothing teaches a kit faster than watching a number change
   when you swap a support in.
2. **Post-fight attribution.** "68% of your damage came from Cinder." Best teaching tool in the
   genre and almost nobody ships it. *Built.*
3. **Combo cookbook.** Named interactions recorded as illustrated cards on first discovery. Makes
   learning collectible.
4. **Shop glow with a reason.** "Consumes Burn — you have 2 Burn appliers."
5. **Auto-generated kit summaries** from tags. Plain line first, numbers behind a tap.
6. **Live exposure numbers while dragging**, and a drawn line from each front unit to the one it
   covers. Makes the cover rule impossible to miss.

The synergy panel now shows counts, the active tier, and the next threshold — which is guidance
without a verdict. That's a better shape than the old pass/fail checklist.

**Open question:** the old team-check panel may have been too generous. Seeing `Burn · Enabler` three times and
no Payoff is a conclusion the player could reach themselves, and reaching it is more satisfying than
being told. Consider showing the tags but not the verdict.

---

## 10. Feel and pacing

- Hitstop 3–6 frames, white palette flash, screenshake scaled to damage
- Numbers escalate in size, colour and weight through tiers; pile up and fall off screen on a big
  detonation
- Full-screen shockwave shader for the biggest hits **only**
- Rising pitch ladder on consecutive hits does more than any particle system
- Routine turns fast, break and boss-ultimate turns slow down and take their frame
- 2× speed should compress trash turns far more than climactic ones
- Turn limit as a soft timer: makes wasted actions legible and keeps runs to bedtime length
- Watch fight length — four units versus four enemies at 3s a turn is a two-minute trash fight

---

## 11. Testing method

**The hesitation test.** Do you pause at the shop? A decision made instantly isn't a decision.
Measurable with a stopwatch and brutally honest.

**The regret test.** After a run, can you name the purchase you'd take back? If not, the shop is a
gold sink rather than a set of choices.

Instrument later: reroll usage rate, gold remaining at fight time, whether five runs converge on the
same team, whether you can describe your build in one sentence.

Balance in a spreadsheet or a headless simulator before writing game code. Auto-battlers live or die
on balance, and degenerate combos are far cheaper to find outside an engine.

---

## 12. Trunk questions — ANSWERED

All three are settled. None went the way they were originally framed.

**1. Automation level → tactics board plus two Calls.** Not full auto, not manual. Policies and stance
set before the match; two interventions during it; plus free choice moments the game hands you at
Break and Convergence. (§3c)

**2. What persists → options, never numbers.** Settled indirectly by ruling out gacha: PEGI 16 floor
from June 2026 on paid random items, and the structural incompatibility between permanent relevance
and purchase pressure. Premium, cosmetic/expansion monetisation. (explorations §13)

**3. Session shape → the roguelite run.** Reasoning: a puzzle has a solution, so a wrong read is
failure with no partial credit and no story. A run generates its own situations, so even a loss
produces something diagnosable.

### What this collapses

- Daily-puzzle branch is **dead**, and the no-shop variant dies with it
- The economy **must exist** → rotating shop with reroll and interest is now the working assumption
- Biomes announced a fight ahead need somewhere to react → shop or rest node between encounters
- Calls-as-buildable needs a run to build across
- Variance-vs-forecast needs a roster you can swap mid-run

### Still genuinely open

Fiction · the exact shop shape (standing-offer slot? tavern-tier investment?) · whether unbounded
difficulty tiers or the mastery grid ships first.

---

## 12b. Run structure

### Modes — three, and they play differently

| Mode | Shape | Favours |
|---|---|---|
| **Short** | 6–8 fights, one act | units that work immediately, low-setup archetypes, Fixed variance — too few shop visits to assemble a chain |
| **Standard** | 12 fights, three acts | the full arc; builds come online mid-run |
| **Infinite** | escalates until you die | anything multiplicative — purity stockpiles, Weight builds, Wild variance. Home of the mastery grid and the score chase |

Same content, three metas. Cheap, and justified because each favours different builds rather than
just different durations.

### Node layout

**Open with two reward nodes before any fighting** — solves the "first battle with a random team"
problem, which is real.

| Node | Gives |
|---|---|
| Reward | gold and/or a character offer (two of these open the run) |
| Encounter | gold, a character offer |
| Elite | optional, harder, drops a terrain tile |
| Boss | act gate, category set by the planet |
| Store | **between nodes, not at fixed points** — every fight is followed by a moment to reassess |
| Attribute | pick 1 of 3 (see below) |

The store between nodes is the evaluate-and-plan beat. *(Biome is not announced here — it is fixed for
the whole run from the planet chosen at the start.)*

### Group health — replaces carried character HP

*Previous proposal (character HP carrying between fights) is superseded.* Carrying HP **snowballs** —
one bad fight cripples the run and it dies slowly.

**Group health (hull integrity) gives run-level attrition without fight-level decay.** Every battle is
a clean test of the build; losing costs a life, not your team. Fits the sports frame: you lose a
match, not your players. FTL proves the feeling.

**Scale the loss to the margin.** Lose with the boss at 5% → costs 2. At 80% → costs 8. A defeat still
rewards building well, and a narrow loss differs meaningfully from a blowout.

*Consequence:* characters reset, so healing only matters within a fight. Doesn't kill the sustain role
but narrows it from "keep the team alive across the run" to "survive this fight."

### Attributes — the run-defining layer

Pick 1 of 3 each round. They stack; by act three you hold four to six and together they have
redirected the run. **They change rules, not numbers.**

```
Reactions land one ladder rung higher
Wild sources reroll any below-average result
Calls refresh whenever an enemy breaks
Non-reacting element pairs overflow at half the threshold
Your ship terrain re-rolls, and you pick from four instead of two
```

This is where effects too strong for a character belong. Two runs with the same roster play
differently — variety without more characters.

**Attributes are also the trigger for terrain change** — some refit the ship's deck plating.

### Terrain asymmetry

- **Your ship's terrain**: chosen from options at match start, then **stable**. A build commitment you
  can plan placement around
- **Enemy terrain**: changes every battle. The varying constraint you read and respond to — which
  element to lead with, which reactions land hard

Stability where building needs it, variance where freshness needs it, neither undermining the other.
Diegetically clean: your deck is your deck, their world is their world.

---

## 12c. Fiction — the ship

*Resolves the open fiction question in §6.*

A ship exploring worlds that run on six primordial forces, with a crew learning to read the sigils.
Puts the runic script and sigil wheel in the right place — **the alien system you are decoding**,
rather than decoration. Familiar frame, strange notation, reinforcing rather than competing.

| Mechanic | Fiction |
|---|---|
| Group health | hull integrity |
| Characters reset each fight | crew return to the ship |
| Run | a voyage |
| Mode selection | how far you are willing to travel |
| **Planet choice at run start** | **destination — sets the terrain pool and the boss category** |
| Attributes | what the ship learns and refits between jumps |
| Mastery grid | logged worlds, star charts |
| Roster growth | recruiting |

**Planet selection is the strongest part.** A real strategic decision made before drafting anything,
setting both the terrain pool and the boss category, so the run's shape is chosen rather than rolled.

### Planets should not map cleanly to elements

If each planet simply favours one element, choosing is trivial. The interesting version: **terrain
bias and boss category are separate properties that do not always agree.**

| Planet | Terrain | Native lifeform | Tension |
|---|---|---|---|
| Cairn | dense Order | Swarm | defensive terrain, but Swarm wants fast clear |
| The Hollows | Void and Decay | Fortress | slow terrain, slow enemy — a grind either way |
| Verge Bloom | Growth | Ramper | you scale, it scales faster |
| Anvil | Energy and Chaos | Colossus | aggressive terrain, but the boss is a wall |
| Quietus | mixed, no bias | Executioner | no help from the ground, one enormous threat |

Agreement makes a focused, easier run; disagreement makes a harder puzzle. **A natural difficulty
ordering that is not a number** — a hard planet is hard in a *specific* way you can prepare for.

Adds an axis to the mastery grid too: clearing Cairn with Order is the obvious line, clearing it with
Chaos is the achievement.

---

## 12d. Shop economy

### Full refund on selling

Selling a unit returns the full purchase price. **Gold is a position, not a cost** — you are never
poorer for having bought something.

**Consequence: gold buys search, not power.** Rerolls are the only irreversible spend, so the entire
economy is about how much *looking* you can afford. "Can I afford another look?" is a better question
than "can I afford this unit?", and it puts pressure exactly where the interesting decisions are.

**This makes packs the most valuable thing in a run** — a pack improves search efficiency, which
compounds across every reroll remaining.

### Two supports that keep it from flattening

- **Interest is the cost of ownership.** Gold earns, units do not. Buying early costs compounding.
  Preserves spend-vs-save without any sell penalty
- **Roster cap (8) makes buying a decision.** Without it, full refund means buying every affordable
  offer, evaluating at leisure and selling the rejects — not a decision at all

### The pivot cost

Selling costs no gold, so changing strategy is priced in three other currencies:

1. **The synergy cliff** — drop 4 Foundry to 3 and the tier bonus vanishes the moment you sell,
   before the replacement exists
2. **Shop luck** — the gold is free, but the units have to actually appear
3. **The fights in between** — a two-visit pivot means fighting once half-built

Low stakes, real tension, risk lives in the shop rather than the wallet. Nothing punishes you
permanently for experimenting, which fits the bedtime constraint.

### Bench and Substitute

**Own eight, field six.** Benched units contribute nothing but are available.

**Substitute is one of the two Calls** — swap a benched unit in mid-fight; they enter at the back of
the turn order. Gives the bench a purpose beyond storage, gives situational units a reason to be kept,
and is a genuinely dramatic use of a Call.

Selling and buying stay between fights. Substitution is the in-fight version and it costs a Call.

### Packs

**Packs weight the odds; they never filter.** Selecting one makes those units substantially more
likely — nothing is excluded, nothing is guaranteed. You still might not draw what you need, which is
the MTG feeling and the whole point.

**Hold one at a time. Swapping costs gold at a store.** Default is commitment, pivoting has a price —
the same shape as selling, so the two mechanics rhyme.

Two versions, build in this order:

1. **Weighted tags** — a Chaos pack, a Foundry pack, a Support pack. Cheap and immediately readable.
   Risk: it is a filter with extra steps
2. **Curated sets** — eight named units designed to interlock, spanning several elements and roles.
   Closer to an actual MTG set, more interesting to draft into, and authored content that can be added
   later without touching any system

Fiction gives them a name free: the ship broadcasts on a frequency and certain crew answer. A
*manifest*, or a *signal*.

### Safety valve

Pack weighting gives direction but no floor, so a bad run of shops can leave a hole you never fill.
**The standing-offer slot** — one fixed slot always carrying a basic unit of whichever role you are
most short of, at a premium price. You can always buy out of a dead build, but you pay the tax, which
converts "the shop screwed me" into "I chose not to pay."

### What to watch in testing

- **Is gold scarce?** Are you ever choosing between two offers you both want, or can you take both? If
  always both, prices are too low or income too high — the economy is decorative
- **Churn.** If the optimal play is selling and rebuying constantly to chase shop offers, the synergy
  cliff is not biting and tier bonuses need to be stronger


---

## 13. Next up

- ~~Decide the three trunk questions~~ **done — see §12**
- Rebuild the bench on the new model (trigger/effect actions, element grid, priority lists, Calls)
- Define node distribution and reward curves for the twelve-fight run
- Write ~20 attributes and check each changes a rule rather than a number
- Set the margin-to-hull-loss curve
- Decide how many planets ship at launch and what each one's terrain pool contains
- Tune gold income and prices until two desirable offers regularly cannot both be bought
- Write the first three curated packs as interlocking eight-unit sets
- Prototype conditional-rules combat — biggest unexplored fork, and the bench can host it
- Implement Decay, Burst and Attrition and check they don't collapse into each other
- Build the Focus gauge into the sim
- Reinforcement waves as a core tension device rather than a feature that merely exists
- Elite telegraphing, not just bosses
- Find a team that beats Colossus
- Try a 12-slot shared-pool team in the bench to sanity-check Coalition
- Rebuild the action system as data (trigger / effect / magnitude / cost) and port the 22 units
- Port the starter roster into the bench and check all fifteen cells are reachable
- Set neighbour vs resonance thresholds
- Write all eight starter characters in the four-slot authoring format before coding anything
- Decide the skill point cap (the number that makes skill costs bite)
- Give every enemy an element; resistance is inert without it
- Check whether Ward absorbing before Resistance makes shields too strong
- Set the four variance profiles' exact ranges and check Wild concentrates rather than spreads
- Write priority lists for the starter roster, then brute-force the orderings
- Decide how many Calls per fight (starting guess: two)
- Make sure the starter roster contains at least one engine of each of the four types
- Re-examine the five-ladder cap — likely another rule stated at the wrong level
- Decide whether twelve derived elements is over the legibility line (test, don't guess)
- Decide whether the Void/Decay reaction asymmetry is deliberate
- Give each of the ten derived elements a tested mechanical job, not just a name
- Set the purity threshold and test whether mono-element is actually viable
- Decide the cap on how many elements one target can hold at once
- Set the reaction-size thresholds that pick which ladder rung applies
- Test whether five ladders is genuinely the readability ceiling
- Build the Focus gauge and hang the crit buffs off it
- Prototype a distribution-scaling payoff and check it actually beats funnelling
- Consider a third count axis, or unit-specific pair bonds, if two axes prove too coarse
- Decide whether faction should carry fiction (it currently carries only mechanics)
