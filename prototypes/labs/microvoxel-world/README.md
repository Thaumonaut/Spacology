# Microvoxel World Lab

Open `prototypes/microvoxel-world.html` through `npm run serve`, or the **Microvoxel World** Exploration entry in the playtest library. No build or external runtime dependencies. WebGL2 and workers are required. This is an engineering/visual proof for [Epic #8](https://github.com/Thaumonaut/Spacology/issues/8), with bounded worlds and an opt-in streaming experiment, not a replacement for the world editor, voyage, Supply Run or route-planning prototype.

## World truth

- 128 × 128 metres by default; the optional **256 × 256 m region** extends the same seeded geography to four times the area. Y up. The default uses 0.25 m material cells (32 × 32 columns, 96 vertical cells per chunk). The **12.5 cm** comparison uses 0.125 m cells (64 × 64 columns, 192 vertical cells). Both cover the same 8 × 8 × 24 m chunk volume; trees, ore thickness, water and characters retain their metre scale.
- Seed + generator revision + coordinates determine strata, terrain, water and volumetric vegetation. Material run endpoints retain occupied/empty intervals, not just a rendered heightfield. Surface geography is intentionally simple in this proof: one ridge, river catchment and clearing. This is not yet planet geology, caves or production generation quality.
- `createWorld(seed, cellMetres = 0.25, extent = 128)` exposes ground/column/chunk queries and the already-surveyed ferrite root. The root lies on fault-exposed basalt; its stable ID/provenance is independent of mesh/cache state. Trees are derived from a bounded coordinate grid and cached, not randomly advanced per request. Both densities and footprints retain the root identity and existing 128 m material truth; `dataId` additionally identifies cell size **and footprint**, since a formerly out-of-bounds edge chunk's mesh halo changes on expansion. Density regeneration changes authoritative ground quantization, unlike render-only LOD. Ground returns `null` outside the selected footprint, which selection skips rather than intersecting nonexistent terrain.
- No mutation/editing API. Ground queries use exact voxel-column centres and exclude foliage; water surface is not walkable ground. The demo actors stay in the dry clearing. No pathfinding, road validity, construction, discoveries or Research handoff is implemented yet.

## Data/render path

1. The worker retains lossless column runs (`Uint16` offsets, byte endpoints/material IDs) in an LRU capped at 128 chunks / 4 MiB. One request is in flight; current view replaces queued work. Old-view/old-seed replies do not reach the GPU.
2. A transient dense halo samples the same world outside each chunk. Greedy meshing merges only coplanar, same-material exposed faces. No internal voxel faces are submitted. Six vertices per quad use **8 bytes each** (local uint16 XYZ, byte face/material); buffer ownership transfers to the main thread.
3. The WebGL2 renderer uploads one buffer/VAO per mesh. The GPU chunk cache caps at 320 entries / 32 MiB and deletes buffers/VAOs on eviction. The original footprint has 256 horizontal chunks; the expanded footprint has 1,024, but only visible ones are generated and the regional zoom limit adapts to the screen aspect so a view stays inside the cache's entry budget. Pan to explore rather than loading the entire region at once. No per-cell objects/draw calls and no terrain meshing in the animation loop.
4. Camera span chooses a uniform cell-/half-/one-metre surface approximation. The finer density can use an 8× render step to retain metre-scale overview costs. The **previous LOD remains drawable** while new meshes stream; the displayed step switches after the requested view is fully resident. If both views cannot fit, retain one covering mesh per visible chunk, prioritizing requested meshes and retiring an old fallback only where a replacement exists. This avoids a cache-starvation loop as well as clearing the world on zoom; it is not geometric morphing or a crossfade. Previously unseen edge chunks can still stream in, with a visible indicator. Adjacent chunks use halo queries to avoid border faces; a settled view has uniform LOD to avoid mixed-resolution cracks, though a budget-constrained transition can temporarily mix steps. The highest occupied material in each vertical block preserves grass at coarse zoom. Approximation can shift a visible surface by up to a coarse cell; it is explicitly **not** construction ground. Switching density clears both caches and measurement samples; in-flight obsolete results cannot populate the new density.
5. Characters reuse a shared unit-cube mesh with articulated body-part transforms. They do not rebuild voxel meshes each frame. Fixed 50° downward orthographic tilt / 35° azimuth; drag/arrows pan, +/− zoom (down to an 8 m span), R returns to root, Space pauses. Drag uses the inverse projection so terrain follows the pointer horizontally and vertically. Buttons support touch. Reduced motion stops limb/water oscillation; Pause stops crew movement as well.

## Measurements and limits

Performance opens live frame p50/p95/p99, generation/meshing p95, resident voxel bytes, uploaded **chunk** vertex bytes, cache counts, draw calls and triangles. Export captures the world identity and browser/viewport. Frame intervals include visible-tab stalls; they are not GPU timestamps. Driver/framebuffer overhead, transient JS allocations and whole-process memory are not claimed to be measured. Shared actor geometry adds 288 vertex bytes outside the chunk cache. Economy caps pixel density at 1 and coarsens render sampling; ordinary density is capped at 1.5.

`node tools/benchmark-microvoxel.cjs [seed]` reproducibly measures 64 root-catchment chunks at full resolution, with hardware and revision in JSON. On this session's Linux Xeon / Node 24.19.0, seed 2718 used 623,726 encoded bytes versus 6,291,456 dense bytes (**10.09×** smaller). Greedy meshing emitted 25,642 quads for 177,447 exposed faces (**85.55%** fewer). These are exact fixture sizes, not universal compression ratios or phone-performance results. Cold generation/meshing timing varies with warmup and hardware; rerun the command rather than treating a VM time as a device budget. Warm lookup timing excludes remeshing.

### Finer-density comparison

The same seed-2718 fixture, 64 chunks and physical area on Node 24.19.0 / Linux Xeon:

| Full-resolution measure | 25 cm | 12.5 cm |
| --- | ---: | ---: |
| Dense material bytes | 6,291,456 | 50,331,648 |
| Encoded material bytes | 623,726 | 2,494,668 |
| Packed vertex bytes | 1,230,816 | 4,627,104 |
| Greedy quads | 25,642 | 96,398 |
| Generation p50 / p95 (ms) | 0.70 / 2.33 | 3.38 / 5.58 |
| Meshing p50 / p95 (ms) | 6.12 / 25.61 | 62.35 / 80.06 |

Halving cell width multiplies the dense volume by eight, but this fixture's run storage by about four. Surface geometry and cold meshing also cost more; these timings are one CPU run, not phone FPS. CPU/GPU residency limits remain unchanged. The finer density is an opt-in comparison, not a claim of an approved device budget. Compare **Root site → 25 cm / 12.5 cm** without changing the camera, then zoom closer. `?cell=0.125` retains the comparison on reload; exports identify the density.

The quarter-metre baseline, simple lighting, small extent and provisional camera do not match John Lin's engine density/lighting. Human visual approval and real tablet/phone GPU testing remain gates before scaling beyond this **bounded comparison**. Natural terrain remains non-editable. No production renderer choice or planet-scale claim is made.

### Regional seed survey

In **Field notes**, choose 256 × 256 m and enter a seed; `?extent=256&seed=39` retains that choice after reload. **Region** centres a viewport over the new area; **Root site** returns to the same ferrite deposit. The regional view shows only a cache-bounded portion, not the entire footprint. The 128 m default still loads unless explicitly selected.

Run `node tools/survey-microvoxel.cjs 256 0.25` (or `256 0.125`) to sample seven seeds on a 4 m grid, assert repeatable ground/chunk bytes and root geology, and report fingerprints for heights, river corridor, surface water, exposed rock and root locations. The first survey found **7 distinct height fields, 1 river corridor, 1 exposed-rock pattern and 1 root location** at 25 cm; water coverage varies slightly with seeded height. Thus the extension and surface variety are testable, **but the macro world generation is still a fixed river/ridge/clearing template**, not diverse worlds or resource placement. This should guide the next generator iteration rather than be hidden by larger map dimensions. These are sampling checks, not proof of phone performance or visual quality.

`node tools/benchmark-microvoxel.cjs 2718 0.25 256` benchmarks 64 chunks entirely beyond the original boundary; unlike a whole-world estimate, this shows the actual cost of generating an equal physical patch in the expanded region. The chunk origin is in its JSON output; browser viewport, loading and cache estimates are separate.

## Infinite streaming experiment

Choose **Field notes → World footprint → Infinite streaming experiment → Generate**, or open `?extent=infinite&seed=2718`. Both finite footprints remain available; 128 m / 25 cm is still the default. This mode uses a separate **`micro-wilds-1`** generator and root identity, leaving the finite generator's material fixtures unchanged. Seeded ridge, fracture and wet-corridor fields vary across coordinates and seeds; they are a streaming fixture, **not routed hydrology or finished fantasy geography**.

- Navigation stores signed 8 m chunk coordinates plus local metre offsets in `[0, 8)`: `{cx, cz, x, z}`. Negative boundaries normalize rather than wrapping. URL parameters `cx`, `cz`, `lx`, `lz` retain this compact location alongside mode, seed and density. Density changes keep the logical location and root identity but re-quantize ground.
- One articulated explorer stays at render X/Z zero. Dragging moves terrain under them; arrows travel, **Surroundings** widens the current view, and **Root site / R** returns home. Field notes also provides a chunk-centre jump for testing distant coordinates. This is free traversal: slopes, vegetation and water do not obstruct movement, and there is no route/collision simulation.
- Chunk origins sent to WebGL are `(chunk - playerChunk) * 8 - localOffset`. CPU generation/ground queries use logical coordinates, but GPU positions remain local. Surface-detail coordinates are bounded separately; a distant selection/root marker projects relative to the current explorer.
- Residency stays capped at **128 voxel chunks / 4 MiB**, **320 meshes / 32 MiB**, and **2,048 memoized vegetation entries per world instance** (main thread and worker). There is no visited-chunk collection. Returning after eviction regenerates the same material runs; cold terrain can visibly stream in again. These are explicit buffer/cache limits, not whole-process memory measurements.
- “Infinite” means on-demand generation, **not literal infinity**. Navigation and chunk generation stop at **±16,777,215 chunks** (about ±134,218 km); movement clamps there rather than wrapping. Terrain is immutable. Only the URL location persists: discoveries, buildings, edits and world-wide history are not stored.

`node tools/benchmark-microvoxel.cjs 2718 0.25 infinite` samples 64 chunks starting at `(1000000, -1000000)`—8,000 km from zero on each axis. Optional final arguments select a different chunk origin. The same full-resolution patch encoded **580,112 bytes** at 25 cm and **2,320,106 bytes** at 12.5 cm in this fixture, versus 6,291,456 / 50,331,648 dense bytes. These are storage measurements, not device FPS results. Automated regressions cover signed rebasing, distant/guardrail-near travel, return-image equality after eviction, URL reload, density, GPU position bounds, portrait LOD/cache pressure and the offline package. The earlier iOS Simulator results concern the finite world; **streamed-mode iOS and physical-device performance are unverified**.

## Verification and portable copy

```sh
npm test -- microvoxel-world
node tools/benchmark-microvoxel.cjs 2718
node tools/benchmark-microvoxel.cjs 2718 0.125
node tools/survey-microvoxel.cjs 256 0.25
node tools/benchmark-microvoxel.cjs 2718 0.25 infinite
node tools/package-microvoxel.cjs /existing/directory/microvoxel-world.html
```

The last command packages the **same** source/model/worker into a single HTML (Blob worker); it does not rebuild or substitute a mock simulation. The bundled library link goes to the public library. Tests cover source and packaged/offline operation. Browser tests are headless unless explicitly requested otherwise. No new linter/type checker is configured for the plain-JS lab; syntax, model and browser tests complement the existing Svelte check/release gates.

### iOS launch path

The original package was tested on **iPhone 17 Pro Simulator / iOS 26.5**: native Files/Quick Look stalled, while the identical bytes served over HTTP rendered in actual Safari and supported crew/pause. The preview's execution failure was not explained, and this is not a physical-device performance result. For iOS, use a hosted Safari page rather than promising downloaded-file preview support. The static startup notice makes that limitation visible even if the runtime never begins. Hosting/deployment is separate from creating the portable copy; this PR does not automatically deploy a preview.
