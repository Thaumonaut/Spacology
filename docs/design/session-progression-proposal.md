# Session progression: charters, briefs, and deterministic requisition

**Proposal, 6 October 2026. Design only, nothing implemented.** This revises the acquisition
direction in [team roles and acquisition](team-roles-and-acquisition-plan.md) §5 and extends
[modifiers](modifiers.md) and [run variety](run-variety-proposal.md). Numbers are starting
values for testing, not balance findings. Where this contradicts
[the design record](design-record.md), the design record still wins until this is accepted.

---

## 1 · The problem, stated as three demands on one system

Three things are wanted at once:

- **A — Agency.** You pick the crewmate you want. No "the character I needed never appeared."
- **B — Pacing.** You cannot have the finished team on leg one.
- **C — Variety.** You do not build the same team every session.

Currency Wars buys all three with a single currency: **randomness in supply.** That delivers B
and C and destroys A, and the destruction of A is the grievance this project was founded on.
The mistake is treating supply randomness as the only lever available.

**The thesis of this proposal: put the randomness in the problem and in the price, never in the
supply.**

Each demand gets its own lever:

| Demand | Lever | Mechanism |
|---|---|---|
| A — Agency | **Supply is deterministic** | Every crewmate is always available, at a price |
| B — Pacing | **Strength is bought, not drawn** | Berths, convex pricing, and a time-only currency |
| C — Variety | **The problem and the constraint are rolled** | The Brief, revealed; the Charter, chosen from three |

Our own measurements already argue for this. [Conditions swing 4.7×](design-record.md); tag
thresholds 2×; placement 1.20×. Variety per unit of authored content is highest in conditions by
a factor of more than two. Acquisition randomness has the worst ratio of frustration to variety
anywhere in the system — it is the one axis where the cost is paid in resentment.

### The warning that comes first

Determinism removes a fig leaf. [measurements.md](measurements.md) reports that banning Ash costs
the achievable ceiling **24.3%**, and that Ash appears in 29 of the top 50 teams. If the player
may freely pick anyone, the player picks Ash — every session, correctly.

**So roster flattening is a prerequisite, not a polish pass.** Random supply was hiding a
mandatory-character problem that free choice will expose immediately. Target: no crewmate's cost
of banning above roughly 10%, and no crewmate in more than 35% of top-50 teams.
`sim/diversity.js` and `sim/unique-teams.js` already measure exactly this.

---

## 2 · Layer one — the Brief, and the three kinds of modifier

At departure, the voyage rolls and **shows**, before any gold is spent: the conditions each of the
three sectors will impose, the three bosses, and the encounter formats on the route.

**Correction to an earlier framing.** Revealing this up front is *not* a differentiator from
Currency Wars — CW already does it. Its pre-match screen shows the match's affixes, its factions
and its boss slot together before you commit. The things that actually differ are the ones
[the teardown](cw-teardown.md) already catalogued: trades rather than pure subtraction, category
caps instead of stacked stat multipliers, a guaranteed removal, and counterplay you can build
rather than draw.

### Three layers, three different jobs

The proposal was blurring a distinction that needs to be explicit, because each layer does
something the others cannot.

| Layer | Who decides | When | What it is for |
|---|---|---|---|
| **Imposed conditions** (the Brief) | The voyage rolls it | Revealed at departure, before any spending | **The problem.** This is the reading game |
| **The Charter** | Player chooses 1 of 3 | At departure, before building | **The constraint.** Authored difficulty and build direction |
| **Modifier stops** (nodes 3, 10, 17) | Player chooses 1 of 3, or passes | Mid-voyage | **The pivot.** Adaptation to what the voyage turned out to be |

The imposed layer is the load-bearing one and it is the one currently missing. The design record
says the game is about *"reading a situation and answering it correctly."* **You cannot have a
reading game where the player writes the text.** If every constraint is opted into, nothing is ever
answered that was not also chosen, and the genre quietly changes from puzzle to sandbox.

### The gap in the shipped spine

This is not a theoretical hole. On the current 21-node route
([voyage-nodes.md](../testing/voyage-nodes.md)), all three modifier stops are
*"Optional modifier or pass"*, and passing is a valid line all the way down. The only
non-optional difficulty is the departure selector, and `prototypes/shared/voyage/voyage-settings.js` defines it
as:

```js
hard: { enemyScale: 1.3, enemySpeed: 1.12, enemyGuard: 1.2, breakDelay: .15, ... }
```

Three stat multipliers applied simultaneously — and each sector then adds +55pp health, +30pp
attack, +4 speed and +12 guard on top of that.

[modifiers.md](modifiers.md) opens by naming this exact construction as the failure the whole
system exists to fix: *"Health ×1.6 with damage ×1.45 with speed ×1.25 is a wall no build clears —
each one scales the same underlying number."* Its headline rule caps a stack at **one** stat
modifier. The shipped difficulty selector applies three at once.

Sector scaling is a separate matter and is defensible on its own terms — a progression curve has to
be made of something, and stats are the honest material for it. But it is made of the *same*
material, which means the system's whole budget for imposed stat pressure is spent before a single
condition is applied. The rule layer that was supposed to carry difficulty instead is sitting
behind an optional node the player may skip three times out of three.

So the honest statement of the problem is not "should we add affixes." It is: **difficulty
currently lives in the one place the design record says it must never live, and the affix layer is
the place it is supposed to move to.**

### The reconciliation: the player authors the weight, the voyage authors the text

A flat CW-style session-start roll would contradict two standing principles — *"zero conditions for
a beginner"* and *"choosing where to go is choosing your difficulty."* The fix keeps both:

- **The player picks the weight.** The departure selector stays, but it stops buying stat
  multipliers and starts buying **condition weight** — 0 for a beginner, 4–6 for an expert, on the
  scale [modifiers.md](modifiers.md) already defines.
- **The voyage picks the text.** Within that weight, the specific conditions are rolled per sector,
  filtered by the category caps, and revealed in the Brief.

CW's real defect is not that affixes are imposed. It is that their *count* is set by rank — a meta
number carried in from outside the session, which the player cannot opt down from today. Here the
count is chosen fresh every voyage and the content is rolled fresh every voyage. That is the
difference between an imposed problem and an inherited tax.

Charters can modulate this layer, and one already does: **Hard Science** makes every stack one
heavier in exchange for an extra choice at every reward node. The taxonomy is what explains why
that charter works — it is buying imposed weight with chosen compensation.

### Two lessons from CW's own briefing screen

Both are presentation, both are cheap, and both go the opposite way from the reference.

**Hierarchy.** CW renders its affixes as a row of small chips beside the Next button, several
truncated mid-word, visually subordinate to three large character portraits. Conditions are the
**4.7× swing axis** — the highest-variance system in the mode — presented in the lowest-priority
real estate on the screen. The design record's Marvel Snap principle says the thing that matters
takes precedence in the visual hierarchy. **On the departure screen, the conditions should be the
largest element.** The crew are already known; the conditions are the news.

**Naming.** CW's affixes read *"Satisfying Brawl"*, *"Connections First"*, *"Carried By
In…"* — flavor names that cannot be decoded without a tooltip. Compare this project's own pool:
*"Ailments wither here"*, *"Broken shields reform at once"*, *"No clean water"*. Those are
readable at a glance and they state their mechanic. [dictionary.md](dictionary.md) exists to
enforce exactly this. **A condition name that needs a tooltip has failed**, and it fails hardest
for the six-year-old the design record wants to be able to play.

---

## 3 · Layer two — the Charter

**The new system, and the one doing the heavy lifting against sameness.**

A charter is a **rule rewrite plus a roster lens**, taken once at departure. Three are offered
from a pool of twelve; one is chosen; it holds for the voyage. Each charter changes a structural
or economic rule, makes some kinds of crew cheap and others expensive or forbidden, and states
its cost plainly on the card.

### Why this shape

- It is **chosen**, so it carries no lottery pain. Agency is preserved.
- It is **rolled**, so the offer differs each session. Variety is supplied.
- It is taken **before you own anything**, which is the fix to the flaw the
  [CW teardown](cw-teardown.md) identified in Investment Environments and Strategies: *"the perks
  are random, so the trade is often not one your build can use."* Taking the charter first
  inverts the dependency. The charter cannot fail to match your build, because it **defines**
  your build.
- It is **cheap**. A charter is a data row plus a few price and rule hooks. Compare the cost of
  authoring a crewmate with art.
- It is the missing piece the teardown asked for: *"A pool of twelve or so run-rewriting options
  would do more for replay than any amount of new characters."* With the correction recorded in
  the design record respected — these are structural rewrites the player builds into, not
  desperation buttons pressed twice a run.

### Twelve starting candidates

Proposals for testing. Expect to cut half on the discrimination test in §6.

| Charter | Rewrite | Cost | What it forces |
|---|---|---|---|
| **Skeleton Crew** | Field cap stays 4 all voyage; no upkeep; everyone starts one clause ahead | No breadth, no coverage | Hypercarry |
| **Standing Orders** | Pick one Department: its deep tier fires at 2 instead of 4 | At most two of any other Department | Reaching a rule change early, paid for in coverage |
| **Vivisection Writ** | Breaks pay double; Assay crew cost half | Healing halved | Break / ultra-break |
| **Quarantine Protocol** | At most one crewmate per element | Harmony cannot fire | Spread, and full weakness coverage |
| **Long Haul** | Four extra legs | Income halved per leg | A slow build with room to use it |
| **Double Watch** | The off-field board is live — six bench slots contribute | Bench crew pay full upkeep | Owning depth |
| **Lean Hold** | Clause costs halved | You may own at most six crew, no reserves | Depth instead of breadth |
| **Running Light** | Re-spec one crewmate's clauses free at every stop | Field cap 6 | Flexibility instead of power |
| **Salvage Charter** | Stripping pays triple | Packs cost double | The scrap economy as the spine |
| **Hard Science** | Every reward node offers one extra choice | Every modifier stack is one heavier | Opt-in difficulty with a *relevant* perk |
| **Press Gang** | Recruits are free | You do not choose which clauses are active; the Brief does, and shows them | Reading a hand you were dealt |
| **Blind Survey** | Every reward is one tier better | The Brief stays hidden until each sector begins | Reacting instead of planning |

Two rules govern the pool:

**Every charter closes a door and opens one.** The same rule the modifier pool already lives
under, for the same reason: a stack of pure subtraction is a slow death, and a trade is a puzzle.

**One charter per voyage, never stacked.** Stacking reintroduces the gods problem one level up.

**The offer must not substitute.** Never offer three charters that all want the same build family.
The offer generator needs the same compatibility filtering the modifier pool needs.

---

## 4 · Layer three — Requisition

All crew visible at all times. Anyone can be recruited. The limiter is price, and price is paid
from budgets that do not convert into each other.

### Two wallets and one meter

| | What it buys | How it is earned | Why it limits |
|---|---|---|---|
| **Berths** (meter) | Team size | Fixed schedule plus one purchase per sector | Caps size directly |
| **Gold** (wallet) | Who joins | Battles, bands, salvage | Convex in team size — breadth is expensive |
| **Commission** (wallet) | How strong they are | **Play only. Never purchasable with gold** | Strength cannot be rushed, only earned over legs |

Three budgets rather than one, because **one currency has one optimum and a stable optimum is the
same team every session.** Three non-fungible budgets whose exchange rate the charter sets make
the optimum move. This is the same tension the design record already relies on between upkeep and
streak.

Deliberately two wallets and not three. The teardown killed CW's five-tier / gem / synthesis layer
for vocabulary cost above decision value, and that judgment applies here. Berths stay a **meter,
not a wallet** — a visible track with one purchase, which is close to what
[field XP](field-progression.md) already is.

### Convex recruit pricing

The Nth crewmate costs more than the (N−1)th. A starting form: `base × N`, so with base 12 the
second recruit is 24 and the sixth is 72. One formula, and it does three jobs:

- it paces team size growth without a hard ban,
- it makes a wide team a real and visible choice rather than a default,
- it is **self-balancing against determinism** — free choice of *who* stops mattering as a
  loophole when *how many* is priced steeply.

Upkeep as specified in the design record stays, and compounds with this correctly: wide is
expensive to assemble and expensive to keep.

### The important refinement: a rank is a clause, not a stat

The current copy system grants ★★ = +35% health, +25% attack
([copy progression](../testing/copy-progression.md)). **Replace the stat with a named clause.**
★★ turns on a second sentence in the kit: *"your follow-up now also triggers on marks."*

Five reasons, and the first is the one that matters:

1. It serves fun pillar three — **the build visibly coming online.** A stat bump is invisible; a
   clause firing for the first time is the moment the game is built around.
2. It makes strength a **count of activated engines** — discrete, visible, and budgetable, which
   is exactly what "limit how fast a team grows in strength" requires.
3. It makes owning everyone cheap and worthless, which is what you want once supply is free. The
   game becomes *which three engines do I turn on*, not *who did I get*.
4. It answers the open question of whether a duplicate feels rewarding, without a stat.
5. Vocabulary cost is near zero. The project already says *entry tier is a number, deep tier is a
   rule change* at the Department level. This is the same idea one level down.

### Where randomness survives — upside only

Packs, caches, loot carriers and prime rolls all stay. The rule is that they can only ever
**exceed** the plan, never block it. Nothing on the critical path to a working engine is obtainable
only by roll.

This is not a concession, it is load-bearing. [CHI research on random reward
mechanisms](https://dl.acm.org/doi/fullHtml/10.1145/3491102.3517642) found that random rewards,
compared against deterministic rewards *of the same expected value*, produced more intense
emotional responses and were generally preferred by participants. Removing every roll would cost
something real. So keep the roll, and keep it off the critical path — which is the store
document's "every pull pays" instinct taken the whole way.

### One concrete revision to the existing plan

[Acquisition plan §5](team-roles-and-acquisition-plan.md) proposes a requisition meter that grants
a nominated recruit after three opportunities. **Under this proposal that meter should be cut.**
A guarantee-after-N is a pity timer, and a pity timer is an admission that the supply is random.
Price replaces pity: you can always buy the crewmate you named, today, if you are willing to pay
for them instead of something else. That is a better decision than a meter filling.

---

## 5 · Six lenses on the proposal

These are perspectives taken on the material, not independent agents and not a vote. They
disagree with each other in places, which is the point.

### Systems designer

The proposal's real content is one move: unbundle three demands that were sharing one lever.
Everything else follows. The second-most important content is the §1 warning — determinism is a
**measurement instrument** pointed at the roster, and the first thing it will report is that the
roster is not flat. Do the flattening first or the charters will be theatre.

Watch one failure mode: convex pricing plus a time-only currency can converge on a single correct
*shape* — "four crew, all fully activated" — even while the names change. That is still sameness,
just one abstraction up. The charters are what break it, which is why charter discrimination is
the gating test and not a nice-to-have.

### Player experience designer

**This proposal takes something away and must pay it back.** The pack opening was the session's
spike — ten cards, a near miss, a running tally. Deterministic requisition is a menu, and a menu
is not a moment.

Three things to pay it back with:

- **Give the ceremony to the charter draw.** Three cards face up at departure, illustrated, one
  sentence each, laid out the way the pack select screen lays out consignments. This is now the
  session's opening beat and it should look like one.
- **Give the ceremony to the clause activation.** Commission spent should be staged — the card
  turns, the new sentence writes itself onto the kit. This is the compensating spike, and it is a
  *better* one than a pack because the player chose it and it changes the next fight legibly.
- **Keep the caches.** Surprise still belongs in the game. It just no longer gates anything.

And the chore risk, which is this proposal's largest: **twenty-eight crew always available is a
menu, and a menu every stop is work.** The requisition board must open as a **shortlist against
the Brief** — six to eight candidates, with why each fits, "show all" one tap away. Choice
architecture, not restriction. One decision per stop, not a shopping trip. The panel's thresholds
hold: more than three inspections or more than three minutes at an ordinary stop is a chore
warning.

### Economy designer

The non-fungibility is the whole mechanism and it is fragile. The moment gold buys commission —
even at a bad rate — three budgets collapse into one and the optimum stabilizes. **There must be
no exchange rate.** Charters may change the *earn rate* of commission; nothing may convert gold
into it.

The snowball is the real risk. Commission earned only by play means a bad opening compounds. Fix
it the way gold is already fixed: **every band pays something**, and the lower bands should pay
*proportionally more* commission than gold. A rout should leave you poor but not stalled — it
converts into build progress rather than nothing, which also keeps a losing session diagnosable
rather than dead.

Also: measure whether the budget ever binds. The store document already recorded this lesson — *if
packs are always affordable, nobody ever saves.* A budget that is never binding is not a limiter.

### Player advocate, arguing against

Four objections worth answering in writing.

**"Charters are difficulty modifiers with extra steps."** They would be, if they only changed the
fight. The test is not whether the voyage got harder, it is whether **the best team changed.** A
charter that fails that test is a mislabelled difficulty knob and should be cut. §6 makes this
measurable.

**"If I can pick anyone, I pick the best."** Correct, and this is the §1 prerequisite. The charter's
job is to make "the best" a function of the charter.

**"Twelve charters get solved."** They do, in about twelve sessions. Which is why the offer must be
non-substituting, why Hard Science needs to exist so mastery has somewhere to go, and why the
content roadmap is charters-first (see the next lens).

**"Clauses instead of stats means a late recruit is useless."** Real risk, and it is the thing most
likely to break this proposal in play. A crewmate joining at leg 16 with no commission behind them
is a passenger, which makes late recruitment dead and kills the mid-voyage pivot the whole design
wants. Mitigation to test: a recruit arrives with clauses **matched to the voyage's current
average**, and their gold price carries that. You pay for the catch-up up front. Validate this
explicitly — if late recruits are never taken, this proposal has failed at its own goal.

### The hundredth session

What runs out, in order, and what it costs to renew:

| Runs out | After roughly | Cost to renew |
|---|---|---|
| Charters | 12 sessions | **Data** — a row and a few hooks |
| Modifier combinations | 30 sessions | **Data** — a row and a weight |
| Boss answers | 40 sessions | Authoring, no art |
| Crew pairings | 100 sessions | Art and kit work — expensive |

So the content roadmap is charters first, modifiers second, crew last — the opposite of the
instinct that replay needs more characters. And the cheapest renewal of all is **escalation that
reuses existing content**: charter plus modifier weight is an ascension ladder the project gets for
free, and the teardown already approved the ascension gate as a shape.

### Teaching it to a child

The design record's stated goal is that this be teachable to a six-year-old with visual rather than
textual vocabulary. **Determinism is strictly better for that player.** "I want the green one" and
getting the green one is comprehensible; a pack that refuses you is not, and it is not teaching
anything. Zero charters and zero modifiers must stay a valid, complete way to play. And the paced
strength is what keeps the game from collapsing for them — they get who they want, and the game is
still about whether the team can answer the board.

A charter must therefore be readable as one illustrated card with one sentence. Any charter that
needs a paragraph has failed, regardless of how good it is.

---

## 6 · How to validate it

Three tests. The machinery for the first two already exists.

### Test 1 — Argmax churn. The variety test.

**The question: will I build the same team every session?** This is the one number that answers it.

For each of 200 rolled sessions (a charter offer triple plus a Brief), compute the best-scoring
legal team under that session's constraints and budgets, using the existing
`designer.js → composer.js → evaluator.js` search and `synergy.js score()`. A new
`sim/charter-churn.js` extends `sim/unique-teams.js` from one global pool to a pool per session.

| Metric | Definition | Starting target |
|---|---|---|
| **Argmax churn** | Share of consecutive session pairs whose best team differs by ≥2 members | ≥ 0.70 |
| **Winner concentration** | Share of sessions won by the single most common best team | < 10% |
| **Character breadth** | Each crewmate's appearance rate in session-best teams | between 5% and 40% |
| **Charter discrimination** | Per charter: does its best team differ from the unconstrained best by ≥2 members, *and* beat it under that charter? | both, or cut the charter |
| **Modifier discrimination** | Per modifier: spread of clear rate across the seven build families | keep the spread, cut the flat |

The last two use a method this project has already run and trusted: four enemy archetypes were cut
for *moving every build equally*, and the kept eight spread 0.77 to 1.66. Apply the same blade to
charters and modifiers. **Expect to cut about half the charter pool**, and treat that as the test
working rather than the pool failing.

### Test 2 — Pacing and reachability. Headless.

**The questions: can I finish the team on leg one, and can I always get what I need?**

| Metric | Definition | Starting target |
|---|---|---|
| **Completion node** | First node at which engine + amplifier + answer + payoff are all online | median in sector 2; under 5% before node 6 |
| **Denial rate** | Runs where a nominated crewmate was never affordable | 0% — expensive is the design, unavailable is not |
| **Snowball spread** | Clauses active at node 14, bottom-band opening vs top-band opening | behind, within about 30% |
| **Binding rate** | Share of stops where the player could afford everything wanted | near 0% |
| **Late recruit uptake** | Share of runs taking a recruit after node 14 | above 0 and non-trivial, or the clause system has killed pivots |

### Test 3 — Fun and chore. Human, and the part no simulation reaches.

The project's own process note applies: *the store needs to be prototyped and felt, not modelled.*
Same here. But the protocol matters more than usual, because of one methodological fact:

**A single-session playtest cannot detect the failure being guarded against.** Sameness only shows
up across sessions. So:

- **Five consecutive sessions, same player, logged.** Not one session played five times —
  consecutive, because the failure mode is session four feeling like session two.
- **Before each session**, after seeing the charter offer and Brief, the player writes one
  sentence: *"this voyage I am going to try ___."* After, one sentence: *"what actually happened."*
  Two measurements fall out — **plan divergence** across the five sessions, and
  **plan-to-outcome divergence** within each.
- **Per stop**: decisions offered, decisions taken, crew inspected, seconds elapsed. The panel's
  warning thresholds hold.
- **Per session, two ratings kept separate: "did I have agency" and "was I excited."** These two
  come apart under this proposal — determinism raises the first and puts the second at risk — so
  a single enjoyment score would hide the exact trade being made.

**The kill criterion, registered before the test runs:** if the fielded roster at session five
overlaps session one by more than 60% *and* the five plan sentences read the same, the variety has
failed — regardless of clear rates, and regardless of the ratings. Writing the kill criterion down
in advance is what makes this a test rather than a demonstration.

### What to build for Test 3

Extend [`prototypes/team-building-lab.html`](../../prototypes/team-building-lab.html) rather than
building anything new. It already has the model, the seed control, the export and the stage loop.
It needs: the charter draw, the Brief reveal, convex pricing, commission-as-clauses, and a
five-session log. That is a small extension, which matters — the process note says mock it up and
review before building.

### Order of work

1. **Flatten the roster.** Prerequisite for everything. Existing tools measure it.
2. **Write the twelve charters and widen the modifier pool.** Data only, no code.
3. **Run Test 1.** Cut what fails discrimination.
4. **Extend the lab. Run Test 2 headless.**
5. **Run Test 3** — five consecutive sessions, kill criterion pre-registered.

---

## 7 · One rule for authoring rewards

Independent of everything above, and the thing that makes progression *felt* rather than merely
paced:

**Every reward must produce one sentence the player can say about the next fight.** Not "+18%
damage" but "now Reva counters twice." If a reward cannot be stated that way, it is texture, and
the design record already records what happens to texture: rarity ladders, gem synthesis and
reroll economies were cut for making a run feel busy without making it feel different.

This is also the acceptance test for a clause, a charter and a modifier alike.

---

## 8 · What this proposal deliberately rejects

| Rejected | Why |
|---|---|
| **Enemies adapting to your last build** | Reads as punishment, and the run-variety fairness rules already forbid secret scaling. The safe version of the same idea is a gift, not a tax: **shore leave** — crew who sat out your last voyage start with one extra clause |
| **Rank as a stat** | +35% health paces nothing interesting and is invisible at the moment it happens |
| **A fourth currency** | Two wallets and one meter. The teardown's verdict on CW's gem layer applies |
| **Any roll on the critical path**, including a guarantee-after-N meter | A pity timer is an admission that the supply is random. Price replaces pity |
| **Stacking charters** | The gods problem, one level up |

---

## 9 · Open questions

1. **Does the charter offer need to be rerollable?** Rerolling three charters at once is CW's
   Environment refresh, which the teardown did not object to. But a reroll on the session's
   defining choice may just be a slot machine with one lever.
2. **Does the Brief reveal cost too much surprise?** Blind Survey exists as the opt-out, but if
   most players take it, the reveal is wrong by default rather than right.
3. **How many clauses does a crewmate have?** Two plus the base seems right — three activation
   states, matching the existing ★ vocabulary. Four would make commission the whole game.
4. **Does Press Gang belong in the pool at all?** It deliberately reintroduces randomness on a
   dimension other than identity. That might be the most interesting charter in the pool, or it
   might be the grievance sneaking back in through a side door. It is worth testing precisely
   because it is the proposal's own counterexample.
5. **Whether commission should be visible as a number or only as the clauses it has bought.** The
   design record keeps numeric stats off cards for a reason.
6. **Should the session roll a crew *subset* rather than the full roster?** CW's briefing screen
   shows three faction cards alongside the affixes. If those name the factions whose characters
   appear in that match's shop — not verifiable from one screenshot, so treat it as a mechanism
   rather than a claim about CW — then it is a genuine middle option this proposal does not cover:
   **rolled, but revealed at departure and fixed for the voyage.** It cannot deny you mid-run,
   because you know from leg one who is reachable and plan inside that, which is a different and
   much milder complaint than "the character never appeared." And it forces variety on the roster
   axis directly, which is the axis the charters only reach indirectly.

   It is the roster-side sibling of **Press Gang**, and it stresses the argmax-churn test harder
   than anything else proposed here. Worth building as a **fourth mode in the team-building lab**,
   beside packs, draft, and draft-plus-guarantee — not adopted on argument.
