# Prototypes

Stable public HTML entry points backed by grouped implementations. Open **[the playtest library](minigames.html)** for current tests, the preserved demo, and labeled studies/archive. Serve with `npm run serve`; use `npm run build:pages && npm run serve:pages` for the complete site including the two built apps.

Implementation map: `demo/` is the preserved voyage; `minigames/<id>/` holds each game's model/controller/styles; `labs/<name>/` holds independent experiments; `shared/` holds combat, voyage, minigame shell, and menus. Public page URLs stay here for compatibility. See [architecture and reuse](../docs/architecture.md).

## element-pairs.html

An isolated Research candidate in the playtest library's Reserve section. Its model, controller and styles live in `minigames/element-pairs/`; the public entry point reuses the shared mini-game shell and Aether element names/glyphs. Clear identical or opposing elements (Order/Chaos, Growth/Decay, Energy/Void) along rows, columns or 45° diagonals. Horizontal matching also wraps in reading order between rows in either direction. Every intervening element blocks; gaps stay in place unless an entire row clears and rows below move up.

The 8-column, 24-row board shows eight rows at a time. Start with 36 elements and four reserve batches of 36; each batch appends after the last occupied cell rather than filling internal gaps. Clear the board to finish, even with reserves unused. There is no timer, gravity, recipes or voyage rewards.

Tap to select and pair; use Undo, Hint, optional partner highlighting and Retry seed. Arrow keys move focus, Enter/Space selects, and Escape deselects. An exhausted attempt can be undone before explicitly finishing. Hints identify legal pairs, not a guaranteed winning route. Reload restarts the seed; in-progress boards are not autosaved. Results, ratings and export reuse MiniGameKit.

Run `npm test -- element-pairs minigames-hub` for model and headless browser checks. The focused [OpenSpec change](../openspec/changes/add-element-pairs/proposal.md) records scope and prototype defaults.

## relay-runner.html

An endless combat runner sketch. Drag or use A/D or the arrow keys to steer while the ship fires automatically. Shoot through one of three upgrade walls, enter the open lane to collect its power, and survive increasingly large enemy waves. Hull damage ends the run; distance and a local personal best give each attempt a score. The pause button and P/Escape pause the simulation. This experiment is separate from the current voyage build.

Its 2.5D, instanced-rendering follow-up lives in [`../runner-next/`](../runner-next/README.md).

## minigames.html

Station games for the two support teams. The full design, the decisions behind each game and the playtest rules
are in [`docs/design/three-teams-and-station-games.md`](../docs/design/three-teams-and-station-games.md). Each
game is generated from a seed, proven solvable by its own solver, and has hints, undo, assist levels, an automatic
fallback (Skip) and a result card with a near-miss line. The hub groups them by team and records play counts and
separate fun and annoyance ratings in this browser; "Export playtests" downloads them.

| Page | Team · phase | Inspired by | Produces |
|---|---|---|---|
| `aether-attunement.html` | Research · night | Flood-It | Boss study: buffs removed, weakness found |
| `sensor-grid.html` | Research · night | Catdoku / Queens | Elective fight scouted, difficulty lowered |
| `dna-sequencing.html` | Research · night | Shotgun sequencing assembly | Research assistance card flaws cleared |
| `signal-decoding.html` | Research · day | Cyberpunk 2077 Breach Protocol | Blueprints for logistics |
| `intel-check.html` | Research · day | Papers, Please | Verified manifests; Null sabotage stopped |
| `core-assay.html` | Research · day | Spectrometry peak matching | Resource nodes for logistics |
| `supply-run.html` | Logistics · night | Walk-and-collect idle games | Raw resources and crafted parts |
| `gear-pack.html` | Logistics · night | Backpack Battles | Gear kits exploration ordered (the user finds this one unfun; open) |
| `pallet-stacking.html` | Logistics · night | Honkai: Star Rail cargo stacking | Rockets: gear to the front, samples to the lab |
| `route-planning.html` | Logistics · day | Mini Motorways / Cities: Skylines | The road network, built at night, watched by day |
| `pipes.html` | Logistics · day | Rotating pipe puzzles | Base production layout |
| `depot-sorting.html` | Logistics · day | Water-sort puzzles | Arrivals sorted for tonight's production |
| `synergy-links.html` | Reserve | Flow Free | Not assigned to a team |

`shared/minigames/minigame-kit.js` and its CSS are the shared frame: the registry (`GAMES`, with `role` and `phase`),
seeded randomness, meters, timer, result card, playtest storage, and an embedded station mode that posts
`spacology:minigame-result` to a parent page. Each game's rules live in its `*-model.js`, tested by
`tests/unit/<game>.cjs`; `tests/browser/<game>.cjs` and `tests/browser/minigames-hub.cjs` play them headlessly.
Long runs should use `caffeinate -i npm test` so the Mac cannot sleep mid-test.

## team-building-lab.html

Isolated team-building experiment: compare two-recruit packs, choose-one drafts, and nominated recruitment guarantees over six preparation stages. Test hypercarry, ultra-break, DoT, retaliation, and multi-carry formations, assign gear, and export decisions and enjoyment ratings. A free-build sandbox exposes all recruits, gear, and encounter profiles. The shared model also runs in `sim/team-building-lab.js`; these are experimental rules, not live combat balance. See [play instructions, results, and limitations](../docs/testing/team-building-lab.md).

## watchable-fight.html

The reusable animated battle stage used by the preserved demo. Rules live in `shared/combat/combat-core.js`; choreography and stage styling live alongside it in `battle-presentation.js` and `battle-stage.css`. The following describes its original design; current rule constants remain in the shared modules:

- **Turn order** — speed-based ATB (`av = 10000/sp`) with a visible track of upcoming turns.
- **Elements** (`order, chaos, growth, void, decay, energy`) — enemies carry two weaknesses.
  A matched element shreds shields at full rate, unmatched at 20%. Breaking a shield also
  fires a free chain hit from every ally sharing the breaker's element.
- **Departments** (`Hull, Blight, Drive, Ordnance, Assay, Crew`) — TFT-style traits with a
  2-piece and a 4-piece bonus.
- **Shields → break → vulnerable** — layered shields that must be shredded; a break delays
  the enemy's turn and opens a damage window.
- **Energy and ultimates** — ultimates fire as an *interrupt*, costing charge rather than a
  turn, gated by a per-archetype policy (`ultPolicy`) that explains its own reasoning.
- **Targeting profiles** — `finisher, breaker, tactician, bully, opportunist`, each a weight
  vector over target features, surfacing a human-readable reason for every pick.
- **Time as the resource** — a round limit, where losing a crew member costs two rounds.
- **Carry-over** — injuries persist between fights.

The architecture worth keeping: `resolveAction()` resolves an entire action against game
state and returns a plain event object; `playAction()` then animates that event. The
simulation never depends on the animation, which means fights can be run headlessly for
balance testing and replayed deterministically.

## worldgen.html

A tectonic world editor with a separate alien environment layer. Open the file in
a browser; no server or dependencies are required.

- Expand **Terrain & climate settings** to choose plate count, relief, ocean level
  and climate, then **Generate terrain**. Generating terrain resets environment edits.
- **Plates** shows collision belts, subduction trenches, volcanic arcs, spreading
  ridges, rifts and transform boundaries. This is a procedural approximation of
  plate interactions, not a time-stepped geological simulation.
- **Environment** shows lava fields, neutrino seas, glass deserts and luminous
  forests. **Place environments** deterministically distributes them according to
  abundance, coherent spatial variation and terrain suitability. Abundance is a
  placement threshold, not a target percentage of the world.
- Choose a brush and drag on the map. Suitability limits lava to volcanic belts,
  neutrino seas to ocean/low ground, glass to dry land, and forests to moist land.
  Turn suitability off to author exceptions. Erase restores the underlying climate
  biome; **Undo edit** restores one of the last twelve layer edits.
- The neutrino-sea animation is an illustrative material study. Globe rendering
  includes emissive materials; neither view simulates fluid physics or rain zones.
- **Save world / Load world** round-trips the seed, terrain configuration and painted
  cells in a versioned JSON document. Loading rebuilds terrain with `tectonics-v1`;
  future changes to terrain generation must bump that identifier or migrate saves.
  Keep these JSON files as source assets. **Export map PNG** exports the current map
  or globe; the report and material study are not part of the image.
- Environment edits never mutate elevation, drainage, climate or climate biomes.
  Existing settlement generation and reports still describe the underlying climate;
  alien hazards do not yet affect settlement, battles or research mechanics.
- **Export conditioning** retains the existing Terrain Diffusion bridge through
  `tools/cond_to_tiff.py`. This prototype does not execute Terrain Diffusion or import
  Azgaar maps. The world JSON preserves the alien layer separately from physical
  conditioning, so fictional sea materials are not interpreted as water/climate data.

Browser verification covers terrain invariance after environment changes, undo,
seeded save/load reconstruction, invalid-save rejection, zero abundance, pointer
painting, downloaded-save reloading, independent globe latitude/climate tilt,
and tablet overflow. The animated study respects reduced-motion preferences and
pauses while its view or browser tab is hidden.

## spacology-v0.1.0.html

The first playable vertical slice of Spacology. Open it directly in a browser and play the Ops room
setup, pack decisions, and full animated battlefield:

`Ops room v5 → pack opening → inventory / formation setup → fieldwork → animated combat`

The prototype uses the current progression assumptions: four starting character slots, one required
on-field character, one ship equipment slot, pack prices in the 11–14 gold range, direct keep/sell/scrap
card decisions, and rising enemy health, field size, and wave counts. Ops and combat share one session state.
Characters and equipment can be dragged to their destinations, packs have a Take All action, and a
three-sector, 21-node voyage runs through scaling battles to a final archive report (legacy six-encounter saves remain supported). Battles use the original
`watchable-fight.html` engine and its complete animation choreography; the configured Ops formation,
rows, Gear, round pressure, and results pass between the two full-page views through saved run state.

Current limitations and verification evidence are recorded in [the systems audit](../docs/testing/spacology-v0.1.0-systems-audit.md). Crafting, Calls, modifier selection, and some Ops descriptions remain unfinished; this playable slice is not a complete implementation of the design.

## affix-lab.html

Affix team-building lab. Every voyage rolls a Brief (0–4 match-wide conditions within the category caps and compatibility rules, plus three bosses) before any choice. Any of 23 crewmates can be recruited, across six team types that each include their own sustainer: two start free, vouchers open berths 3–6 at rising prices (straight from the roster when every berth is full), and crew beyond four cost upkeep. Each battle's enemy strength is derived from what a themed crew can afford by then, with a gentler sector 1. The only random purchase is equipment, three offers per stop with rising rerolls. Battle reports state what each condition did, and a session log shows how much of the crew carried over between voyages. The model (`affix-lab-model.js`) also runs headless in `sim/affix-lab.js`. See [the design](../docs/design/affix-team-building.md) and [the lab notes](../docs/testing/affix-lab.md).

## weaver-voyage-lab.html

Weaver voyage lab: a full 21-node voyage with 19 crew. The seven Aether Weavers plus four families: Break, Blight (poison), Hull (returned damage) and Drive (follow-ups). Crew are bought with vouchers and promoted ★1–★4 with Insight, and ★3 upgrades each kit. Gear is 5-piece sets on HoYoverse's pattern (a stat at 2 pieces, an action-keyed perk at 5, plus threshold, conversion and team-buff sets), in ★1–★4 tiers bought in two-set packs. The voyage opens with two Supply runs. Enemies carry caches that are opened on the Prepare screen, and every voyage rolls a Brief of 0–4 affixes. The model (`weaver-voyage-model.js`) runs headless in `sim/weaver-voyage.js`. See [the walkthrough](../docs/design/weaver-voyage-walkthrough.md) and [the lab notes](../docs/testing/weaver-voyage-lab.md).
