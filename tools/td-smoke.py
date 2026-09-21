"""Bounded Terrain Diffusion benchmark; run with the isolated upstream Python environment."""
import argparse
import json
import os
from pathlib import Path
import sys
import time

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[2] / 'terrain-diffusion')
parser.add_argument('--output', type=Path, default=Path('artifacts/terrain-diffusion'))
parser.add_argument('--device', choices=['cpu', 'mps'], default='mps')
parser.add_argument('--conditioning', type=Path, help='Folder of five conditioning TIFFs from FMG full JSON conversion')
parser.add_argument('--fmg', type=Path)
parser.add_argument('--latitude', type=float, default=0)
parser.add_argument('--longitude', type=float, default=0)
args = parser.parse_args()
if args.fmg:
    args.fmg = args.fmg.resolve()
args.output = args.output.resolve()
if args.conditioning:
    args.conditioning = args.conditioning.resolve()
os.environ.setdefault('MPLBACKEND', 'Agg')
sys.path.insert(0, str(args.source.resolve()))
os.chdir(args.source)
import numpy as np
import torch
from terrain_diffusion.inference.world_pipeline import WorldPipeline
from terrain_diffusion.inference.tiff_export import CHANNEL_FILES, _load_and_pad

if args.device == 'mps' and not torch.backends.mps.is_available():
    raise RuntimeError('MPS unavailable; explicitly use --device cpu to test CPU inference')
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
started = time.perf_counter()
print('Loading 90m model on', args.device, flush=True)
world = WorldPipeline.from_pretrained('xandergos/terrain-diffusion-90m', seed=42,
    latents_batch_size=1, torch_compile=False, caching_strategy='direct', cache_limit=512 * 1024**2)
world.to(args.device)
origin = 0
metadata = None
if args.fmg:
    from fmg_conditioning import prepare
    fields, metadata = prepare(args.fmg, args.latitude, args.longitude)
    for channel, values in enumerate(fields):
        world.set_custom_conditioning_import(channel, values, -64, -64, default_value=float(np.median(values)), rebuild=False)
    world.set_cond_snr([0.2, 0.2, 1.0, 0.2, 1.0])
if args.conditioning:
    folder = args.conditioning.resolve()
    for filename, channel, scale, default in CHANNEL_FILES:
        path = folder / filename
        if not path.is_file():
            raise FileNotFoundError(path)
        world.set_custom_conditioning_import(channel, _load_and_pad(path, channel, scale, default), 0, 0,
            default_value=default, rebuild=False)
    origin = 64 * 256
world.bind()
row = col = origin
if not args.conditioning and not args.fmg:
    coarse = world.synthetic_map_factory.sample_raw(0, 0, 64, 64)[0]
    cell = np.unravel_index(np.argmin(np.abs(coarse - 1800)), coarse.shape)
    row, col = int(cell[0]) * 256, int(cell[1]) * 256
loaded = time.perf_counter()
print('Generating one 256 x 256 tile', flush=True)
with world, torch.inference_mode():
    result = world.get(row, col, row + 256, col + 256, with_climate=True)
    elevation = result['elev'].detach().cpu().numpy()
if not np.isfinite(elevation).all():
    raise RuntimeError('Model returned non-finite terrain')
np.save(output / 'elevation.npy', elevation)
from matplotlib.colors import LightSource
from matplotlib import colormaps, pyplot as plt
relief = LightSource(azdeg=315, altdeg=45).shade(elevation, cmap=colormaps['terrain'], vert_exag=1, dx=90, dy=90)
plt.imsave(output / 'relief.png', relief)
report = dict(device=args.device, model='xandergos/terrain-diffusion-90m', seed=42,
    conditioning=metadata or (str(args.conditioning) if args.conditioning else 'upstream synthetic world (not FMG)'),
    originRow=row, originColumn=col, width=256, height=256, metresPerPixel=90, minimumM=float(elevation.min()), maximumM=float(elevation.max()),
    modelLoadSeconds=loaded-started, inferenceSeconds=time.perf_counter()-loaded, torch=torch.__version__)
(output / 'report.pending.json').write_text(json.dumps(report, indent=2))
(output / 'report.pending.json').replace(output / 'report.json')
print(json.dumps(report, indent=2), flush=True)
