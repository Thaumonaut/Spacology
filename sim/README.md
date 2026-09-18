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
`dmg`, `sp`, `appliesDot`, `dotPerHit`, `armorShred`, `detonate`, `thorns`, `taunt`, `marks`, `procOn`, `procMax`
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
bias a comparison between tags, so tag comparisons remain meaningful **once the engine itself is
sound** — which, before the fixes below, `synergy.js` was not.

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

## Two bugs found and fixed, and what they invalidate

Both were in `synergy.js`; `engine.js` was unaffected.

**Enemies never took a turn.** Foes spawned with
`av: (10000/p.sp) * (.4 + rnd()*.7) * BON.foeSlow`, and `BON` has no `foeSlow`. Every foe's action
value was `NaN`, `NaN` never sorts to the front of the turn order, and no foe ever acted —
measured at zero foe turns across sixty fights at three difficulties. The crew was scored against
a board that could not hit back, and the only loss condition was the twenty-round limit.

**Ailment ticks made enemies unkillable.** The tick on a foe's own turn multiplies by
`BON.tickMul`, also never defined, so the tick was `NaN` and took the foe's health to `NaN` with
it — and `NaN` fails every `<= 0` test. Dormant only because foes never had turns, so fixing the
first bug activated the second. 213 foes reached `NaN` health in twenty fights before the fix and
none after. The Bloom's identical formula hardcodes `1.0`, which is why 1 is the intended value.

This is the failure mode the design record already documents under *"bugs that produced confident
wrong answers"* — enemies with no action value field, undefined arithmetic, an eleven-round fight
with zero enemy actions reading as *"placement does not matter"*. Same shape, different engine.

### What the correction reverses

The top team fell from `6.44` to failing at difficulty `3.0`. Everything scored through
`synergy.js` before the fix is void, including the breakpoint tables in `roster-design.md`,
`synergy-notes.md` and `pipeline-notes.md` — whose headline conclusions were that the healing
build and the shielding build underperform. In a model where nothing attacks you, that is
arithmetic rather than a finding.

Re-measured, the picture inverts:

| | before | after |
|---|---|---|
| Most load-bearing constant | `VULN_BONUS`, a damage amplifier, at 44.7% | `ARMOR_PER_LAYER`, shield depth, at 56.2% |
| Least | `BREAK_DELAY` at exactly 0.0% | `BREAK_DELAY` at 5.7% |
| Best deep tag | `DPS×4` at +47% | `Breaker×4` at +37.5%, the only monotonic curve |
| Worst | `Healer×4` at −54% | `Healer×3` at −29.9% |
| Mandatory character | Ash: in 12 of top 12, banning her cost 37% | nothing above 16%; Ash costs 11% |

**Always confirm a constant does something before concluding it does not matter.** `BREAK_DELAY` reading
exactly zero across its whole range, including at `10`, is what exposed both bugs.
