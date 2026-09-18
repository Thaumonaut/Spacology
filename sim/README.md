# Simulation and balance tools

Headless models of the fight, used to measure builds without playing them. Plain Node, no
dependencies. All nine tools run — `cd sim && node <tool>.js`.

## Two independent engines

They were written separately and do not share code, which is useful: where they agree, the
finding is probably about the game rather than about one model.

| Engine | Driven by | Scores |
|---|---|---|
| `engine.js` | `ladder.js`, `counters.js` | Difficulty breakpoint per build, and a build × enemy matrix |
| `synergy.js` | `search.js`, `evaluator.js` → `pipeline.js` | Breakpoint per team per world, plus tag lift |

Shared data lives in `roster.js` — 21 characters, 6 tags with both tiers, 8 enemy archetypes,
6 world conditions. `builds.js` holds the hand-authored archetype teams; `pool.js` the draft pool.

## The tools

| Tool | What it does | Writes |
|---|---|---|
| `search.js` | Samples random fives, ranks them across five worlds, measures which tag counts actually lift a team | `search.json` |
| `pipeline.js` | Genetic search — `designer.js` builds characters on a fixed power budget, `composer.js` assembles rosters, `evaluator.js` scores power and watchability separately, survivors breed | `best.json` |
| `ladder.js` | Breakpoint per authored build | `ladder.csv` |
| `counters.js` | Build × enemy-archetype matrix, absolute and relative | `counters.csv`, `counters-rel.csv` |

`smoke/` holds five full-run harnesses that load a prototype's HTML, stub the DOM, and run it
headless. They caught real bugs a parser never would.

## Method rules, earned from failures

From `../docs/design/design-record.md` §10, and worth re-reading before trusting any new number:

1. **Calibrate the encounter first.** A plain team should win about two thirds and be able to
   lose both ways. Uncalibrated tests saturate at 100% and hide everything.
2. **Score by breakpoint, not win rate.** Win rate saturates; the difficulty a build still beats
   does not.
3. **Sweep every scalar, never sample one.** A ward mechanic read as worthless at 0.09 and worked
   at 0.30.
4. **Record how fights are lost.** Wiped and timed-out need opposite fixes.
5. **Score interest separately from power.**
6. **Vary the encounter as well as the team.**

And one more, from `pipeline-notes.md`: **tune `COST` in `designer.js`, not characters.** Costs
are the real balance surface.

## A known limitation: element is not modelled

**Characters have no element.** `roster.js` defines 21 characters across 25 properties — `tags`,
`dmg`, `sp`, `apply`, `stacks`, `shred`, `detonate`, `thorns`, `taunt`, `marks`, `trig`, `react`
and the rest — and **none of them is an element.**

Both engines assign it by array position instead:

```js
// engine.js:42  and  synergy.js:12   — the ally's element is its slot index
e: ELS[i % 6]

// engine.js:74  and  synergy.js:49   — the enemy's weakness is its spawn order
weak: [ELS[spawned % 6], ELS[(spawned * 3 + 1) % 6]], e: ELS[spawned % 6]
```

So a five-unit team always carries `order, chaos, growth, void, decay` in that order, whoever is
in it, and enemy weaknesses follow a fixed cycle. `isW()` then drives the shred rate and part of
target selection off those values.

**Harmony is not modelled at all.** `engine.js:35` declares `harmony: 0` in its parameter block
and no line of either engine ever reads it.

### What this does and does not invalidate

It is a legitimate *control*: because element is identical across every team compared, it cannot
bias a comparison between tags. So the **tag findings stand** — the breakpoint tables, the tag
lift figures, the enemy discrimination matrix, the finding that Crew is not a build.

What it means is that **the element axis has never been measured.** Any claim about weakness
coverage, about spreading versus stacking elements, or about Harmony's contribution is
unsupported by anything in this directory. `design-record.md` §5 states that six elements give
"roughly 89% coverage for a diverse team, which makes coverage a planning tradeoff rather than a
checklist" — no run here produced that number, and the same axis is degenerate in
`../prototypes/watchable-fight.html` for a related reason.

Giving characters a real element is a prerequisite for measuring any of it.

## Fixes applied on import

Both were startup failures, not model changes:

- The five `smoke/` harnesses read their prototype from `/mnt/user-data/outputs/…`, an absolute
  path from the machine they were written on. Now resolved relative to `__dirname`.
- `search.js` asked for a world named `blight`; `roster.js` defines `bloom`. Every call threw.
