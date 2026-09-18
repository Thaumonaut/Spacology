# Spacology

An auto-battler about cataloguing life in a star system before the plague reaches it.

You crew a research vessel. Each leg offers three destinations with independently rolled danger
ratings, so **choosing where to go is choosing your difficulty** — there is no slider. Between
legs you are in the ops room drafting crew from themed consignment packs, stripping what you
cannot use into element shards, and promoting who you keep. Then the fight runs itself and you
watch. Fights score on the share of the board's points you take, not on win or lose, and the
result moves your **fidelity** — the quality of the record you are trying to bring home. It starts
at 70% and you are trying to raise it.

The design goal is the **payoff**: you spend time tuning a team, then watch it pay off. A follow-up
that keeps chaining. An area attack that clears the board. Enemies dying one after another to a
thorn carry they should not have touched. And the one that has to be earned rather than authored —
finding two characters who work together in a way nobody planned.

Premium, no gacha. Built to be played on an iPad before sleep.

## Where things are

| | |
|---|---|
| **`docs/design/`** | The design corpus. **Start with `design-record.md`** — it is the current specification and wins wherever another document disagrees. `README.md` there sorts current from superseded, and `decisions.md` holds the naming proposal and the open questions |
| **`prototypes/`** | Playable builds, each a standalone HTML file that runs by opening it. `watchable-fight.html` is the combat spike and the best asset in the project; `ops.html` is the economy loop end to end; `voyage.html` wraps the run around real combat |
| **`prototypes/animation/`** | Ten studies of staging, rhythm and effects — the groundwork for "fun to watch with almost no artwork" |
| **`prototypes/superseded/`** | Earlier builds, kept because they record what was tried |
| **`mockups/`** | Six visual studies, including four candidate directions for the board |
| **`sim/`** | Two independent headless engines and their tools. See `sim/README.md` — it documents what runs, the method rules, and one significant gap |

## State of play

The mechanical design is settled and measured; much of it is built across three prototypes that
each work but do not yet share a codebase. Nothing is consolidated into an application, and the
simulation is not yet deterministic, so balance numbers are not currently reproducible.

Two known problems, both recorded in `docs/design/decisions.md`:

- **The element axis does not work.** Every preset team carries six distinct elements, so the
  same-element Harmony chain can never fire, and weakness coverage is trivially 100% on every
  world. Neither simulation engine models element as a property of a character at all.
- **Area-of-effect breaks pay nothing.** The single-target path runs Overstrike, builds the
  Harmony set and cascades; the area path sets a flag and stops. The units doing most of the
  breaking trigger none of the break payoffs — which lands directly on top of one of the payoff
  moments the game is built around.
