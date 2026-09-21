# Terrain diffusion: can we run it, and where does it plug in

Notes from reading the [terrain-diffusion](https://github.com/xandergos/terrain-diffusion)
source (MIT, paper [arXiv:2512.08309](https://arxiv.org/abs/2512.08309)) with two
questions in mind: whether it runs without an NVIDIA card, and where it would
actually attach to `prototypes/worldgen.html`.

## Mac support: verify with the local benchmark

> **Mac is CPU-only.**

The upstream README does not promise MPS support. Generic device handling makes it worth testing, but source inspection alone does not establish compatibility. Reading
the inference tree:

- Every entry point already takes `--device`, and the explorer server also reads
  `TERRAIN_DEVICE` (`inference/explorer/server.py:25`).
- Every single `'cuda'` literal under `inference/` is inside a
  `torch.cuda.is_available()` ternary. There is no `.cuda()` call, no `autocast`, no
  hardcoded device anywhere in the path that generates terrain. The `'cuda'` strings
  that *are* hardcoded live in `training/dev_utils/` and `evaluation/`.
- `WorldPipeline.to(device)` (`world_pipeline.py:584`) moves all three submodels
  generically.
- `torch.compile` disables itself when CUDA is absent (`world_pipeline.py:336`), which
  happens to dodge the usual reason diffusion code explodes on MPS.
- Default dtype is `None` → float32. The `bf16`/`fp16` options are a plain string
  mapping, not CUDA-gated.
- Every `float64` in the tree is **numpy**, not torch — so the one hard MPS limitation
  that usually bites (no float64 tensors) is not in play.
- Nothing in `requirements.txt` is CUDA-only: no triton, no xformers, no flash-attn,
  no bitsandbytes.

So `--device mps` is worth trying directly. Run `tools/td-doctor.sh` — it detects the
machine and prints the install for it.

## Vulkan is not a path

PyTorch's Vulkan backend was a mobile-inference experiment. It never covered the op set
a diffusion UNet needs and has been removed from recent torch. There is no version of
this that works, on any hardware.

## "Metal" means the MPS backend

You never write Metal. PyTorch's MPS backend is built on Metal Performance Shaders, and
using it is `--device mps`. The branch that matters is which machine:

| machine | answer |
|---|---|
| Apple Silicon Mac | MPS is available locally; validate actual inference with `tools/td-smoke.py`. |
| Intel Mac + AMD GPU | Blocked by packaging, not by Metal — see below. |
| PC + AMD, Linux | ROCm. It presents itself to torch *as* `cuda`, so no flag needed. |
| PC + AMD, Windows | ROCm's Windows support is newer and partial; `torch-directml` lags well behind the version floor. Prefer Linux. |

The Intel Mac case is worth spelling out because it looks like it should work and
doesn't. PyTorch's own MPS prerequisites do list AMD GPUs, so the card qualifies. But
**torch 2.2.2 was the last release with a `macosx_x86_64` wheel** — verified against
PyPI: 2.4.1 (terrain-diffusion's floor) and everything since ships `macosx_arm64` only.
There is no torch you can `pip install` on an Intel Mac that both meets the version
requirement and has MPS. Building from source with `USE_MPS=1` is the only local
option, and renting an NVIDIA box is the sane one — terrain output is just rasters, so
generate remotely and do the map, culture and lore work locally where it costs nothing.

## Skip `requirements.txt`

It pulls `cartopy`, `rasterio`, `earthengine-api` and `wandb`. None of those are
imported by `world_pipeline.py` or the explorer server — they belong to dataset
construction (`data/downloading/`, `training/datasets/`) and to GeoTIFF export. They are
also the three most painful things to install on macOS. The actual inference set is
roughly: `torch torchvision diffusers accelerate safetensors h5py numba scikit-image
matplotlib scipy ema-pytorch infinite-tensor flask click pyfastnoiselite`. Add
`rasterio` only for `tiff-export`.

## The thing that changes the plan

`terrain_diffusion/inference/utils/azgaar_to_tiff.py` exists. It converts an **Azgaar
Fantasy Map Generator full JSON export** into the conditioning rasters the model
upscales:

```
heightmap.tif         elevation in metres
temperature.tif       mean temperature °C
temperature_std.tif   temperature std dev °C  (derived from biome)
precipitation.tif     annual precipitation mm
precipitation_cv.tif  precipitation CV %      (derived from biome)
```

Two consequences.

First, **the coarse map was always meant to come from a generator like ours.** The
model does not invent a planet; it takes a low-resolution world and resolves it to
30 m/px. The two-stage split is exactly the split we already have — global structure
from simulation, local detail from somewhere else — and the seam between them is five
named rasters.

Second, **`worldgen.html` already computes four of those five fields.** Elevation,
temperature, precipitation and biome are all per-cell state in the generator today. The
fifth and sixth (`temperature_std`, `precipitation_cv`) are a 13-entry biome lookup
table, printed in full at the top of `azgaar_to_tiff.py` and trivially portable to our
biome set. We do not need to fork FMG or export its JSON — we need to write five arrays
in the layout that file already documents, including its periodic-seam handling
(`to_periodic_conditioning`, `make_periodic_seam`) for a world that wraps.

That is the integration point. It also settles the earlier language question: the answer
was never "rewrite the generator faster." The generator produces the coarse field, which
is small by construction, and the resolution comes from a model with O(1) random access
that only ever renders the tile you are looking at.

---

## The bridge, built

`prototypes/worldgen.html` has an **Export conditioning** button; `tools/cond_to_tiff.py`
turns what it writes into the five GeoTIFFs above.

The split is deliberate. The browser ships the raw simulation fields — normalised
elevation, temperature in °C, an unclamped precipitation index, and a biome index — and
does no unit conversion at all. How many metres the tallest mountain is and how many
millimetres fall on the wettest coast are worth re-deciding without regenerating the
planet, and they are flags on the Python side.

```
# what will this cost before I ask for it
python3 tools/cond_to_tiff.py world.cond --report

# write the conditioning folder
python3 tools/cond_to_tiff.py world.cond out/

# one region, at 30 m (note the = form, the value starts with a minus)
python3 tools/cond_to_tiff.py world.cond out/ --region=-30,20,10,55 --native-resolution 30

python -m terrain_diffusion.inference.tiff_export \
    xandergos/terrain-diffusion-90m out/ terrain.tif --device mps
```

One change was needed upstream of the export: the precipitation field was clamped to the
88th percentile, because the biome classifier only needs the ordering. Handing that to a
terrain model would give it one flat value across every rainforest on the planet, so the
generator now keeps an unclamped copy for export only. Biomes are unaffected.

### The number that decides how big your planet is

terrain-diffusion renders **256 output pixels per conditioning cell**. With the model's
native resolution that fixes the ground size of a cell, and therefore the size of the
world — nothing in the file says "planet", so it is easy to ask for a moon by accident.

| model | km per cell | cells for an Earth | our generate time |
|---|---|---|---|
| 90 m | 23.04 | **1739 × 870** | **5.2 s** |
| 30 m | 7.68 | 5218 × 2609 | ~45 s, ~700 MB |

Measured, not estimated: 1739 × 870 generates in 5.2 s and reports back as 40,067 km
around, radius 6,377 km against Earth's 6,371. **The 90 m model at 1739 × 870 is the
Earth-sized option and it sits comfortably inside what the generator already does.**

Full output at that size would be 445,184 × 222,720 px — 198 GB as int16. That is not a
failure, it is the point: you never render a planet, you render the part you are looking
at, which is what O(1) random access buys. `--report` prints the number so nobody
discovers it the hard way, and `--region` crops.

### Hypsometry is matched by rank, not by a curve

Elevation is remapped onto Earth's real elevation distribution instead of through a power
curve, because a noise-derived field is unimodal and Earth's is not — 76% of the sea floor
is abyssal plain between 3 and 6 km. Measured on our own output, a single power curve gave
a mean ocean depth of 560 m against Earth's 3,682, and even a near-step curve only reached
2,078. Matching by rank lands it at 3,740, with land mean 938 m (Earth 840) and land
precipitation 700 mm (Earth 715).

This also keeps the conditioning inside the distribution the model was trained on, which
matters more than the realism: feeding it a planet whose hypsometry Earth never had is
asking it to extrapolate. `--hypsometry power` is there for when that is the point.

### Known limitation

The conditioning is equirectangular and the model has no idea what latitude is, so cells
near the poles are stretched on the ground but rendered as if square. Terrain within about
60° of the equator is honest; beyond that it is progressively smeared in longitude.


## Local Terrain Lab (September 2026)

The upstream checkout is a sibling directory, `../terrain-diffusion`, at commit
`e8dcb4b1a834ab2f6b1a6f5256ed7c9f2f3e8230`. Its `.venv` isolates Python inference
from FMG. The 90m pretrained models and WorldClim 10-minute reference data are
local downloads. Do not commit model weights, the environment or reference rasters.

```sh
../terrain-diffusion/.venv/bin/python tools/td-smoke.py --device mps
../terrain-diffusion/.venv/bin/python tools/terrain-lab.py
```

The lab is at http://127.0.0.1:8871. Each run requests one 256×256 tile (23.04 km
across). `artifacts/terrain-diffusion` contains float elevation, a shaded-relief
PNG and measurements. MPS fallback is not enabled; errors are visible instead of
silently switching to CPU. The initial benchmark uses upstream synthetic
conditioning, not an FMG world. Model-native detail is 90m; enlarging the display
is not extra generated resolution.

For FMG input, save the native **Full JSON** export, then run the direct module
(the upstream umbrella CLI imports unrelated training dependencies):

```sh
cd ../terrain-diffusion
.venv/bin/python -m terrain_diffusion.inference.utils.azgaar_to_tiff /absolute/world.json /absolute/conditioning --scale 23.04
cd ../Spacology
../terrain-diffusion/.venv/bin/python tools/td-smoke.py --conditioning /absolute/conditioning
```

That path is provided for testing, not yet validated against this fork's current
JSON schema or alien biome IDs. The regional JSON export from Surface Exports is
not accepted by the upstream FMG converter. It also needs explicit seasonal
climate assumptions and reprojection. Do not substitute it without an adapter.

Keep three boundaries: FMG algorithms produce editable world structure; a local
inference worker refines requested regions; a separate viewer presents terrain,
sci-fi overlays and test measurements. Use FMG's existing Layers → Globe until
there is a reason to replace the viewer. Research-battle regions should keep
stable IDs and cache provenance. Alien materials should initially be overlays on
Earth-trained relief rather than claims that the model learned alien geology.

Verified locally: PyTorch 2.14.0 reports MPS available, and the 90m model produced
finite 256×256 elevation on MPS without CPU fallback. The first ocean-floor tile
took 64.5 seconds of inference, plus 3.7 seconds loading cached weights. This is
not yet an interactive streaming benchmark and does not establish full-world
performance. The small bounded test is the current supported lab workflow.

To reproduce the environment after cloning the pinned upstream source:

```sh
uv venv --python 3.12 ../terrain-diffusion/.venv
uv pip install --python ../terrain-diffusion/.venv/bin/python -r tools/terrain-inference.lock.txt
```

Upstream also needs `wc2.1_10m_bio_{1,4,12,15}.tif` from the WorldClim 2.1
10-minute bioclimatic archive in its `data/global` directory; this machine has
those files. Model weights are fetched from Hugging Face on first use. The
reference data is needed even when custom conditioning is supplied upstream.


### FMG import is now connected

Use **Alien Worlds → Send world to Terrain Lab** in the local fork, or select a
**Full JSON** export with the lab's Import world control. Select Imported FMG
world, enter latitude and longitude, and generate. Files stay local. Imports are
blocked while a run is active so the conditioning source cannot change mid-run.

`tools/fmg_conditioning.py` samples the actual grid and packed cell positions on
a sphere, creating a 129×129 local azimuthal-equidistant conditioning patch at
23.04 km per cell. The model refines its central cell into 256×256 pixels. This
avoids treating equirectangular longitude degrees as equal-length ground units.
The radius is currently fixed at 6371 km. Regional maps need about 1475 km of
surrounding coverage; incomplete context is rejected rather than extrapolated.

Fork spherical maps use their 100 m per land height unit / 300 m per ocean unit
and 20 mm per precipitation unit. Ordinary FMG maps use the upstream converter's
height exponent and 100 mm precipitation assumption. The Full JSON exporter now
preserves tectonic metadata to distinguish those conventions. Seasonality is
estimated from explicit Earth-biome analogues for the alien biome types.

Each report includes a hash of the exact exported source, region coordinates,
projection and model. These are independent regional experiments, not yet
seamless adjoining tiles. Noise is local to the patch; do not stitch outputs and
assume continuity. Source terrain is sampled from nearest cells, not eroded or
interpolated before inference. The model may alter the coarse sketch.

Verified end-to-end with a browser-exported spherical world, Moia, at
latitude -44.233875 / longitude -92.821500: MPS inference took 61.46 seconds,
producing finite elevations from 1196.30 to 2220.05 m. This is an actual FMG-backed
result, not the earlier synthetic benchmark.

```sh
../terrain-diffusion/.venv/bin/python tools/td-smoke.py --fmg /absolute/world.json --latitude -44.233875 --longitude -92.821500
../terrain-diffusion/.venv/bin/python -m unittest discover -s tools -p 'test_*.py'
```

### Zoom-driven viewer

The lab home page is now a custom canvas world viewer. Import/test controls remain
at `/benchmark`. Click to center a location, drag to pan, and scroll or use the
zoom buttons. **Explore selected location** jumps to the refinement scale. At
256× zoom and above, a navigation pause of 850 ms automatically requests a 90m
region; a ready result replaces the coarse canvas with a framed regional preview.

Requests snap to 0.1° latitude/longitude. Cache entries under
`artifacts/terrain-diffusion/cache` are keyed by the source-file hash, snapped
location, adapter revision, model resolution and device. Only one subprocess
runs at a time. During a run the client waits on its latest selection rather than
queuing every intermediate location. A completed old request cannot replace the
current view. Turning automatic refinement off stops new requests; an already
running GPU job is allowed to finish and populate the cache.

This is a world overview plus independent regional previews, not seamless streamed
terrain yet. Detail is fixed at 90m; extra zoom does not synthesize finer resolution.
The cache is local and persistent, with no automatic eviction in this prototype.
The full world overview is a nearest-cell elevation/climate rendering of the FMG
snapshot; imports refresh on viewer reload. Failed regions show an error and do
not continuously retry while stationary.

### Unified generation and exploration

World Explorer now includes a terrain preset and seed form. **Generate world**
uses the existing FMG generation engine embedded in the page, automatically
transfers the resulting snapshot to the local inference service, and displays
its overview. No file export or import is needed for this flow. Native Continents
is the default; Archipelago, Pangea and the alien climate presets are available.
The generator and terrain service still run as separate local processes on
ports 5174 and 8871. The interface is unified, not the server runtimes.

The cross-frame bridge accepts messages only from the local explorer origin and
its parent window, validates preset names, and matches generation response IDs.
It is enabled only by the dedicated `terrainLab=1` embed flag. A current inference
job finishes before a new generated world replaces its input. Advanced file
imports and benchmarks remain at `/benchmark`.
