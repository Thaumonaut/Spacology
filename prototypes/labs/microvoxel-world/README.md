# Microvoxel World Lab

Open `prototypes/microvoxel-world.html` through `npm run serve`, or the **Microvoxel World** Exploration entry in the playtest library. No build or external runtime dependencies. WebGL2 and workers are required. This is a bounded engineering/visual proof for [Epic #8](https://github.com/Thaumonaut/Spacology/issues/8), not a replacement for the world editor, voyage, Supply Run or route-planning prototype.

## World truth

- 128 × 128 metres, Y up, 0.25 m material cells; each horizontal chunk covers 8 × 8 × 24 m (32 × 32 columns, 96 vertical cells).
- Seed + generator revision + coordinates determine strata, terrain, water and volumetric vegetation. Material run endpoints retain occupied/empty intervals, not just a rendered heightfield. Surface geography is intentionally simple in this proof: one ridge, river catchment and clearing. This is not yet planet geology, caves or production generation quality.
- `createWorld(seed)` exposes ground/column/chunk queries and the already-surveyed ferrite root. The root lies on fault-exposed basalt; its stable ID/provenance is independent of mesh/cache state. Trees are derived from a bounded coordinate grid and cached, not randomly advanced per request.
- No mutation/editing API. Ground queries use exact voxel-column centres and exclude foliage; water surface is not walkable ground. The demo actors stay in the dry clearing. No pathfinding, road validity, construction, discoveries or Research handoff is implemented yet.

## Data/render path

1. The worker retains lossless column runs (`Uint16` offsets, byte endpoints/material IDs) in an LRU capped at 128 chunks / 4 MiB. One request is in flight; current view replaces queued work. Old-view/old-seed replies do not reach the GPU.
2. A transient dense halo samples the same world outside each chunk. Greedy meshing merges only coplanar, same-material exposed faces. No internal voxel faces are submitted. Six vertices per quad use **8 bytes each** (local uint16 XYZ, byte face/material); buffer ownership transfers to the main thread.
3. The WebGL2 renderer uploads one buffer/VAO per mesh. The GPU chunk cache caps at 320 entries / 32 MiB and deletes buffers/VAOs on eviction. The active view has at most 256 horizontal chunks. No per-cell objects/draw calls and no terrain meshing in the animation loop.
4. Camera span chooses a uniform quarter-/half-/one-metre surface approximation. Using one LOD per view avoids mixed-resolution boundary cracks; halo queries agree between neighbours. The highest occupied material in each vertical block preserves grass at coarse zoom. Approximation can shift a visible surface by up to a coarse cell; it is explicitly **not** construction ground. Switching LOD can briefly show missing background chunks, with a loading indicator, rather than hide costs or invent a terrain fallback.
5. Characters reuse a shared unit-cube mesh with articulated body-part transforms. They do not rebuild voxel meshes each frame. Fixed 50° downward orthographic tilt / 35° azimuth; drag/arrows pan, +/− zoom, R returns to root, Space pauses. Buttons support touch. Reduced motion stops limb/water oscillation; Pause stops crew movement as well.

## Measurements and limits

Performance opens live frame p50/p95/p99, generation/meshing p95, resident voxel bytes, uploaded **chunk** vertex bytes, cache counts, draw calls and triangles. Export captures the world identity and browser/viewport. Frame intervals include visible-tab stalls; they are not GPU timestamps. Driver/framebuffer overhead, transient JS allocations and whole-process memory are not claimed to be measured. Shared actor geometry adds 288 vertex bytes outside the chunk cache. Economy caps pixel density at 1 and coarsens render sampling; ordinary density is capped at 1.5.

`node tools/benchmark-microvoxel.cjs [seed]` reproducibly measures 64 root-catchment chunks at full resolution, with hardware and revision in JSON. On this session's Linux Xeon / Node 24.19.0, seed 2718 used 623,726 encoded bytes versus 6,291,456 dense bytes (**10.09×** smaller). Greedy meshing emitted 25,642 quads for 177,447 exposed faces (**85.55%** fewer). These are exact fixture sizes, not universal compression ratios or phone-performance results. Cold generation/meshing timing varies with warmup and hardware; rerun the command rather than treating a VM time as a device budget. Warm lookup timing excludes remeshing.

The quarter-metre baseline, simple lighting, small extent and provisional camera do not match John Lin's engine density/lighting. Human visual approval and real tablet/phone GPU testing remain gates before expanding this representation. Natural terrain remains non-editable. No production renderer choice or planet-scale claim is made.

## Verification and portable copy

```sh
npm test -- microvoxel-world
node tools/benchmark-microvoxel.cjs 2718
node tools/package-microvoxel.cjs /existing/directory/microvoxel-world.html
```

The last command packages the **same** source/model/worker into a single HTML (Blob worker); it does not rebuild or substitute a mock simulation. The bundled library link goes to the public library. Tests cover source and packaged/offline operation. Browser tests are headless unless explicitly requested otherwise. No new linter/type checker is configured for the plain-JS lab; syntax, model and browser tests complement the existing Svelte check/release gates.
