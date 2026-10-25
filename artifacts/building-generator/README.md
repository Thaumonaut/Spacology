# Building generator screenshots

Headless captures from `tests/browser/building-lab.cjs` (the building lab, `prototypes/building-lab.html`). Rerunning `npm test -- browser/building-lab` regenerates them.

**Variety at a glance:** `variety-<type>.png` shows the ground floors of seeds 1–16 for each building type, with the plot, typology and plan chosen freely. Each tile names its typology, plot context, storeys and stair kind. Rooms are coloured by type. Furniture is not drawn on these sheets.

**Facades:** `facades-<style>.png` shows the street fronts of seeds 1–8 per style, with type, plan and look chosen freely. Wall hues, timber patterns, window shapes, roofs, cross gables and turrets vary within a style's character.

**Massing:** `massing.png` shows one house built with each roof form and silhouette feature forced: gable along and to the street, hip, half-hip, gambrel with dormers, a cross gable, a turret with oriels, and a lacquer hip with a turret.

**Close-ups:** `<typology>-…-close-door/eave/roof-corner.png` are taken 3–6 m away, where detail problems show first.

**One building per typology:** `<typology>-<type>-<style>-…`:

| Typology | Example |
| --- | --- |
| `side` | Shop-house, machiya, terrace: a side passage and straight stair, with rooms in a row |
| `wing` | Workshop, half-timber, corner plot: a side passage ending in a rear wing, yard beside |
| `centre` | Family home, harbour, terrace: a central hall with a straight stair |
| `stairhall` | Family home, half-timber, detached: a broad hall to a U-turn stair at the back |
| `cross` | Shop-house, lacquer, corner plot: a passage across the house, rooms along the street |
| `cottage` | Family home, half-timber, detached: the front door into the living room, with the stair in it |
| `courtyard` | Inn, lacquer, detached: wings round a courtyard, outer galleries, a stair tower |

Each has four images:

- `-corner`: a three-quarter view from the street.
- `-ground` and `-upper`: cutaways of the ground floor and the first floor.
- `-plan-ground`: the 2D plan. Doors appear as gaps, windows in blue, outside doors in red, and furniture footprints in brown.

`metrics.json` holds per-view CPU submit times in headless Chromium (software GL, so not GPU timings) and per-building plan, voxel and mesh times. Furniture is voxelised KayKit (CC0, Kay Lousberg).
