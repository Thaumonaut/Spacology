# Three-sector voyages and starting difficulty

Implemented 2026-09-22 in the local prototype. Start a **new voyage** to use this route. Schema-4 saves without `voyageVersion: 1` retain their original six-battle progression and rewards; their header says “Legacy voyage”. Saved caches are preserved.

## Route

| Slot | Sector 1 | Sectors 2 and 3 |
| --- | --- | --- |
| 1 | Setup reward | Survey battle |
| 2 | Survey battle | Swarm or ambush |
| 3 | Optional modifier or pass | Optional modifier or pass |
| 4 | Swarm | Remaining swarm or ambush |
| 5 | Elite | Elite |
| 6 | Reward | Reward |
| 7 | Boss | Boss |

There are 21 nodes, 14 battles, four rewards and three modifier choices. Each sector gets one of supply cache, field workshop and research station without repeats. A saved seed fixes their order, combat variants, equipment offers and one optional treasure-carrier opportunity per sector. The header shows the current seven-node sector; the map dialog shows all 21 nodes. Reward/modifier stops advance without launching combat and record the choice in the inbox. Result node IDs reject stale results from another voyage.

- Survey: two waves of three regular enemies; no elites.
- Swarm: three waves of five chaff, 30 base HP, 6 attack, 8 guard, one shield layer; no elites. The sixth visible place is reserved for an optional treasure carrier.
- Ambush: two waves of three quicksteps, 40 base HP, 8 attack, 12 guard, speed 150.
- Elite: two waves of three; one elite per wave.
- Boss: one existing-faction major specimen, 560 base HP, 23 attack, speed 110, three shield layers. At half HP, attack rises 35% and guard strength drops 40%, preserving ailments and current breaks. Every third attack deals 1.8× damage, announced one attack ahead. Recovery awards up to 80 points for damage and 20 for the kill. Healing cannot erase earned damage progress.

Partial extraction still advances a boss node, matching the existing partial-recovery progression. Boss victory is not a new hard gate. Existing integrity and retreat behavior remain in use.

## Voyage difficulty

The departure dialog lists the actual modifiers and locks the choice when departing. Optional modifiers at nodes 3, 10 and 17 stack with that choice for subsequent battles. Changing the external playtest preset does not change an active voyage.

| Difficulty | HP / attack | Speed | Guard | Break delay | Sector-1 regular deadline |
| --- | --- | --- | --- | --- | --- |
| Relaxed | 85% | 90% | 85% | 35% of enemy wait | 7 rounds |
| Standard | 100% | 100% | 100% | 25% | 6 rounds |
| Hard | 130% | 112% | 120% | 15% | 5 rounds |

Each new sector adds 55 percentage points to the base HP multiplier, 30 points to attack (starting at 90%), 4 points to speed and 12 points to guard, before difficulty and optional modifiers. The deadline gains one round per sector and one more for a boss. Noncombat nodes do not increase strength. These are initial tuning values, not a balance guarantee.

Victory gold is `18 + sector × 6`, plus 6 for elites or 12 for bosses, before modifier and ship effects. Partial extraction retains the existing 10 gold base. Carrier payouts use loot levels 2, 4 and 6 rather than the 21-node index. Rewards offer gold, existing gear, scrap, integrity repairs, field XP or Bloom crystals. No new enemy species or equipment tools were introduced here. Containment, rescue, interception objectives and other proposed nodes remain future work.

## Validation

- `node tests/unit/voyage-rules.cjs`: 300 seeded routes, slot counts, stable offers, one-time claims, modifier gating, three carrier opportunities, difficulty locking and scaling, boss phase/recovery and legacy settings.
- Existing treasure, field-progression and down-recovery unit suites pass.
- Headless Playwright `/tmp/playwright-test-voyage-nodes.js`: all 21 stops through the actual Ops controls; 14 fights resolved through the combat engine with strengthened crew, all reward variants, modifier passes, reload after each node, final summary, and no runtime errors. This verifies progression, not ordinary-roster balance.
- Headless `/tmp/playwright-test-voyage-edges.js`: starting selection at 1024×768 and 768×1024, direct combat-link guards, all three difficulties in real combat stats, Hard plus Reinforced, ordinary-crew animated survey victory, boss warning/heavy strike/phase, old six-battle saves, and stale-result rejection.
- Existing recovery-progress and round-timeline browser checks can target legacy behavior by explicitly setting fixture `voyageVersion: 0, maxRounds: 6`. New-run fixtures must choose a starting difficulty and reach a battle node before navigating into combat.

Broader economy balance, all crew combinations, every optional-modifier combination, and offline service-worker updating have not been exhaustively playtested.
