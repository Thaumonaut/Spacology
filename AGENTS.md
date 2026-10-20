# Browser testing

Run automated browser tests headlessly by default. The user works on this computer during testing: do not open browser windows, steal focus, or flash UI unless they explicitly request a visible debugging session.

The retained browser tests honor `SPACOLOGY_HEADED=1` as an explicit opt-in. Leave it unset for routine tests. Screenshots and traces can be captured headlessly. Apply this preference to new temporary test scripts as well.

Run the tests with `npm test` from the repository root (after `npm install` once). It serves the site on a free port, runs the unit and browser tests one file at a time, and stays headless. `npm test -- <text>` runs only files whose path contains the text. See `tests/browser/README.md`.

# Game app (game/)

`game/` is a separate Svelte 5 + Vite + TypeScript app ("The ridge expedition") that embeds `prototypes/aether-attunement`, `gear-pack` and `pallet-stacking` in iframes (`?embed=expedition&task=…&attempt=…`, results via `postMessage`). `game/vite.config.ts` bridges those specific repo files and `assets/cast/*` into dev and `dist` (allowlist only). Commands (from `game/`): `npm run dev`, `npm run check` (svelte-check), `npm test` (node --test, session rules), `npm run build`, `npm run test:browser` (builds dist, serves it locally, drives real puzzle solves headlessly; screenshots land in `/tmp/spacology-expedition-*`). The embedded-mode result payload (`delivery`) is produced inside each game's own `shell.finish` result object.
