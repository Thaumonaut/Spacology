# Aether Weaver first-pass verification

The six-character preset uses `?weavers=1` and separate save/result keys. Skills spend shared Aether; ultimates retain individual charge.

Headless browser checks verified all six deployed characters, four move descriptions per character, lore, portraits, save isolation through battle return, and review-page layouts at 1440, 768 and 390 pixels without horizontal overflow.

Combat checks passed for Hanae's generation and one-use tuning; Roonie's discount with Arunima's optional overcharge; basic fallback when Aether is insufficient; Ivara's single-hit shelter and capacity loss on death; Veska's Refrain healing; Daven's barrier refund limit; and ultimates spending no shared Aether. Existing Aether unit tests, browser Aether checks and gear-details checks passed.

Twelve seeded first-encounter runs produced eight wins and four timeouts, with no crew deaths. Every run used basics, skills and ultimates, and the pool stayed within bounds. This suggests strong defensive coverage with inconsistent damage. It is a first playable balance pass, not a complete-voyage balance assessment.

Custom headless checks were run from `/tmp/playwright-test-weaver-kits.cjs` and `/tmp/playwright-test-weaver-page.cjs`; raw first-encounter results were written to `/tmp/weaver-balance.json`.
