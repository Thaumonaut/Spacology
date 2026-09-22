# Recovery progress — Pages playtest 4

The live battle bar scores defeated enemies across every wave: chaff = 1 point, other regular enemies = 2, elites = 4. Damage alone earns nothing. Future waves are included from the start, so clearing the first wave cannot show 100% recovery.

| Recovered enemy points | Integrity change |
|---|---:|
| Below 18% | −8 |
| 18%–below 42% | −6 |
| 42%–below 68% | −4 |
| 68%–below 88% | −2 |
| 88%–below 100% | 0 |
| 100% | +2, or +5 with the observation completed |

These prototype deltas preserve the previous worst-loss and full-clear values; the older design-record's danger-scaled ranges are not applied yet. Thresholds come from the design record. Comparisons use exact point ratios, not rounded percentages. The live percentage rounds down, and the next target displays the whole points still needed. Because points are discrete, some small encounters can jump over a band.

The bar previews the applied integrity change if combat ends now, capped by the current 0–100 integrity range. Its thick green tick marks the 88% no-loss threshold. Tap for the entire scoring table; battle pauses while details are open. The final report and inbox persist the same score. Gold remains tied to full-clear versus partial-recovery rewards; this release changes integrity scoring, not gold or rare-drop odds.

The release includes the previously tested Ops systems, difficulty presets, enemy behaviors and encounter deadlines. A separate checkout assembled from the tested playtest keeps unfinished roster, artwork and lore edits out of this publication.

Validation: recovery-progress.cjs exercises every band boundary, point weights, future waves, partial-health non-credit, touch details, tablet layout, timeout/report/receipt agreement, once-only payout and capped integrity. Existing browser regressions are run before publishing. Balance measurements in enemy-pressure-balance.json remain historical evidence for combat outcomes; their integrity totals predate these bands.
