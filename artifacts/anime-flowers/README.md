# Anime flowers: A/B (`?flowers=anime`)

Goal: flowers like the anime field references, with recognisable species, painted petals and clusters.

- **A**: the current flowers (default). One five-lobe head per card, in a flat palette colour with a warm centre.
- **B**: `?flowers=anime`, a shader-only change (`flowerVertex` / `flowerFragment` in `voxel-renderer.js`):
  - **Species from the material, varied by seed.** Pink flowers are cosmos (eight broad petals with a notched tip) or daisies (fourteen thin white petals). Yellow are buttercups (five cupped petals) or yellow cosmos. Violet and glow flowers are forget-me-not clusters (five round petals, pale eye).
  - **Painted petals.** Deep and saturated at the base, the palette colour through the middle, pale tips; a soft fold between petals, a faint vein, sunlit tops slightly lighter, and a thin rim in the petal's deeper tone. The centre is a gold disc with a darker ring and dotted pollen.
  - **Clusters.** Up to three heads per stem at different heights (forget-me-nots always three). The card is 1.6× wider to fit them, and stems run to each head.

Headless captures with `tools/__ground-shot.cjs` (`OUT=anime-flowers FLAG=flowers=anime`), seed 2718, standing at (−9.85, −42.36) looking −z:

| A | B | View |
| --- | --- | --- |
| `meadow-walk-a.png` | `meadow-walk-b.png` | Walk mode: cosmos and a buttercup pair up close |
| `meadow-map-a.png` | `meadow-map-b.png` | Close map view |
| `meadow-wide-a.png` | `meadow-wide-b.png` | Zoomed out 4 clicks |

Not done yet:
- **Density.** The references show dense colour drifts. How many flowers there are depends on where the generator places `FLOWERS` voxels (`turf` and flower props in `voxel-world-model.js`), not on the shader. Thickening the drifts would be a separate generator change.
- **Distance.** Far away, flowers are only drawn on close tiles, so distant fields don't show as colour masses yet. The painted-ground drifts (`?ground=paint`) help there.
- **Edges.** They are still hard (discard), not soft anti-aliased.
