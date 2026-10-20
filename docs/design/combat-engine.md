# The shared combat engine

The live combat rules live in `prototypes/shared/combat/combat-core.js`. The watchable fight loads them as a classic script, and `prototypes/shared/combat/combat-headless.js` runs them in Node (`runFight(spec)`), one isolated context per fight. They were moved out of `watchable-fight.html` unchanged. `tests/unit/combat-headless.cjs` checks 15 recorded fights against the live page, and `tests/browser/combat-core-parity.cjs` checks the page itself, action by action.

## What a host can use

Labs and sims drive the same rules the game plays. Every addition below changes nothing when unused: the 15 recorded fights stay byte-identical.

| Part | What it does |
|---|---|
| `runFight({team \| crew \| session, seed, rng})` | One fight: a prototype team, crew in the live kit format, or a voyage battle set up exactly as the page does |
| `on: {spend, gain, outgoing, afterHit, break, afterIncoming}` | Listen to the fight (`COMBAT_HOOKS`). Payloads carry live units. `gain` may change an Aether credit; `outgoing` may change or multiply a hit before mitigation. Every hit has a kind (basic, skill, ult, follow, chain, reflect, transfer, attack, or a status's name) |
| `rules: {healMul, barrierMul, enemyAtkMul, reformDelay, layerDelta, …}` | This fight's rules (`COMBAT_RULES`), plus the core's own constants (`SOAK`, `BRK`, `EN`, …). An unknown or invalid rule throws |
| `api.enemyAttack(foe, target?)` | An extra enemy attack from a hook, through the normal targeting: never the back row or a summon |
| `u.frozen = n` | A crewmate loses its next n turns, ultimates and extra turns included |
| `metrics`, `state` | The fight's totals (damage by kind, healing, barriers, damage taken, Aether generated, spent, wasted, refused and peak, lowest health, Breaks, deaths and more), and the fight's state as JSON |

The exact payloads and rules are documented where they are declared, at the top of `combat-core.js` and `combat-headless.js`. `tests/unit/combat-hooks.cjs` and `tests/unit/combat-hooks-regressions.cjs` hold them to it.

## Decisions and resolved questions

**The back row is safe in every fight (2026-10-09).** This is a game rule ("never invalidate the safe back row"), confirmed by the user for standalone fights as well as voyages:
- Enemies target only the front row.
- `hit()` lands nothing from an enemy on a back-row or summoned crewmate, by any route: turns, status ticks, reflections, `enemyAttack`.
- The crew is wiped when its front row is down.

Before this, standalone prototype fights let enemies reach the back row; 11 of their 12 fingerprints were re-recorded.

**A zero-scale hit deals nothing (2026-10-09).** `resolveHitDamage` used `src.dmg*(scale||1)`, so a Reflect off a fully absorbed hit, or a Lash with nothing stored, landed at full strength. It is now `scale===undefined?1:scale`. voyage/bridged was re-recorded for this.

**A crewmate felled mid-action (2026-10-09).** The landing review of the hooks commit covered `canShred()` and its neighbours. `canShred()` is correct. Three more effects ran after the actor fell; each is now guarded on the actor still standing:
- Arunima's 15 AV delay;
- Fracture, marks and survey;
- Daven's barrier.

**Decided by the user:** other crew's follow-ups still trigger off an ally who fell mid-action. The action happened and its Break landed.

**Known, no current kit reaches them:** `act.consume` (it would clear a target's Fracture) and `act.follow` (it would advance the next ally) after a mid-action fall.
