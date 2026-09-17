# Design documents

Imported from the design conversations that preceded this repository. They are kept
verbatim, including where they disagree with each other — the disagreements are
themselves a record of what was tried and abandoned.

## Read this first

**`design-record.md`** is the current consolidated specification. Where any other
document in this folder contradicts it, this one wins.

## Current, supporting

| File | What it covers |
|---|---|
| `dictionary.md` | The controlled vocabulary, and the promotion/demotion rules that keep it from sprawling |
| `roster-design.md` | The six tags with measured breakpoint tables per world |
| `store.md` | The pack store and the scrap economy |
| `modifiers.md` | The world-condition pool and its category caps |
| `synergy-deep-dive.md` | Structural analysis of synergy systems, with ratings against this game's constraints |
| `synergy-notes.md` | Character-level combination testing |
| `pipeline-notes.md` | The genetic search over rosters — designer / composer / evaluator |
| `cw-teardown.md` | Teardown of the main reference point, with verdicts |

## Superseded exploration

Kept for the reasoning they record, not for current decisions.

| File | Describes | Why it is superseded |
|---|---|---|
| `design-notes.md` | Three defence layers, four ability slots, Calls, priority lists, and a fifteen-reaction element wheel | The reaction *wheel* and the four-slot framework did not survive into the design record. **The cosmology underneath it did — see below** |
| `character-matrix.md` | A four-axis character model — Element × Shape × Trigger × Payload, 1192 cells | The design record settles on two axes: tag and element |
| `explorations.md` | Research: what players reliably love and hate, an HSR teardown, rarity, monetisation | Conclusions that survived were folded into the design record |
| `HANDOFF.md` | Porting notes for `voyage-bench.html` | Predates the current prototype set |
| `tech-evaluation.md` | An engine survey across four addenda | Weighted a Switch release that is no longer a stated requirement |

---

## Not superseded: the cosmology

`design-notes.md` is filed above as superseded exploration, and for its *mechanics* that is
correct. But it also contains the setting's underlying physics, which is not a game-design
proposal at all — it is the author's own cosmology, and it is current.

**Six elements in three opposed pairs.** `order ↔ chaos` · `growth ↔ decay` ·
`energy ↔ void`. These are the building blocks of matter in this universe; combining them is
where the familiar elements come from — Water is Order + Chaos, Wood is Order + Growth, Fire is
Chaos + Energy, Stone is Order + Decay.

**Each element is an adverb, not a damage type.** This is the load-bearing idea, and it is the
one this repository initially lost:

> Order is fixed and predictable. Growth escalates. Energy is immediate and converts to tempo.
> Chaos is all-or-nothing. Decay is front-loaded and permanent. Void negates rather than reduces.

| Element | Shield | Heal | Advance |
|---|---|---|---|
| Order | fixed absorb, persists until spent | fixed amount each turn | permanent speed increase |
| Growth | starts small, grows while unbroken | heals more the longer the fight runs | gets faster every turn |
| Energy | absorbs, converts absorbed into speed | instant burst, nothing over time | large immediate jump |
| Chaos | holds fully then shatters for damage | nothing until an ally is low, then enormous | acts twice, then loses a turn |
| Decay | starts enormous, shrinks each turn | heals now, reduces max health | fast now, slower later |
| Void | deletes one hit entirely, any size | undoes damage already dealt | skips the enemy's turn instead |

One verb becomes six characters. An Order follow-up is precise and rhythmic; a Chaos follow-up
is unpredictable. **The element says how a character acts.**

Distinguish the two things when reading `design-notes.md`: the fifteen-reaction wheel is a
mechanic that was cut, and reasonable to cut. The six primitives, their oppositions, and the
adverb table are the setting, and are not up for redesign.
