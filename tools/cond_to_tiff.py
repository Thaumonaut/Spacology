#!/usr/bin/env python3
"""Turn a worldgen.html conditioning bundle into terrain-diffusion input.

terrain-diffusion generates terrain from five conditioning rasters. Its own
``inference/utils/azgaar_to_tiff.py`` writes exactly these, and
``inference/tiff_export.py`` reads them back by filename:

    heightmap.tif         elevation, metres, negative below sea
    temperature.tif       mean temperature, C
    temperature_std.tif   temperature standard deviation, C
    precipitation.tif     annual precipitation, mm
    precipitation_cv.tif  precipitation coefficient of variation, percent

So the coarse map was always meant to come from a generator. This script is the
bridge from ours. It does the physical unit mapping the browser deliberately
left alone, because how tall the tallest mountain is and how wet the wettest
coast is are worth changing without regenerating the planet.

    python3 tools/cond_to_tiff.py world.cond out/ --report
    python3 tools/cond_to_tiff.py world.cond out/
    python3 tools/cond_to_tiff.py world.cond out/ --region=-30,20,10,55

Then:

    python -m terrain_diffusion.inference.tiff_export \
        xandergos/terrain-diffusion-90m out/ terrain.tif --device mps
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

MAGIC = b"SPCOND\x01\n"

# terrain-diffusion renders 256 output pixels per conditioning cell. This is the
# number that silently decides how big your planet is, so it is worth stating.
PIXELS_PER_CELL = 256
EARTH_CIRCUMFERENCE_KM = 40075.0

# Earth's hypsometry, as (fraction of that domain's area at or below, metres).
# A noise-derived elevation field is roughly unimodal, and Earth's is not: 76%
# of the sea floor is abyssal plain between 3 and 6 km, and no monotone curve
# turns one shape into the other — measured on our own output, mean ocean depth
# came out at 560 m against Earth's 3,682, and even a near-step power curve only
# reached 2,078. Matching the distribution by rank fixes it exactly, and it also
# keeps the conditioning inside the range the model was trained on.
EARTH_LAND_HYPSOMETRY = [
    (0.00, 0.0), (0.26, 200.0), (0.48, 500.0), (0.70, 1000.0),
    (0.87, 2000.0), (0.95, 3000.0), (0.995, 5000.0), (1.00, 8848.0),
]
EARTH_OCEAN_HYPSOMETRY = [
    (0.00, 0.0), (0.08, 200.0), (0.12, 1000.0), (0.18, 2000.0),
    (0.27, 3000.0), (0.50, 4000.0), (0.78, 5000.0), (0.96, 6000.0),
    (1.00, 10900.0),
]

# Biome -> (temperature std C, precipitation CV %). Taken from BIOME_VARIABILITY
# in terrain-diffusion's azgaar_to_tiff.py, mapped from our biome names onto the
# nearest of its thirteen. Values are characteristic of the biome; the means
# come from the simulation.
BIOME_VARIABILITY = {
    "ocean":     (float("nan"), float("nan")),  # marine: filled from nearest land
    "shallow":   (float("nan"), float("nan")),
    "ice":       (15.0, 20.0),   # glacier
    "polar":     (15.0, 20.0),   # glacier
    "tundra":    (15.0, 25.0),
    "taiga":     (15.0, 20.0),
    "temperate": (8.0, 22.2),    # temperate deciduous forest
    "grass":     (10.0, 25.0),   # grassland
    "steppe":    (15.0, 33.0),   # cold desert
    "desert":    (5.0, 80.0),    # hot desert
    "savanna":   (5.0, 28.6),
    "seasonal":  (3.0, 26.7),    # tropical seasonal forest
    "rain":      (2.0, 16.0),    # tropical rainforest
    "wetland":   (8.0, 20.0),
    "alpine":    (15.0, 25.0),   # tundra
    "peak":      (15.0, 20.0),   # glacier
}


def read_bundle(path: Path):
    """Parse a .cond bundle into (header, {name: numpy array})."""
    import numpy as np

    raw = path.read_bytes()
    if not raw.startswith(MAGIC):
        raise SystemExit(f"{path}: not a conditioning bundle (bad magic)")
    p = len(MAGIC)
    (hlen,) = struct.unpack_from("<I", raw, p)
    p += 4
    header = json.loads(raw[p : p + hlen].decode("utf-8"))
    p += hlen

    w, h = header["width"], header["height"]
    dtypes = {"f32": np.float32, "u8": np.uint8}
    out = {}
    for f in header["fields"]:
        dt = dtypes[f["dtype"]]
        a = np.frombuffer(raw, dtype=dt, count=w * h, offset=p + f["offset"])
        out[f["name"]] = a.reshape(h, w)
    return header, out


def _match_hypsometry(values, table, ceiling):
    """Remap by rank onto a target elevation distribution, scaled to `ceiling`."""
    import numpy as np

    n = values.size
    if n == 0:
        return np.zeros_like(values)
    order = np.argsort(values, kind="stable")
    ranks = np.empty(n, dtype=np.float64)
    ranks[order] = np.arange(n, dtype=np.float64)
    q = (ranks + 0.5) / n
    qs = np.array([a for a, _ in table], dtype=np.float64)
    ds = np.array([b for _, b in table], dtype=np.float64)
    ds = ds / ds[-1] * ceiling          # keep the shape, honour --max-alt/--max-depth
    return np.interp(q, qs, ds)


def to_layers(header, fields, *, max_alt, max_depth, land_power, ocean_power,
              shelf_frac, shelf_depth, precip_at_p88, hypsometry):
    """Simulation fields -> the five rasters in the units the model expects."""
    import numpy as np
    from scipy.ndimage import distance_transform_edt

    el = fields["elevation"].astype(np.float64)
    sea = float(header["seaLevel"])

    # Elevation to metres. Land uses a power curve for the same reason Azgaar's
    # does: real hypsometry is bottom-heavy, so a linear map puts far too much
    # of a continent high up. Ocean mirrors their depth curve.
    land = np.clip((el - sea) / max(1e-6, 1.0 - sea), 0.0, None)
    deep = np.clip((sea - el) / max(1e-6, sea), 0.0, None)

    # The sea floor gets two regimes, because Earth's hypsometry is bimodal and
    # one power curve cannot make that shape: a broad shallow shelf, a short
    # steep slope, then abyssal plain. A single curve run over a roughly
    # Gaussian elevation field gives a mean ocean depth of about 560 m against
    # Earth's 3,682 — an ocean that is all shelf and no deep.
    is_land = el >= sea
    elevation_m = np.zeros(el.shape, dtype=np.float64)
    if hypsometry == "earth":
        # Rank within each domain separately, so the shoreline stays exactly
        # where the simulation put it and only the depth profile is restyled.
        elevation_m[is_land] = _match_hypsometry(
            land[is_land], EARTH_LAND_HYPSOMETRY, max_alt)
        elevation_m[~is_land] = -_match_hypsometry(
            deep[~is_land], EARTH_OCEAN_HYPSOMETRY, max_depth)
    else:
        shelf = np.clip(deep / max(1e-6, shelf_frac), 0.0, 1.0)
        below = np.clip((deep - shelf_frac) / max(1e-6, 1.0 - shelf_frac), 0.0, 1.0)
        depth = shelf_depth * shelf + (max_depth - shelf_depth) * np.power(below, ocean_power)
        elevation_m = np.where(is_land, max_alt * np.power(land, land_power), -depth)
    elevation_m = elevation_m.astype(np.float32)

    temperature_c = fields["temperature"].astype(np.float32)
    precipitation_mm = (fields["precipIndex"].astype(np.float64)
                        * precip_at_p88).astype(np.float32)

    names = header["biomeNames"]
    bidx = fields["biome"]
    std_lut = np.array([BIOME_VARIABILITY.get(n, (float("nan"),) * 2)[0]
                        for n in names], dtype=np.float32)
    cv_lut = np.array([BIOME_VARIABILITY.get(n, (float("nan"),) * 2)[1]
                       for n in names], dtype=np.float32)
    temperature_std_c = std_lut[bidx]
    precipitation_cv_pct = cv_lut[bidx]

    # Marine cells have no land-biome variability, same as the Azgaar path.
    # Fill them from the nearest valid cell rather than leaving holes, because
    # tiff_export turns non-finite conditioning into a flat default.
    def fill(a):
        mask = ~np.isfinite(a)
        if not mask.any():
            return a
        if mask.all():
            return np.zeros_like(a)
        idx = distance_transform_edt(mask, return_distances=False,
                                     return_indices=True)
        return a[tuple(idx)]

    return {
        "heightmap.tif": elevation_m,
        "temperature.tif": temperature_c,
        "temperature_std.tif": fill(temperature_std_c),
        "precipitation.tif": precipitation_mm,
        "precipitation_cv.tif": fill(precipitation_cv_pct),
    }


def crop(layers, header, region):
    """Crop every layer to a lon/lat box, returning new layers and bounds."""
    import numpy as np

    w, h = header["width"], header["height"]
    lon_w, lon_e, lat_s, lat_n = region
    x0 = int(math.floor((lon_w + 180.0) / 360.0 * w))
    x1 = int(math.ceil((lon_e + 180.0) / 360.0 * w))
    y0 = int(math.floor((90.0 - lat_n) / 180.0 * h))
    y1 = int(math.ceil((90.0 - lat_s) / 180.0 * h))
    x0, x1 = max(0, x0), min(w, max(x0 + 1, x1))
    y0, y1 = max(0, y0), min(h, max(y0 + 1, y1))
    out = {k: np.ascontiguousarray(v[y0:y1, x0:x1]) for k, v in layers.items()}
    bounds = (x0 / w * 360.0 - 180.0, 90.0 - y1 / h * 180.0,
              x1 / w * 360.0 - 180.0, 90.0 - y0 / h * 180.0)
    return out, bounds


def report(header, layers, native_resolution):
    """Say how big this planet actually is, before anyone renders 400 GB."""
    h, w = next(iter(layers.values())).shape
    cell_km = PIXELS_PER_CELL * native_resolution / 1000.0
    # Planet size comes from the whole map; a crop is a window onto it, not a
    # smaller world.
    circ = header["width"] * cell_km
    out_w, out_h = w * PIXELS_PER_CELL, h * PIXELS_PER_CELL
    px = out_w * out_h
    cropped = (w, h) != (header["width"], header["height"])
    print(f"  conditioning     {w} x {h} cells"
          + (f"  (crop of {header['width']} x {header['height']})" if cropped else ""))
    print(f"  native res       {native_resolution:g} m/px "
          f"-> {cell_km:.2f} km per conditioning cell")
    print(f"  implied planet   {circ:,.0f} km around "
          f"({circ / EARTH_CIRCUMFERENCE_KM:.2f}x Earth, "
          f"radius {circ / (2 * math.pi):,.0f} km)")
    print(f"  {'this crop' if cropped else 'full output':16} "
          f"{out_w:,} x {out_h:,} px "
          f"= {px / 1e9:.1f} Gpx, {px * 2 / 1e9:.1f} GB as int16 "
          f"({w * cell_km:,.0f} x {h * cell_km:,.0f} km on the ground)")
    need = EARTH_CIRCUMFERENCE_KM / cell_km
    print(f"  Earth-sized here would need {need:,.0f} cells across "
          f"({need:,.0f} x {need / 2:,.0f})")
    if px * 2 > 50e9:
        print("  NOTE: rendering all of this is not the intended use. Crop with "
              "--region, or let the explorer server page it in on demand.")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bundle", type=Path)
    ap.add_argument("out_dir", type=Path, nargs="?")
    ap.add_argument("--report", action="store_true",
                    help="print sizing and exit without writing")
    ap.add_argument("--native-resolution", type=float, default=90.0,
                    help="m/px of the model you will run (30 or 90)")
    ap.add_argument("--region", default=None,
                    help="crop to lonW,latS,lonE,latN. Use the equals form when a "
                         "value is negative: --region=-30,20,10,55")
    ap.add_argument("--hypsometry", choices=["earth", "power"], default="earth",
                    help="earth: match the real elevation distribution by rank "
                         "(keeps the model in distribution). power: the simpler "
                         "curve, for deliberately un-Earthlike worlds")
    ap.add_argument("--max-alt", type=float, default=None,
                    help="metres at the highest point on land "
                         "(default: 8848 matching Earth, or 6500 in power mode)")
    ap.add_argument("--max-depth", type=float, default=None,
                    help="metres at the deepest point of ocean "
                         "(default: 10900 matching Earth, or 4000 in power mode)")
    ap.add_argument("--land-power", type=float, default=1.0,
                    help="higher puts more of the land low down; 1.0 because the "
                         "generator's relief slider already shapes hypsometry, and "
                         "it lands on Earth's mean land elevation on its own")
    ap.add_argument("--ocean-power", type=float, default=0.45,
                    help="curve below the shelf break; lower reaches abyssal depth sooner")
    ap.add_argument("--shelf-frac", type=float, default=0.10,
                    help="fraction of the ocean's depth range that is continental shelf")
    ap.add_argument("--shelf-depth", type=float, default=200.0,
                    help="metres at the shelf break")
    ap.add_argument("--precip-at-p88", type=float, default=1600.0,
                    help="mm/year at the 88th percentile of land precipitation")
    args = ap.parse_args(argv)

    try:
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError:
        raise SystemExit("needs numpy and scipy: pip install numpy scipy rasterio")

    # In earth mode the tables already carry real metres, so rescaling them to a
    # ceiling only compresses the distribution we just went to the trouble of
    # matching — capping depth at 4000 drags mean ocean depth from 3,682 to
    # 1,352. Only override when asked.
    if args.max_alt is None:
        args.max_alt = 8848.0 if args.hypsometry == "earth" else 6500.0
    if args.max_depth is None:
        args.max_depth = 10900.0 if args.hypsometry == "earth" else 4000.0

    header, fields = read_bundle(args.bundle)
    print(f"{args.bundle.name}: seed {header['seed']!r}, "
          f"{header['width']}x{header['height']}, {header['plates']} plates")

    layers = to_layers(header, fields,
                       max_alt=args.max_alt, max_depth=args.max_depth,
                       land_power=args.land_power, ocean_power=args.ocean_power,
                       shelf_frac=args.shelf_frac, shelf_depth=args.shelf_depth,
                       precip_at_p88=args.precip_at_p88, hypsometry=args.hypsometry)

    bounds = (-180.0, -90.0, 180.0, 90.0)
    if args.region:
        try:
            r = [float(v) for v in args.region.split(",")]
            if len(r) != 4:
                raise ValueError
        except ValueError:
            raise SystemExit("--region wants lonW,latS,lonE,latN")
        layers, bounds = crop(layers, header, (r[0], r[2], r[1], r[3]))

    report(header, layers, args.native_resolution)

    # Earth, for comparison: mean land 840 m, mean ocean depth 3,682 m,
    # mean land precipitation about 715 mm. Numbers far from these mean the
    # conditioning is describing a planet the model was not trained on.
    hm = layers["heightmap.tif"]
    land, ocean = hm[hm > 0], hm[hm <= 0]
    pr = layers["precipitation.tif"]
    prl = pr[hm > 0]
    print(f"  elevation        {hm.min():,.0f} .. {hm.max():,.0f} m, "
          f"land mean {land.mean() if land.size else 0:,.0f} m "
          f"(Earth 840), {land.size / hm.size * 100:.0f}% land")
    print(f"  ocean depth      mean {-ocean.mean() if ocean.size else 0:,.0f} m "
          f"(Earth 3,682)")
    print(f"  precipitation    {pr.min():,.0f} .. {pr.max():,.0f} mm, "
          f"land mean {prl.mean() if prl.size else 0:,.0f} mm (Earth 715)")

    if args.report:
        return 0
    if args.out_dir is None:
        raise SystemExit("give an output directory, or pass --report")

    try:
        import rasterio
        from rasterio.transform import from_bounds
    except ImportError:
        raise SystemExit("writing GeoTIFFs needs rasterio: pip install rasterio")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    h, w = hm.shape
    transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], w, h)
    for name, arr in layers.items():
        with rasterio.open(args.out_dir / name, "w", driver="GTiff",
                           height=h, width=w, count=1, dtype="float32",
                           crs="EPSG:4326", transform=transform,
                           compress="lzw") as dst:
            dst.write(arr.astype("float32"), 1)
        print(f"  wrote {args.out_dir / name}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:      # piping into head is not an error
        sys.stderr.close()
