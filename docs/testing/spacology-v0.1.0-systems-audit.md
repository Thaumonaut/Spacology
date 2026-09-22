# Spacology v0.1.0 systems audit

Audited 2026-09-21 against the local working tree, including the pending tablet, pack, equipment, and wave changes. This is not verification of the currently published GitHub Pages build. Concurrent title-screen/enemy-art edits arrived after the full-voyage run; those changes are outside this audit’s verified snapshot.

**Verdict: the six-encounter playable loop works, but several visible systems remain mockups or disagree with combat. This is not a fully implemented prototype.**

## What was exercised

A fresh browser session started with the normal 42 gold, three random reserve characters, and an empty formation. The audit purchased packs, kept rewards, placed crew, equipped earned gear and ship items through drag handlers, bought field levels with earned gold, and launched all six encounters through Ops. It did not inject crew, money, wins, or battle results into this voyage.

Combat used the real resolver with animation delays disabled (`MODE='none'`) for the six-encounter test. Separate animation checks cover live staging, target markers, layout, and counters; this is not exhaustive validation of every animation branch.

The recorded voyage won all six encounters, received 34/40/46/52/58/64 gold, triggered 37 ultimates, and reached the final report. Enemy pools were 6/6/8/12/15/18 across 2/2/2/3/3/3 waves. Each result applied once and was consumed on return to Ops. No page errors occurred. One successful randomized voyage does not establish balance or guarantee every starter team can win.

Raw results: [audit evidence](spacology-v0.1.0-audit-evidence.json).

## System status

| System | Status | Evidence / limitation |
| --- | --- | --- |
| New voyage and starter roster | Working | Three reserve crew, including a front-compatible character; empty field is allowed; empty-field launch is blocked. |
| Crew deployment | Working in Ops | Capacity and row restrictions enforced; selected cell retained; returning the final front character is allowed. Battle preserves names and rows but compacts occupied cells instead of preserving empty cell positions. |
| Field progression | Working | Alternates character capacity and ship slots; charges escalating gold cost. |
| Pack purchase, refresh, random contents | Working | Three offers, paid refresh, randomized card contents; keep/sell/scrap, drag destinations, bulk actions. Reloading during resolution loses unclaimed cards (see below). |
| Pack resale economy | Working under current values | Automatic gold plus selling all five cards yields less than each pack's price. No balance claim beyond this specific anti-arbitrage check. |
| Crew sale/dismantle | Working | Pays currency/materials and returns attached gear. |
| Gear and ship equipment | Implemented, partial coverage | Slots, replacements, reserve ownership and combat modifiers exist. Regression tests cover selected effects and ownership paths, not every effect/character combination. Desktop native-drag checks had intermittent failures before passing; physical iPad testing remains necessary. |
| Combat and ultimates | Working core | Real resolver, targeting, energy, damage, breaks, chains, and ultimates ran across the voyage. No iframe. |
| Scaling enemies, elites, waves | Working | Increasing counts/HP, larger elite cards, wave transitions, remaining-enemy counter, stable enemy dock dimensions. |
| Battle controls | Partial | Autostart, play/pause and log toggle work. Session Calls and selectable combat settings are not connected. |
| Recovery and voyage summary | Partial | Gold, combat stats, crystals/items, observation status and final report appear. Finished-state reload and integrity reporting have gaps. |
| Rare crystals/items | Working rewards | Random drops, crystal pity, post-battle application. Duplicate rare gear equipped to reserve crew was fixed during this audit. |
| Character abilities shown in Ops | Incorrect / divergent | `crewKits` is separately authored from battle `TEAMS`. For example Ops Ash promises break-triggered Reprisal, while the live loader uses Ash's Blight/Decay seeder kit. Coda, Morrow and Spore borrow Vane, Ash and Sump kits respectively. Matching names/portraits/stats does not make these descriptions accurate. |
| Harmonies | Combat implemented; Ops rail is a mockup | Ops shows reached breakpoints even on an empty field and does not update when crew change. Combat counts Hull/Blight/Drive/Ordnance/Assay/Crew; the Ops rail mixes different names, thresholds and effects. |
| Observations/fieldwork | Placeholder objective integration | Ops asks to observe Quickstep acting twice. Live battle awards completion for at least two breaks OR two chains. These are different objectives. No selectable per-world observation system or catalogue reward flow. |
| Forge / combining / upgrading cards | Not implemented | Opens descriptive text only. No recipe resolution, drag-to-combine operation, or scrap spending path. |
| Attunements | Not implemented | Descriptive text only; inventory's Order attunement `3 / 20` is hardcoded. |
| Barracks | Not implemented | Describes a 120-gold recruitment option but offers no recruitment controls. |
| Inventory management/filtering | Not implemented | Manage describes filters but does not offer them. Tabs are real; advanced filtering is not. |
| Difficulty/modifier selection | Not implemented | Describes Survey III/Scarce Salvage; no selection or corresponding modifier state in the live loader. Enemy progression is real but only round-based. |
| Route/map | Mockup | Round number updates, but node completion and named destination remain static. |
| Calls | Not connected to live combat | Ops promises two Calls. Focus/Hold handlers exist only for the unused embedded battle, not the active watchable-fight session. |
| Ops pause | No action | Visible button has no handler. Ops itself is not advancing in real time. |
| Undo | Misleading placeholder | Button hides toast; it does not reverse purchases, upgrades, sales, or placement. |
| Saving/resume | Partial | Formation/resources persist. Opened-pack transaction and completed-voyage state are not restored correctly. Active battle progress is not checkpointed. |
| PWA installation | Working metadata/registration | Manifest, standalone display, icons and service worker register. No physical iPad home-screen installation validation in this audit. |
| Offline play | Broken for first unvisited battle URL | Cache contains bare `watchable-fight.html`; navigation adds query parameters. On offline cache miss, worker returns Ops HTML at the battle URL. |
| Persistent catalogue, recipes and unlocks | Not implemented | No cross-voyage discovery/progression loop in these screens. |
| Reactive crew exchanges and combat audio | Not implemented in live session | No connected dialogue/reaction system or audio playback path found. |

## Confirmed outstanding bugs

1. **Paid pack contents lost on reload.** Open the first pack at 42 gold, leave all five actionable cards unresolved, reload. Gold remains 35; the cards disappear and offers return. `activeCards`/`resolved` are transient, outside saved run state.
2. **Finished voyage can continue after reload.** Finish encounter six and return to Ops: final report appears. Reload: saved round seven remains, but the final overlay does not reopen and Continue is available.
3. **Offline battle loads the wrong screen.** Load Ops online and allow caching, switch offline, then launch a first battle. URL becomes `watchable-fight.html?spacology=1&round=1`, but title/DOM are Ops and `#sessionControls` is absent.
4. **Undo performs no undo.** Buy a field level, press Undo: level/gold stay changed. The handler only removes the toast's `show` class.
5. **Displayed integrity gain may exceed applied gain.** Wins show +5% at 100% integrity, while application clamps to 100%. The report displays nominal reward, not actual change.

The static controls, mismatched abilities, harmonies, and observation rules above are separately confirmed functionality gaps, not hidden working systems.

## Recommended completion order

1. Define one shared crew/ability/harmony model used by Ops details, pack hints and the battle resolver. Surface actual effects so team-building decisions are trustworthy.
2. Persist pack resolution and voyage completion as explicit run phases; handle interrupted battles and offline URL routing. Remove or implement misleading Undo.
3. Implement the two-item crafting flow and actual uses for scrap/crystals. Resources currently accumulate without the advertised spending loop.
4. Connect Calls, round settings, observations and modifier selection to the active battle engine; derive the route and objective displays from run state.
5. Validate on physical iPad Safari, including interrupted drags, browser suspension, offline launch and a full voyage. Then measure economy and difficulty across many starters/builds.

No new implementation was invented for these incomplete design systems during this audit. They require coherent gameplay rules, not just active-looking buttons.

## Review-loop result

Bug-hunter: **3 iterations, 10 fixes, 0 refutations; capped, not clean.**

- Iteration 1: six fixes — effect wiring, material quantity/type, equipment return, drops over gear diamonds, randomized pack contents, simultaneous rare-reward display.
- Iteration 2: three fixes — sparse ship slots, consistent Prime/duplicate resolution, shared displayed/combat stats.
- Iteration 3: one fix — rare rewards now use the shared ownership check, including gear attached to reserve crew. Matching regression observed red, then green.

The final ownership fix has a passing regression but has not had a subsequent independent finder pass: iteration three exhausted the skill's review budget. No clean sign-off, commit or deployment was made. The broad systems findings above are separate from the ten fixes in that staged-change review.

Final checks: all ten retained regression cases passed in isolated reruns. Live staging/target reaction, wave scaling/layout, a complete first battle and PWA registration also passed. Two older pack tests were initially blocked by the newly added title screen. Both passed after temporary harness copies entered Ops through its new entry button; their assertions were unchanged. Retained interaction regressions now also enter through that button. The full voyage was not repeated after the concurrent art edits, so the latest tree still lacks full-scope verification. Intermittent native-drag failures also occurred before isolated passes; no claim of universally reliable touch/drag behavior is made.

The staged and working copies of both prototype HTML files now differ due to concurrent work. Those edits and the new art assets were preserved, not staged or reverted by this audit. The ownership fix in the JS file is left uncommitted.

Follow-up: the final reward-ownership fix subsequently received a fresh independent review with no new scoped findings. See [reward ownership review](reward-ownership-review.md). The other systems findings above remain open; this is not a whole-game sign-off.
