# Treasure carriers — first playable version

Implemented in the existing six-encounter prototype. The twenty-one-node voyage, new factions, consumable tools and general equipment redesign remain separate work.

## Playing

Each voyage receives two seeded sightings: one at encounter 2 or 3, another at 4 or 5. Existing saves receive a persistent treasure seed without resetting their crew or equipment. Sightings use the current encounter's faction artwork with a gold outline and treasure marker.

The top-left Ops recovery tray announces a sighting and lets the player switch between **Pursue treasure** and **Mission first**. Pursuit focuses direct attacks; area attacks can hit the carrier under either order. A carrier joins the first wave as an additional, non-elite, non-attacking target. It flees after 240 combat AV or when that wave's required enemies are cleared. It never contributes required recovery points, takes an attack turn, blocks reinforcements, or prevents mission completion.

Defeating it saves bonus gold, one advanced equipment copy and a sealed Treasure cache immediately. Secured loot survives partial extraction, reload and retreat. Equipment duplicates are retained. Reopening the battle cannot farm a second drop. Its cache is Tier II with 75% probability or Tier III with 25% probability.

The recovery tray and Inbox open caches individually or all together. Each gives a guaranteed gold amount plus a featured reward; its contents are fixed before opening. Tier II has 25% currency / 35% basic gear / 40% advanced gear. Tier III has 20% currency / 20% basic gear / 60% advanced gear. Currency outcomes split 60% gold / 30% scrap / 10% Bloom crystals. These are initial tuning values. No unimplemented tools are awarded.

Existing battle receipts retain their already-credited semantics. Cache claim state and granted inventory/currency are saved together. The end-of-voyage screen retains Inbox access and directs the player to unopened caches before starting a new voyage; there is still no cross-voyage equipment progression.

## Validation

- `node tests/unit/treasure-rules.cjs`: 100 voyage seeds verify bounded sightings, deterministic rewards, duplicate gear preservation, cross-voyage isolation, replay protection and exactly-once opening across serialization. A 10,000-reward sample checks pool reachability and broad expected distributions.
- Existing Aether and downed-recovery unit suites pass.
- Headless `/tmp/playwright-test-treasure-carriers.js`: actual targeting orders, scoring exclusion, 240-AV escape boundary, wave progression, animated defeat, immediate persistence, timeout rewards, result replay and cache opening/reload. Screenshots show Ops, combat and Inbox.
- Headless `/tmp/playwright-test-treasure-edge-cases.js`: eight complete resolver fights using the Weaver fixture under both orders; simultaneous wave/carrier kills; final victory with a surviving carrier; reload after capture; actual retreat; end-screen opening; new-voyage reset. These are regression samples, not a balance claim.
- Both 1024×768 and 768×1024 layouts checked for horizontal overflow and overlap between the carrier status, enemies, recovery and objective panels. Also inspected a 1024×900 screenshot.
- Existing `recovery-progress.cjs` and `round-timeline.cjs` browser regressions pass.
- The retained `rare-reserve-gear.cjs` fixture uses obsolete schema 3 and fails because the prototype accepts schema 4. A temporary copy changing only that fixture to schema 4 passes its original ownership assertion. The historical test and unrelated save migration were left unchanged.

All browser work ran headlessly with isolated saves. Temporary browser scripts and images are under `/tmp`; no deployment or commit was performed.

## Limitations and next decisions

Carrier health, escape time, frequency and reward value need economy/balance playtesting on earned teams. Carrier artwork currently reuses its faction's existing creature portrait with a treasure treatment. Dedicated hoarding-creature art can follow. The proposed tools, ordinary battle cache pools and larger voyage formula are not prerequisites for trying this slice.
