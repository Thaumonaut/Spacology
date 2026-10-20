# Spacology

An expedition game about cataloguing life before the plague reaches it. Build a crew, watch its autobattles, and experiment with Research and Logistics station games.

## Play

- **[Preserved voyage demo](https://thaumonaut.github.io/Spacology/)** — the existing Ops → formation → animated combat flow. The root URL still opens this demo.
- **[Playtest library](https://thaumonaut.github.io/Spacology/prototypes/minigames.html)** — all 13 station games, equipment and team-building labs, runners, expedition slice, and retained animation studies. Also available from **PLAYTEST LIBRARY** on the demo's main menu.

The expanded library becomes live when this revision is deployed. Existing public HTML URLs and browser save keys are retained; moving implementation files does not reset saves.

## Which work is current?

This organization uses **`station-games-checkpoint`** as the newest source checkpoint. New experiments are not replacements for the preserved demo, and their balance models are not automatically authoritative for it.

| Status | Entry points | Purpose |
|---|---|---|
| **Preserved demo** | `prototypes/spacology-v0.1.0.html` | Playable voyage, progression and full battle choreography |
| **Current experiments** | `game/`, `prototypes/minigames/`, `prototypes/labs/team-building/`, `runner-next/` | Three-team expedition, station puzzles, equipment workbench, team-building and 3D runner |
| **Reusable systems** | `prototypes/shared/` | Combat rules/presentation, voyage rules, menus, minigame shell |
| **Earlier experiments** | `prototypes/labs/affix-lab/`, `prototypes/labs/weaver-voyage/`, `prototypes/minigames/relay-runner/` | Independent alternatives retained for comparison, not deleted or silently made canonical |
| **Reference / studies** | `prototypes/animation/`, `mockups/`, worldgen, atlas, art gallery | Staging, visual and world-authoring references |
| **Archived** | `prototypes/superseded/`, earlier versioned animation studies | Historical work; do not start new features here |

The library labels individual entries. “Experiment” means available for playtesting, not approved final design. Synergy Links remains reserved/unassigned.

## Repository map

```text
prototypes/                 Stable public HTML entry points
  demo/                     Preserved voyage implementation
  library/                  Playtest catalogue, filtering and UI
  minigames/<game>/         Game controller, stylesheet and pure model
  labs/<lab>/               Independent experiment models and UI
  shared/
    combat/                 Live resolver, headless host, battle presentation
    minigames/              Shared registry, frame, results and playtest storage
    voyage/                 Session, progression, rewards and voyage rules
    ui/                     Menus and preferences
  animation/                Retained animation studies
  superseded/               Archived prototypes
game/                       Svelte expedition app; published at /expedition/
runner-next/                Three.js runner; published at /runner/
sim/                        Simulation tools (live and independent: see its README)
docs/design/                Current direction, proposals and historical design
docs/testing/               Methods and retained evidence, not a current specification
assets/                     Shared art; original versions retained
mockups/                    Visual references
tests/                      Unit, browser, parity and Pages checks
tools/                      Build and world-authoring utilities
artifacts/                  Retained experiment evidence; not published by Pages
```

Read **[the architecture/reuse guide](docs/architecture.md)** before adding a second copy of a system. **[The design index](docs/design/README.md)** distinguishes the newer three-team direction from older specifications. **[The prototype index](prototypes/README.md)** has mechanics and play instructions.

## Run locally

Use Node 24. Install the root test tools and the two app dependencies:

```sh
npm install
npm --prefix game install
npm --prefix runner-next install
npx playwright install chromium
npm run build:pages
npm run serve:pages
```

Open `http://127.0.0.1:4173/`. The complete preview uses `dist/`, just like Pages. For static prototype development without building the apps, `npm run serve` serves the source tree; `/expedition/` and `/runner/` are build outputs, not source directories. The apps also have their own `npm run dev` commands.

## Verify / publish

```sh
npm run test:unit
npm run test:browser:release
npm --prefix game run check
npm --prefix game test
npm --prefix game run test:browser
npm --prefix runner-next test
npm run build:pages
npm run test:pages
```

`npm test` runs the root unit and browser suites; filters select files by name. Browser tests are **headless** unless `SPACOLOGY_HEADED=1` is explicitly requested. See [browser tests](tests/browser/README.md) for parity and slower tests.

The [Pages workflow](.github/workflows/pages.yml) validates pull requests into `main` and `station-games-checkpoint`. It builds both apps and publishes only `dist/`, not the checkout or dependencies, after successful validation on pushes to `main` or manual dispatch; pull requests and checkpoint merges do not publish it. Pages checks serve under `/Spacology/` to catch subpath errors. The demo, battle and registered station games are precached for offline use after the demo's service worker installs; the newer apps and reference studies need an initial online visit.
