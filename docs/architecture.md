# Code organization and reuse

## Boundaries

Public HTML entry points remain at `prototypes/<name>.html` deliberately: bookmarks, local save behavior, iframe URLs, and older playtest instructions keep working. Implementations live in grouped directories; the HTML loads them with ordinary classic scripts. Do not move those public pages just to make the tree look tidier.

| Owner | Files | Contract |
|---|---|---|
| Demo | `prototypes/demo/` | Existing voyage UI, using shared rules and saves |
| Minigame | `prototypes/minigames/<id>/` | `*-model.js` has deterministic rules; `<id>.js` owns DOM/input; `<id>.css` owns presentation |
| Minigame shell | `prototypes/shared/minigames/` | Registry, seeds, clocks, assistance, result UI, ratings, storage, embedded result messages |
| Live combat | `prototypes/shared/combat/` | Resolver, hooks, event stream and headless adapter |
| Battle presentation | `shared/combat/battle-presentation.js`, `battle-stage.css` | Existing `playAction()` choreography, effects, stage and controls hosted by `watchable-fight.html` |
| Voyage | `prototypes/shared/voyage/` | Settings, session ownership, progression, recovery and rewards |
| UI | `prototypes/shared/ui/` | Shared pause/settings/help UI and preference persistence |
| Labs | `prototypes/labs/<name>/` | Deliberately independent models; not interchangeable with live combat |
| Library | `prototypes/library/` | One catalogue of entry points and statuses; station records derive from `MiniGameKit.GAMES` |

The equipment workbench is a separate minigame using the team-building model; the 2D runner is a retained standalone game, not part of the 13 station-game result contract. The Svelte and Three.js apps remain separate packages because they have different toolchains.

## Reuse a station game

1. Import `prototypes/minigames/<id>/<id>-model.js` with `require()` for simulation/unit tests. The same module exposes its existing browser global when loaded as a script.
2. Reuse `shared/minigames/minigame-kit.js` and its CSS for the frame, not another copy of seeds, result tiers, timers, or storage. Register new station games in `MiniGameKit.GAMES`; the library discovers them automatically.
3. Use the stable page URL with `?seed=…&difficulty=…` for independent playtests. For expedition embedding, add `embed=expedition&task=…&attempt=…`. The parent validates origin, source, game, task, attempt, seed and difficulty before accepting a result. See `game/src/MiniGameHost.svelte` and `game/src/lib/session.ts`.
4. The Vite asset allowlist in `game/vite.config.ts` emits the three embedded pages, their grouped implementations and shared shell. Extend that allowlist when embedding another game; do not copy implementations into `game/src/`.
5. Add model and browser tests in `tests/unit/` and `tests/browser/`. The library test checks registry coverage and local dependencies; the Pages test checks built paths.

## Reuse battle behavior without forking it

```js
const {runFight} = require('./prototypes/shared/combat/combat-headless.js');
const result = runFight({team:'bloom', planet:'spread', seed:7});
```

The headless host loads the same rule scripts as `watchable-fight.html`, with display callbacks stubbed. `resolveAction()` returns events; the battle page's `playAction()` animates them. The extracted presentation is **not** a generic component: it still expects that page's stage DOM, globals and script order. Reuse the page (standalone or embedded), or explicitly introduce a mount/lifecycle contract before using it in another renderer. Do not duplicate the resolver to reuse its animations.

Retained studies in `prototypes/animation/` are design references, not dependencies of the current stage. Early versioned studies and `prototypes/superseded/` are archived. Independent lab simulations must not be cited as live-resolver parity; see `sim/README.md`.

The retained `tests/unit/combat-fingerprints.json` checks hashes of the complete battle event streams; `combat-headless.cjs` replays its standalone and voyage fixtures. For browser parity, serve the source and run `node tests/browser/combat-core-parity.cjs check tests/unit/combat-fingerprints.json` (`SPACOLOGY_BASE_URL` overrides port 4173). The harness also supports `record <output.json>` / `check <output.json>` for full before/after traces. Do not regenerate fingerprints just to hide a refactor mismatch.

## Saves and publication

No storage keys or migration semantics changed in this organization pass. `spacologyRunV010` remains the demo save and `spacologyMinigamesV1` remains station playtest history. Labs and the expedition keep their own existing storage contracts. Library navigation does not start a new voyage or clear storage.

`tools/build-pages.cjs` builds both apps, copies the static publication allowlist, then installs the app builds at `expedition/` and `runner/`. Asset bases are relative, so the artifact runs at the repository prefix or a custom domain. App source and node_modules are not published. Preview the full inventory with `npm run build:pages && npm run serve:pages`.

`sw.js` precaches the preserved demo, extracted battle presentation and all registered station games. Bump its cache version when changing cached resources. The built-site smoke test verifies a real offline game/battle and a nested deployment prefix. Non-precached experiments are not guaranteed to work offline.

## Status discipline

- Put new playable entries and their status in `prototypes/library/catalogue.js`; do not replace the preserved demo without an explicit design decision.
- Keep one implementation per system. Old experiments may retain their distinct rules; label them instead of silently rewriting them to match current rules.
- Add design proposals to the design index with their authority and limitations. Recorded measurements and screenshots are historical evidence, not “latest” merely because their paths changed.
- Archive obsolete entry points only with a redirect or a retained public page. Avoid renaming shared globals or save keys during a file-organization change.
