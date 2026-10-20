# Design documents

Imported from the design conversations that preceded this repository. They are kept
verbatim, including where they disagree with each other — the disagreements are
themselves a record of what was tried and abandoned.

## Read this first

**`glossary.md`** is the working vocabulary — standard industry terms only, and what each
one replaced. The older documents in this folder predate it and still use the custom names.

**`design-record.md`** is the older consolidated combat/voyage baseline. It remains useful for topics not revised below; it does not override the newer three-team/station-game decisions. Proposals and isolated labs are not silently promoted to implemented rules. See the [repository map](../../README.md) for the latest source checkpoint and [reuse guide](../architecture.md) for code ownership.

## Newest working direction

**`three-teams-and-station-games.md`** records the user's decisions from 6–14 October 2026: the three modes
(Exploration, Research, Logistics) on one globe, the asynchronous day/night clock, affixes vs exploration
environment vs research assistance, the voyage phase and research's targets, the twelve station games and the
playtest rules they follow, and what is still open. On those topics it is newer than `design-record.md`; its
§12 lists where the older documents disagree.

## Current, supporting

| File | What it covers |
|---|---|
| `glossary.md` | The working vocabulary: roles, character properties, enemy archetypes, combat constants |
| `combat-engine.md` | The shared combat engine: what labs and sims can use from `prototypes/shared/combat/combat-core.js` (hooks, per-fight rules, metrics), and its open questions |
| `enemy-catalogue.md` | Enemy factions, Null progression, hero specimens, and the procedural frontier grammar |
| `crew.md` | The current 28-character lore cast, relationships, field names and species mix |
| `art-direction.md` | Shared painterly anime/JRPG portrait language and species-specific constraints |
| `visual-identity.md` | Working logo system based on *Star Singer*'s aft ring and hull silhouette |
| `measurements.md` | **Generated.** Every number from the simulation — role lift, strongest teams, the mandatory-character test, constant sensitivity, worlds, verb census |
| `decisions.md` | The naming proposal, three bugs found checking it, and the open questions |
| `character-construction.md` | How a character is built — the uniqueness rule, self-sufficiency versus amplification, and where the roster falls short |
| `discovery-findings.md` | Measured: can players find combinations nobody designed? |
| `dictionary.md` | The controlled vocabulary, and the promotion/demotion rules that keep it from sprawling |
| `roster-design.md` | The six tags with measured breakpoint tables per world |
| `store.md` | The pack store and the scrap economy |
| `team-roles-and-acquisition-plan.md` | **Proposal:** primary combat roles, team engines, enemy-pressure experiments, sustain revisions, and reliable character/gear acquisition |
| `voyage-team-building-design-panel.md` | **Exploration:** five independent agent perspectives on growing pouches and alternative puzzles across a 20+ node voyage |
| `modifiers.md` | The world-condition pool and its category caps |
| `run-variety-proposal.md` | **Design revision:** three seven-node sets, basic/elite/boss formats, reward nodes, and one modifier selection per set |
| `weaver-voyage-walkthrough.md` | **Clean-sheet exploration:** Aether profiles for every character (generator, cadence, consumer, Weaver), and the Weavers as the build / hold / spend triangle, traced across a full voyage from each starting pair — selection order, Aether-keyed equipment sets and the burst-ceiling power curve |
| `session-progression-proposal.md` | **Proposal:** deterministic requisition, the Charter pool, ranks as clauses rather than stats, six design lenses, and the argmax-churn variety test |
| `recovery-inbox-and-equipment-proposal.md` | **Proposal:** top-left tiered reward caches, consumable adjustment tools, visible illustrated equipment, and direct equipping |
| `synergy-deep-dive.md` | Structural analysis of synergy systems, with ratings against this game's constraints |
| `synergy-notes.md` | Character-level combination testing |
| `pipeline-notes.md` | The genetic search over rosters — designer / composer / evaluator |
| `cw-teardown.md` | Teardown of the main reference point, with verdicts |
| `affix-team-building.md` | **Prototype:** match-wide affixes that decide the team, open requisition with vouchers and upkeep, and random equipment as the only gamble, measured in `prototypes/affix-lab.html` and `sim/affix-lab.js` |

## Deferred expansion ideas

| File | What it preserves |
|---|---|
| `fantasy-factions-proposal.md` | Goblins, undead, vampires and other possible future peoples and enemies. Deferred at the user's request; outside current work. Treasure carriers remain part of the current rewards proposal and can use existing factions. |

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

## Playable Aether Weavers

[The first six: lore, portraits and kits](aether-weavers.md). Open `prototypes/aether-weavers.html` for the cast page and isolated test voyage.
