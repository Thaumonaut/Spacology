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
