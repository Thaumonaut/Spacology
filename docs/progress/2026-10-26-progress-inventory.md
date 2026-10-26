# Spacology feature inventory, 2026-10-26

Built from the `progress-review` branch. That branch is `worldgen-integration` (about 20 feature branches merged) with `anime-ab-flags` merged on top. It has 406 commits. 323 of them are dated 2026-10-09 or later.

## How to read this

Status labels:

- **Default on**: you get it when you open the page with no URL flags.
- **Opt-in `?x=y`**: off until you add the URL flag.
- **Study or prototype only**: a separate page, script or set of screenshots. It is not in the default world.
- **Planned**: written down as a goal or brief, not built.

Evidence is a commit hash, an `artifacts/` folder, or both. Anything I could not confirm is marked **unclear**.

How "default" was decided: I read the URL flags in `prototypes/labs/microvoxel-world/lod-stream.js` and `voxel-renderer.js`. The flags that exist are `mesh`, `trees`, `far`, `grass`, `ground`, `flowers`, `flowerStyle`, `leaves`, `outlines`, `gpuMiB`, `lod`, `walk`, `gallery`, `extent`, `seed`, `map`, `cell`, `fov`, plus position flags (`cx`, `cz`, `lx`, `lz`, `yaw`). Smooth terrain and ink outlines are on unless you pass `?mesh=blocky` or `?outlines=0`. `?trees=objects`, `?far=lobes`, `?grass=lush`, `?ground=paint` and `?flowers=anime` are all off unless passed.

The main world page is `prototypes/microvoxel-world.html`. The current world loads with `?extent=infinite&seed=2718` (see `docs/worldgen-integration.md`). The integrated world revision is `micro-wilds-32-integration`.

### Older work, in brief (2026-09-17 to 2026-10-07)

- 2026-09-17: initial commit (`119dcc6`). Then a playable voyage prototype: Ops screen, formation, animated combat, crew copies and ranks, selling crew for gold, dismantling equipment, reserves (`ee9caf8`, `0843517`, `2b1fb67`, `4cb2331`, `c49cb4e`).
- 2026-09-19: notes on running the terrain-diffusion model, and a bridge to its input format (`c8b75ec`, `07bb307`; `docs/design/terrain-diffusion.md`). Research only.
- 2026-09-22 to 09-25: voyage variety, game menus, enemy summoners, cast art, tablet controls (`c49cb4e`, `f6b40a0`).
- 2026-10-06 to 10-07: shared combat engine (`6a9e413`, `590a221`), affix team-building lab (`84d7f87`), one `npm test` command (`629b7e9`).

---

## 1. Microvoxel world

### Terrain, mountains and volcanoes

| Feature | Status | Evidence |
|---|---|---|
| One finite macro map per seed (continents, coasts, climate, rivers, lakes), ported from Azgaar's map templates. Voxel detail sits on top. | Default on | `a7e263a`, `f8ccf06`; `artifacts/terrain-macro-map` |
| Streamed world: plates, climate and biomes, one voxel LOD system, zoom out to a continent view. | Default on | `c5e4f12`, `8661194`, `51df7e1`; `artifacts/terrain-micro-wilds-5` |
| Eroded mountains: gully filter, wandering ranges, snow and glaciers by slope. | Default on | `3d58cd8`; `artifacts/terrain-mountains`, `terrain-mountains-2` |
| Rough rock: strata ledges, rubble, undercut boulder clusters, snow in hollows, rock detail map for close nodes. | Default on | `f70d2a1`, `da9d200`, `30c3b35`; `artifacts/terrain-mountains-rough`, `snow-rock` |
| Fixes for comb-tooth stripes on steep faces, softer cliff bands, calmer peaks. | Default on | `a1dc37f`, `5ebc4b1`, `8ce715a`; `artifacts/terrain-spike-fix` |
| Range styles modelled on real ranges: Alps, Cascades, Rockies, Himalaya, Andes, plus rounded old ranges. Pyramid peaks and sharp crests. | Default on | `714fdd0`, `a7d3047`; `artifacts/range-styles` |
| Five volcano types: Fuji, Rainier, St Helens, Crater Lake caldera, Hawaiian shield. Radial ribs, summit-only snow, no pits in the flanks. | Default on | `51f1164`, `f9b1422`; `artifacts/volcano-types`, `volcano-fixes` |
| Open grass plains between the ranges, with a dithered treeline. | Default on | `6dc7407`; `artifacts/open-plains` |
| Volcano and range inputs reconciled on the integrated world. | Default on | `2adde02` |
| Real elevation data compared with the mountain generator, with measurements and a ranked fix list. | Study only | `ce1af99`; `artifacts/real-terrain` |
| Warped coastline study and a relief baseline capture. | Study only. No README. Unclear whether the generator uses it. | `6518a78`, `09fd572`; `artifacts/terrain-relief` |

### Rivers, lakes and coasts

| Feature | Status | Evidence |
|---|---|---|
| Natural rivers and lakes: crag-aware drainage, meanders, real waterfalls, fewer puddle lakes and comb-tooth creeks. | Default on | `00217d7`; `artifacts/terrain-rivers` |
| Lakes follow the land instead of cutting walls into hillsides. | Default on | `bd28357` |
| River mouths and confluences. Join calculations and channel-mouth tracing restored. | Default on (branch `devin/river-mouths-confluences`) | `05c5bdf`, `07775f4` |
| Every river flows. Speed comes from slope. White-water rapids and calm pools. No current at sea; gentle estuaries. | Default on | `db5e31e`, `58079ef`, `6078900`, `15e4a82` |
| Water look: clear shallows, thin shore foam, soft caustics, sun glints, low-poly facets. | Default on | `6a76660`, `e967f67`, `dd41d8b`; `artifacts/voxel-rendering` shots 29-30 |
| Fractal rivers and local drainage routing. | Study only. Before/after maps only. Unclear whether the default world uses them. An older drainage model is kept at `prototypes/labs/microvoxel-world/voxel-world-model-local-drainage.js`. | `9957210`, `2154176`; `artifacts/terrain-rivers-fractal` |

### Biomes and ground

| Feature | Status | Evidence |
|---|---|---|
| Greener land and new regional biomes (autumn wood, blossom grove, fen, rose-grass prairie, golden savanna, bamboo). | Default on | `c9ea0c5`; `artifacts/terrain-biomes` |
| Biome borders that meander and blend, with dithered transition bands for ground, trees and scatter. | Default on | `a068ce6`; `artifacts/terrain-biome-edges` |
| River corridor ecology: oasis ribbons, willows, jungle overhang, cattails, lily pads, rocky fast reaches. | Default on | `a9d5f6b`; `artifacts/terrain-riparian` |
| Biome colour palettes for undergrowth, sky and fog. | Default on | `f802c78`, `45c3d63` |
| Smooth terrain (Surface Nets mesh) for ground, rock, snow, sand and water. Trees and ruins stay blocky. | Default on. `?mesh=blocky` restores blocky ground for comparison. | `e04dd40`, `dd41d8b`; `artifacts/voxel-rendering` shots 26a/26b |
| Painted ground: soft patches that span many voxels, instead of per-voxel colour. | Opt-in `?ground=paint` | `5a2cb7d`; `artifacts/anime-ground`, `anime-together` |
| Finer cliff mesh `?cliffs=fine`. | Study only. Made no visible difference. Not ported to this branch. | `artifacts/anime-cliffs`, `artifacts/anime-together` |

### Trees and vegetation

| Feature | Status | Evidence |
|---|---|---|
| Voxel trees: species, size classes, scatter, world tree, giant sequoia, conifer tiers, oak, birch, palms, bamboo, cacti, ferns, understory. | Default on | `e6839e2`, `dda4d0b`, `475ddd5`, `787d929`, `ef8273a`; `artifacts/terrain-vegetation` |
| Leaf cards on crowns, tiered conifer skirts, snow on trees standing on snow. | Default on | `619c1c3`, `4bd02d1`; `artifacts/voxel-rendering` shots 8-21 |
| Treeline: forest thins and turns to conifers with altitude. Trees climb the mountains. | Default on | `65bdc78`, `1795f37` |
| Mushrooms, logs, stumps and palm fronds as smooth objects rather than voxels. | Default on | `ab74475`, `32592f5`, `481a90d`, `fb38ad9` |
| **Trees as objects**: nearby trees drawn as instanced crowns (lobes, tiers, willow strands, birch masses, bushes) instead of voxels. | **Opt-in `?trees=objects`**. The code comment in `lod-stream.js` says "under evaluation". | `b70734f` (first pass), `3c88dc7`, `667eeab`, `0ffd697`, `3271aad`, `6a17173`, `b420999`, `d740931` |
| Distant trees as object crowns, then low-res billboards, instead of voxel columns. | Opt-in `?far=lobes` | `5a2cb7d`; `artifacts/anime-far-trees`, `anime-v2` |
| Conifer leaf-card outline choice (`round`, `soft`, `hard`, `round+soft`, `mixed`). | Opt-in `?leaves=...`. Default is `mixed`. | `artifacts/voxel-rendering` shot 12 |
| Specimen gallery: one of each tree, prop, ruin, rock arch and crystal on a flat field. | Opt-in `?gallery=1` | `949c961`, `fd8c125`; `prototypes/labs/microvoxel-world/README.md` |

### Grass and flowers

| Feature | Status | Evidence |
|---|---|---|
| Wind-blown grass in long curved clumps over a shared meadow colour. Tone follows the biome. | Default on | `94cf6a9`, `1d69cfa`, `0ba9fff`, `9b1ce35` |
| Flowers drawn as props (stem and five-lobe head) instead of voxel cubes. | Default on | `fe15a7d`; `artifacts/voxel-rendering` shot 27 |
| Anime flowers: small bright heads (pink five-point stars, white six-point lilies, cosmos) in clusters of five, on thin bent stems, heads at grass height, each turned and tipped its own way. | Opt-in `?flowers=anime`. Still being iterated (`09c9795` is marked WIP). | `5a2cb7d`, `09c9795`; `artifacts/anime-flowers`, `anime-v2` to `anime-v7` |
| Anime flower head style menu. Page options: Mixed, Pink star, White lily, Cosmos, Painted. | Opt-in `?flowerStyle=mixed\|star\|lily\|cosmos\|painted`. Choosing a style also turns on anime flowers. | `09c9795`; `artifacts/anime-v6`, `anime-v7` |
| Lush grass: 40 tufts per m2 instead of 24, bigger Walk tuft budget, Walk grass fades at 60-120 m instead of 30-60 m. Walk grass now fills nearest tiles first. | Opt-in `?grass=lush` | `09c9795`; `artifacts/anime-v3` |

### Rocks, ruins, castles, cities and buildings

| Feature | Status | Evidence |
|---|---|---|
| Pixel-art voxel stone for boulders and cliffs, flagstone paths, cel-shaded rock. | Default on | `2c22695`, `78b3117`; `artifacts/voxel-rendering` shots 15, 24, 25 (shot 25 is marked WIP) |
| Overgrown ruins in the world: a castle, a town and a temple site; masonry courses, rubble, vines, moss. | Default on (ruin code is in `voxel-world-model.js`) | `39e770f`, `e6839e2` |
| Anime ruin kit (pillars, arches, arcades, roofs, per-building decay) and castle-island ruins. | Study only. Packaged as a variant, not in the default world. | `a3b8bdf`, `2bcabe9`, `d851bda`; `artifacts/ruins-anime`, `artifacts/integration-variants/ruins-anime` |
| Fairy-tale castle generator and viewer, with Walk interiors, ring/spur/palace/linked layouts. | Study only (separate page) | `addd322`, `e7c7a32`, `a2c6ec4`; `artifacts/castle-drafts`; `prototypes/labs/castle-drafts/` |
| City drafts: walled cities of about 3,000-4,000 buildings, plaza, cathedral, guildhall, markets, bridges, hills, river quays, moat rivers, townsfolk, anime look. | Study only (separate page) | `d380963`, `9eec8eb`, `82004a6`, `cd29229`, `e8f5871`; `artifacts/castle-drafts` |
| Town building kit and streamed city pages. | Study only | `4507d50`, `78eaf53`, `a8b2543`; `prototypes/labs/castle-drafts/toolkit/` |
| City slice: three.js/WebGPU enterable city with PBR textures, cel shading first pass. | Study only | `c05c2c1`, `3a97584`, `9a53d99`; `artifacts/city-slice` |
| Building lab: one seeded building inside and out. Seven house plans, stairs, shop fronts, jetties, shaped lots, facade styles, roof forms. | Study only (`prototypes/building-lab.html`) | `64ba12e` to `4414759`; `artifacts/building-generator` |
| Structures design brief: shacks to cities, decay, Walk interiors, dungeons. | Planned | `80e23a4`; `docs/design/structures-and-dungeons.md` |

### Atmosphere: fog, clouds, sky, lighting, outlines

| Feature | Status | Evidence |
|---|---|---|
| Layered fog: aerial perspective, ground mist, drifting banks. Slider default 50. Fog rises with altitude (thick low, clear high). No snap-in while walking. | Default on | `039e258`, `867025e`, `27e2765`; `artifacts/voxel-rendering` fog shots |
| Golden-hour cumulus clouds in wide views, gathered into banks with wisps. Slider default 85. | Default on | `998ac5b`, `8600530`, `32cab3d`; `artifacts/voxel-rendering` shots 17-18 |
| Drifting cloud shadows over the land. | Default on | `5f77c17` |
| Soft sun shadows from trees, spires, stones, isles and crew. | Default on | `a3fd679`; `artifacts/voxel-rendering` shots 2, 16 |
| Warm strong sun over cool fill on rock and steep ground. | Default on | `1a1a300`; `artifacts/voxel-lighting` |
| Ink outlines around silhouettes. | Default on. `?outlines=0` turns them off. | `0886fe4`, `33c2c0d`; `artifacts/voxel-rendering` shots 19-20 |
| Curved horizon, 10 km view, fog hides loading, per-voxel fade-in. | Default on | `60f8e12` |

### Streaming, LOD and performance

| Feature | Status | Evidence |
|---|---|---|
| Bounded voxel world with compressed storage and worker meshing. | Default on | `a7065f5`, `57372ec` |
| Floating-origin streaming for huge distances. Streamed world is now the default. | Default on | `464a1b2`, `a38d85d` |
| Streamed columns 512 m tall; 10 km streamed world height; 3D chunk slices. | Default on | `ddb28a0`, `f86c2dc` |
| Packed GPU data: indexed smooth meshes with 10-byte vertices, 8-byte grass tufts. | Default on | `4d82d7d`, `beb4183` |
| Per-frame upload budget, work moved to workers so far views pan smoothly. Device-based GPU budget: 640 MiB desktop, 256 or 192 MiB phone, `?gpuMiB=` overrides, Economy 128 MiB. | Default on | `f6d665b`, `11b5dc0`, `60f8e12`; `lod-stream.js` |
| Same view gives same level and pixels regardless of cache history. | Default on | `7f392e3` |
| In-page Performance panel; manual LOD pin menu (`?lod=v4`). | Default on | `prototypes/labs/microvoxel-world/README.md` |
| Benchmark of node generation against another branch: about 15.9-16.3 ms/node here. | Tool | `tools/benchmark-lod.cjs`; `docs/worldgen-integration.md` |

### Walk mode, crew and co-op

| Feature | Status | Evidence |
|---|---|---|
| First-person Walk (WASD, mouse look, touch stick, jump, swim, collision, steers around round obstacles). Enter from the toolbar or by double-click. Walk FOV slider default 70. | Default on | `8716b7a`, `ef8273a`, `3e8a64c`, `34f02dc`; `docs/design/first-person-walk-mode.md` |
| View menu with Peek (see under tree cover) and X-ray for hidden crew. | Default on | `ef722a4`, `ffda786`, `d988c27`, `d269221` |
| Crew figures that walk the world, with ground contact and pause. | Default on | `a7065f5`; `tests/browser/microvoxel-world.cjs` |
| Hex atlas draped on the terrain, with task-linked crew. | Default on | `a38d85d` |
| Barrier terrain (massifs, gorges) and engineered crossings on the supply line. | Default on | `220dd4b`, `f736f32` |
| Co-op supply line: up to three players split Exploration, Research and Logistics over a night/day/dusk clock, via room codes (PeerJS or same-browser tabs). | Default on in the World Lab | `2944d0b`, `683d5a1`, `fd7b8cf`, `ff6fb04`; `tests/unit/coop-session.cjs` |

### Anime look A/B flags and the View > Anime looks panel

Four buttons in View > Anime looks toggle the flags. A fifth control, Flower style, sets `?flowerStyle`. Each click reloads the page at the same spot, heading and Walk state (`look-flags.js`). The flags were added on the `anime-ab-flags` branch in `5a2cb7d` and merged in `fa68ef8`.

| Button | Flag | Status | Evidence |
|---|---|---|---|
| Ground | `?ground=paint` | Opt-in | `artifacts/anime-ground` |
| Flowers | `?flowers=anime` (+ `?flowerStyle=`) | Opt-in | `artifacts/anime-flowers`, `anime-v4` to `anime-v7` |
| Far trees | `?far=lobes` | Opt-in | `artifacts/anime-far-trees`, `anime-v2` |
| Grass | `?grass=lush` | Opt-in | `artifacts/anime-v3` |
| All together | all four | Study | `artifacts/anime-together` |

On the 2026-10-26 benchmark, `?far=lobes` used fewer terrain bytes (156 KiB vs 600 KiB in a 35-node sample) but took longer to generate (42.7 vs 36.5 ms/node). Source: `docs/worldgen-integration.md`.

---

## 2. Game app and station mini-games

| Feature | Status | Evidence |
|---|---|---|
| **The ridge expedition** (`game/`): Svelte 5 + Vite + TypeScript app with Exploration, Research and Logistics departments and a shared session. It embeds three station games in iframes and takes results by `postMessage`. Published at `/expedition/`. | Prototype ("current experiment" per `README.md`) | `371050b`, `8bc4b37`; `game/src`, `game/tests/session.test.ts`, `game/tests/browser.cjs` |
| Station mini-games, 13 in the playtest library: aether attunement, core assay, depot sorting, DNA sequencing, element pairs, gear pack, intel check, pallet stacking, pipes, route planning, sensor grid, signal decoding, supply run. Equipment puzzle and synergy links also exist. Synergy links is "reserved/unassigned". | Prototype | `fc7db65`, `371050b`; `prototypes/minigames/`; `docs/design/three-teams-and-station-games.md` |
| Sensor grid: smooth zone shapes, dynamic islands, Sensor/Cross tap switch. | Prototype | `afc1236`; `artifacts/sensor-grid-readability`, `sensor-grid-controls` |
| Element Pairs ported into grouped mini-games. | Prototype | `b20279d` |
| Playtest library: one page listing all games and labs, plus reusable systems under `prototypes/shared/`. | Prototype | `8bc4b37`; `prototypes/minigames.html`, `docs/architecture.md` |
| Weaver voyage lab; affix team-building lab; team-building lab. | Prototype (kept for comparison, "not made canonical") | `ebcb789`, `84d7f87`; `prototypes/labs/` |
| Shared combat engine: hooks, per-fight rules, metrics. Back row is safe in every fight. | Shared system | `fb69535`, `6036ba0`, `6a9e413`; `docs/design/combat-engine.md` |
| Preserved voyage demo (Ops, formation, animated battle). | Preserved demo | `prototypes/spacology-v0.1.0.html`; `README.md` |
| Relay Run: Horizon, a 2.5D three.js runner. | Prototype | `runner-next/README.md` |
| Worldgen field board comparing the three runnable worlds and the building/city labs. | Study | `prototypes/worldgen-integration.html`; `docs/worldgen-integration.md` |

---

## 3. Tooling and tests

| Feature | Status | Evidence |
|---|---|---|
| `npm test` runner: starts its own server, runs unit and browser files one at a time, headless by default. `npm test -- <text>` filters. `SPACOLOGY_HEADED=1` opts in to a visible browser. | Default | `629b7e9`; `tests/run.cjs`, `tests/serve.cjs`, `tests/unit/test-runner.cjs` |
| Release gate `npm run test:browser:release` (13 station games, library, offline launch, battle safe area, microvoxel world). Pages workflow validates pull requests. | Default | `7e5d6ee`, `1fa4360`; `tests/browser/README.md` |
| Microvoxel browser tests: launch, camera, shadows, motion, streaming, crossings, walk, walk props, grand tree, co-op. | Default | `tests/browser/microvoxel-world-*.cjs` |
| Microvoxel unit tests: world, hillshade, shadows, slices, gallery, walk, grand tree, crown reach, crystal material, structures, ground-mat halo, terrain crossings. | Default | `tests/unit/microvoxel-*.cjs`, `terrain-crossings.cjs` |
| Building and city tests: building plan/voxels, castle city, city frontage, neighbourhoods, district, dense, circular, town kit/interiors/floorplans/infinite, room comparison, building lab. | Default | `tests/unit/`, `tests/browser/building-lab.cjs`, `town-*.cjs`, `city-scale-lod.cjs` |
| Touch input fixes: native taps and drags on one channel; failures captured. | Default | `2a0103c`, `08a4aa0`, `996c81c` |
| Game app checks: `npm --prefix game run check`, `npm --prefix game test`, `npm --prefix game run test:browser`. | Default | `game/package.json` |
| Screenshot and probe tools: `tools/__ground-shot.cjs`, `__anime-shot.cjs`, `__cliffs-shot.cjs`, `__grass-shot.cjs`, `__tree-shot.cjs`, `__mountain-shot.cjs`, `__gallery-shot.cjs`, `__crystal-shot.cjs`, `__walk-probe.cjs`, `__walk-view.cjs`, `__peak-find.cjs`. | Tooling | `tools/` |
| Benchmarks and surveys: `benchmark-lod.cjs`, `benchmark-microvoxel.cjs`, `survey-microvoxel.cjs`, `packing-smooth.cjs`, `packing-survey.cjs`, `snow-survey.cjs`, `check-river-connections.cjs`. | Tooling | `tools/` |
| Map and packaging: `render-macro-map.cjs`, `package-microvoxel.cjs` (standalone offline file), `build-pages.cjs`. Terrain study scripts live in `tools/terrain-study/`. | Tooling | `tools/` |
| Python helpers: `cond_to_tiff.py`, `fmg_conditioning.py` (terrain-diffusion input), asset importers. | Tooling | `tools/` |

---

## Known gaps and open questions

Each item comes from the named README or commit. Quotes are shortened.

**Integration (`docs/worldgen-integration.md`)**
- "This is an integration checkpoint, not a claim that every experimental generator can run as the default world simultaneously."
- `microvoxel-crystal-material` and `microvoxel-structures` unit tests "remain present and failing against the integrated default, rather than being disabled."
- "Other browser journeys and GPU/frame-time comparisons between variants have not been validated yet."
- `?far=lobes`: GPU timings and appearance "need separate evaluation".
- The anime/crystal world and the ruins/castles world are "separate experiments", kept as packaged variants.

**Anime flags**
- `artifacts/anime-ground`: possible tile-edge seam when the paint warp reaches past the two-column halo ("Not checked yet... before making this the default"). Also: no second spot with sand, dirt or gravel; moss edge left soft.
- `artifacts/anime-flowers`: flower density depends on the generator, so "Thickening the drifts would be a separate generator change". Far fields do not show as colour masses. Edges "still hard".
- `artifacts/anime-far-trees`: levels 5+ "still voxel canopy"; conifers unchecked; the hand-over from level-0 voxel trees to level-1 crowns "could pop while walking"; a second viewpoint "still needs a shot".
- `artifacts/anime-cliffs`: the mesher is not the cause of un-anime cliffs. Round 2 suggested (one rock tone per stratum; per-pixel material choice) and was not run in these folders.
- Commit `09c9795` says the flower look is "still being iterated with the user" and "full pass owed before merging to main".

**Terrain**
- `artifacts/range-styles`: comparisons are "pre-rescale"; the world is "about 1/3 of real scale" and "is about to be rescaled", so size-based numbers should not be tuned against. Valleys "still V-sharp" ("the main open discrepancy").
- `artifacts/real-terrain`: ranked fix list. Volcano cone fix was measured. "There is no flat land" and "Drainage is half as dense" fixes are marked "(untested)".
- `artifacts/volcano-types`: `artifacts/real-terrain` describes `micro-wilds-29`; its volcano areas "no longer match this revision's volcanoes".
- `artifacts/terrain-mountains-2`: "Known issue (outside this change)": trees stand on snow, glacier and alpine rock (density fallback in `treeStyle`).
- `artifacts/terrain-riparian`: sand and gravel bars on bends "are not built".

**Structures**
- `artifacts/castle-drafts`: street views are heavy ("Too heavy for phones"); fix is instancing repeated pieces and dropping detail from the shadow pass. Interiors in city drafts are "parked" (`?interiors=1` re-enables).
- `prototypes/labs/castle-drafts/toolkit/CONTENT-ROADMAP.md`: multi-wing compounds "do not yet have indoor cross-wing passages"; stable street/building IDs and addresses are future work.
- `artifacts/city-slice`: shading is PBR plus a first cel-shading pass; first-pass textures "too coarse" (`s1`).
- `docs/design/structures-and-dungeons.md`: design brief only (dungeons, size ladder).

**Microvoxel World Lab (`prototypes/labs/microvoxel-world/README.md`)**
- "No mutation/editing API"; "No pathfinding, road validity, construction, discoveries or Research handoff is implemented yet."
- "Human visual approval and real tablet/phone GPU testing remain gates before scaling."

**Game and design**
- `docs/design/three-teams-and-station-games.md` section 10 lists nine open questions, including gear assembly ("why it is unfun"), day/night assignment of each game, Research's effect on battles, and what logistics does solo.
- `tests/browser/README.md`: this "is not a claim that the entire historical browser suite is green". `touch-interactions.cjs` and `voyage-return.cjs` "still assume that Continue is visible before a voyage starts".
- `README.md`: the Pages workflow publishes only on `main`; newer apps "need an initial online visit" to work offline.

**Unclear**
- Whether the fractal rivers, warped coastline and relief captures (no README) are wired into the default generator.
- Whether the City slice and castle drafts have any plan to join the main world beyond the structures brief.
