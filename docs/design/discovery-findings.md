# Can you find combinations nobody designed?

The design goal under test:

> Finding characters who work together in unexpected ways — each character should have a value
> where you can find alternate combinations that also work outside the normal teams.

**All numbers live in `measurements.md`**, which is generated from the simulation rather than typed
here, so it cannot drift out of step with the model. Terms are defined in `glossary.md`.

**Short answer: yes, and better than the first attempt suggested.** The strongest teams are built
from chains of abilities rather than from role thresholds, no character is mandatory, and the top
of the table holds several mechanically different shapes. What limits it is the vocabulary — eight
of seventeen verbs sit on a single character, so a chain through any of them has exactly one
possible form.

---

## What was wrong the first three times

The corrections matter more than the original findings, so they go first.

**Enemies never took a turn.** `synergy.js` spawned every enemy with a `NaN` action value, because
it multiplied by a bonus that was never defined. `NaN` never sorts to the front of the turn order,
so no enemy ever acted — zero enemy turns across sixty fights. The crew was being scored against a
board that could not hit back, and the only way to lose was the twenty-round limit. Fixing that
woke a second undefined constant, which made damage-over-time ticks `NaN` and the poisoned enemy
unkillable.

That reversed two headline findings. It also voids the breakpoint tables in `roster-design.md`,
`synergy-notes.md` and `pipeline-notes.md` — all three came from this engine, and all three
concluded that the defensive builds underperform. In a model where nothing attacks you, that is
arithmetic rather than a finding.

**The difficulty search was capped.** A strong team returned `5.96` whatever it was really worth,
because that was the top of the range being searched. Two worlds of five saturated there, which
compressed the top of every ranking into near-ties. The ceiling is now an argument to `score()`.

**Teams were sampled with duplicates.** The best teams doubled up freely, which is not legal — a
team is unique characters. Removing duplicates cost nothing at the ceiling, but it exposed a
mandatory character that the duplicates had been masking.

`sim/README.md` has the detail on all three.

## The finding that survived every correction

**The strongest teams are never committed to one role.** Every team in the top ten carries two or
three roles at their entry tier and commits to none. This was true in the broken model and it is
true now, for different reasons, which makes it the most robust thing here.

What they share is a chain of abilities rather than a shared role. The current best team runs four
characters carrying `armorShred` and `aoe` to strip the board's armour in parallel, plus one
detonator to cash in the damage-over-time the others applied. Three roles, one mechanism, and the
mechanism lives entirely in what the characters *do*.

## No character is mandatory

Removing the most-used character costs the ceiling about a tenth. Nothing exceeds a sixth, and
several heavily-used characters cost nothing at all, because more than one team reaches the top.

Before the fix, one character appeared in all twelve of the top twelve teams and removing her cost
over a third. That artifact is worth understanding: with enemies that never attack, a fight is a
pure damage race, so the best area-shredder is simply the best character and every good team wants
her. Restore the enemy, survival starts mattering, and the top splits into several shapes.

## Only one role rewards commitment

**Breaker** is the only role that gets better the deeper you go, rising steadily from one member to
four. That is exactly the shape the two-tier design is aiming for, and no other role has it.

**Defence splashes but does not commit.** Tank and Healer are fine at one or two members and fall
off a cliff at three. That is defensible, and it matches the project's own rule that a team of five
shielders with nothing to shield should still lose — but it means neither is a build on its own,
only an ingredient.

**DPS is not a build either.** It was the strongest thing in the broken model, where raw damage was
all that mattered. With enemies fighting back it is slightly negative.

## What the fight actually runs on

Of the five combat constants, two decide the game: **how much armour each layer carries**, and
**how fast you strip armour when your element does not match**. The other three barely move
anything.

The second of those bears on a decision that is still open. Off-element shred is the second most
load-bearing number in the fight, which makes element matching high-stakes — and neither engine
models element as a property of a character at all. It is assigned by array position.

## The ceiling: eight verbs sit on one character

This census never runs a fight, so the engine corrections do not touch it.

Eight of seventeen verbs exist on exactly one character — `detonate`, `dotSpread`, `turnBoost`,
`energyGain`, `lifesteal`, `needsShield`, `shieldOnHit` and `overheal`. **A verb carried by one
character gives every chain through it exactly one possible shape.** There is a single detonator
serving three characters that apply damage over time, so that chain is identical every time. The
three characters that act out of turn each trigger on a different event, so they never substitute
for one another either.

Two characters carry no verbs at all — they are pure damage. They can never be part of anyone's
discovery, though one of them appears often in strong teams because raw damage is still raw damage.

## What follows

The prescription is in `character-construction.md`, because the answer turned out to be structural.

In short, the sparseness above is what **enablement** produces. A chain exists only where a producer
meets its specific consumer, so one detonator serving three appliers gives that chain one shape
however many appliers are added. Replacing enablement with **amplification** — every character
completes its own loop, and others make that loop bigger — makes the space dense instead, because
anything touching a mechanic then improves anything else touching it.

## What this cannot tell you

Neither engine models element as a property of a character, and Harmony — the follow-up that fires
when allies share an element — is declared in one engine and read by neither.

So everything here is a finding about **abilities and roles only**. Whether elements add a second,
independent source of unexpected combinations is unmeasured and unmeasurable until characters carry
one. That is the prerequisite for the interesting half of this question.
