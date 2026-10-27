# City Lab Rust/WASM comparison

JavaScript remains the default. Rust/WASM is an **opt-in CPU backend**, not a
Rust renderer, room/furniture planner port or native-engine migration. This
follow-up uses the currently served 661,088-byte WASM, SHA-256
`d115b8d77bce7c4f3e02a033422d6f99d665cabaf23e33e1cab593d11d9605b8`.
The older broad `comparison.json`/`comparison.md` output is historical, not a
measurement of this final batch/compact ABI build.

## Reproduce and scope

From the repository root, with installed toolchains/dependencies. These are CPU
commands; headless browser results are reported separately below:

```sh
source ~/.nvm/nvm.sh && nvm use 24
cargo fmt --manifest-path prototypes/labs/city-lab/rust/Cargo.toml -- --check
cargo check --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --locked
cargo clippy --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --all-targets --locked -- -D warnings
cargo test --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --locked
node tools/build-city-rust.cjs --test
npm test -- --unit city- building-plan building-voxels building-walk
node --expose-gc tools/benchmark-city-rust.cjs --bounded --repeats=3
cargo build --manifest-path output/city-rust-native-probe/Cargo.toml --release --locked
node --expose-gc output/city-rust-native-probe/probe.cjs
```

Node v24.19.0, Linux x64, Intel Xeon. Samples ran **serially**, flat before
uneven, with one excluded warm-up and three measured pairs in JS/Rust, Rust/JS,
JS/Rust order per phase. GC runs outside timed regions. Fresh-process WASM load
was 5.971–6.607 ms across three processes, not a cold filesystem/browser cache.

The bounded fixture is **seed 1, woven, count option 24, width 1, stream, sparse**,
eye `[0,1.6,0]`, height 720, FOV 70 degrees, forward `[0,1]`. It measures all 24
startup facade jobs and **one representative parcel-0 sparse exterior job**, not
the complete stream-target set, interiors or scene-settle time. Shared JS plan
and exterior voxel generation are sampled separately. Every timed JS/Rust pair
checks bounds, summary, exact typed buffers (facade quad ordering canonicalized),
sparse materials/frame and output bytes. Failure withholds completed output.

Raw current results (ignored output, not functional source):

- `output/city-rust-comparison/bounded.json`: 12 paired rows, 12 shared-JS rows,
  three cold loads, exact fixture/plan/voxel/WASM hashes, targets, ABI clocks,
  copies, output counts and final WASM capacity.
- `output/city-rust-native-probe/native-vs-wasm.json` and `.md`: native optimized
  ABI diagnostic, six phase/terrain rows, three rounds each and exact native/
  WASM metadata and typed-buffer parity. Probe sources are in that same ignored
  directory. No migration is proposed.

The full benchmark mode remains available but was **not rerun** for this bounded
follow-up. Its broad correctness suite was run separately on this served WASM.

## Current focused validation

Cargo check/fmt/clippy succeeded; **46 native tests** passed. The served-WASM
build passed typed-buffer ABI diagnostics, **200 free cycles**, growth/error/
readiness checks and reported all **ten operations implemented**, no pending ops.

The root focused command ran 20 files: 18 passed initially, two failed on stale
assertions. `city-rust-parity.cjs` still expected the former 2-near/8-exterior
caps instead of the actual 6/16 policy. `city-rust.cjs` distinguished JSON's `0`
from JS `-0` in door-model metadata. Only those assertions were aligned: nonzero
model terms, geometry/material/collision buffers and all other fields remain
exact. Both failed files then passed when rerun directly:

```sh
node tests/unit/city-rust-parity.cjs
node tests/unit/city-rust.cjs
```

Final broad parity: **108** complete topologies; **417** real plans/facades;
**1,251** coarse conversions; **12** real dense volumes; **36** sparse cases;
**162,132** material samples; **1,341** streaming paths (including the new
buffer/turn/pinned matrix); **64** prefetch cases; **100** repeat cycles. Final
live ABI allocations/bytes were zero; broad-test WASM capacity was 129,826,816
bytes (retained high-water memory, not resident GPU geometry).

Other passing focused files cover BuildingPlan, BuildingVoxels, BuildingWalk,
City door-stream/facade/frustum/green/model/render-stream/sparse/storage/stream/
walk/World/World-renderer, single-call dense batches, no-JS-fallback operation
spies and classic-worker ready/error/stale-epoch schemas. Exact E-position/yaw
CPU contracts are not a physical-entry browser acceptance claim.

## Matched bounded CPU results

Medians in milliseconds, **three samples per row**:

| Terrain | Work | JS wall | Rust wall | Overlapping shared JS in Rust wall |
| --- | --- | ---: | ---: | ---: |
| Flat | 24 startup facade jobs | 210.400 | 192.410 | 146.757 |
| Uneven | 24 startup facade jobs | 196.534 | 204.904 | 150.790 |
| Flat | One exterior sparse job | 539.206 | 381.642 | 266.254 |
| Uneven | One exterior sparse job | 813.117 | 387.067 | 255.156 |

Independent ABI-clock medians (not additive phase walls):

| Terrain/work | Encode | Copy in | Rust execute | Copy-out bookkeeping | Decode/owned arrays |
| --- | ---: | ---: | ---: | ---: | ---: |
| Flat/24 facades | 17.641 | .132 | 31.658 | .048 | .805 |
| Uneven/24 facades | 14.115 | .146 | 36.215 | .057 | .855 |
| Flat/exterior sparse | 8.153 | 7.033 | 81.456 | .005 | .179 |
| Uneven/exterior sparse | 18.375 | 5.236 | 92.908 | .006 | .190 |

Encode includes JSON/binary packet packing. Execute includes Rust packet
parsing, internal copies and serialization, **not just the algorithm**. There is
no full output-packet copy; decode copies owned result arrays. Batch jobs report
one `timings.batch` wall and one real `geometry.prepare` dispatch, not fabricated
per-substep clocks. JS walls include shared generation too.

Separately sampled shared JS medians: plan **9.725 ms flat / 3.292 ms uneven**;
exterior dense voxels **267.071 / 186.817 ms**. The plan and voxel hashes are
identical between terrains; later fixtures benefit from warm JIT/cache state.
The timings are noisy and deliberately descriptive, not statistical confidence,
terrain cost estimates, or evidence of a general end-to-end speedup. Facade
results are mixed; dense conversion improves in this small sample but unchanged
JS generation remains substantial.

Both engines produced **1,211,840 bytes / 21,640 quads** for 24 facades, and
**296,400 sparse bytes**, 839 unique mixed bricks, 19,199 mixed cells for the
representative exterior. Source dense volume is **21,183,552 bytes**
`[184,369,312]`; one Rust batch sends it plus 1,024 palette bytes and returns no
dense source unless navigation was requested. Final bounded live ABI bytes/
allocations are **zero**; retained WASM capacity **66,387,968 bytes**.
Zero live allocations does not mean zero retained WASM capacity or JS heap.

## Native vs WASM diagnostic (not an app migration)

Native optimized dispatch runs the same ABI packets after file read, with an
excluded warm-up and three timed rounds. Process launch, file I/O, JS packet
encode/decode are excluded from **native** clocks. WASM wall includes browser-
loader-style ABI encode/copy/decode; WASM execute is the comparable inner clock.
The streaming row deliberately uses the legacy whole-city JSON path, not compact
cached production streaming. Native/WASM buffers and metadata are exact.

| Terrain | Operation | JS ms | WASM wall ms | WASM execute ms | Native ABI ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Flat | Legacy stream.targets | .059 | .993 | .672 | .347 |
| Uneven | Legacy stream.targets | .089 | .996 | .675 | .431 |
| Flat | mesh.segment | 1235.364 | 488.175 | 473.253 | 321.857 |
| Uneven | mesh.segment | 1303.808 | 492.418 | 476.973 | 320.055 |
| Flat | sparse.pack | 161.819 | 62.269 | 47.579 | 68.329 |
| Uneven | sparse.pack | 196.314 | 105.599 | 88.859 | 94.760 |

Native is not universally faster (notably sparse); it does not remove shared JS
planning/volume generation or solve renderer/GPU costs. These are CPU/ABI probes,
not a recommendation to replace the browser app. Native probe retained WASM
capacity was 72,155,136 bytes; its per-phase live-allocation assertions passed.

## Runtime ownership, buffers and observability

Rust owns the ten public CPU operations and the optional compact-stream and
prepare/door/open/convert batch extensions of those same operations. Shared JS
still owns BuildingPlan/BuildingVoxels, facade spans/mask decomposition, leaf
selection, navigation/collision/movable-door state, environment/vegetation,
bounds/summary, worker queues and WebGL/uploads. No full Rust rewrite is claimed.
Buildings retain hard normals/material IDs; vegetation keeps its separate soft
normal path. See City Lab `README.md` and Rust `CONTRACT.md` for exact schemas.

The frame/CPU samples in this report predate the expanded-coverage policy.
Current streaming quotas are **16 all-around + 24 view-facing + 24 held
exteriors (64 total including pinned)**, **six close-protection flags**. All
exterior targets can use full-resolution sparse bricks, not only close ones;
view-facing selection uses the aspect-correct horizontal FOV plus 10° padding.
The acquire/retain thresholds remain unchanged:
14/20 m close acquire/retain, 36/48 m local detail, 96/120 m forward detail with
angular/projection padding, 112 m held turn buffer and 24/32 m ranking hysteresis.
No direction uses 64/80 m all-around. Prisms include overhang/envelope expansion;
frustum culling skips passes without unloading residents. One ready closed-door
interior is prefetched at 12 m/retained at 18 m, never through proximity targets.
Three light facade/low jobs may pipeline; dense jobs remain exclusive.

The **128 MiB resident geometry cap** includes access meshes, meshes, sparse
textures and conservative replacement peaks; it is distinct from 256 MiB ABI
packet and 512 MiB live-registry caps. Replacement stages first and releases
partial GL allocations on failure; budget refusal retains available geometry and
does not open an unrenderable doorway. Telemetry/error rings retain 600 entries.

Snapshots expose `scheduling.calls/ms/posted/peakInflight/cancelled`, queue/
receive/upload `jobPhases`, resident/enabled/drawn/cull counts in `renderMetrics`,
shadow cache status, upload CPU and asynchronous GPU timer values. Cached shadow
passes report null derived cull counts. **This CPU run did not measure these
worker/scheduler/renderer/GPU phases.** SoftwareGL/headless FPS is a backend
caveat, not hardware/mobile evidence. No phone/tablet FPS or visual claim is made.

## Outstanding quality and browser test contract

The independent shared-baseline party-wall audit still finds **36 matrix cases**
with unequal-depth neighbours advertised as full-depth party walls. Reproduction:
seed 1, woven, count option 100, width .75: parcels **12 (12 m)** and
**13 (10.5 m)**. `city-model.js` sets party flags from frontage adjacency without
testing equal rear depth; Rust preserves the same options. No golden or quality
check was relaxed. This blocks overall quality certification despite engine parity.

Only the parent's persistent testing agent should run headless UI acceptance.
Keep `SPACOLOGY_HEADED` unset. Minimal matched-path checks:

1. `/prototypes/city-lab.html`: seed 1/woven/count24/stream/sparse, flat first then
   uneven, JS then explicit Rust. Check visible Rust missing-WASM error (no JS
   fallback), matched architecture/materials/hard vs organic normals, orbit/walk
   camera-forward sign, nearby/offscreen turn buffer, bounded queue/cull counters.
2. Approach a ready closed door, confirm no proximity interiors, E keeps exact
   position/yaw with no new full job, physical enter/exit, closed-wall collision,
   one retained/released interior, stale epochs/engine switches and 128 MiB cap.
3. World exterior bridge:
   `/prototypes/microvoxel-world.html?district=6&citySeed=2718&engine=js&walk=1`
   then `?district=12&citySeed=2718&engine=rust&walk=1`, optionally append
   `&districtTerrain=uneven`. Check IDs/materials/rigid Y placement, unchanged XZ,
   hard building normals/soft vegetation and release. Ordinary World default is
   unchanged. The bridge budgets 80 MiB terrain + 47 MiB buildings + palette,
   preflights 64 MiB dense scratch and 32 MiB reply, and retains no dense sources.
   It is closed-exterior-only: it does **not** certify World E doors, furnished
   interiors, exact multi-floor collision or shared-world walk quality.

Only executed checks can pass. The contract above is not itself evidence of
shared-world enterability or hardware/mobile performance.

## Headless City acceptance and matched frame samples

The persistent testing agent ran the required seed 1 / woven / width 1 / count
24 / stream / sparse fixture headlessly. Flat JS and explicit Rust retained
recognizable nearby roofs, windows, timber, doors and projections through turns.
Door-approach prefetch finished while the door was closed; E preserved exact
XYZ/yaw and did not start another full job. Collision-driven walking in/out,
closed-door blocking, cached re-entry and eventual resident-interior release
passed. Rust uneven terrain also passed the physical doorway lifecycle. This
does not certify all generated seeds or resolve the party-wall issue above.

Frame samples used identical 1440×900 viewport, camera and settled scene
geometry, with 45 RAF intervals per engine/view. A non-atomic staging attempt
produced different hysteresis geometry and was rejected; only the corrected
matched run is reported:

| View | Engine | p50 ms | p95 ms | p99 ms |
| --- | --- | ---: | ---: | ---: |
| Aerial | JS | 66.7 | 83.4 | 100.1 |
| Aerial | Rust | 83.3 | 100.0 | 100.1 |
| Street | JS | 416.6 | 466.6 | 499.9 |
| Street | Rust | 350.0 | 466.6 | 499.9 |

Matched street counters: **897,178 main triangles, 26 main draw calls, three
drawn/four resident sparse volumes, 26,441,554 resident GPU geometry bytes**.
Aerial counters: 48,058 main triangles, 26 main calls, no sparse volumes,
1,342,424 GPU geometry bytes. Total calls were 27 with cached shadows; these are
not a claim of 27 fresh shadow draws. Initial facade-ready observations were
1.292 s JS / 1.386 s Rust, one observation each, not a stable loading benchmark.

These runs used **SwiftShader/software rendering**, not a phone or physical
GPU. Asynchronous GPU timing was unsupported. CPU upload time is not GPU time.
Rust's CPU generation improvement therefore remains distinct from rendering:
the mixed frame results do **not** establish an overall Rust browser FPS win.
No resolution, shader quality or raymarch-step reduction was used to win.

Machine-readable evidence (ignored local output):
`output/city-buffered-world-ui/resume/matched-performance.json` and
`matched-preflight.json` in the same directory. The valid City doorway recording
is `output/city-buffered-world-ui/primary-rust-buffered-door.mp4`.

## World renderer regression and focused revalidation

The first flat six-building JS WebGL gate failed despite passing mesh/unit
checks and GL error zero: rear/occluded architecture appeared through the front
facade. A bounded diagnostic matched the source parcel, options and 46,717-quad
greedy City mesh to World's 280,302 expanded vertices. Culling and shadow
toggles did not fix the defect. Skipping **only building crew-X-ray draws** did,
with normal geometry, BACK culling and shadow casting unchanged.

Cause: World's crew overlay replayed all `caster` records with depth GREATER;
the new architectural shadow casters accidentally joined it. Draw records now
separate shadow eligibility (`caster`) from crew overlay eligibility (`xray`).
Buildings still cast shadows but never draw through their own exterior. Crew
parts retain their ordinary and X-ray passes; terrain does not acquire either
flag merely from this integration.

The renderer regression executes the actual `end()` pass selection with fake GL
commands; a negative control restores the old caster filter and fails. Both
changed JS files pass `node --check`. The current root command passed **21/21**:

```sh
npm test -- --unit city- microvoxel-world.cjs microvoxel-world-walk.cjs microvoxel-gallery.cjs microvoxel-shadows.cjs
```

There is no standalone lint/type-check script for these plain-JS labs. This is
focused validation, not a claim that unrelated whole-project failures vanished.
Corrected-source World acceptance was a separate headless gate; diagnostic-toggle
screenshots were not used as proof that the source fix passed it.

### Corrected-source World acceptance

The persistent testing agent passed these headless Chromium/SwiftShader gates
in order on the corrected source, with **no rendering behavior overrides**:

- **Flat JS6**, seed 2718 / gallery true / original walk spawn: solid front
  timber, windows and closed door under the overhang; intact exterior roofs and
  ground contact. Six normal + six shadow + **zero building X-ray** draws, with
  BACK/CCW normal and FRONT/CCW shadow culling. W advanced 1.4 m then stopped
  outside the closed parcels; S retreated 2.6 m. GL error zero, dense source zero.
- **Flat Rust12**: explicit Rust ready, twelve loaded, twelve normal + twelve
  shadow + zero building X-ray draws. Coherent exterior and walking/collision;
  about 21.0 MB building / 24.3 MB combined resident geometry, zero dense source.
- **Natural Rust12**: gallery false, identical parcel IDs/seeds/options/XZ to
  flat. Surrounding samples ranged 33.5–40 m, while the bounded district used
  one 36.5 m platform, 5 m cut/fill and an 8 m halo. Roofs/timber/windows stayed
  grounded beside rolling terrain; W advanced 1.4 m then stopped, S retreated
  1.8 m. Twelve normal + twelve shadow + zero building X-ray; GL error zero,
  zero dense source; observed combined geometry peak about 46.1 MB.
- **Lifecycle**: Field notes travel to chunk (100,100) released all buildings
  and building GPU bytes; return reloaded twelve with identical GPU bytes.
  Generate twice (second issued at 6/12 loaded) completed with twelve ready,
  explicit Rust, source zero and no errors. This did **not** directly observe a
  rejected stale reply, so browser stale-reply rejection is not certified here.
- **Default World**: no City scripts, City worker or WASM requests; only World
  workers. Terrain rendered and W moved 2.6 m, GL error zero, zero building
  draws. Sixteen non-building X-ray draws persisted, consistent with preserved
  crew overlays; individual actor identity was not checked.

The optional natural opposite-side viewpoint was initially inconclusive: a grey
surface/near stone wall blocked the terrace. A **separate plain-World control**
at the exact same XYZ/yaw/pitch reproduced that surface with no City loaded and
zero building draws. Runtime identified the same pre-existing town ruin centred
at approximately [-101.519,72.881], reach 47, with a thin blocker 0.25–0.5 m down
the view ray. An exact-data-ID CPU reconstruction found masonry/vine there;
runtime material identity was not established. This resolves its attribution to
World content, **not** an acceptance claim for an unobstructed rear terrace view.

A 240 s test-controller request timed out while the software-rendered flat
Rust capture continued; completed walking/view artifacts were recovered without
repeating input. There were no page or console errors. The 62 s primary corrected
World video is captioned at 4× playback and covers flat JS6 only; Rust12 and natural
evidence are separate stills/data, not claimed to appear in that video.

Corrected-source artifacts are in ignored `output/world-acceptance/`:
`primary-corrected-world.mp4`, `flat6-js-{spawn,exterior}.png`,
`flat12-rust-exterior.png`, `natural12-rust-exterior.png`,
`flat6-js-walking.json`, `flat12-rust-walking.json`,
`natural12-rust-walking.json`, `flat-natural-identity-terrain.json`,
`bounded-lifecycle.json`, `default-world-regression.json`,
`default-ruin-control.{json,png}` and `browser-events.json`.

Scope remains **closed exteriors with conservative parcel collision**. World E
doors/interiors/furnished navigation and per-parcel hillside pads are not
connected. Framebuffers/driver/JS/WASM heap are excluded from the 128 MiB geometry
cap. These tests do not certify the larger city/party-wall matrix, an overall
Rust FPS win, real GPU performance or physical mobile performance.
