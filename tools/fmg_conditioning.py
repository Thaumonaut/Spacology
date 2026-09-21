"""Adapt FMG Full JSON to a local azimuthal-equidistant conditioning patch."""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree

VARIABILITY = {0: (8, 25), 1: (5, 80), 2: (15, 33), 3: (5, 28.6), 4: (10, 25),
    5: (3, 26.7), 6: (8, 22.2), 7: (2, 16), 8: (6, 25), 9: (15, 20),
    10: (15, 25), 11: (10, 30), 12: (8, 20)}
ALIEN_CLIMATE = {'lava': 1, 'basalt': 4, 'ash': 2, 'salt': 1, 'glacial': 11,
    'geothermal': 12, 'darkforest': 6, 'luminous': 12, 'crystal': 2, 'leyforest': 6}

def validate(data):
    if not isinstance(data, dict) or not all(k in data for k in ('info', 'settings', 'grid', 'pack', 'mapCoordinates')):
        raise ValueError('Use an FMG Full JSON export, not a .map or regional conditioning file.')
    if not all(isinstance(data[k], dict) for k in ('info', 'settings', 'grid', 'pack', 'mapCoordinates')):
        raise ValueError('Malformed FMG export sections')
    for name in ('width', 'height'):
        v = data['info'].get(name)
        if not isinstance(v, (int, float)) or not math.isfinite(v) or v <= 0:
            raise ValueError('Invalid map dimensions')
    for name in ('grid', 'pack'):
        cells = data[name].get('cells')
        if not isinstance(cells, list) or not cells or len(cells) > 250000:
            raise ValueError('Expected 1–250,000 exported cells')
    points = data['grid'].get('points')
    if not isinstance(points, list) or len(points) != len(data['grid']['cells']):
        raise ValueError('Full JSON must contain grid points and cells')
    coords = data['mapCoordinates']
    for key in ('lonW', 'lonE', 'latS', 'latN'):
        if not isinstance(coords.get(key), (int, float)) or not math.isfinite(coords[key]):
            raise ValueError('Invalid geographic bounds')
    if not (-90 <= coords['latS'] < coords['latN'] <= 90 and 0 < coords['lonE'] - coords['lonW'] <= 360):
        raise ValueError('Invalid geographic extent')
    return data

def sphere(lat, lon):
    lat, lon = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)], axis=-1)

def prepare(path, latitude, longitude):
    raw = Path(path).read_bytes()
    data = validate(json.loads(raw))
    if not (math.isfinite(latitude) and math.isfinite(longitude) and -85 <= latitude <= 85 and -180 <= longitude <= 180):
        raise ValueError('Choose latitude -85…85 and longitude -180…180')
    latitude, longitude = round(latitude, 6), round(longitude, 6)
    geo = data['mapCoordinates']
    if not (geo['latS'] <= latitude <= geo['latN'] and geo['lonW'] <= longitude <= geo['lonE']):
        raise ValueError('Selected location is outside this map')
    size, spacing, radius = 129, 23040.0, 6371000.0
    east, north = np.meshgrid((np.arange(size)-64)*spacing, (64-np.arange(size))*spacing)
    distance = np.hypot(east, north)
    angle = distance / radius
    bearing = np.arctan2(east, north)
    lat0, lon0 = math.radians(latitude), math.radians(longitude)
    lat = np.arcsin(np.sin(lat0)*np.cos(angle) + np.cos(lat0)*np.sin(angle)*np.cos(bearing))
    lon = lon0 + np.arctan2(np.sin(bearing)*np.sin(angle)*np.cos(lat0), np.cos(angle)-np.sin(lat0)*np.sin(lat))
    lat, lon = np.degrees(lat), (np.degrees(lon)+180)%360-180
    query = sphere(lat, lon).reshape(-1, 3)
    def sample(points, cells, key):
        points = np.asarray(points, dtype=float)
        if points.ndim != 2 or points.shape[1] != 2 or not np.isfinite(points).all():
            raise ValueError('Invalid cell coordinates')
        p_lon = geo['lonW'] + points[:, 0] / data['info']['width'] * (geo['lonE']-geo['lonW'])
        p_lat = geo['latN'] - points[:, 1] / data['info']['height'] * (geo['latN']-geo['latS'])
        _, indices = cKDTree(sphere(p_lat, p_lon)).query(query)
        values = np.asarray([c[key] for c in cells], dtype=float)[indices].reshape(size, size)
        if not np.isfinite(values).all():
            raise ValueError('Non-finite map fields')
        return values
    grid, pack = data['grid'], data['pack']
    h = sample(grid['points'], grid['cells'], 'h')
    temp = sample(grid['points'], grid['cells'], 'temp')
    prec = sample(grid['points'], grid['cells'], 'prec')
    biome = sample([c['p'] for c in pack['cells']], pack['cells'], 'biome').astype(int)
    spherical = grid.get('tectonics', {}).get('version') == 2
    exponent = float(data['settings']['heightExponent'])
    if not math.isfinite(exponent) or not 0 < exponent <= 5:
        raise ValueError('Invalid height exponent')
    elevation = np.where(h >= 20, (h-20)*100 if spherical else np.maximum(0,h-18)**exponent,
        (h-20)*300 if spherical else -4000*(np.maximum(0,20-h)/20)**1.5)
    definitions = {b['i']: b for b in pack.get('biomes', [])}
    variability = {i: VARIABILITY.get(ALIEN_CLIMATE.get(definitions.get(i, {}).get('alien'), i), (8,25)) for i in np.unique(biome)}
    tstd = np.vectorize(lambda b: variability[b][0])(biome)*100
    pcv = np.vectorize(lambda b: variability[b][1])(biome)
    fields = [elevation, temp, tstd, prec*(20 if spherical else 100), pcv]
    if geo['lonE']-geo['lonW'] < 359.99:
        outside = (lon < geo['lonW']) | (lon > geo['lonE']) | (lat < geo['latS']) | (lat > geo['latN'])
    else:
        outside = (lat < geo['latS']) | (lat > geo['latN'])
    if outside.any():
        raise ValueError('This region needs more surrounding map coverage (about 1475 km in each direction). Choose a location farther from the map edge.')
    digest = hashlib.sha256(raw).hexdigest()
    metadata = dict(source='FMG Full JSON', sourceHash=digest, mapName=str(data['info'].get('mapName','Unnamed world')),
        latitude=latitude, longitude=longitude, conditioningSize=size, conditioningMetresPerCell=spacing,
        projection='local azimuthal equidistant on a 6371 km sphere',
        tileId=f'{digest[:16]}:{latitude:.6f}:{longitude:.6f}:90m',
        climateAssumption='Seasonality inferred from Earth biome analogues; alien geology is not learned by the model.',
        seamStatus='Independent regional preview; adjacent inference patches are not yet guaranteed seamless.',
        sampling='Nearest spherical FMG cells; original cell-scale boundaries are preserved in conditioning.',
        elevationConvention='Spacology spherical metres' if spherical else 'FMG exponent and synthetic ocean-depth curve')
    return [np.asarray(f, dtype=np.float32) for f in fields], metadata
