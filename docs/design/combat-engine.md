# The shared combat engine

The live combat rules live in `prototypes/combat-core.js`. The watchable fight loads them as a classic script, and `prototypes/combat-headless.js` runs them in Node (`runFight(spec)`), one isolated context per fight. They were moved out of `watchable-fight.html` unchanged. `tests/unit/combat-headless.cjs` checks 15 recorded fights against the live page, and `tests/browser/combat-core-parity.cjs` checks the page itself, action by action.

## What a host can use

Labs and sims drive the same rules the game plays. Every addition below changes nothing when unused: the 15 recorded fights stay byte-identical.

| Part | What it does |
|---|---|
| `runFight({team \| crew \| session, seed, rng})` | One fight: a prototype team, crew in the live kit format, or a voyage battle set up exactly as the page does |
| `on: {spend, gain, outgoing, afterHit, break, afterIncoming}` | Listen to the fight (`COMBAT_HOOKS`). Payloads carry live units. `gain` may change an Aether credit; `outgoing` may change or multiply a hit before mitigation. Every hit has a kind (basic, skill, ult, follow, chain, reflect, transfer, attack, or a status's name) |
| `rules: {healMul, barrierMul, enemyAtkMul, reformDelay, layerDelta, …}` | This fight's rules (`COMBAT_RULES`), plus the core's own constants (`SOAK`, `BRK`, `EN`, …). An unknown or invalid rule throws |
| `api.enemyAttack(foe, target?)` | An extra enemy attack from a hook, through the normal targeting: never the back row or a summon in a voyage fight |
| `u.frozen = n` | A crewmate loses its next n turns, ultimates and extra turns included |
| `metrics`, `state` | The fight's totals (damage by kind, healing, barriers, damage taken, Aether generated, spent, wasted, refused and peak, lowest health, Breaks, deaths and more), and the fight's state as JSON |

The exact payloads and rules are documented where they are declared, at the top of `combat-core.js` and `combat-headless.js`. `tests/unit/combat-hooks.cjs` and `tests/unit/combat-hooks-regressions.cjs` hold them to it.

## Open questions

**A crewmate felled mid-action, and the code around it, has not had a final review (2026-10-08).** The bug check on the hooks commit ran its three passes. The third found that a crewmate downed partway through its own action, for example by a provoked counterattack, kept damaging shields and Breaking enemies. That is fixed: `canShred()` checks both units at the four places that damage shields. No pass has reviewed the fix. Nearby code in the same class was not changed, because nothing proved it wrong:
- a downed Arunima still delays later enemies by 15 AV;
- other crew's follow-ups still trigger off the fallen actor's action;
- `weaverAfterBasic` still runs.

Recommendation: before a lab relies on counterattacks that can down the actor, run the bug check scoped to those paths. The odds are good: each path is a one-line `act.alive` check, and unhooked fights never reach them.

**A hit with a scale of 0 lands at full strength (2026-10-08). Handed to spacology-18.** `resolveHitDamage` uses `src.dmg*(scale||1)`, so a hit whose damage-based scale is 0 is treated as a normal hit. This affects two skills:
- Reflect after a hit that a barrier fully absorbed;
- Lash with no damage stored.

Both hit at 1× the crewmate's damage instead of nothing. It is live behaviour: found/spread, found/order and voyage/bridged, three of the 15 recorded fights, take this path. The new rules make it worse: with `enemyAtkMul` 0, Reflect deals more than it does at 0.05.

Recommendation: `scale===undefined?1:scale`, landed as its own live-rule commit that re-records those three fingerprints, alongside the commit that removes back-row damage. The odds are high: it is one line, and the fights that move are known.
