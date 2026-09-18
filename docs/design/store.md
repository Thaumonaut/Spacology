# The store

A pack store that feels like a gacha and takes no money. Twelve roster slots, eight
on the field, two rows of six.

---

## The problem it has to solve

The original grievance: in Currency Wars you spend everything rerolling and the thing
you need never appears. The money is gone and you have nothing.

**Scrap is the fix, and it is the load-bearing idea here.** A pull you did not want
still converts into progress toward something. Every pull pays; it just does not always
pay what you asked for. That single rule is the difference between a pack store and a
slot machine.

---

## The two axes

A character carries a **tag** (what it does) and an **element** (what it scraps into).
These are deliberately independent.

- **You pull for tags.** A pack is themed, so buying a Blight pack pulls you toward that
  playstyle without guaranteeing it.
- **You scrap for elements.** An unwanted character becomes shards of its element.
- **Shards craft into upgrade crystals**, which upgrade a character of that element.

So the store asks two questions at once — *what am I building* and *what am I feeding
it* — and they are answered by different properties of the same card. A card you cannot
use for the first is still useful for the second.

---

## The loops

**Gold → packs → characters.** Cheap, exciting, random, themed. The default action.

**Characters → shards → crystals → upgrades.** Every dud feeds this. It is the reason
a bad pack is not a wasted node.

**Gold → a named character, expensively.** Precision when you know exactly what is
missing.

**Shards → other shards, at a loss.** Three of one element buy one of another, so you
are never stranded holding the wrong colour. This matters more than it looks: without
it, element randomness stacks on top of tag randomness and a run can dead-end.

---

## What the modelling established

**Packs must be expensive enough to be an event.** At a low price the simulated run
pulled 158 cards and scrapped 146 of them — a 92% scrap rate, where no individual pull
means anything and the store becomes a slot machine you hold down. Pricing packs so a
run buys roughly **twelve to eighteen** of them puts each pack back in the range where
opening it is a moment.

**Targeting is a threshold purchase, not a general one.** It is worth paying for in
exactly one situation: when you are one short of a tag threshold. Sitting at three of
four, a guaranteed fourth is worth far more than three random cards, because it converts
a tier-2 bonus into a tier-4 rule change. Away from a boundary it is never correct.

That gives a clean price rule: **targeting should cost roughly two and a half packs**.
Cheap enough that a boundary justifies it, expensive enough that it is never the default.

---

## What is not settled

I could not get the model to produce a stable answer for **how often targeting should
be bought**, and I do not trust the numbers it gave. The simulated player's buying
policy dominated the result more than the prices did — it never accumulated gold
because it always had a pack it could afford.

That is a real finding about the design, not just about the model: **if packs are always
affordable, nobody ever saves.** Which suggests the store needs something that makes
saving visible and deliberate. Two candidates:

- **A limited number of packs per node.** Once they are gone, gold has nowhere else to go
  but targeting. Turns "should I save" into "I have already spent what I can".
- **A visible target.** You nominate the character you are building toward; the price
  drops each node you do not buy it. Saving becomes a thing you can watch working.

The second is more interesting and is close to a pity timer, but it is chosen rather
than automatic — which keeps it a decision.

---

## The gacha feeling, without the money

What makes a pack opening feel good is not randomness, it is **a near miss you can act
on**. Three cards, one of them almost what you wanted, and a clear next step.

The pieces that produce that:

- **Themed packs** so the pull is aimed, not arbitrary
- **Scrap** so the two you did not want are still progress
- **Thresholds** so you always know precisely how far you are from something changing
- **Targeting** so a near miss has an answer that is not "pull again"

The last one is what CW lacks. Its answer to a near miss is another reroll, which is why
the money feels wasted.

---

## Next thing to build

The store needs to be prototyped and *felt*, not modelled — the same lesson as the
placement grid, where three rounds of simulation could not answer a question that one
minute of dragging did.

A store screen with real packs, real scrap, and a real roster, run across a mock ladder
of nodes. Then the question "does opening this feel like anything" gets a real answer.
