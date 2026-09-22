# Browser regressions

For hands-on testing, serve the repository and open [the playtest setup and checklist](../../docs/testing/manual-playtest.html). It provides new-voyage presets (Relaxed / Standard / Hard, starting integrity 50 / 60 / 70), saved checkboxes and notes, and a downloadable report. Settings only apply when starting a new test voyage; existing runs keep their difficulty and earned integrity. The default new voyage starts at 70 integrity.

To test on an iPad on the same Wi-Fi, serve on a LAN interface, for example `python3 -m http.server 4174 --bind 0.0.0.0`, and open `http://<Mac-LAN-IP>:4174/docs/testing/manual-playtest.html`. Keep the Mac awake. This HTTP setup is for online gameplay, not service-worker/offline validation. The current session also has a frozen build under `/tmp/spacology-playtest-f6fa566`, containing commit `f6fa566` plus the integrity/difficulty playtest changes; that temporary copy must be recreated after removal or restart if no longer present.

These scripts retain regression cases from the prototype reviews. They require Node.js, Playwright and Chromium. They run headlessly by default and use isolated browser contexts, so tests do not open windows or take desktop focus. Set `SPACOLOGY_HEADED=1` only when explicitly requesting a visible debugging run. Do not run the native-drag scripts concurrently; browser focus can interfere with those interactions.

Serve the repository root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

With Playwright installed on Node's module path:

```sh
node tests/browser/pack-equipment-regressions.cjs
node tests/browser/formation-regressions.cjs
node tests/browser/rare-reserve-gear.cjs
node tests/browser/art-gallery-filters.cjs
node tests/browser/pack-crew-visibility.cjs
node tests/browser/voyage-settings.cjs
node tests/browser/ops-systems.cjs
node tests/browser/touch-interactions.cjs
```

`SPACOLOGY_BASE_URL` overrides `http://127.0.0.1:4173`. A Playwright skill runner can also execute these files when Playwright is installed with that skill.

These are focused regressions, not proof that every advertised gameplay system is implemented. See [the systems audit](../../docs/testing/spacology-v0.1.0-systems-audit.md) for outstanding gaps, coverage limits, and the full-voyage evidence. The sealed-pack randomization test samples two packs and can very rarely draw the same contents; investigate any failure before classifying it.

The Ops systems update and additional manual checks are described in [the current playtest notes](../../docs/testing/ops-systems-playtest.md). The original audit is historical; its resolved placeholder findings should not be read as the current implementation status.

### Enemy pressure and combat deadline

`enemy-pressure.cjs` checks actual recovery attacks, Assay suppression, capped haste, shield capacity, speed ordering, exact deadline boundaries (including Bloom/ultimates), timed recovery, touch inspection and the full recovery animation. `enemy-balance.cjs` samples 540 seeded fights through the real resolver; it writes `/tmp/spacology-balance-after.json` (override with `SPACOLOGY_BALANCE_OUTPUT`). The strongest fixture is intentionally an upper bound, not an earned-economy build.

```sh
SPACOLOGY_BASE_URL=http://127.0.0.1:4174 node /Users/jek/.agents/skills/playwright/run.js tests/browser/enemy-pressure.cjs
SPACOLOGY_BASE_URL=http://127.0.0.1:4174 node /Users/jek/.agents/skills/playwright/run.js tests/browser/enemy-balance.cjs
```

Port 4174 is the isolated original-roster playtest used for the [recorded tuning comparison](../../docs/testing/enemy-pressure-playtest.md). Port 4173 follows workspace edits, including the concurrent roster expansion. Sampling a different roster/rule revision requires a new comparison; do not label it the recorded baseline. Run browser scripts sequentially to avoid native pointer interference.

`recovery-progress.cjs` covers weighted recovery bands, partial-wave accounting, threshold details, applied integrity and receipt persistence. See [Pages release scoring](../../docs/testing/recovery-progress.md).

`owned-attunement.cjs` checks token upgrades, rank caps, placement, recruitment and combat stats. `gear-crafting.cjs` checks scrap costs, equipped ingredients, cancellation, gear removal and tablet detail layouts. `crystal-controls.cjs` checks crystal selection and held touch-drag confirmation. All three run headlessly.
