# Measurements

**Generated — do not edit.** `cd sim && node sweep.js && python3 build-workbook.py && python3 report.py`

240 unique teams of 5, 26 fights per difficulty probe, difficulty ceiling 24. Baseline (mean team score) **1.732**.

A **breakpoint** is the difficulty a team still beats three fights in four. Higher is stronger.

> Characters and enemies now carry a real element, and Harmony is evaluated. engine.js still uses the old index-assigned model, so ladder.js and counters.js are an independent control rather than a second opinion on elements.

## Role lift

Mean team score when N of a role are present, against baseline.

| role | x1 | x2 | x3 | x4 |
| --- | ---: | ---: | ---: | ---: |
| **Breaker** | -15.3% | +18.1% | +25.4% | +38.4% |
| **Healer** | +9.9% | -9.9% | -29.3% | — |
| **DoT** | -2.7% | +6.2% | -5.9% | — |
| **Speed** | +2.7% | -3.1% | +3.4% | — |
| **Tank** | +2.7% | -5.4% | -28.4% | — |
| **DPS** | +1.0% | -0.8% | -13.6% | — |

## Strongest teams

| team | avg | open | murk | hive | fortress | bloom | roles at 2+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Rime, Ferrule, Mote, Ash, Wex | 4.50 | 4.48 | 3.19 | 5.91 | 4.80 | 4.13 | Breakerx2 Tankx2 |
| Pyre, Ash, Mote, Rime, Vitre | 4.10 | 3.35 | 2.27 | 6.07 | 3.26 | 5.54 | DoTx2 Speedx2 Breakerx3 |
| Ash, Fen, Sump, Rime, Ledger | 3.91 | 3.56 | 2.61 | 5.54 | 3.95 | 3.90 | DoTx2 Healerx2 Breakerx2 |
| Sump, Ash, Rime, Mire, Maul | 3.84 | 3.35 | 2.57 | 5.42 | 3.74 | 4.11 | DoTx2 Healerx2 Breakerx2 |
| Maul, Mire, Ash, Ferrule, Mote | 3.73 | 3.23 | 2.29 | 5.01 | 3.97 | 4.16 | DPSx2 Breakerx2 Tankx2 |
| Mote, Corr, Rime, Fen, Maul | 3.45 | 2.75 | 1.90 | 5.06 | 3.26 | 4.27 | Breakerx3 DPSx2 |
| Mote, Ash, Vane, Mire, Wex | 3.45 | 3.35 | 2.36 | 4.71 | 3.81 | 3.00 | Speedx2 Healerx3 Tankx2 |
| Maul, Mote, Ash, Vitre, Nettle | 3.21 | 2.59 | 1.90 | 5.08 | 3.05 | 3.42 | Breakerx3 Speedx3 |
| Corr, Mire, Ash, Mote, Maul | 3.10 | 2.57 | 1.90 | 4.23 | 3.44 | 3.35 | DPSx2 Breakerx2 |
| Vane, Rime, Mire, Ballast, Ash | 3.07 | 2.57 | 1.97 | 5.19 | 2.98 | 2.66 | Healerx2 Tankx2 |

## Is any character mandatory?

`cost of banning` is how far the best achievable team falls if that character is removed from the pool.

| character | roles | hooks | in top 50 | cost of banning |
| --- | --- | ---: | ---: | ---: |
| Ash | DoT | 3 | 31 | -23.4% |
| Mote | Speed / Breaker | 2 | 24 | -13.1% |
| Maul | DPS / Breaker | 1 | 19 | — |
| Rime | Breaker | 2 | 19 | -17.1% |
| Wex | Tank / Healer | 1 | 18 | -9.0% |
| Vitre | Breaker / Speed | 3 | 16 | — |
| Ferrule | Tank / DPS | 2 | 14 | -9.0% |
| Mire | Healer / Tank | 3 | 12 | — |
| Tarn | Tank / DPS | 3 | 11 | — |
| Corr | DPS | 0 | 10 | — |
| Sump | DoT / Healer | 3 | 9 | — |
| Ledger | Breaker / Speed | 1 | 9 | — |

## Does stacking elements pay?

Teams grouped by how many duplicate elements they carry. `harmonies` is how many Harmony follow-ups fire per fight — allies sharing the breaker's element striking after a break.

| duplicate elements | teams | mean score | vs baseline | harmonies | best |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 36 | 1.74 | +0.2% | 0 | 4.10 |
| 1 | 125 | 1.78 | +2.8% | 4.4 | 4.50 |
| 2 | 73 | 1.67 | -3.8% | 11.4 | 3.91 |
| 3 | 6 | 1.49 | -14.1% | 22.3 | 2.21 |

## Which constants move the game

Each constant varied alone across five values, everything else at default. `range` is how far the mean score travels across those values.

| constant | range | values tested | mean score |
| --- | ---: | --- | --- |
| `ARMOR_PER_LAYER` | 75.1% | 8 → 24 | 2.53 → 1.44 |
| `ARMOR_MITIGATION` | 13.8% | 0.25 → 0.85 | 1.77 → 2.01 |
| `VULN_BONUS` | 8.0% | 0 → 0.75 | 1.78 → 1.93 |
| `SHRED_OPPOSITE` | 8.0% | 0.5 → 2 | 1.74 → 1.88 |
| `BREAK_DELAY` | 6.2% | 0 → 0.75 | 1.79 → 1.88 |
| `SHRED_SAME` | 3.9% | 0.05 → 0.5 | 1.86 → 1.93 |
| `HARMONY_DMG` | 0.6% | 0.2 → 1.3 | 1.87 → 1.86 |
| `HARMONY_CAP` | 0.5% | 0 → 8 | 1.86 → 1.87 |

## Worlds

| world | speed | median | max | spread | note |
| --- | ---: | ---: | ---: | ---: | --- |
| hive | 1 | 1.85 | 6.07 | 15.2x | a tide of small things |
| bloom | 1 | 1.90 | 5.54 | 13.8x | the Null is thick here — damage over time bites harder |
| open | 1 | 1.55 | 4.48 | 11.2x | nothing unusual |
| fortress | 1 | 1.94 | 4.80 | 8.9x | a few very tough things |
| murk | 0.72 | 1.07 | 3.19 | 8.0x | low visibility — everyone acts slower |

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

