# Building generator screenshots

Headless captures from `tests/browser/building-lab.cjs` (the building lab, `prototypes/building-lab.html`). Rerunning `npm test -- browser/building-lab` regenerates them.

There are four buildings, each from the same pipeline (plot → program → floor plan → doors and windows → 6.25 cm voxel shell → kit furniture):

| Prefix | Seed | Type | Style | Plot |
| --- | ---: | --- | --- | --- |
| `shophouse-machiya` | 1 | Shop-house | Lantern-street machiya | Terrace |
| `home-fairytale` | 7 | Family home | Storybook half-timber | Detached |
| `inn-harbour` | 6 | Inn (3 storeys) | Harbour white & blue | Corner |
| `workshop-spire` | 3 | Workshop | Sky-temple lacquer | Terrace |

Views per building:

- `-corner`: a three-quarter view from the street.
- `-street`: eye level from the street.
- `-back`: the yard side.
- `-above-floor1` and `-above-floor2`: cutaways showing the ground floor and the first floor.
- `-plan-ground`: the 2D plan of the visible floor. Rooms are coloured by type, doors appear as gaps, windows in blue, outside doors in red, and furniture footprints in brown.

`metrics.json` holds per-view CPU submit times in headless Chromium (software GL, so not GPU timings) and per-building plan, voxel and mesh times. Furniture is voxelised KayKit (CC0, Kay Lousberg).
