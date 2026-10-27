# City Lab Rust core contract, ABI 1

All ten port operations are implemented in Rust and integrated into the existing
City Lab through `../city-rust.js` and `../city-worker.js`. See `../README.md`
for the opt-in selector, static build, Node adapter and measurement schema.
`core.info` and `core.echo` remain native/WASM ABI diagnostics, not a replacement
city or a performance result. No browser speedup is certified by CPU unit tests.
JavaScript remains the default baseline. This is not a Rust renderer and does
not port Building Lab's room/furniture planner.

## Ownership and stable entry points

All paths below are relative to `prototypes/labs/city-lab/rust/`.

| Independent port | Files to edit, including module-local tests | Operations |
| --- | --- | --- |
| Topology / policy | `src/city.rs`, `src/stream.rs` only | `city.generate`, `city.validate`, `stream.targets`, `stream.prefetch` |
| Plan-derived geometry | `src/geometry.rs` only | `geometry.facade`, `geometry.coarse`, `geometry.prepare`, `geometry.doors` |
| Conversion | `src/mesh.rs`, `src/sparse.rs` only | `mesh.segment`, `sparse.pack` |

Every module exports these **identical** signatures, already dispatched by
`src/lib.rs` (no later dispatch edits needed):

```rust
pub fn handle(op: &str, request: &Request) -> EngineResult<Reply>;
pub fn implemented_operations() -> &'static [&'static str];
```

Only list fully implemented operations in `implemented_operations()`; leave
pending operations returning `EngineError::pending(op)`. Geometry may call this
already-declared conversion function without changes to shared files:

```rust
pub fn mesh_segment(volume: &Volume, y0: usize, y1: usize,
    ownership: Option<&Ownership>, segment: i32) -> EngineResult<Mesh>;
pub fn from_volume(volume: &Volume, palette: &[u8], model: Model,
    options: &SparseOptions) -> EngineResult<Sparse>;
```

The first belongs to `mesh`, the second to `sparse`. No other cross-module helper
is required. Do not edit `types.rs`, `lib.rs`, `abi.rs`, Cargo files, the loader,
build tool, or another port's files: coordinate any contract change with lead.
Until `mesh_segment` is ready, coarse/door conversion must fail explicitly rather
than call the JavaScript mesher. Module-local tests can use native `dispatch`,
`abi::{encode_request,execute_packet,decode_reply}`, or direct typed functions.

## Shared Rust types

`src/types.rs` is the authoritative compilable definition. JSON fields use the
existing JS names (camelCase where noted, `M` for the material map).

- `Request { op: String, meta: serde_json::Value, buffers: Vec<Buffer> }`.
  `meta_as::<T>()`, `buffer(name, kind)`, `volume(&VolumeSpec)` validate/convert inputs.
- `Reply { meta: Value, buffers: Vec<Buffer> }`; `Reply::new(meta)` for metadata-only replies.
- `EngineResult<T> = Result<T, EngineError>`; errors have `{code,message}`.
  Use `INVALID_REQUEST` for malformed op inputs, `NOT_IMPLEMENTED` for pending
  work. ABI errors are `INVALID_PACKET` / `ABI_MISMATCH`; unknown names are
  `UNKNOWN_OPERATION`. Never silently substitute another implementation.
- `Buffer { name, kind, bytes: Vec<u8> }`; `BufferKind::{U8,U16,U32,I32,F32}`.
  Helpers `u8/u16/u32/i32/f32`, `as_u16/as_u32/as_i32`, `check` encode LE bytes
  explicitly; do not transmute potentially unaligned byte slices.
- `Volume { spec: VolumeSpec, vol: Vec<u8> }` with
  `VolumeSpec { dims:[usize;3], cell:f64, origin:[i32;3], levels:Vec<usize>,
  plate:usize, city_front:f64, materials: BTreeMap<String,u8> }`.
  Wire names are `cityFront`, `M`. Palette is a separate binary input.
  Dimensions are `[X,Y,Z]`; dense index is **`x + X*(z + Z*y)`**. `validate()`
  checks product/length, positive finite cell and uint16-representable dimensions.
- `Model = [f64;16]`, column-major, `IDENTITY` available. Preserve all transform
  terms and `cityFront` origin compensation; do not reset models to identity.
- `Ownership { indices:Vec<u32>, segments:Vec<i32> }` matches a JS Map. Validate
  equal lengths, unique in-range indices and segment semantics in `mesh.rs`.
- `Mesh { meta:MeshMeta, verts:Vec<u16>, idx:Vec<u32>, normals:Option<Vec<f32>> }`.
  Metadata: optional `id`, `model`, `voxelSize`, `voxelBytes`; required `quads`.
  Vertices are `[x,y,z,normal|(material<<8)]`; normals `0..5` mean
  `+X,-X,+Y,-Y,+Z,-Z`, indices are uint32, six per quad. Native raw mesh coordinates
  are voxel corners; facade/coarse use existing 1/16 m city coordinates and model.
  `Mesh::into_reply()` emits `verts:u16`, `idx:u32`, optional `normals:f32`.
  **Architecture has `normals=None` (hard), vegetation retains its shared smooth
  normals.** The renderer selects soft shading from presence of `normals`, not
  from material ID. Do not smooth buildings or flatten vegetation to win timings.
- `Sparse { meta:SparseMeta, coarse:Vec<u16>, bricks:Vec<u8>, pal:Vec<u8> }`;
  `into_reply()` emits those three named buffers. Metadata is exactly
  `n,offset,o,cvs,sub,brickRows,nb,mixedCells,frame:{x,z,rot},lo,hi,bytes`.
  Fine bricks are 4 cubed, `sub=4`, coarse R16UI uses `0..255` for uniform material
  and `256+brickIndex` for mixed cells. Brick atlas R8UI is 1024 wide, 64 bricks
  per row; atlas index `(floor(k/64)*4+y)*1024+(k%64)*16+z*4+x`.
  Cropped coarse index is `x + nx*(y + ny*z)` (different from dense volume!).
  Preserve all sample IDs, empty-volume bounds, offsets/world origins, dedup
  collision checks, 65280-brick limit, palette shift `(i-1)*4`, glow alpha 128 and
  shoji alpha 64. Default `SparseOptions {deduplicate:true,crop:true}` is lossless.

## Operation inputs and outputs

Each `meta` below is a JSON object. Binary names/types are not optional unless
explicitly noted. No arrays of dense voxels, vertices, indices, palette or atlas
bytes are serialized into JSON. JSON contains full small plan/options metadata.

| Operation | `request.meta` / typed input | Input buffers | Successful `reply.meta` / output buffers |
| --- | --- | --- | --- |
| `city.generate` | `CityGenerateInput {seed:u32,options:CityOptions}` | none | Exact `CityModel.generate` city object as root metadata; no buffers |
| `city.validate` | `{city: <full city object>}` | none | `{errors:[string]}`; no buffers |
| `stream.targets` | `StreamTargetsInput {city,position:[x,y,z],previous:[Target],mode,pinned,view:{height?,fov?,aspect?,forward?:[x,z]}}` | none | `{targets:[Target]}`; ranked order must match JS Map insertion order |
| `stream.prefetch` | `StreamPrefetchInput {position:[x,y,z] or null,summaries:[{id,entry:[x,z] or null}],current:id or null,inside:bool}` | none | `{id: number or null}` |
| `geometry.facade` | `PlanGeometryInput`, below | none | `MeshMeta`; `verts:u16`, `idx:u32` |
| `geometry.coarse` | `PlanGeometryInput`, `voxelSize` exactly .5, 1 or 2 | none | `MeshMeta` including `voxelSize/voxelBytes`; `verts:u16`, `idx:u32` |
| `geometry.prepare` | `PrepareInput {plan,parcel,volume:VolumeSpec,exterior:bool}` | `vol:u8` | `{volume:updated VolumeSpec,model:[16]}`; updated `vol:u8` |
| `geometry.doors` | `DoorsInput {volume:VolumeSpec,leaves:[{floor,room,box:[x0,y0,z0,x1,y1,z1]}],model:[16],id:string}` | `vol:u8` | `{mesh:MeshMeta,boxes:[[6]]}`; `verts:u16,idx:u32,indices:u32,materials:u8` |
| `mesh.segment` | `MeshInput {volume:VolumeSpec,y0,y1,segment:-1 by default,id?,model?}` | `vol:u8`, optionally BOTH `ownerIndices:u32`, `ownerSegments:i32` | `MeshMeta`; `verts:u16`, `idx:u32` |
| `sparse.pack` | `SparseInput {volume:VolumeSpec,model:[16],options:{deduplicate,crop}}` | `vol:u8`, `palette:u8` exactly 1024 bytes | `SparseMeta`; `coarse:u16,bricks:u8,pal:u8` |

`CityOptions` defaults: `{layout:'woven',terrain:'flat',width:1,count:24}`;
supported widths `.75,1,1.25`, counts `24,100,1000`, layouts `woven,grid`,
terrains `flat,uneven`. Callers normalize seed with `Number(seed)>>>0`.
Topology must itself perform deterministic hash/road/block/clipping/parcel/
party-wall generation in Rust: no callback or pre-generated JS city is allowed
as input to `city.generate`. Preserve `revision:'city-fixture-3'` and all existing
city fields, parcel options, envelopes, IDs and fitting rules, not a new demo.

`Target` is `{id,mode,near,voxelSize,distance,projected}`. Array form replaces only
the JS Map transport; reconstruct `new Map(targets.map(({id,...t})=>[id,t]))`.
Public stream modes remain `stream`, `detailed`, `full`, `exterior` as in baseline;
returned targets never request `full` interiors. Preserve exact projection,
hysteresis and near/mid limits. `view.fov` is radians. Prefetch is one nearby
doorway: 12 m approach, 18 m retention, 2 m competing-door hysteresis, hold while
inside. Queue scheduling, epoch validation, release and upload budget remain
the caller's integration responsibilities, not hidden state in WASM.

`PlanGeometryInput` is `{plan,parcel,extent,M,spans,rectangles,roofRectangles,
voxelSize:1}`. Preserve **the existing complete plan JSON language**. Shared JS
may precompute `spans[f]=BuildingPlan.facadeSpans(plan.plot,f,plan.facade.bays)`
and inclusive rectangle lists `rectangles[f]=BuildingVoxels.decompose(mask,w,d)`;
`roofRectangles[f]` decomposes `mask[f] && !mask[f+1]` (top floor: its mask).
For facade, require all three outer arrays to match floor count, including empty
lists when appropriate; missing data must not silently omit roofs or timber.
Coarse needs the plan masks but not those precomputed arrays. The geometry port
owns architectural geometry, not room-plan generation. `geometry.prepare`
implements existing `cityVolume` pruning/solid exterior filling and `model`.
Legacy prepare does not open doors; optional batching below does. Caller keeps
all other building fields and info intact.
`geometry.doors` extracts only selected leaf wood/dark-timber voxels and meshes
them using Rust `mesh_segment`, preserving removable dense indices/materials.

## ABI 1 optional compact/cache and batch extensions

These extend existing operations, not the ten-operation public surface. Legacy
metadata-only targets and single-conversion calls remain supported and tested.

### Cached compact `stream.targets`

`meta={cityId:u32,city?:{parcels},compact:true,position,mode,pinned,view}`.
The first call supplies `city`, later calls may omit it. Each instance caches at
most **four** descriptors; a fifth evicts the smallest ID. Missing/expired IDs
return `UNKNOWN_CITY`; the adapter may resend the SAME descriptor once, never
call the JS policy. Cached descriptors precompute parcel geometry; they do not
cache changing target state. Disposal/epoch replacement releases the instance.

Previous state is either the legacy JSON target array or one `previous:u32`
buffer with `[id,flags]` pairs, not both. Flags: bits 0–1 mode low=0/facade=1/
exterior=2; bit 2 near; remaining bits voxel size .5=0/1=1/2=2 shifted by 3.
Unknown modes/sizes/strides fail. Reply metadata `{count,stride:24}` accompanies
`targets:u8`: each 24-byte LE record is id:u32, flags:u32, distance:f64,
projected:f64. No f32 rounding is permitted at policy boundaries. The adapter
rebuilds the same insertion-ordered target Map. `view.forward` is optional XZ
camera-forward (orbit/walking signs follow the shared renderer).

Policy quotas are shared with JS: **16** all-around exteriors, **24** additional
view-facing exteriors and **24** additional held exteriors (64 total including
pinned); **six** close-protection flags. `view.aspect` defaults to 1; view-facing
selection uses `atan(tan(fov/2)*aspect)` plus a 10° edge buffer. Selected targets
precede unselected ones, preserving stable saturated selection. Sparse exterior
representation is independent of the close flag. Prism distance expanded
max(2 m, declared envelope), 14/20 m
close, 36/48 m local, forward 96/120 m at >48/>32 px; 25/40 degree angular padding
(min 65/80, max 85/100), 112 m retained turn buffer, 24 m held/32 m near ranking
hysteresis and 32 m far-forward bias. No direction uses 64/80 m all-around.
Facade projection acquire/retain >12/>8 px. These are target counts, not a byte
budget, and frustum culling must not evict residents. See `../README.md`.

### Batched `geometry.prepare`

Add `batch:{render:'mesh'|'sparse',navigation:false,leaves:[],selectedLeaves:[],
options:{deduplicate:true,crop:true}}` to legacy prepare metadata. Input `vol:u8`
remains closed; sparse adds `palette:u8` (1024 bytes). Rust prepares once,
extracts selected door leaves before opening all recorded leaves for full
rendering, then performs mesh/sparse conversion without a dense round trip.
Exterior batches reject navigation or door leaves. Selected leaves require
navigation. Door definitions/selection still originate in shared JS planning.

Reply metadata is `{batched:true,volume,model,bounds,mesh,ray,doorMesh,boxes}`.
Only the selected render metadata is populated; buffers are `verts:u16/idx:u32`
or `coarse:u16/bricks:u8/pal:u8`. Navigation additionally returns the exact opened
`vol:u8`, `doorVerts:u16`, `doorIdx:u32`, `doorIndices:u32`,
`doorMaterials:u8`, plus door metadata/boxes. Non-navigation replies never return
dense voxels; the JS adapter drops its source reference after conversion.
Null empty-mesh bounds are reconstructed with the existing shared bounds helper.
A stale WASM that omits `batched:true` is rejected with `ABI_MISMATCH`, never a
legacy/JS fallback. Every batch is checked against legacy native buffers and real
JS flat/uneven exterior/full mesh/sparse/rotated-door fixtures. `timings.batch`
is one wall clock, not fabricated individual native prepare/door/convert clocks.

## Worker/browser and Node loader

Stable generated asset: `prototypes/labs/city-lab/wasm/city_lab_core.wasm`.
Classic browser worker: `importScripts('city-rust.js')` then
`const engine=await CityRust.load()` (default URL is relative to the loader
script/window or worker location). Browser script exposes `globalThis.CityRust`;
CommonJS: `const CityRust=require('./prototypes/labs/city-lab/city-rust.js')`.
Node `load()` defaults to the asset beside that file. `load({url,bytes,requiredOps})`
can override the asset; `bytes` accepts a WASM BufferSource. No external imports,
wasm-pack, JS-generated topology, WebGL implementation or browser server is used.

**`load()` by default requires ALL ten implemented port operations.** Only
diagnostic/preparation checks deliberately use `load({requiredOps:[]})`.
`engine.requireOperations(names)` rejects incomplete ports; selected Rust must
surface this failure, not use JS. Never use that diagnostic override to make an
incomplete selected Rust engine appear functional.

`engine.call(op,meta={},buffers={name:TypedArray})` is synchronous after async
loading and returns `{meta,buffers,timings}`; result buffers are independent,
transferable arrays, never WASM views. Example conversion:

```js
const result=engine.call('mesh.segment',
  {volume:{dims:b.dims,cell:b.cell,origin:b.origin,M:b.M},y0:0,y1:b.dims[1]},
  {vol:b.vol});
const mesh={...result.meta,...result.buffers};
```

Keep worker `{epoch,id,mode,voxelSize,...}` and transfer lists unchanged. For
door output assemble `doorMesh={...r.meta.mesh,verts:r.buffers.verts,
idx:r.buffers.idx}` and `doorData={indices,materials,boxes:r.meta.boxes}`.
For sparse output combine metadata and all three buffers into the existing ray
payload. CPU `vol` transfer for one resident interior is separate from geometry.
`engine.stats()` returns `{liveBytes,liveAllocations,memoryBytes}`; live allocations
must return to zero after every call, including errors. WASM linear memory is a
high-water allocation and need not shrink when buffers are freed. `dispose()`
invalidates this loader and releases its exports reference (GC reclaims instance).

## Raw allocation/wire contract

Exports: `memory`, `city_abi_version()->u32`, `city_alloc(byteLen:u32)->handle:u32`,
`city_buffer_ptr(handle)->ptr`, `city_buffer_len(handle)->u32`,
`city_run(inputHandle)->outputHandle`, `city_free(handle)->u32`,
`city_live_bytes()->u32`, `city_live_allocations()->u32`.

Handles are monotonically allocated IDs, not pointers and never reused. Zero
means allocation/invalid-handle failure. Registry-owned zero-initialized buffers
stay valid until freed. `city_run` retains input and returns a distinct result;
the caller frees BOTH in `finally`. Invalid or double free returns 0; valid free
returns 1. No caller-supplied pointer/length is dereferenced by Rust. Re-fetch
`memory.buffer` after calls that may grow memory; never retain borrowed views.

Packet: LE u32 JSON-byte length, UTF-8 JSON, zero padding until absolute offset
is divisible by 8, then binary payload. Request JSON is
`{abi:1,op,meta,buffers:[{name,kind,offset,length}]}`. `length` is ELEMENT count;
`offset` is BYTE offset relative to payload. Arrays are LE; each buffer must be
naturally aligned, non-overlapping, within bounds, unique-name. Success JSON:
`{abi:1,ok:true,meta,buffers:[...]}`; failure:
`{abi:1,ok:false,meta:null,buffers:[],error:{code,message}}`. All retained resources
are owned Rust collections. ABI limits are 16 MiB JSON, 256 MiB packet, 128 buffer
descriptors, 512 MiB live registry bytes. These are transient transport limits,
**not** permission to exceed the unchanged **128 MiB resident geometry cap**.
Module handlers must validate metadata ranges and return errors, not panic;
WASM release uses abort-on-panic and a trapped instance should be discarded.

## Shared JS costs that are intentionally NOT ported

- `BuildingPlan.generate`: full plot/room/stair/opening/furniture planning;
  `BuildingPlan.facadeSpans` precomputation. No claim to port its room planner.
- `BuildingVoxels.build` for exterior/full architectural volumes, furniture and
  kit-piece placement; `kit-pieces.js`, `M`, `palette`, `decompose` remain shared.
  Exterior uses `{exterior:true,closedDoors:true}` and skips interior furnishing/
  stairs. Full build is ONLY the separate bounded doorway prefetch.
- JS baseline/legacy `BuildingReview.openDoors` and all existing
  `BuildingWalk`/`CityWalk` collision, stair traversal and movable-door behavior.
  Rust's selected batched full path opens the same recorded leaves natively;
  shared JS still plans/selects them and owns navigation state/movement.
- `BuildingRenderer` WebGL shaders, upload, shadow/outline passes and rendering;
  `CityRay` sparse rendering. The JS baseline still uses JS `meshSegment`; the
  selected Rust engine must use Rust mesh/door/sparse conversion, not that helper.
- `CityGreen` generation/mesh and its soft normals; `CityGeometry.environment`,
  `roadHeight`, `walkHeight`, `accessPath`/`accessMesh`, `bounds`/`planBounds` and
  small summary/entry/density helpers. Existing collision uses `CityModel`
  geometric utilities; this is not a topology-generation callback into JS.
- Worker queue/orchestration, structured clone/transfer, block mesh concatenation,
  main-thread residency management, UI, browser/GPU and GC costs remain JS/browser.

Preserve initial exterior-only jobs, one bounded interior prefetch, ready E
opening/closing without a new full job or teleport, physical bidirectional entry,
retention/release, epoch and stale-target rejection, and 128 MiB before uploads.
Do not change collision/envelope/parity assertions or reduce geometry quality.
The runtime implements these paths. CPU/worker tests cover payload parity and
door collision; headless browser acceptance remains lead-owned, not certified here.
Light facade/low requests are pipelined at most three; dense jobs are exclusive.
Geometry cap checks include access meshes and transactional replacement peaks;
GL failure retains old geometry and cleans staged buffers/textures. Diagnostic
arrays are capped at 600 recent entries. `scheduling` counts calls/ms/posted/
peakInflight/cancelled; `jobPhases` splits queue/receive/upload CPU. Render
snapshots expose resident/enabled/drawn/cull counts for main/light passes (a
cached light pass has null derived culls), upload CPU and asynchronous GPU timing.
These counters are not benchmark measurements of browser/frame performance.

The optional `city-world.js` bridge uses original IDs/plans and a rigid local
model plus XZ anchor: `microvoxel-world.html?district=6|12&citySeed=2718&engine=js|rust&walk=1`,
optionally `districtTerrain=uneven`. It is closed-exterior-only, not interior/E
walking certification. Limits are 80 MiB terrain + 47 MiB buildings + palette
within 128 MiB geometry; one 32 MiB reply and 64 MiB per-building source scratch
preflight, no retained dense volumes. Framebuffers/driver/JS heap are separate.

Measure cold read/compile/instantiate separately from per-call encode/copy-in/
execute/copy-out/decode (`loadTimings`, `timings`). `executeMs` INCLUDES Rust packet
decode/dispatch/encode, not pure algorithm time. Also separately measure shared
plan, span/decomposition, full/exterior voxel generation, JS preparation, worker
transfer/queue, upload, resident geometry/CPU volumes and frame distribution.
Do not omit remaining JS costs from end-to-end comparisons. This integration has
no city speedup claim and no browser/GPU/device performance certification.

## Reproducible setup and checks

Verified toolchain at preparation: rustc `1.97.1 (8bab26f4f 2026-07-14)`, cargo
`1.97.1 (c980f4866 2026-06-30)`, rustup `1.29.0`, Node `v24.19.0`, npm `10.8.3`.
Only setup installation performed: `rustup target add wasm32-unknown-unknown`.
Cargo fetched lockfile dependencies; direct deps pinned to serde `1.0.228` and
serde_json `1.0.145` (`float_roundtrip`). No wasm-pack/wasm-bindgen/Node dependency
installation. Native target remains `x86_64-unknown-linux-gnu`.

From repository root:

```sh
source ~/.nvm/nvm.sh && nvm use 24
rustup target add wasm32-unknown-unknown
cargo check --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --locked
cargo test --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --locked
cargo fmt --manifest-path prototypes/labs/city-lab/rust/Cargo.toml -- --check
cargo clippy --manifest-path prototypes/labs/city-lab/rust/Cargo.toml --all-targets --locked -- -D warnings
node tools/build-city-rust.cjs --test
npm test -- --unit city-
```

Build script runs locked release Cargo build for `wasm32-unknown-unknown`, pins
`CARGO_TARGET_DIR` inside ignored `rust/target`, and copies only the stable WASM
asset. Its generated `wasm/.gitignore` ignores the entire generated directory
without modifying the dirty root ignore file. `--test` adds native Node/WASM ABI
checks, 200 allocation/free cycles, memory growth, operation-readiness and failure
checks. Focused `city-rust*.cjs` unit tests exercise all ten actual operations,
shared JS job parity and classic-worker schemas. The bounded follow-up is
`node --expose-gc tools/benchmark-city-rust.cjs --bounded --repeats=3`; raw results
are in `output/city-rust-comparison/bounded.json`, documented in
`docs/testing/city-rust-comparison.md`. No browser benchmark runs here. Full root/browser
testing belongs to lead's testing_agent and remains headless by default.
