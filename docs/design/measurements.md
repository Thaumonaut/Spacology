# Measurements

**Generated — do not edit.** `cd sim && node sweep.js && python3 build-workbook.py && python3 report.py`

240 unique teams of 5, 26 fights per difficulty probe, difficulty ceiling 24. Baseline (mean team score) **1.813**.

A **breakpoint** is the difficulty a team still beats three fights in four. Higher is stronger.

> Characters and enemies now carry a real element, and Harmony is evaluated. engine.js still uses the old index-assigned model, so ladder.js and counters.js are an independent control rather than a second opinion on elements.

## Role lift

Mean team score when N of a role are present, against baseline.

| role | x1 | x2 | x3 | x4 |
| --- | ---: | ---: | ---: | ---: |
| **Breaker** | -15.0% | +16.8% | +24.7% | +40.3% |
| **Healer** | +9.2% | -8.6% | -26.4% | — |
| **DoT** | -2.6% | +4.8% | -7.4% | — |
| **Speed** | +1.7% | -3.0% | +3.2% | — |
| **Tank** | +1.7% | -4.5% | -24.9% | — |
| **DPS** | +1.5% | -1.8% | -13.0% | — |

## Strongest teams

| team | avg | open | murk | hive | fortress | bloom | roles at 2+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Rime, Ferrule, Mote, Ash, Wex | 4.60 | 4.41 | 3.35 | 5.91 | 5.01 | 4.32 | Breakerx2 Tankx2 |
| Pyre, Ash, Mote, Rime, Vitre | 4.10 | 3.35 | 2.27 | 6.07 | 3.26 | 5.54 | DoTx2 Speedx2 Breakerx3 |
| Ash, Fen, Sump, Rime, Ledger | 4.02 | 3.51 | 2.61 | 5.91 | 4.02 | 4.04 | DoTx2 Healerx2 Breakerx2 |
| Sump, Ash, Rime, Mire, Maul | 3.85 | 3.28 | 2.50 | 5.61 | 3.74 | 4.11 | DoTx2 Healerx2 Breakerx2 |
| Maul, Mire, Ash, Ferrule, Mote | 3.79 | 3.35 | 2.29 | 5.01 | 4.11 | 4.18 | DPSx2 Breakerx2 Tankx2 |
| Mote, Ash, Vane, Mire, Wex | 3.51 | 3.35 | 2.38 | 4.92 | 3.83 | 3.07 | Speedx2 Healerx3 Tankx2 |
| Mote, Corr, Rime, Fen, Maul | 3.48 | 2.73 | 1.90 | 5.22 | 3.28 | 4.27 | Breakerx3 DPSx2 |
| Maul, Mote, Ash, Vitre, Nettle | 3.34 | 2.75 | 1.90 | 5.47 | 3.14 | 3.42 | Breakerx3 Speedx3 |
| Vane, Rime, Mire, Ballast, Ash | 3.13 | 2.64 | 2.08 | 5.24 | 2.98 | 2.70 | Healerx2 Tankx2 |
| Corr, Mire, Ash, Mote, Maul | 3.12 | 2.61 | 2.06 | 4.25 | 3.35 | 3.35 | DPSx2 Breakerx2 |

## Is any character mandatory?

`cost of banning` is how far the best achievable team falls if that character is removed from the pool.

| character | roles | hooks | in top 50 | cost of banning |
| --- | --- | ---: | ---: | ---: |
| Ash | DoT | 3 | 29 | -24.3% |
| Mote | Speed / Breaker | 2 | 25 | -12.7% |
| Rime | Breaker | 2 | 20 | -17.6% |
| Vitre | Breaker / Speed | 3 | 19 | — |
| Maul | DPS / Breaker | 1 | 18 | — |
| Wex | Tank / Healer | 1 | 17 | -10.9% |
| Ferrule | Tank / DPS | 2 | 14 | -10.9% |
| Mire | Healer / Tank | 3 | 12 | — |
| Tarn | Tank / DPS | 3 | 10 | — |
| Corr | DPS | 0 | 10 | — |
| Halo | Healer / Speed | 1 | 10 | — |
| Ledger | Breaker / Speed | 1 | 9 | — |

## Does stacking elements pay?

Teams grouped by how many duplicate elements they carry. `harmonies` counts the follow-ups that fire per fight when allies share the attacker's element.

This compares *different teams*, so it is confounded by team quality — a team that happens to share elements may be weaker for unrelated reasons. It answers **are stacked teams better than spread ones**, and the answer is that they are now about the same, which is what a secondary axis should look like: a real choice rather than a correct answer.

For what Harmony itself contributes, `sim/harmony-test.js` scores the *same* team with it on and off, which removes the confound. That number is **16.5%** for a team with two or more duplicate elements and **0%** for a team with none.

| duplicate elements | teams | mean score | vs baseline | harmonies | best |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 36 | 1.74 | -4.3% | 0 | 4.10 |
| 1 | 125 | 1.83 | +1.1% | 14.5 | 4.60 |
| 2 | 73 | 1.81 | -0.0% | 36.3 | 4.02 |
| 3 | 6 | 1.84 | +1.8% | 80.7 | 2.70 |

## Which constants move the game

Each constant varied alone across five values, everything else at default. `range` is how far the mean score travels across those values.

| constant | range | values tested | mean score |
| --- | ---: | --- | --- |
| `ARMOR_PER_LAYER` | 68.9% | 8 → 24 | 2.50 → 1.48 |
| `ARMOR_MITIGATION` | 16.1% | 0.25 → 0.85 | 1.77 → 2.05 |
| `VULN_BONUS` | 8.7% | 0 → 0.75 | 1.81 → 1.97 |
| `SHRED_OPPOSITE` | 5.2% | 0.5 → 2 | 1.80 → 1.89 |
| `BREAK_DELAY` | 4.2% | 0 → 0.75 | 1.85 → 1.91 |
| `SHRED_SAME` | 3.4% | 0.05 → 0.5 | 1.88 → 1.95 |
| `HARMONY_DMG` | 2.5% | 0.2 → 1.3 | 1.87 → 1.91 |
| `HARMONY_CAP` | 1.1% | 0 → 8 | 1.86 → 1.88 |

## Worlds

| world | speed | median | max | spread | note |
| --- | ---: | ---: | ---: | ---: | --- |
| hive | 1 | 1.85 | 6.07 | 15.2x | a tide of small things |
| bloom | 1 | 1.94 | 5.54 | 13.2x | the Null is thick here — damage over time bites harder |
| open | 1 | 1.58 | 4.41 | 11.0x | nothing unusual |
| murk | 0.72 | 1.09 | 3.35 | 8.4x | low visibility — everyone acts slower |
| fortress | 1 | 2.11 | 5.01 | 7.2x | a few very tough things |

## Verb census

A verb carried by one character gives every chain through it exactly one possible shape. This never runs a fight, so it is unaffected by engine changes.

| verb | characters | who has it |
| --- | ---: | --- |
| `detonate` | 1 | Pyre |
| `dotSpread` | 1 | Sump |
| `turnBoost` | 1 | Vane |
| `energyGain` | 1 | Halo |
| `lifesteal` | 1 | Ballast |
| `needsShield` | 1 | Tarn |
| `shieldOnHit` | 1 | Ferrule |
| `overheal` | 1 | Mire |
| `marks` | 2 | Quill, Vitre |
| `thorns` | 2 | Tarn, Mire |
| `taunt` | 2 | Tarn, Ballast |
| `shield` | 2 | Wex, Ferrule |
| `appliesDot` | 3 | Ash, Cinder, Sump |
| `dotPerHit` | 3 | Ash, Cinder, Sump |
| `procOn` | 3 | Nettle, Maul, Ledger |
| `heal` | 3 | Sump, Fen, Mire |
| `armorShred` | 4 | Ash, Mote, Vitre, Rime |
| `aoe` | 4 | Ash, Mote, Vitre, Rime |

