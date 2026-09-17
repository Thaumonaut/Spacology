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
