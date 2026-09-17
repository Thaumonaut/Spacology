# Spacology — naming and open decisions

A proposal, not a ruling. Everything here is reversible and several items are explicitly
flagged as the developer's call. Written against `design-record.md`, which is the current
specification.

The headline: **eleven player-facing words change.** Every crew name, every enemy archetype,
every fitting, every rarity tier and the entire §11 Universal vocabulary survive untouched.

---

## 1 · The separation rule

Three kinds of label, three word-shapes, distinguishable at 9px with no colour and no icon.

| Kind | Shape | Test that passes | Test that fails | Counted as |
|---|---|---|---|---|
| **Department** | Capitalised, never ends in `-er` | "report to Ordnance" | "traces of Ordnance" | a tally of people — `Ordnance ×4` |
| **element** | always lowercase | "traces of salt" | "report to salt" | a quantity of material — `8 salt` |
| **Type** | Capitalised, always ends in `-er` | "she works as a Spotter" | neither of the others | never counted at all |

No word in any set passes another set's test. Any future candidate that passes two is
disqualified on the spot.

> **This rule is currently undermined by the code.** `EL` (`watchable-fight.html:315`) and
> `TAGCOL` (`:498`) are the same six hex values permuted, so Hull renders in order's blue,
> Crew in growth's sage, and Drive in `#D4A45C` — the exact amber that design-record §9
> reserves for "whoever is acting". Separate the two palettes, or accept that typography is
> doing all the work alone.

---

## 2 · Departments

Four of six unchanged. Mechanics are untouched throughout — only the words move.

| Department | Was | What it does | At 2 | At 4 |
|---|---|---|---|---|
| **Hull** | Hull | Stands in front on purpose and gives it back | barriers 45% larger | **PAYBACK** — what a barrier swallows is returned to the attacker |
| **Cultures** | Blight | Grows something on the enemy, lets it spread, then sets it off | every application lands one extra Rot | **BLOOM** — a culture joins the turn order and detonates every Rot on the board |
| **Drive** | Drive | Gets the crew acting sooner and acting again | crew act 12% sooner | **RELAY** — a kill immediately advances the next crewmate |
| **Ordnance** | Ordnance | Hits hard, and hardest into something already open | 20% more damage | **OVERSTRIKE** — a hit that breaks a shield lands a second time |
| **Assay** | Assay | Reads the specimen, finds the seam, opens the shell | shields shred 60% faster | **DISSECTION** — a break costs the enemy two turns |
| **Infirmary** | Crew | Keeps everyone standing, and stands one back up | healing 50% stronger | **RELIEF** — the first crewmate to fall is brought back |

**Why the three that moved:**

- **AMMUNITION → PAYBACK.** Not invented — recovered. `watchable-fight.html:242` already reads
  *"Plate & payback — Hull×4"*. AMMUNITION was a Hull capstone named after Ordnance's
  stock-in-trade, which at 9px invites the player to read it as an Ordnance bonus.
- **Crew → Infirmary.** This repairs a one-word-two-concepts violation that currently lives
  *inside a single tooltip*: Drive's own entry tier reads "**crew** act 12% sooner" while
  **Crew** is simultaneously a department. Retiring it fixes Drive's string without editing
  Drive, and frees "crew" to mean the whole team, which it was always trying to do.
  (Triage was ruled out — `design-record.md:224` already uses "triaged" for the keep/strip gesture.)
- **Blight → Cultures.** The weakest of the three, and the one most worth arguing about. Blight
  is real plant pathology and does serve the title; it fails only the separation rule, because
  you cannot report to it. It also sat between `growth` and `decay`, leaving three
  decomposition words to hold apart at 9px. *Known risk: "Cultures" can misread as alien
  civilisations.* See open question 2.

**Ordnance and Assay should not move.** Ordnance is the best name in the project — precise,
unambiguous, impossible to mistake for an element, and more survey-coded than it looks
(Ordnance Survey is Britain's national mapping agency). Assay was kept by all four independent
proposals. Obscurity is cured once by a tooltip and then never again.

---

## 3 · Elements

Four of six unchanged. Colours inherit except where noted.

| element | Was | Reads as | Colour |
|---|---|---|---|
| **order** | order | Life that builds to a plan — lattices, colonies, hives repeating one solution forever | `#7FA8C9` |
| **chaos** | chaos | Life that never repeats — mutation as the survival strategy | `#C97F9E` |
| **growth** | growth | Life that answers every problem by making more of itself | `#8FB878` |
| **decay** | decay | Life that eats what is finished and puts it back in the ground | `#A89070` |
| **salt** | void | Life that survives by stopping — dried, dormant, waiting out the dark | `#8F8FC9` |
| **heat** | energy | Life running on chemistry rather than sunlight — vents, fast short metabolisms | **must change** |

**Why `void` moves.** It is the only one of the six that is not a way of being alive. Reaching
for "Void Walkers" is evidence the word is being pulled toward the antagonist anyway — retiring
it as an element is exactly what makes that phrase safe to keep.

**Why `energy` moves, and a hard constraint.** `#D4A45C` is `--energy` in the stylesheet *and*
the acting / charged / ultready accent in sixteen places, and design-record §9 reserves amber
for whoever is acting. Naming the element "heat" pulls the VFX toward that amber. **Give it its
own hue and rename the CSS variable.**

### What an element *is*

> An element is the one thing a lifeform's biology has committed to — the survival strategy it
> is built around — which your instruments read off it as a signature, and which one of your
> crew has handled a thousand times before.

That one sentence does all three mechanical jobs without hand-waving:

- **Weakness** works because every commitment is also a cost. Press on the thing an organism is
  built around and it has nothing to fall back on. And a crewmate carrying that signature is an
  expert who knows where the seam is — which is *why* they shred at full rate while a stranger
  fumbles at 20%. Two weaknesses per enemy reads as "committed to two strategies, fragile in both".
- **Currency** works because stripping a card does not destroy a person — you keep their notes
  and samples, filed by signature. Twenty-four shards of one signature make a crystal, and a
  crewmate who has studied a complete set gets promoted. The promotion ladder is a career ladder.
- **Harmony** finally has a reason to exist: a second reading of the same signature *corroborates*
  the first, which is why two colleagues in one field crowd in the moment a specimen is cracked
  open. **This is the part the design has been missing — a fiction that argues for stacking
  elements, not only for spreading them.**

It is a taxonomy, not a damage type. That is why this game is not fire, ice and lightning, and
why the element axis survives the rename to Spacology completely intact.

---

## 4 · Types — the ruling is no

**You asked for a third set of shared-trait bonuses. You should not have them.**

The arithmetic, measured against the actual roster:

| | Entry tiers lit | Deep tiers lit | Chance a drafted card advances the plan |
|---|---|---|---|
| Departments, no plan | 3.27 | 0.93 | — |
| Departments, drafted hard | — | **1.80** | **51%** |
| One-membership axis, no plan | 2.19 | 0.18 | — |
| One-membership axis, drafted hard | — | **0.35** | **1.4%** |

Characters carry 1.67 departments each, so eight fielded bodies give 13.3 department slots —
enough for three deep tiers. An axis where each body has exactly one membership gives 8 slots on
the same eight bodies, which is the worst possible shape for a threshold system: the cheap tier
lights by accident and the expensive one stays out of reach. Drafting *converts* entry tiers into
deep tiers for departments; for a single-membership axis all that effort buys a third of a tier,
on one card in seventy, across the ~57 characters seen in a voyage.

`roster-design.md` already prices the loss: a team with no deep tier sits at **1.58** against
**3.38–4.69** for committed builds. A third axis asks you to risk a 2–3× breakpoint loss to gain
a tier that fires a third of the time.

**You have also already run this experiment.** `design-notes.md` §4 ran archetype counts alongside
a faction axis with tiers at 2 and 4, concluded "faction alone doesn't carry you" — and factions
appear nowhere in the design record. No game in the reference corpus runs more than one counting
axis; TFT's Origin and Class are two label *kinds* inside one trait system.

### What type should be instead

It already exists, fully authored, in the prototype. `PROFILES` at `watchable-fight.html:500`
carries five entries with plain-English labels, every one of the 36 roster entries has one, it
drives real target selection at `:1537`, and it already renders on the crew card at `:777` every
turn of every fight.

Because the player never chooses targets, **this is the only thing that tells them who their unit
will attack** — which is exactly "the ops room is the game; the fight is the answer coming back."

| Type | Was | Temperament |
|---|---|---|
| **Opener** | breaker | Works the shell. Puts the next hit into whatever is nearest a Break |
| **Finisher** | finisher | Goes for the throat. Picks whatever is closest to dead |
| **Spotter** | tactician | Plays the clock. Picks by what is about to act, not what is about to die |
| **Wrangler** | bully | Takes the big one. Picks the heaviest thing and stays on it |
| **Scavenger** | opportunist | Waits for something to be opened by someone else, then arrives |

Renamed only so they never read as departments and never borrow a Universal term — "Breaker"
claims a mechanic every unit can produce; "opportunist" truncates to `opportuni…`.

**Type grants nothing, is never counted, and is never shown as ×3.** Keep it at five — the moment
there are six, players start hunting for a threshold.

---

## 5 · The rest of the vocabulary

| Thing | Recommendation | Note |
|---|---|---|
| Antagonist | **the Null** | Keep. See below |
| Run life-total | **Fidelity** | Replaces both "data integrity" and "data quality" |
| A run | **voyage** | Unchanged — the working title becomes the word for a run |
| One of fourteen | **leg** | Unchanged |
| Between-fights screen | **the ops room**, shortened to **Ops** | Unchanged |
| Your ship | **vessel** | Unchanged |
| Currency | **grant** | Keeps the `g` suffix, so every economy table in §4 stays true |
| A pack | **consignment** | Unchanged |
| One character | **crewmate** | "intern" kept where it is true — the starter pack |
| Worlds | Cairn, **Reef**, **Anvil**, Verge, **Scarp**, Hollows | Phomous, Maelstrom, Bastion move |

**The Null, not the Void Walkers.** One word against three, and the only proper noun the player
must learn. `dictionary.md` already fought this exact fight: *"the original design had Void as an
element and Null as a reaction and Null as the antagonist; only the antagonist keeps the name."*
"Walkers" is a plural agent noun — it promises findable individuals and eventually a boss the
design does not deliver. The Null does not walk toward you; it reaches a system and the record
stops.

But the instinct to want something you can *point at* is right, and it is already satisfied twice.
First, **Husk, Thrall, Spore, Cyst and Grub are not the Null — they are what it left behind**, and
that enemy roster already reads as its wake. Second, because `void` is no longer an element,
*"void walkers"* is now free as **crew slang** — a rumour in bios and pack flavour the survey does
not officially endorse. Keep the phrase; keep it out of the UI.

**Fidelity, not Integrity.** Integrity is the wrong word for a bar you are trying to *raise* —
every player reads it as hull integrity, a thing that starts full and falls, which is the exact
mental model design-record §2 says it abandoned. Fidelity means how faithfully the record matches
the thing recorded, which is literally the premise. Two free consequences: Hull stays a department
with no shadow, and "Recovering" is freed to mean only a downed crewmate rather than *also* naming
the score gauge — a live one-word-two-concepts breach nobody had flagged.

**Worlds.** *Phomous* does not obviously mean anything. *Maelstrom* is a threat word on a system
where danger is rolled fresh every visit. *Bastion* is already an enemy in §7 and a preset button
in the prototype. Anvil is recovered from `design-notes.md:1470`, not invented.

---

## 6 · Three bugs found while checking the above

All verified by running the prototype's own data.

### 6.1 AoE breaks pay nothing — the largest of the three

The single-target break path (`:1496–1507`) sets broken and vulnerable, runs Overstrike, builds
the Harmony ally set, and calls `cascade()`. **The AoE path (`:1482`) sets broken and vulnerable,
pushes to `ev.broke2`, and stops** — no Overstrike, no Harmony, no cascade.

Three of the five units flagged `p:'breaker'` are AoE (Ash, Rime, Mote), with `shred` of 16–24
against the single-target breakers' `dmg` of 10–15. **The units doing most of the breaking trigger
none of the break payoffs.**

*Fix:* lift that block into a shared `onBreak(ev, act, target)` and call it from both paths.

### 6.2 Two different off-element penalties

| Path | Formula | Penalty | Stat used |
|---|---|---|---|
| Single-target (`:1495`) | `act.dmg * (match ? 1 : UNMATCHED)` | **0.2** | `dmg` |
| AoE (`:1476`) | `act.shred * (isWeak ? 1 : 0.5)` | **0.5** | `shred` |

AoE units are 2.5× less element-sensitive than everyone else, and read a different stat field. Any
element experiment run today measures how many AoE units were fielded.

### 6.3 Element is not a property of a character

Seven of the twenty-one crew change element between presets — Ash (decay/chaos), Pyre (chaos/void),
Quill (void/growth), Fen (order/energy/void), Wex (chaos/energy), Rime (void/order), Vane
(order/chaos). Element was being fitted per-team to force one-of-each.

This contradicts design-record §5's own economy: *"you scrap for elements"* requires the element to
be printed on the card. Fixing it also largely fixes the rainbow problem on its own — under a
uniform draft, **72% of allies have an element partner at field 8 by pure pigeonhole**, with nobody
stacking deliberately.

### And two name collisions

`CHAFFNAMES` (`:517`) contains **Shard**, which collides with shards the salvage currency, and
**Rime**, which is also a crewmate. Drop both from that array — Blot sits fine beside Mite, Nit
and Grub. No document needs editing.

---

## 7 · The Harmony fix

Four changes, roughly thirty lines, none of which touch the rules:

1. Shared `onBreak()` so AoE breaks pay (6.1)
2. One `UNMATCHED` constant across both paths (6.2)
3. Element becomes a fixed property of a character (6.3)
4. **Cap the Harmony ally set at two**, sorted by action value

Item 4 is the real dial, and it decides whether the game has one right answer or four:

| Harmony cap | Result |
|---|---|
| Uncapped | eight units on one element is 7 partners and ×5.2 damage every break — every world collapses toward mono |
| 3 | three of four worlds converge on the same 4/4 answer |
| **2** | **all four worlds want different shapes** — Bastion mono, Cairn 5/3, Verge 3/3/2, Hollows 4/4, with 1.32×–1.66× swings |

A 1.3–1.7× swing sits exactly where a secondary axis belongs: above grid placement's 1.20×, which
was already rejected as too weak to build, and below tag thresholds' 2×. It also gives the element
axis the shape players already learned from departments — **one partner is the splash, two is the
commitment.**

### The measurement that confirms it

Extract the engine headless first — budget a few hours, since none of the `.js` files in §13 are in
this repository and there is no seeded RNG, so nothing is reproducible today. Then sweep all 20
element distributions of 8 units over 6 elements, against all four worlds, across Harmony caps
0/1/2/3/uncapped, 200 seeds each. About 80,000 fights — minutes. Score by breakpoint, not win rate,
per the project's own rule.

Four falsifiable pass criteria:

- **(a)** at least three of four worlds have different best shapes
- **(b)** best-to-worst swing lands between 1.3× and 2.0× on every world
- **(c)** Harmony fires on ≥30% of breaks for the winning shape on ≥3 worlds — today it is 0%
- **(d)** no single shape is top-two on all four worlds

If (a) or (d) fails, the one-line fallback is to retarget Harmony to the **target's weakness**
rather than the actor's element (`:1504`).

### Stop showing the coverage number

`coverage()` at `:331` is an oracle pointing the wrong way. It is *negatively* rank-correlated with
clear speed on three of four worlds — on Bastion the maximum-coverage shape is dead last of twenty,
1.89× slower than the optimum. **It taught the design to spread.**

Binary coverage also cannot be a tradeoff at these numbers: with two distinct weaknesses drawn from
six elements, any team holding three or more distinct elements covers 100% of enemies. The spec's
89% claim matches neither the code nor the arithmetic and should be deleted.

Replace the percentage with per-element depth against the world's weakness histogram — *"order ×4
against 3 of 3 enemies"* — a consequence rather than a grade, exactly as §9 requires.

---

## 8 · Technology

**Vite + TypeScript + vanilla DOM + Vitest, zero runtime dependencies.**

Everything that exists is `.html` and `.js`. LÖVE2D cannot reach an iPad without a native build and
a paid Apple Developer account, which was never asked for and which would discard twenty sessions
of work. Skip a UI framework too: the board is about thirty DOM nodes carrying hand-tuned
choreography, and `watchable-fight.html` already does manual FLIP animation by measuring
`getBoundingClientRect` and inverting the transform — exactly what a VDOM diff layer stomps.

**The one architectural rule that matters:** `src/sim/` must be pure, with a seeded RNG and no DOM
import, ever. The moment the animator can drive the simulation — it does today, `step()` calls
`playAction()` which calls `resolveAction()` — the headless harness is lost, and with it every
balance number in the project.

There are 18 `Math.random()` calls in the prototype; six sit on gameplay paths (`:743`, `:1593`,
`:1602`, `:1604`, `:1605`, `:1655`). One `reflowFoes()` call at `:1375` sits inside `resolveAction`
and is the single line stopping the simulation from running without a DOM.

---

## 9 · Build order

Five steps, each independently playable.

1. **Get it on the iPad, unchanged, today.** Commit everything first — all five prototypes, the six
   mockups, the fifteen `.js` sim files, `battle-tests.xlsx` exported to CSV alongside the binary.
   The port is a diff against these, and you cannot diff against a hard drive. Then stand up Vite,
   set `server.host: true` and point `server.hmr.host` at the laptop's LAN IP — HMR advertises
   `localhost` and silently fails from the iPad otherwise. Open the network URL in Safari, Share →
   Add to Home Screen. **Do not refactor anything until this works.**

2. **Extract `src/sim/` and make it deterministic.** Lift `resolveAction`, `hit`, `cascade`,
   `evalTarget`, `chooseTarget`, `ultPolicy` and `spawnFoes` out verbatim. Replace the gameplay
   `Math.random` sites with one seeded `mulberry32` threaded through fight state. Delete the
   `reflowFoes()` call. Move `G.hp0`, `u.retiring` and the deferred AV reset into the presenter so
   `FightState` is plain and serialisable. Invert control flow so `step()` returns an Event and
   `present(ev)` consumes it. First test: the same seed produces a byte-identical event log across
   1000 fights. Then replace the 27 chained `setTimeout`s with one `requestAnimationFrame` timeline
   — which is also what gives you pause, variable speed and skip-to-end, and what survives iOS
   backgrounding, where timers throttle and CSS transitions do not.

3. **Fix the element axis and re-measure.** The four changes in §7, then the 80,000-fight sweep.
   Write the real Harmony and coverage numbers back into `design-record.md` — nobody has ever seen
   a true value for either, and the §10 balance table was measured in a build where Harmony
   contributed exactly zero.

4. **The rename pass, as data.** One `src/data/strings.ts` mapping stable ids to display names —
   the id `hull` never changes, its label can change ten times. Apply the eleven words, fix
   `CHAFFNAMES`, move `heat` off the acting amber, split `EL` from `TAGCOL`. The next re-skin
   becomes a one-file diff.

5. **The voyage around the fight.** Port the ops room onto the sim core — consignments, keep/strip,
   shards, forge, the 16-roster and 12-slot field with upkeep — then wrap it in 14 legs, three
   destinations, danger 1–5, scoring bands and the streak. Leave `ops.html` and `voyage.html` frozen
   in `prototypes/` as running oracles to diff against. **Port them; do not wrap them.**

---

## 10 · Decisions taken

| # | Question | Decision |
|---|---|---|
| 1 | How many crew are fielded — 6, 8 or 12? | **8 free of 12 slots**, with 7g-a-leg upkeep beyond 8. `FIELD=6` in the prototype is now wrong; set `FIELD=8` before the sweep runs, or the sweep measures the wrong game |
| 2 | Cultures, or keep Blight? | **Cultures**, with the Fracture stack renamed **Rot**. The three-way separation rule stands |
| 3 | Is weakness coverage a planning lever, or a floor? | **A floor.** Harmony carries the element axis; world conditions carry world choice at a measured 4.7×. No content work. Delete the 89% claim from design-record §5 — it is true of no build yet run |
| 4 | Are Calls in the first shippable version? | **Out of v1.** Ship the watched fight, play ten complete voyages before sleep, then decide |

### What decision 1 changes

`FIELD=6` appears in the prototype at `:518`. At field 8 the element-partner probability under a
uniform draft is **72%** rather than 60%, which is what makes the Harmony cap of two the right
starting guess rather than a hopeful one. The 80,000-fight sweep in §7 must run at field 8.

### What decision 3 changes

Nothing needs building, which is the point. It also means the coverage readout described in §7
is not merely misleading — it is measuring something the design has now decided is not a lever.
Replace it with per-element depth (*"order ×4 against 3 of 3 enemies"*) or remove it.

---

## 11 · Still open

| # | Question | Recommended default |
|---|---|---|
| 5 | **What does the starter department pack deal?** Sets the difficulty of the first three legs and the first lesson the player learns. Four single-department Commons lights a deep tier on leg 1, which teaches commitment in one move — but makes the opening fights unusually strong, so the calibration rule (a plain team wins about two thirds and can lose both ways) needs re-running against it | **4 single-department interns plus 2 off-department**, with at least one element repeated among the six so Harmony fires on leg 1 |
| 6 | **Where does type appear — sheet, card front, or acting card?** This is the back door through which the third axis returns. A label you can filter by is a label players assume pays, and the first thing anyone does is long-press *Scavenger* hunting for the bonus that is not there | **Character sheet plus the acting card** (the prototype already renders it at `:777`). No filter chip and no count anywhere in the ops room until the game has shipped once |
| 7 | **Fidelity, or keep Integrity?** Eleven occurrences in one document, but it is the number the player reads every leg, and it is the one place this proposal overrules both the spec and the phrasing used today | **Fidelity** |
| 8 | **Which iPad, and how heavy can the VFX be?** The particle canvas caps `devicePixelRatio` at 3 — on a 12.9" Pro that is a 2732×2048 surface repainting during cascade rattle. Budget against the best iPad you own and it will stutter on the one you actually pick up at eleven at night, which is the whole use case | **Budget against the cheapest iPad you own.** Keep the existing density slider; measure frame time during a four-stage cascade, not an idle turn |
