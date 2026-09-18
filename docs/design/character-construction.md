# How characters are built

The rules for authoring a character, as distinct from what things are called
(`decisions.md`) or how the game is shaped (`design-record.md`).

This exists because the construction vocabulary is scattered — the useful parts live in
`design-notes.md`, which the design record correctly simplified for *mechanics* but under-carried
for *character authoring*. Three separate times a principle has been rediscovered from scratch
that was already written there. Read `design-notes.md` for how a character is assembled;
`design-record.md` for everything else.

---

## 1 · Teams are unique characters

**No duplicates.** A team of eight is eight different people.

This is a harder constraint than it sounds and it invalidates measurements taken without it. Both
`sim/search.js` and `sim/diversity.js` sample with replacement, and their best teams doubled up
freely — `Maul, Maul, Ash, Ferrule, Vitre`, `Corr, Corr, Maul, Maul, Nettle`. Use
`sim/unique-teams.js` for any question about team composition.

It also removes a failure mode worth naming: if doubling the strongest hook is legal, the draft
degenerates into hunting copies of one character, which is the opposite of looking for
combinations.

## 2 · Every character works alone; other characters make it bigger

The load-bearing rule.

> A character can do damage on their own and set their own application and trigger it. Other
> characters boost or enhance the amount of application, or the trigger multiplier — so they work
> well on their own but also combine with others to increase their damage.

The distinction that matters is **enablement versus amplification**:

| | Structure | What a combination feels like |
|---|---|---|
| **Enablement** | A applies, B spends. Without B, A's mechanic does nothing | Binary. You either found the partner or you did not |
| **Amplification** | A applies *and* spends. B makes A's application bigger or A's multiplier steeper | Graded. Every character that touches the mechanic improves it |

Amplification is the better structure for discovery, and the reason is arithmetic rather than
taste. **Under enablement the space of working pairs is sparse** — a chain exists only where a
producer meets its specific consumer, so the number of discoverable combinations is bounded by how
many consumers exist. **Under amplification it is dense** — anything that touches a mechanic
improves anything else that touches it, so combinations are found rather than looked up.

This supersedes the existing content rule *"no applier ships without a spender"* with something
stronger. That rule patched the Banners of Ruin failure by pairing every applier with a partner.
Making every applier its own spender removes the failure mode instead of managing it.

### The verb classes this implies

From `design-notes.md`, and exactly the shape the rule above needs:

> **Payload verbs** act on a target — freeze, poison, restrain.
> **Modifier verbs** act on the system — conduct, insulate, seal, catalyze.
>
> Modifier verbs are worth more per unit of complexity — each multiplies the interest of
> everything else rather than adding to the pile.

The modifier vocabulary already drafted there: **Amplify** (+1 application) · **Widen** (a second
type) · **Escalate** (one rung further) · **Catalyze** (fires at a lower threshold) · **Anchor**
(applications stop decaying) · **Volatile** (decay fast, hit much harder) · **Conduct** (reach
further) · **Insulate** (blocks spread — the counter to conduct).

A character's combination value is its **modifier surface**: what it makes bigger for others, and
what others can make bigger about it. That is the "value on each character" the discovery payoff
needs, and it should be what a card leads with.

## 3 · Where the current roster stands

Audited with `sim/verbs.js` and a self-sufficiency pass over `sim/roster.js`:

- **No character both applies and detonates.** Zero of twenty-one. Ash (`×2`), Cinder (`×3`) and
  Sump (`×1`) all seed and none can spend. Pyre spends and cannot seed. Three producers, one
  consumer, and the consumer is mandatory for all three.
- **Eight of twenty-one carry a hard dependency.** Ledger answers on `mark` with no marks of his
  own, so he is inert without Quill or Vitre. Tarn's thorns need a barrier source. Mire's thorns
  need someone to pull fire.
- **Eight of seventeen verbs exist on exactly one character**, so most chains have one possible
  shape.
- **Two characters have no verbs at all** — Corr (`dmg:25`) and Bosk (`dmg:17`) are pure stat
  blocks and can never be part of any combination.

## 4 · The restructure this calls for

Proposals, not decisions. The shape is: give every mechanic-carrying character a complete if modest
loop, then add modifier characters that steepen it.

**The DoT chain, worked through.** Today: Ash seeds, Pyre spends, and neither functions without
the other.

| | Now | Proposed |
|---|---|---|
| **Ash** | applies ×2, shreds 12 | applies ×2, shreds 12, **and her area attack consumes one stack per target for modest damage** |
| **Cinder** | applies ×3 | applies ×3, **consumes on her own single-target hit** |
| **Pyre** | detonates only | **applies ×1** and detonates everything at a high multiplier |
| *new* | — | **Amplify** — every application on the team lands one extra stack |
| *new* | — | **Escalate** — detonation multipliers are one step steeper |

What that buys:

- Ash alone — works, modestly
- Ash + Pyre — Pyre cashes a bigger pile than he could build. Strong
- Ash + Amplify — Ash's *own* detonations get bigger. A different shape, not a worse one
- Cinder + Pyre — different again; more stacks, no shredding
- Ash + Pyre + Escalate — the payoff

Five readings instead of one, from two added characters and one changed line each.

**Triggers, the same way.** Maul answers `break` at `2.2×` and carries no shred, so he waits on
someone else — though his `dmg:20` does break shields unaided when the element matches. Ledger
answers `mark` at `0.8×` with no marks at all and is simply inert alone. Both should be able to
produce their own trigger sometimes, with a modifier character raising the multiplier rather than
granting the condition.

**Triggers should overlap.** Three reactors answering three different events (`ally`, `break`,
`mark`) is three forced lines. Two reactors answering `break` at different ratios is a choice.

**Every verb on at least three characters.** Two is a pair; three is a decision about *which*.

**No character with zero hooks.** Give Corr and Bosk one condition each. Not a nerf — it makes the
big number draftable for a reason rather than by default.

## 5 · What cannot be settled yet

Neither simulation engine models element as a property of a character — see `sim/README.md`. So
whether the adverb table gives a *second* independent source of combinations (an order reactor
answering precisely and rhythmically where a chaos one answers unpredictably, per
`design-notes.md`) is unmeasured and unmeasurable until characters carry an element.

That is the prerequisite for the interesting half of the discovery question, and it is the same
change the element degeneracy needs.
