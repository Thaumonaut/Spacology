# Handoff — moving from prototype to project

Companion to `design-notes.md` (the spec) and `explorations.md` (research). This file is for
whoever picks the project up in Claude Code, including future you.

---

## What exists

`voyage-bench.html` — a single self-contained file, ~2,700 lines, no dependencies. Two script blocks:

**Block 1: the simulation** (~700 lines, starts `/* Combat core v2 */`)
Pure logic. No DOM, no globals outside its own module scope, fully deterministic given a seed.
**This is the asset. Port it as-is.**

**Block 2: the interface** (~900 lines, starts `var SIDES`)
Screen functions that rebuild `innerHTML` wholesale. It works, it is not architecture.
**Rewrite this.**

---

## Recommended stack

**Vite + TypeScript, vanilla DOM or Preact.** Not a game engine.

Reasoning: the sim is already framework-free and tested; a turn-based auto-battler makes no demands
a canvas engine would satisfy; and Vite gets onto a real iPad the same day.

```bash
npm create vite@latest voyage -- --template vanilla-ts
cd voyage && npm i && npm i -D vitest
npm run dev -- --host          # then open the network URL on the iPad, add to home screen
```

Add to home screen gives full-screen with no browser chrome, which is close enough to a native feel
for design testing. Defer Capacitor until you want TestFlight.

---

## Structure

```
src/
  sim/                    # pure, deterministic, no DOM — unit tested
    types.ts
    elements.ts           # HEX, relation(), REACTIONS, thresholds, rung naming
    fight.ts              # createFight, step(), turn order, damage models
    effects.ts            # the fx vocabulary (hit, apply, guard, heal, delay …)
    ai.ts                 # priority-list evaluation
  data/                   # content as data, never as code
    units.ts
    enhancements.ts
    enemies.ts
    encounters.ts
    hulls.ts
    planets.ts
    attributes.ts
    tiles.ts
  run/                    # run state machine
    state.ts              # RunState + reducers, serialisable for save/resume
    economy.ts            # gold, interest, levels, crystals
    map.ts                # node sequence, act scaling
  ui/
    screens/              # planets, map, salvage, store, forge, refit, fight, end
    components/           # crew grid, enemy card, sigil, turn ribbon, pops, log
    density.ts
test/
```

**The one rule worth enforcing:** `sim/` and `data/` must never import from `ui/`. If they do, the
headless test harness stops working and balance testing goes with it.

---

## Port directly (proven, do not redesign)

- The hexagon element grid — `relation()`, fusion / annihilation / resonance, thresholds 3 / 7 / 3
- Full consumption of both elements on a reaction, and the three-element cap per target
- Action-value turn order and `order(n)` lookahead
- Guard staying at zero for the whole break window
- Priority-list AI, and the log naming which rule fired
- Variance profiles (fixed / tight / wide / wild) with crit as a top-quartile roll
- Wave structure with a field cap and a queue
- Reactor-output budget with a front-line duty
- Row bands (front / rear / any) with a shared middle
- Ranks: automatic stats plus one chosen enhancement, crystal cost 1 / 2 / 3

## Rewrite

- All screen rendering. Whole-page `innerHTML` per step is why pops needed the negative-delay trick
- Pop handling — a proper component with its own lifecycle removes that hack entirely
- Event wiring — currently rebound on every render

## Bring the test harness

The DOM-stub harness caught real bugs a parser never would, including the `hull` field-name
collision that silently broke every capacity call. Port it to **vitest**:

- `sim/` gets ordinary unit tests, no stubbing needed
- `run/` gets state-machine tests over the reducers
- Keep the balance sweep: every team × every encounter × every act, asserting win rates rather than
  single outcomes now that variance exists

---

## Open questions the bench should answer before more building

1. **Two rows or three.** Currently unresolved. Three gives the shared middle band, which is what
   makes Spindle interesting and gives row bands somewhere to overlap. Two is simpler and may be
   enough. *Test: play the same planet on a 3-row hull and a 2-row hull and see whether the middle
   rank ever felt like a decision.*
2. **Which damage model.** `front` flattens formation choice — testing showed near-identical results
   across every layout. `exposure` is where shape matters. `pool` is the outlier.
3. **Is twelve derived elements legible?** The polygon sigils were built to answer this. If you find
   yourself reading the text list underneath them instead, the notation is not earning its place.
4. **Does the shop ever feel tight?** The check is whether you regularly want two offers and can
   only afford one.
5. **Do rank enhancements read as meaningful,** or as numbers going up?

---

## Known gaps in the build (designed, not implemented)

- **Calls** — two player interventions per fight. Designed in notes §3c, entirely absent
- **The Break pause** — ZZZ-style "which unit responds", the main agency moment
- **Convergence** — the Elation-style scheduled team-wide window
- **Focus gauge** — crit as a charging bar rather than a variance roll
- **Enemy kits** — enemies still have one attack and a trait; players have four slots.
  *This is the largest single gap and explains why encounters feel thin*
- **Telegraphed enemy intent** — only bosses telegraph, and only their charge
- **Directives** — AI rule cards as loot
- **Decay, Burst, Attrition** archetypes — named in notes, never built
- **Pre-combat ability slot** (HSR's Technique) — noted as high value, never built

---

## Suggested first sprint

1. Scaffold, port `sim/` verbatim, get the existing tests green under vitest
2. Rebuild the fight screen only, properly — it is the screen you will look at most
3. Get it on the iPad and play five runs before writing anything else
4. Then close the enemy-kit gap, because it is what makes every other system matter

Do not port the whole UI first. The fight screen alone, on a real device, will tell you more than
another week of desktop iteration.
