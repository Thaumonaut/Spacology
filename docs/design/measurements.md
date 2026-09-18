# Measurements

**Generated — do not edit.** `cd sim && node sweep.js && python3 build-workbook.py && python3 report.py`

240 unique teams of 5, 26 fights per difficulty probe, difficulty ceiling 24. Baseline (mean team score) **1.668**.

A **breakpoint** is the difficulty a team still beats three fights in four. Higher is stronger.

> Neither engine models element as a property of a character; both assign it by array position, and Harmony is never evaluated. Everything here is a finding about verbs and tags only.

## Role lift

Mean team score when N of a role are present, against baseline.

| role | x1 | x2 | x3 | x4 |
| --- | ---: | ---: | ---: | ---: |
| **Breaker** | -13.6% | +13.9% | +24.7% | +37.5% |
| **DoT** | -2.5% | +7.8% | +5.8% | — |
| **Healer** | +7.6% | -7.3% | -29.9% | — |
| **Tank** | +1.9% | -4.3% | -24.8% | — |
| **Speed** | +1.6% | -2.5% | -0.7% | — |
| **DPS** | -0.2% | -0.9% | -9.9% | — |

## Strongest teams

| team | avg | open | murk | hive | fortress | bloom | roles at 2+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Pyre, Ash, Mote, Rime, Vitre | 4.28 | 3.67 | 2.45 | 5.89 | 3.70 | 5.70 | DoTx2 Speedx2 Breakerx3 |
| Rime, Ferrule, Mote, Ash, Wex | 4.10 | 3.97 | 2.87 | 5.56 | 4.34 | 3.74 | Breakerx2 Tankx2 |
| Vane, Rime, Sump, Maul, Mote | 3.79 | 3.70 | 2.45 | 5.22 | 3.67 | 3.93 | Speedx2 Healerx2 Breakerx3 |
| Maul, Mire, Ash, Ferrule, Mote | 3.73 | 3.47 | 2.22 | 4.36 | 4.34 | 4.27 | DPSx2 Breakerx2 Tankx2 |
| Vane, Rime, Mire, Ballast, Ash | 3.61 | 3.40 | 2.45 | 5.38 | 3.97 | 2.87 | Healerx2 Tankx2 |
| Cinder, Rime, Tarn, Quill, Ash | 3.58 | 3.49 | 2.31 | 4.09 | 3.97 | 4.04 | DoTx3 DPSx2 Breakerx2 |
| Sump, Ash, Rime, Mire, Maul | 3.56 | 3.35 | 2.52 | 4.06 | 3.97 | 3.90 | DoTx2 Healerx2 Breakerx2 |
| Mote, Ash, Vane, Mire, Wex | 3.42 | 3.56 | 2.24 | 4.50 | 3.97 | 2.82 | Speedx2 Healerx3 Tankx2 |
| Maul, Mote, Ash, Vitre, Nettle | 3.27 | 2.94 | 2.13 | 3.60 | 3.60 | 4.09 | Breakerx3 Speedx3 |
| Ash, Fen, Sump, Rime, Ledger | 3.17 | 2.82 | 2.41 | 3.51 | 3.74 | 3.35 | DoTx2 Healerx2 Breakerx2 |

## Is any character mandatory?

`cost of banning` is how far the best achievable team falls if that character is removed from the pool.

| character | roles | hooks | in top 50 | cost of banning |
| --- | --- | ---: | ---: | ---: |
| Ash | DoT | 3 | 34 | -11.4% |
| Mote | Speed / Breaker | 2 | 22 | -15.6% |
| Maul | DPS / Breaker | 1 | 17 | — |
| Rime | Breaker | 2 | 16 | -12.8% |
| Wex | Tank / Healer | 1 | 15 | — |
| Ferrule | Tank / DPS | 2 | 14 | — |
| Tarn | Tank / DPS | 3 | 12 | — |
| Vitre | Breaker / Speed | 3 | 12 | -4.3% |
| Mire | Healer / Tank | 3 | 12 | — |
| Ballast | Tank | 2 | 10 | — |
| Cinder | DoT / DPS | 1 | 10 | — |
| Sump | DoT / Healer | 3 | 9 | — |

## Which constants move the game

Each constant varied alone across five values, everything else at default. `range` is how far the mean score travels across those values.

| constant | range | values tested | mean score |
| --- | ---: | --- | --- |
| `ARMOR_PER_LAYER` | 56.2% | 8 → 24 | 2.51 → 1.61 |
| `OFF_ELEMENT_SHRED` | 28.8% | 0.05 → 0.5 | 1.98 → 2.55 |
| `VULN_BONUS` | 9.5% | 0 → 0.75 | 2.01 → 2.20 |
| `ARMOR_MITIGATION` | 9.4% | 0.25 → 0.85 | 2.04 → 2.23 |
| `BREAK_DELAY` | 5.7% | 0 → 0.75 | 2.02 → 2.14 |

## Worlds

| world | speed | median | max | spread | note |
| --- | ---: | ---: | ---: | ---: | --- |
| hive | 1 | 1.64 | 5.89 | 14.7x | a tide of small things |
| bloom | 1 | 1.81 | 5.70 | 14.2x | the Null is thick here — damage over time bites harder |
| open | 1 | 1.46 | 3.97 | 9.9x | nothing unusual |
| fortress | 1 | 1.97 | 4.34 | 9.2x | a few very tough things |
| murk | 0.72 | 1.07 | 2.87 | 7.2x | low visibility — everyone acts slower |

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

