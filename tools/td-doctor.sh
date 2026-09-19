#!/usr/bin/env bash
# What can this machine actually run terrain-diffusion on?
#
# terrain-diffusion's README says "Mac is CPU-only", but that is a note about what
# the author tested, not a constraint in the code: every inference entry point takes
# --device, and every 'cuda' literal in the inference tree sits inside a
# torch.cuda.is_available() ternary. So the question is only whether *torch* can see
# an accelerator here. This script answers that and prints the install to run.
#
#   bash tools/td-doctor.sh

set -uo pipefail

os="$(uname -s)"
arch="$(uname -m)"
echo "os:   $os"
echo "arch: $arch"

have_torch=0
python3 - <<'PY' 2>/dev/null && have_torch=1
import torch; raise SystemExit(0)
PY

if [ "$have_torch" = 1 ]; then
  echo
  echo "--- torch sees ---"
  python3 - <<'PY'
import torch
print("torch          ", torch.__version__)
print("cuda available ", torch.cuda.is_available())
print("  hip/rocm     ", getattr(torch.version, "hip", None))
mps = getattr(torch.backends, "mps", None)
print("mps built      ", bool(mps and mps.is_built()))
print("mps available  ", bool(mps and mps.is_available()))
if mps and mps.is_available():
    x = torch.randn(512, 512, device="mps") @ torch.randn(512, 512, device="mps")
    print("mps matmul     ", "ok", float(x.sum()) == float(x.sum()))
PY
else
  echo "(torch not importable yet — install it first, see below)"
fi

echo
echo "=== what to install ==="
case "$os:$arch" in
  Darwin:arm64)
    cat <<'EOF'
Apple Silicon. Use the MPS backend — that IS Metal; you never write Metal yourself,
torch's MPS backend is built on Metal Performance Shaders.

  python3 -m venv .venv && source .venv/bin/activate
  pip install --upgrade pip
  pip install torch torchvision          # arm64 wheels ship MPS by default
  pip install diffusers accelerate safetensors h5py numba scikit-image \
              matplotlib scipy ema-pytorch infinite-tensor flask click \
              pyfastnoiselite

Then run any entry point with:
  TERRAIN_DEVICE=mps python -m terrain_diffusion.inference.explorer.server --device mps

Skip the repo's requirements.txt. It pulls cartopy, rasterio, earthengine-api and
wandb, which are for building the training set and for GeoTIFF export — none of them
are imported by world_pipeline.py or the explorer server. They are also the three
hardest things to install on macOS. Add rasterio only if you want tiff-export.
EOF
    ;;
  Darwin:x86_64)
    cat <<'EOF'
Intel Mac. This is the dead end, and it is a packaging problem, not a Metal problem.

PyTorch's MPS prerequisites do list AMD GPUs, so in principle your card qualifies.
But torch 2.2.2 was the last release with a macosx_x86_64 wheel — 2.4.1 (which
terrain-diffusion requires) and everything after is macosx_arm64 only. So there is
no torch you can pip install here that both meets the version floor and has MPS.

Options, worst to best:
  1. CPU on torch 2.2.x and patch the >=2.4.1 floor. Likely to break; also slow.
  2. Build torch from source with USE_MPS=1 for x86_64. Hours, and unsupported.
  3. Run it somewhere else and bring the heightmaps back. Terrain output is just
     rasters — generate on a rented NVIDIA box, download the .h5/.tif, and do all
     the map, culture and lore work locally where it costs nothing.

(3) is the honest recommendation.
EOF
    ;;
  Linux:x86_64)
    cat <<'EOF'
Linux. If the AMD card is discrete and reasonably recent, ROCm is the real answer —
it is the only non-NVIDIA backend that runs diffusion at a useful speed.

  python3 -m venv .venv && source .venv/bin/activate
  pip install --upgrade pip
  pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm6.2
  pip install diffusers accelerate safetensors h5py numba scikit-image \
              matplotlib scipy ema-pytorch infinite-tensor flask click \
              pyfastnoiselite

ROCm presents itself to torch AS cuda — torch.cuda.is_available() returns True and
torch.version.hip is set. So terrain-diffusion needs no flag at all; its default
device selection already picks it up.

Check your card is in the support list first; consumer RDNA cards often need
HSA_OVERRIDE_GFX_VERSION set (e.g. 11.0.0 for RDNA3, 10.3.0 for RDNA2).
EOF
    ;;
  *)
    echo "Unrecognised $os:$arch — check torch's install matrix for this platform."
    ;;
esac

cat <<'EOF'

=== not a path ===
Vulkan. PyTorch's Vulkan backend was a mobile-inference experiment, never covered the
op set a diffusion UNet needs, and has been removed from recent torch. There is no
version of "run terrain-diffusion on Vulkan" that works.
EOF
