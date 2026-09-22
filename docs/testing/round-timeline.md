# Fixed rounds and tempo — playtest 4

The round budget remains fixed: one round is 100 Action Value (AV). Difficulty still sets the existing 4–8 round budgets. Speed shortens the wait between turns; action advances remove some of that wait. Neither adds rounds. Pausing and animation speed do not affect combat time. The final extraction marker wins an exact tie with an action; a cascade started before it resolves completely.

The left turn order now contains round markers and extraction. Its header shows whole rounds remaining, including the current round, and progress through that round. Tap it for the rules. The queue previews the current and following round, using distances from now rather than gaps between successive actors. It includes an actor's pending reset so an actor who just moved does not misleadingly appear ready again. Projections are estimates until the next action resolves; deaths, ultimates, advances and new waves rebuild them.

An advance highlights the moved character and records the actual wait removed. Follow-up relays target a waiting teammate rather than the character currently taking its normal turn. Saved AV is combined crew waiting removed, **not time added to the battle**. The report and recovery inbox retain crew turns, advances, AV saved and observations about enemies remaining, shielded hits, crew losses and enemy recoveries. These are observations rather than a claim to know a single cause of defeat.

## Elite tuning

- Warden base health: 165 → 150. Its three shield layers and attack remain.
- Bulwark base health: 210 → 185; base shield layers: four → three. Its heavy hit and slower turn rate remain.
- Elite health growth per additional tier: 16% → 10%.
- Additional shield layers from elite tiers cap at one.
- Enemy encounter/difficulty/modifier scaling, recovery attacks, shield restoration and round budgets remain unchanged.

## Verification

`tests/browser/round-timeline.cjs` covers cumulative/pending projections, exact round/deadline ties, actual turn counts, saved wait, relay target selection, reports/inbox and both tablet orientations. A controlled 3-round fixture gets two slow heavy attacks, three attacks with repeated advances, or four faster light attacks, all ending at the same 300 AV boundary. Heavy and fast fixtures deal the same total damage using different turn patterns.

`tests/balance/round-timeline.cjs` samples 12 identical seeds across 3 difficulties × encounters 1/3/6 × starter/growing/synergy fixtures: 324 battles per version. The initial sample used commit ee9caf8. Results are retained in [round-timeline-balance.json](round-timeline-balance.json).

| Outcome | Before | After |
|---|---:|---:|
| Clear | 240 | 248 |
| Timeout | 45 | 37 |
| Crew wiped | 39 | 39 |
| Timeout with one final enemy | 12 | 8 |

All single-enemy timeouts in these fixtures left a Warden. Hard growing fixtures went from 3/12 to 5/12 clears at encounter 3 and 0/12 to 1/12 at encounter 6. These fixtures measure a repeatable comparison, not player win rates: they do not follow earned economy, and the fully crafted/max-rank fixture is an upper bound rather than a legal early-run progression. Hard still expects significant investment and composition choices.

Playtest: compare a burst team with a tempo/follow-up team; watch who moves before the next marker. After a loss, read the report and try changing elemental coverage, guard damage, tempo or durability according to the observed bottleneck.
