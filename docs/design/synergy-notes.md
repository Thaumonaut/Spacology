# Character-level testing

Everything before this tested *authored archetypes* — "the DoT team", "the chain team".
That can only ever confirm builds someone already believed in. This tests individual
kits in combination, so a pairing nobody designed can surface.

## Files

- `roster.js` — 14 character kits, 6 tags with threshold bonuses, 6 planet conditions
- `synergy.js` — the fight model; `score(team, world)` returns a difficulty breakpoint
- `search.js` — samples random fives across worlds, ranks them, measures tag lift

Run: `node search.js`

## Three rules the testing produced

**A support is only worth a slot if the thing it protects would otherwise die.**
A reflect carry with 1.6× health survived unaided, so shielding it was strictly worse
than bringing another attacker. Dropping it to 0.62× health made the shielder
load-bearing.

**A shield should be ammunition, not mitigation.** While barriers only absorbed damage,
a shielder was a 7-damage attacker. Once the reflect fired on the damage *before* the
barrier ate it, the barrier became the carry's damage resource.

**A tag threshold is only worth what a kit can spend it on.** Averaged over random teams
Shield×3 reads as −8%. Measured against a team that owns a reflect carry, the fourth
Shield tag more than doubles the team. Averages hide conditional value.

## The result that mattered

| team | tags reached | score |
|---|---|---|
| Bell, Kestrel, Bosk, **Corr**, Fen | Shield×3 | 0.77 |
| Bell, **Bell**, Kestrel, Bosk, Fen | Shield×**4**, Kin×3 | **1.63** |

Swapping a 24-damage nuker for a second 7-damage shielder more than doubles the team.
The second shielder contributes almost nothing on its own; it is the fourth Shield tag
that converts barriers into ammunition. This is the property that lets a weak character
be the correct pick.

## Known state

- **AoE is the current meta.** Two AoE units appear in nine of the top ten sampled teams,
  and the two highest scores here are both plain AoE cores. Cycle it later; note it now.
- **Slow worlds discriminate hardest.** Teams that score identically elsewhere spread from
  1.91 to 2.57 under reduced speed. That is the planet condition doing its job.
- **Four of nine enemy archetypes barely discriminate** — bruiser, splitter, harrier and
  skirmisher move every build about equally. They cost a name to learn and return nothing.
