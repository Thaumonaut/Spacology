# Enemy pressure and encounter deadlines — playtest 3

This build gives enemies distinct pressure patterns and a fixed deadline for every encounter. It is available in the isolated iPad playtest at port 4174; it has not been published to GitHub Pages. The original Ops playtest roster is retained there while a separate roster expansion is being edited in the workspace.

## Encounter budgets

One combat round is 100 Action Value. A 100-speed unit normally waits 100 AV between turns; a 158-speed Quickstep waits about 63.3. Animation duration and pausing do not consume AV. No new action may start at or beyond the deadline; an action that starts before it resolves its whole cascade. Clearing the final wave before expiry wins. Surviving enemies at expiry cause a timed extraction with partial data and normal loss recovery gold.

| Difficulty | Encounters 1–2 | Encounters 3–4 | Encounters 5–6 |
|---|---:|---:|---:|
| Relaxed | 6 rounds | 7 rounds | 8 rounds |
| Standard | 5 rounds | 6 rounds | 7 rounds |
| Hard | 4 rounds | 5 rounds | 6 rounds |

Ops displays the next deadline. Battle displays remaining fractional rounds, a progress bar and a final-round warning. The recovery report and inbox preserve elapsed rounds, deadline and timeout outcome. Crew deaths no longer silently reduce the session deadline; the animation laboratory retains its original death penalty.

## Enemy tuning

Values below are bases before encounter, difficulty and elite-tier multipliers.

| Enemy | Health | Damage | Speed | Shield layers × strength | Behavior |
|---|---:|---:|---:|---|---|
| Chaff | 52 | 11 | 100 | 1 × 18 | Regular attacker |
| Bruiser | 66 | 15 | 90 | 1 × 20 | +12% base speed per damaging hit while shielded, max +60% |
| Quickstep | 45 | 9 | 158 | 1 × 16 | Frequent lighter attacks |
| Cleanser | 58 | 11 | 108 | 1 × 18 | Sheds 2 fracture before attacking |
| Reflector | 56 | 12 | 94 | 2 × 18 | Plated; no damage-reflection mechanic in this build |
| Warden — elite | 165 | 19 | 98 | 3 × 22 | Fortified |
| Anchor — elite | 135 | 22 | 120 | 2 × 20 | +10% base speed per damaging hit while shielded, max +40% |
| Bulwark — elite | 210 | 26 | 82 | 4 × 24 | Heavy armor |

All enemies reform their full shield and attack on their recovery turn. A break clears haste stacks, delays the next turn and retains +35% vulnerability. Four Assay still deny two entire turns before recovery. Haste shortens the remaining wait proportionally rather than granting an instant bonus attack. Breaking enemies prevents additional haste until recovery. Bloom damage is not a direct hit and does not grant haste.

Tap an enemy to inspect its current health, damage, speed, shield strength, weaknesses and behavior. Inspection pauses new actions; an animation already underway may finish. Closing resumes only if the battle was previously running.

For encounter index `r = encounter - 1`:

- Health multiplier: `1 + 0.22r`.
- Damage multiplier: `0.9 + 0.16r`.
- Speed multiplier: `1 + 0.025r`.
- Shield-strength multiplier: `1 + 0.06r`.
- Existing waves and enemy totals remain 6 / 6 / 8 / 12 / 15 / 18.
- Elite health gains another 16% per tier after the first; damage gains 10%; every two additional tiers add a shield layer.
- These values depend on encounter progression, difficulty and selected modifiers, never current crew count, level or gear.

| Difficulty | Health / damage | Speed | Shield strength | Break delay, fraction of normal wait |
|---|---:|---:|---:|---:|
| Relaxed | 85% | 90% | 85% | 35% |
| Standard | 100% | 100% | 100% | 25% |
| Hard | 130% | 112% | 120% | 15% |

Existing optional modifiers still apply: Reinforced increases enemy health, Volatile increases enemy and crew damage, and Salvage Contract changes costs/rewards. They do not dynamically compensate for the player's upgrades.

## Evidence and limits

[Recorded balance comparison](enemy-pressure-balance.json): 540 fights before and 540 after, using the real browser resolver, the same 20 deterministic seeds per sample, three difficulties, encounters 1/3/6 and three fixed builds. Animations were disabled for this sampling. This measures those fixtures, not the probability that a player will win.

| Hard fixture | Before wins | After wins | After timeout losses |
|---|---:|---:|---:|
| Basic gear, 4 crew, encounter 1 | 20 / 20 | 20 / 20 | 0 |
| Basic gear, 5 crew, encounter 3 | 20 / 20 | 5 / 20 | 15 |
| Basic gear, 7 crew, encounter 6 | 20 / 20 | 0 / 20 | 20 |
| Crafted gear + rank 2, 6 crew, encounter 3 | 20 / 20 | 20 / 20 | 0 |
| Crafted gear + rank 2, 8 crew, encounter 6 | 20 / 20 | 20 / 20 | 0 |

The strongest fixture is an upper bound, not a build constrained by earned economy. Hard may now be too strict for some ordinary builds; physical playtesting should determine that. Record whether the team loses to damage or time, the exact roster/gear and modifiers. Do not infer a target player win rate from these tests.

Focused regression coverage checks recovery attacks, Assay turn denial, haste cap/reset and queue progress, per-enemy shields, Cleanser actions, speed ordering, exact deadline boundaries, ultimate/Bloom deadlines, last-moment victory, fixed session limits after deaths, timeout rewards, touch inspection, complete recovery attack animation and timer layout.

Separate complete six-encounter earned-economy playthroughs on Standard and Hard verified purchasing, formation, equipment, animated opening actions, all waves, both victory and loss return paths, one receipt/payment per encounter and final-report reload. These simple purchase/deploy scripts do not craft or adapt intelligently. Standard won 5/6 and Hard 1/6 in those particular unseeded runs; those are smoke-test outcomes, not a balance estimate.

The playtest checklist adds checks 27–30 for these behaviors. Existing gaps such as battle checkpoint recovery, combat audio, Calls, zero-integrity termination and first offline battle navigation are unchanged; see the existing Ops systems notes.
