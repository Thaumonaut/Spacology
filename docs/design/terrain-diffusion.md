# Terrain diffusion: can we run it, and where does it plug in

Notes from reading the [terrain-diffusion](https://github.com/xandergos/terrain-diffusion)
source (MIT, paper [arXiv:2512.08309](https://arxiv.org/abs/2512.08309)) with two
questions in mind: whether it runs without an NVIDIA card, and where it would
actually attach to `prototypes/worldgen.html`.

## The README is wrong about Macs, in a useful direction

> **Mac is CPU-only.**

That is a note about what the author tested, not something the code enforces. Reading
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
| Apple Silicon Mac | MPS. Works, and is the good case. |
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
