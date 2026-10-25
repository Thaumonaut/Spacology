# City slice (three.js / WebGPU)

Vertical slice of the enterable city at a higher quality bar: `prototypes/labs/city-slice/`. Renders the TownKitCity
layout with PBR materials from procedural texture sets, cascaded sun shadows, sky + IBL fill, GTAO, bloom, AgX and SMAA;
doors swing open within 3 m and interiors (`interiors.js`) stream in within 22 m with up to six real point lights.

| File | What to look at |
| --- | --- |
| s1-street | First pass: textures are too coarse and the stone block generator shows star-shaped joint artefacts |
| s1-inside | First interior: stair, joists, partition; materials and lighting still placeholder quality |

First numbers (headless WebGPU): ~1,270 draws, ~3.0M triangles for the whole 224-building city in view; city build
1.1 s, texture generation 1.2 s.

## s3 — scanned CC0 textures

`s3-*.png`: the procedural texture sets replaced by ambientCG CC0 scans (Bricks066, RoofingTiles006, PavingStones070,
Plaster001, Planks023A, Grass004), stylised at load into neutral banded detail maps with floored roughness. Compare
`s2-door.png` (procedural stone with star-shaped joint artefacts) with `s3-door.png`. `?tex=proc` restores the old sets.
Shading is still PBR; cel shading is the next step.
