# Reward ownership follow-up review

2026-09-21. New focused bug-hunter run, iteration 1. This closes the independent-review gap left by the previous three-iteration run; it does not clear the unrelated systems-audit findings.

```text
Bug-hunter: 1 iteration · 0 fixed · 0 refuted · 0 new findings reported
Triage: REVIEW — runtime ownership behavior changed
Scope: applyBattleResult() ownership check + rare-reserve-gear regression
Root causes: none found within this scope
Iteration 1: clean — no reachable ownership regression found
Baseline: 10 existing browser regression cases passed
Verification: 10 regression cases passed in final targeted runs;
              10 browser ownership/reload cases passed;
              29 actual-producer/recovery combinations passed in Node VM
Commit/deployment: none
```

The independent reviewer traced the live reward producer, inventory and equipment ownership, return-to-reserve, sale/dismantle, and recovery application. The producer emits `gear` or `ship`, which map correctly to `ownedCard()` categories. Duplicate items convert to exactly four Scrap, including equipment attached to reserve crew. New items enter inventory once. Reapplying a consumed result changes nothing.

The browser ownership matrix exercised inventory, front crew, support crew, reserve crew, second-slot holes, ship inventory/equipment, new gear, new ship and no-item rewards; each case included a reload/replay check. The VM matrix exercised all five possible rare items with the actual producer and ownership/recovery functions.

Existing native-drag cases failed intermittently during final verification, then passed unchanged in isolated reruns. This remains a UI/test reliability limitation from the prior audit; it is not a clean sign-off on every prototype system or physical iPad input.

The review used an isolated, frozen snapshot because the shared checkout had staged and unstaged work. Source hashes remained unchanged throughout the ownership review. No shared source or staging was modified by this review.

Snapshot review tree: `5e48f971f1d3d216207610860ad3d4b87b462311`.

Reviewed `prototypes/spacology-v0.1.0.js` SHA-256: `767d65344eaffd65b5e5072a60a114433f4a0a38beb923f87c35f485e47c56e4`.
