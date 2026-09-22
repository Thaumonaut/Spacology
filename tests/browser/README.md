# Browser regressions

These scripts retain regression cases from the prototype reviews. They require Node.js, Playwright and Chromium. They run visible browsers and use isolated browser contexts. Do not run the native-drag scripts concurrently; browser focus can interfere with those interactions.

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
```

`SPACOLOGY_BASE_URL` overrides `http://127.0.0.1:4173`. A Playwright skill runner can also execute these files when Playwright is installed with that skill.

These are focused regressions, not proof that every advertised gameplay system is implemented. See [the systems audit](../../docs/testing/spacology-v0.1.0-systems-audit.md) for outstanding gaps, coverage limits, and the full-voyage evidence. The sealed-pack randomization test samples two packs and can very rarely draw the same contents; investigate any failure before classifying it.
