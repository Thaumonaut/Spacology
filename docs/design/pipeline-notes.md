# The design pipeline

Three stages, run in generations. Characters that keep appearing in good rosters
survive and get mutated; the rest are replaced.

```
node pipeline.js <generations> <rosters per generation>
```

| file | job |
|---|---|
| `designer.js` | builds a character inside an archetype template, on a fixed power budget |
| `composer.js` | assembles rosters that reach a tag threshold and satisfy applier/spender |
| `evaluator.js` | scores power and watchability separately, then combines them |
| `pipeline.js` | runs the loop, credits characters, breeds the survivors |

## The power budget is what makes it honest

Every character spends 100 points. A point of damage costs 2.6, a point of thorns
costs 9, an area attack costs 26 flat. A generated character cannot simply be better
than another — it can only be *shaped differently*. Change a cost and the whole
search shifts, which makes `COST` in `designer.js` the most important object here.

## Two failures worth keeping in mind

**Unconstrained search finds one answer and stops.** The first run returned five top
rosters and all five were Blight. Fitness rewarded power, Blight had the most power,
and the search never looked anywhere else. Fixed by **niching** — each archetype is
scored against its own kind, so a strong one cannot crowd the others out.

**A power cap does nothing.** With `min(1, avg/2.4)` every serious roster scored 1.0
and fitness was decided entirely by the interest term. Replaced with a distance-from-
target score, so being *too* strong is penalised the same as being too weak. That one
change is what let Hull, Drive, Ordnance, Crew and Blight all land within 0.04 of
each other.

## What it found

After four generations, best per archetype:

| archetype | fit | power | interest | avg | spread | notes |
|---|---|---|---|---|---|---|
| Hull | 0.734 | 0.96 | 0.51 | 2.30 | 2.6× | three guards and one payback carry |
| Blight + Crew | 0.723 | 0.92 | 0.52 | 2.59 | 2.6× | two seeders, two menders, one reader |
| Blight + Hull | 0.715 | 0.83 | 0.60 | 2.80 | 2.6× | seeders shielded by a payback carry |
| Ordnance | 0.709 | 0.97 | 0.44 | 2.34 | 2.4× | one hammer, two answers, a guard |
| Blight | 0.702 | 0.71 | 0.70 | 1.70 | 2.5× | three igniters, two seeders |

Six archetypes inside 0.10 of one another, all with a 2.4–2.6× spread across worlds.
That is the shape to aim for: no dominant build, and every build strongly
world-dependent.

**The most interesting result is #3** — Blight seeders behind a payback carry. Nobody
designed that. The seeders are fragile and want time; the payback carry draws fire and
buys it. Two archetypes that were written for different purposes, combining because of
what the encounter demanded. That is the thing the pipeline exists to find.

## What this does not produce

Characters. It produces **kit skeletons** — shapes worth writing a person around. A
generated `seeder [Blight] sp:113 dmg:10 apply:1 stacks:2 shred:14 spread:1` is not
Quill; it is the argument that Quill should exist. The writing is still the part that
makes anyone care, and no search can do it.

## Sensible next moves

- Widen `TEMPLATES` — every new template is a new kind of character the search can invent
- Tune `COST` rather than tuning characters; costs are the real balance surface
- Add planet conditions to the fitness so a build can be judged on being *situationally*
  excellent instead of broadly fine
- Feed winners back into `roster.js` as named characters once they earn a name
