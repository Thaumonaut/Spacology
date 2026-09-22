# Ops systems playtest 2

This working build extends `f6fa566` plus the integrity/difficulty work. It is not a new published GitHub Pages release. The historical systems audit describes the earlier implementation.

## Implemented and connected

- Five front cells and seven support cells. Shared capacity still begins at four. Migrating an older eight-cell row returns overflow crew to inventory with their gear retained.
- Pack currency/materials are a compact credited receipt; five actionable cards remain. Card taps open details, per-card/bulk actions resolve ownership, and resolving the last card closes the pack. Opened contents and resolution state persist through reload.
- Ask / auto-scrap / auto-sell for owned crew in new packs. The original character and equipment remain untouched. Items still resolve manually; keeping a duplicate converts it to scrap.
- Material counters show real quantities, without the hardcoded attunement progress or overlapping descriptions.
- Basic gear costs 6 scrap. Five advanced recipes combine two gear items plus 8 scrap. Drag ingredients in Forge or select a recipe to preview and confirm. Equipped ingredients are eligible; the result replaces the first equipped ingredient, with all sources shown before payment. Inputs are consumed only when the recipe is valid and the output is unowned. Character details show portraits, gear effects, and removal to inventory. Crafted effects are applied by the live battle loader.
- Copy-based progression replaces material-paid ranks and Barracks. See [current rules and migration](copy-progression.md).
- Attunement spends 2 crystals for one copy of owned crew. New characters come from packs.
- Reserves hold six characters/copies. Three matching copies merge; ★★★ unlocks at field level 5.
- Recovery inbox records already-applied encounter rewards, rare items, duplicate conversion, actual integrity change and goal bonuses. Reading a receipt cannot claim it again. Final-report reload and inbox access work.
- Six route nodes update from the actual encounter index. The separate star atlas describes proposed homeworld systems, not those six encounter locations.
- One optional modifier before first launch, one at encounter four, category caps, and one removal from encounter three for 8 gold. Reinforced specimens: +25% enemy health / +20% victory gold; Volatile atmosphere: +20% crew and enemy direct attack damage; Salvage contract: packs +2 gold / completed encounters +6 gold. Effects apply to the live battle and reward calculations. Modifiers cannot change while a pack is open.
- Choose one voyage goal before first launch: six breaks, six chains, or three victories with no crew Down. The selected goal also determines each encounter's observation objective. Partial progress persists; completion pays 8 gold + 1 crystal exactly once.
- Department harmonies now count the deployed crew and describe the live engine's thresholds. Proposed ancestral-world harmonies share one runtime table across Ops, the atlas and combat: two members give +8% team base health; three give +15% instead; different worlds add.
- Crew descriptions reflect the current prototype kits. Coda uses Energy and Morrow uses Growth consistently in display and combat. Several characters still share underlying kits; this is not a finished unique roster.
- Undo is relabeled Dismiss, because it dismisses a notification.

Prices, homeworld affiliations and new effect values are provisional. See [the star-atlas proposal](../design/star-atlas-proposal.md) for the distinction between proposed ancestry and recorded birthplace.

## Verification

The 10 new `ops-systems.cjs` browser cases passed, covering ownership, spending, migration, persistence, combat effects, goal/reward rules and atlas navigation. The five integrity/difficulty checks and 13 retained regression cases also passed on this update. Two older assertions were updated for intentional behavior: the last front cell is now index four, and packs automatically close after bulk resolution.

A separate full voyage started with normal resources and random starters, bought packs and levels with earned gold, and equipped earned items through UI drag handlers. It completed all six encounters and produced six persistent inbox receipts. The first three actions ran with full animations; the rest used the real combat resolver with animation delays disabled. No wins, crew, gold or results were injected into that voyage.

Recorded enemy pools: 6 / 6 / 8 / 12 / 15 / 18. The test won all six and ended at 100 integrity. Survey Prism bonuses were earned during the run. Final-report reload and inbox access passed. This is one randomized run, not a balance guarantee. Detailed evidence is in [the voyage record](ops-systems-voyage.json).

Synthetic pointer checks also passed for horizontal browsing, canceled held drags and successful held drops without an accidental details popup. These test event handling, not physical Safari gesture recognition. Take All fits its panel.

Tablet browser screenshots were inspected at 1024×768. The Ops layout now has a minimum readable height and may scroll vertically on a ten-inch iPad instead of compressing every control. Physical iPad Safari verification remains necessary, especially touch dragging and scrolling. Older builds showed intermittent native-drag test failures.

## Still outside this implementation

- Calls, combat audio and persistent cross-voyage catalogue/unlock progression.
- Checkpointing an active battle at the exact action after browser suspension/reload.
- Ending the voyage automatically when integrity reaches zero.
- Offline query-URL navigation; the known service-worker fallback bug remains.
- Unique finalized character kits and distinct higher-tier effects for every world.

Use [the manual setup and checklist](manual-playtest.html) for playtest steps and a downloadable report. Re-run changed pack and formation checks even if they were marked passed on the previous build.
