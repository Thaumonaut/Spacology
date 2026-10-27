# City Lab CPU engine comparison

The existing `prototypes/city-lab.html` remains the application. JavaScript is
the default/reference engine. Select **City CPU engine → Rust / WASM** or use
`prototypes/city-lab.html?engine=rust&seed=1&count=24&mode=stream&backend=sparse`.
Use `engine=js` for the matched baseline. Keep every other setting and camera
path the same. A Rust load, readiness or conversion error is visible; the app
does not quietly substitute JavaScript geometry or topology.

## Build and static serving

From the repository root:

```sh
source ~/.nvm/nvm.sh && nvm use 24
# One-time only if missing (not a Node/bundler dependency):
rustup target add wasm32-unknown-unknown
node tools/build-city-rust.cjs --test
npm test -- --unit city-
cargo test --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --locked
cargo fmt --manifest-path prototypes/labs/city-lab/rust/Cargo.toml -- --check
cargo clippy --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --all-targets --locked -- -D warnings
```

The builder uses Cargo's locked release WASM target, then copies it to
`prototypes/labs/city-lab/wasm/city_lab_core.wasm` (generated and ignored).
Neither Vite nor wasm-pack is needed. Serve the repository with an ordinary
HTTP static server and open the existing HTML path; classic scripts and the
classic worker resolve their assets relative to their own URLs. `file://`
does not support the worker/fetch path. The HTML loads `city-rust.js` after its
shared dependencies and before `city-lab.js`. The worker imports the same
loader and shared dependencies before initialization.

The existing Pages builder copies the stable WASM asset if present, but excludes
the Cargo source/cache directory. `SPACOLOGY_BUILD_CITY_RUST=1 node tools/build-pages.cjs`
also builds that asset first; this requires Rust in that build environment.
Without it, a clean static artifact remains a valid JS baseline but selecting
Rust reports a missing WASM asset rather than pretending to run Rust.

Verified integration environment: Node 24.19.0, npm 10.8.3, rustc 1.97.1,
cargo 1.97.1, rustup 1.29.0, installed targets `wasm32-unknown-unknown` and
`x86_64-unknown-linux-gnu`. Integration installed no packages or toolchains.
The earlier preparation stage installed the WASM target with the command above.

## Node adapter (real native operations, no DOM/GL)

```js
const CityRust = require('./prototypes/labs/city-lab/city-rust.js');
const core = await CityRust.load(); // requires all ten operations
const engine = CityRust.createAdapter('rust', core);
const city = engine.generate(1, {count:24, terrain:'flat', layout:'woven', width:1});
const findings = engine.validate(city);
const targets = engine.targets(city, [0, 2, 40]); // Map of parcel targets
const result = engine.runJob({epoch:1, parcel:city.parcels[0], extent:city.extent,
  mode:'facade', voxelSize:.5, sparse:false, includeNavigation:false});
console.log(findings, targets, result.engineMetrics, core.stats());
core.dispose();
```

Use an async function in CommonJS. `createAdapter('js')` exposes the same API and
job schema for matched CPU comparisons. `full` with `includeNavigation:true`
returns the selected closed-door leaf mesh and shared navigation volume;
`exterior` never returns a furnished interior or navigation payload.

## Ownership and measurement contract

Rust actually executes `city.generate`, `city.validate`, `stream.targets`,
`stream.prefetch`, `geometry.facade`, `geometry.coarse`, `geometry.prepare`,
`geometry.doors`, `mesh.segment` and `sparse.pack`. It does not render. Shared
Building Lab JS still generates the complete room/furniture plan, furnishings
and dense voxels. Facade spans/mask decomposition, door
leaf definitions/selection and navigation state, bounds/summary helpers, environment/vegetation,
collision, WebGL/shadows and uploads remain JS. Building architecture keeps hard
normals and original material IDs; vegetation retains its separate soft normals.
Dense Rust jobs use one ABI 1 `geometry.prepare` batch: prepare, extract selected
doors, open recorded leaves for full rendering and convert mesh/sparse natively.
Only navigation batches return dense collision voxels. Compact stream records
retain f64 precision and cache at most four city descriptors. Neither extension
adds public operations or changes the legacy conversion ABI; see `rust/CONTRACT.md`.

`window.__cityLab.snapshot()` adds engine/readiness/error, separate `mainInit`
and `workerInit.load` read/compile/instantiate/init times (plus worker constructor
to ready latency and a bootstrap/scheduling estimate), `mainEngineMetrics`,
`mainShared`, `sharedWalkMs` and per-job `engineJobs`. Each job records actual
operation counts, owned-buffer ABI encode/copy-in/execute/copy-out/decode times,
shared JS milliseconds and total wall time. Execution includes Rust packet
parsing/serialization and its internal volume copies, not just algorithms.
Geometry-category times overlap the shared facade-input subcategory; don't sum
them. Main upload timings are separate. Round-trip minus job wall time is only
a **transfer + scheduling estimate**, not a pure transfer measurement. WASM
`memoryBytes` is retained high-water capacity; zero `liveBytes/liveAllocations`
means freed ABI handles, not a process-heap measurement.

Main and worker initialization are epoch guarded. Up to **three light facade/low
jobs** are in flight (one synchronous worker); dense exterior/full jobs are
exclusive and drain the light pipeline first. Obsolete queued work is removed;
identity/epoch/engine checks reject mismatched replies. One nearby full interior
is retained; initial targets never request interiors. E on a ready door changes
door state without a new job or XYZ/yaw teleport. These are unit-tested contracts,
not a browser walking acceptance claim.

Pre-upload aggregate **128 MiB** geometry checks include access meshes, resident
sparse textures, old replacement buffers and the rebuilt block's upload peak.
Mesh/texture replacements stage first and retain old geometry on upload failure;
partial buffers/textures are freed. Failed budget checks retain available coarse
geometry and keep an opening door closed. Diagnostic job/timing/upload/phase/error
arrays retain the most recent **600** entries (`telemetryLimit`), not a lifetime
history. Cumulative schedule/cancel/stale counters are scalar; per-parcel state is bounded
by the selected city. Selected Rust CPU errors never fall back to JS ports.

The current serial Node 24 bounded probe (seed1/woven/count24, flat then uneven,
one warm-up + three alternating pairs) measured JS/Rust startup-24-facade medians
**210.400/192.410 ms flat**, **196.534/204.904 ms uneven**; one representative
exterior-sparse job **539.206/381.642 ms flat**, **813.117/387.067 ms uneven**.
Shared JS plan/volume generation is separately reported. This is not all-target
scene settling; facade results are mixed and no overall speedup follows. Exact
output parity passed; bounded final live ABI bytes were zero with **66,387,968
bytes retained WASM capacity**. See `docs/testing/city-rust-comparison.md` and
ignored `output/city-rust-comparison/bounded.json` for phase/copy clocks,
native-vs-WASM diagnostic and limitations.

Unit/native coverage does not certify a browser speedup, phone/tablet performance
or actual GL/collision behavior. The lead's headless testing agent owns UI,
door/stream residency acceptance and fair end-to-end camera-path benchmarks.

## Streaming buffer and counters

`city-stream.js` and Rust share these strict acquire/retain thresholds. Distance
is to the parcel prism expanded by max(2 m, declared overhang), not its centre:
14/20 m close protection in all directions; 36/48 m local detail; forward
96/120 m at >48/>32 px with 25/40 degree angular padding (minimum 65/80 degrees,
maximum 85/100). Held exteriors have a 112 m all-around turn buffer. Ranking
retains 24 m (32 m near) hysteresis and a 32 m far-forward bias. Without a valid
view direction use 64/80 m all-around. Selection first protects **16 all-around
exteriors**, then adds **24 view-facing exteriors** using the horizontal FOV
(derived from vertical FOV and aspect, plus a 10° edge buffer), and retains up to **24 further
held exteriors** through turns. The total is bounded at **64, including pinned**;
the close-protection flag is still limited to six. These are target quotas, not
a byte guarantee. All exterior targets use lossless 6.25 cm sparse bricks when
that backend is selected/available, not just close targets. Crossing close/mid
boundaries therefore does not rebuild identical bricks. Explicit greedy mode
and failed sparse uploads retain the mesh fallback. Overflow stays
recognizable facade at >12/>8 px; it does not immediately become a box.
Frustum culling skips draws only, never releases resident geometry. Interiors
prefetch only within 12 m of a door, retain within 18 m, switch with 2 m bias,
and are held while inside. Do not widen these to mask failed quality gates.

The earlier CPU/frame samples above predate this coverage expansion. They are
not performance evidence for the expanded view. The 1,152-parcel flat/uneven
street-policy regression requires at least 40 detailed targets and 24 parcel
centres in the screen cone; rendered coverage and frame cost need separate checks.

Snapshot queue telemetry includes `queuedCount`, `inflightCount`, `stale` and
`scheduling` (`calls/ms/posted/peakInflight/cancelled`); `jobPhases` separates queue wait,
round-trip, receive, upload and receive-non-upload CPU. Transfer+scheduling is an
estimate. Renderer counters distinguish resident/enabled/drawn sparse models,
main/shadow ray draws and derived `mainRayCulled`/`shadowRayCulled` (null on a
cached shadow pass), main/shadow/total draw calls and triangles, mesh/sparse
GPU-byte estimates, upload-call/CPU totals and shadow-cache reuse. GPU elapsed
queries are asynchronous, bounded and optional; disjoint/unsupported results are
not FPS. Building hard normals and soft vegetation remain separate.

## Optional World exterior bridge (not an enterable district)

- `/prototypes/microvoxel-world.html?district=6&citySeed=2718&engine=js&walk=1`
- Use `district=12`, `engine=rust`, and optionally `districtTerrain=uneven`.
- The ordinary World URL/default is unchanged. Only complete terrace rows are
  selected, preserving parcel IDs/plans/materials and local 1/16 m geometry.
  A rigid matrix plus fixed XZ anchor places buildings without uint16 wrapping;
  flat-first grading surveys the existing terrain, and uneven preserves XZ.
- Limits: 80 MiB terrain + 47 MiB buildings + palette within 128 MiB geometry;
  one 32 MiB expanded mesh reply, 64 MiB per-building dense scratch preflight,
  zero retained dense building volumes. This excludes framebuffers/driver/JS heap.
- This version imports **closed exteriors** and uses conservative closed-parcel
  collision. It does not certify E doors, interior navigation, exact multi-floor
  collision or enterable World buildings. Exterior walking, closed-parcel
  blocking and release/return passed the bounded headless World fixtures.

## Measurement and handoff

See `docs/testing/city-rust-comparison.md` for the rebuilt-WASM bounded serial
CPU measurements and native diagnostic, commands and the minimal headless UI
handoff. SoftwareGL/SwiftShader image checks cannot establish hardware/mobile
FPS; keep viewport, DPR, camera, backend, terrain and GPU implementation matched.
Headless City checks passed buffered detail and physical doorway entry/exit on
flat and uneven fixtures. Corrected-source World checks passed flat JS6, flat
Rust12, natural Rust12, resource release/return and ordinary World regression.
The natural World fixture is a **single graded platform**, not per-building
hillside pads. An optional opposite-side view was obscured by a pre-existing
World ruin (reproduced without City); it does not certify an unobstructed rear
view. See the comparison document for exact gates, artifacts and performance
limits. This remains a bounded exterior bridge, not a complete World city.

Known baseline issue: some larger woven cities advertise reciprocal party walls
with unequal rear depths (seed 1, count 100, width .75, parcels 12/13). Both
engines preserve the same parcel options; envelope/collision checks are not relaxed.
