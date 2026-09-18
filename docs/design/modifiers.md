# Modifiers

The difficulty dial. Zero for a beginner, four or five for someone who has been
losing on purpose for a fortnight, drawn from one pool.

The whole design exists to answer one failure: Currency Wars stacks enemy health,
strength and speed until you are fighting several gods at once. That is not hard,
it is unanswerable, and an unanswerable loss teaches nothing.

---

## The rule that fixes it

**Stat modifiers multiply with each other. Rule modifiers do not.**

Health ×1.6 with damage ×1.45 with speed ×1.25 is a wall no build clears — each one
scales the same underlying number. But *ailments wither here*, *shields reform at
once* and *follow-ups cannot chain* are three separate problems. Each is individually
answerable, and answering one does not make the next one harder.

So the pool is capped by category rather than pruned:

| Category | What it touches | Max in a stack |
|---|---|---|
| **Stat** | health, damage, speed | **1** |
| **Rule** | what is correct | no limit |
| **Shape** | the encounter's composition | 1 |
| **Cost** | the run outside the fight | 2 |

Without the cap, **10% of four-modifier stacks contain two or more stat modifiers**.
With it, none — by construction, not by tuning.

---

## Every modifier that closes a door opens another

Not "the back row takes double damage" but "the back row takes double, the front row
deals 40% more." A beginner ignores the cost and enjoys the gift. An expert builds
around both. The same modifier serves two players.

This is also what stops a stack from being pure subtraction. Five modifiers that each
only take something away is a slow death; five that each trade produce a puzzle.

---

## Counterplay has to be reachable, not drawn

Currency Wars has strategies that remove or prevent affixes — but whether you are
offered one is luck. A modifier whose only answer is a card you may never see is
unanswerable; you just do not know it yet.

Two fixes, both cheap:

**Show the stack before the draft.** If you know what you are facing before you choose
a crew, you build the answer instead of hoping for it. This also makes every loss
diagnosable, which is the point of the whole loop.

**One guaranteed removal, at a price.** Somewhere in every run, the option to drop a
modifier exists. Not a chance of it.

---

## Escalation has to be worth taking

CW lets you choose Gold or Prismatic strategies that raise difficulty by 3 or 6 levels
in exchange for perks. The shape is right — the player authors their own ceiling — but
the perks are random, so the trade is frequently not one your build can use.

**The perk offered with a difficulty increase should be drawn from what your build can
spend it on.** If you are running decay, offer decay. Otherwise it is a tax with a
lottery ticket attached.

---

## Difficulty is the count, not the magnitude

A modifier carries a weight, and a stack's weight is the sum. Weight measures *how much
it narrows the answer space*, not how much it multiplies a number.

| Stack | Weight | Feels like |
|---|---|---|
| 0 | 0 | the rules, nothing else |
| 1 | 2–4 | one thing to build around |
| 2 | 4–7 | a shape for the run |
| 3 | 6–10 | two answers closed, one opened |
| 4 | 8–13 | most obvious builds are gone |
| 5 | 10–16 | find the one that still works |

Your nephew plays at zero. The board is the whole game and the rules are the whole
rulebook. You play at five and are solving a different problem every session with the
same crew and the same rules.

---

## The pool

Weights in brackets. Gifts in italics.

### Stat — at most one
- **Enemies carry 60% more health** (3) — a straight tax; you play the same way, longer
- **Enemies hit 40% harder** (3) — a tax on healing and barriers
- **Enemies act 25% sooner** (4) — a tax on everything, hence the heaviest

### Rule — the body of the pool
- **Ailments wither here** (3) — *every shield is one layer thinner*
- **Broken shields reform at once** (3) — *a break deals its damage twice*
- **Follow-ups cannot chain** (2) — *each one lands 80% harder*
- **Everyone deals and takes 40% more** (2) — symmetrical; shortens the fight
- **Everyone acts 25% slower** (2) — symmetrical; favours doing more per turn
- **Healing is halved** (3) — *barriers are doubled*
- **Weaknesses are hidden until struck** (2) — a knowledge tax, not a power tax
- **Ultimates cost half again as much** (2) — *and hit half again as hard*

### Shape — at most one
- **Twice as many, half as tough** (3) — the answer is area damage, always available
- **Half as many, twice as tough** (3) — the answer is single-target, always available
- **Enemies come in waves of three** (2) — rewards clearing fast
- **One enemy strengthens the rest until it falls** (2) — one correct priority

### Cost — at most two
- **You field one fewer** (2) — *the rest are a tier stronger*
- **Half the usual income** (2) — the shop matters more, not less

---

## Still to verify

**Every stack needs at least one team that beats it.** The caps make an unwinnable
stack unlikely, not impossible — *ailments wither* plus *follow-ups cannot chain* plus
*enemies act sooner* closes three engines at once, and whether a fourth survives is a
question for the harness, not for reasoning.

The test: generate every legal stack up to five, run the archetype list against each,
and flag any where no team clears 60%. Any that fail get a compatibility rule — the
pair simply never draws together — which is cheaper and more honest than a warning
arrow telling the player they have already lost.
