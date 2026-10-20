## 1. Focused trial
- [x] 1.1 Record approved pairing/sightline rules, prototype batch defaults and non-goals. [E1–E3]
- [x] 1.2 Reuse station checkpoint, glyphs, seeded RNG and optional untimed/no-auto shell settings. [E5–E6]
- [x] 1.3 Implement finite model, generated clearing witnesses, terminal states and atomic moves. [E1–E5]
- [x] 1.4 Implement touch/keyboard board, invalid feedback, hints, undo/deal/retry and accessible responsive layout. [E4,E6]

## 2. Verification and delivery
- [ ] 2.1 Open a focused reviewable PR against the station checkpoint without unrelated investigation/Svelte changes.
  - Blocked: GitHub branch push returned HTTP 403. Local commits and a reviewable patch are delivered instead; no PR is claimed.
- [x] 2.2 Verify element matrix, all sightlines, blockers, four deals, witnesses and terminal states in unit tests. [E1–E5]
- [x] 2.3 Run headless browser interaction/layout checks and shared-shell station regressions. [E4,E6]
- [x] 2.4 Validate OpenSpec, run syntax/whitespace checks and deliver an offline playable HTML.
- [ ] 2.5 Human playtest: assess whether pair choices, finite reserves and retry create enjoyable depth. Do not infer approval from automated tests.
  - First feedback: opening is too easy and does not require reserves; need visible append space and selected distant sightlines. Jacob subsequently requested more columns, a 4½-row opening, approximately 24 total rows and eight visible rows. Second feedback: still too many neighbouring pairs; add whole-row collapse and multi-step unlocking. Evaluation of the next revision remains pending.

## 3. Playtest revision
- [x] 3.1 Generate one reserve-dependent full-puzzle solution instead of independently clearable batches; verify odd opening-family counts, varied reserve usage and deal-policy outcomes. [E3,E5]
- [x] 3.2 Expand to eight columns and 24 fixed rows, 4½ initially occupied, an eight-row window, visible next-batch slots and 44px touch targets. [E3,E6]
- [x] 3.3 Add default-on selected sightlines, distinct compatible/incompatible markers, empty-path lighting and offscreen match navigation. [E2,E4]
- [x] 3.4 Run updated model, phone/tablet and packaged-copy regressions, validate the specification, and refresh the working live preview. [E1–E6]
  - Evidence: all 33 unit files; 200 seeded full solutions and deal-policy comparisons; retained headless browser suite at 320/390/768/1024 portrait and 844 landscape, including distant wrapped/column/diagonal matches and four-direction offscreen guidance. Exact bundle passes Chromium offline and WebKit file/offline interaction plus sandboxed-srcdoc checks. OpenSpec strict validation and syntax/whitespace checks pass. Fun/difficulty remains a human playtest question.

## 4. Row clearing and dependency revision
- [x] 4.1 Collapse newly emptied rows, preserve columns/partial-row gaps, retain 24-row capacity and undo the complete change. [E2,E7]
- [x] 4.2 Generate geometry with real row collapse, favour newly exposed long pairs, and optimise compatibility across the full timeline with multiple seeded starts. Retain reserve parity and a valid full witness. [E3,E5]
- [x] 4.3 Measure three-step opening chains, sustained full-solution unlocks, incidental opening pairs and ordinary play; do not equate a nominal solution with depth. [E5]
- [x] 4.4 Verify revised phone/tablet interaction, row movement/undo, offline copy and strict specification; refresh the playable preview. [E4,E6,E7]
  - Evidence: focused model/browser suites pass at phone, tablet, desktop and landscape sizes, including actual rendered row collapse and exact undo. Across seeds 1–200, mean opening pairs fell from 22.785 to 14.76; every opening has a three-step unlock chain. Recorded full solutions average 87.49 non-adjacent moves and 84.07 newly unlocked moves out of 90, with a minimum sustained chain of 22. The exact source bundle passes offline row-collapse/undo and sandbox checks in headless Chromium and WebKit. Syntax, whitespace and strict OpenSpec checks pass.
  - Ordinary lowest-index greedy play across 100 seeds: distant-move share rose from about 39% to 44%, while wins changed from 54% to 50%. This more modest change is not evidence of a dramatic difficulty increase; human evaluation remains open, and some neighbouring matches are mathematically unavoidable with three families and diagonals.

## 5. Error hardening
- [x] 5.1 Check 1,000 seeds for deterministic layouts, public-API witness completion, mixed random play, immutability, append/collapse invariants and finite termination. [E2–E5,E7]
  - All 1,000 full witnesses cleared; 1,000 mixed-play runs terminated (355 wins, 645 losses), checking 87,927 matches and 3,991 deals. Losses are valid terminal states, not verification failures.
- [x] 5.2 Retain runtime-error collection across all browser paths, WebKit selection, exact offline/sandbox interaction and retry-confirmation checks; prevent short/narrow embeds from using the two-column landscape layout. [E4,E6]
  - All 33 unit files pass. The 14 selected browser regression files pass after repairing two stale voyage fixtures (including a treasure-carrier assumption in Drive). The full Element Pairs interaction suite passes in Chromium and WebKit with no runtime errors, including the exact offline bundle and 300×150 sandbox. Strict specification, JavaScript syntax and whitespace checks pass.
