# Prototypes

Standalone, self-contained experiments. Each file runs by opening it in a browser —
no build step, no dependencies.

## watchable-fight.html

The battle-watchability spike. Establishes the combat core that the real game will be
built from:

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
six-encounter voyage runs through scaling battles to a final archive report. Battles use the original
`watchable-fight.html` engine and its complete animation choreography; the configured Ops formation,
rows, Gear, round pressure, and results pass between the two full-page views through saved run state.

Current limitations and verification evidence are recorded in [the systems audit](../docs/testing/spacology-v0.1.0-systems-audit.md). Crafting, Calls, modifier selection, and some Ops descriptions remain unfinished; this playable slice is not a complete implementation of the design.
