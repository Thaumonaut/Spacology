# Anime A/B flags on voxel-polish: all three together

These are the `?ground=paint`, `?flowers=anime` and `?far=lobes` flags, ported onto `voxel-polish` (commit ce1af99, generator micro-wilds-29). They're the same changes as the main-checkout A/B tests (see the READMEs there under `artifacts/anime-ground`, `anime-flowers` and `anime-far-trees`). Two differences: `groundMat` uses texture unit 9 (`rockMap` now has unit 8), and `?cliffs=fine` isn't ported, since it made no visible difference.

Seed 203749, standing at (1079, 1017) looking north. Headless, `PORT=4174 VIEWS=walk,map WAIT=120 FLAG="ground=paint&flowers=anime&far=lobes" node tools/__ground-shot.cjs north 203749 1079 1017 1079 1217`.

| A (defaults) | B (all three flags) | View |
| --- | --- | --- |
| `north-walk-a.png` | `north-walk-b.png` | Walk mode across the open plain |
| `north-map-a.png` | `north-map-b.png` | Close map view |
