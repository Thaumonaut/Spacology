# Painted ground: A/B (`?ground=paint`)

Goal: the ground shouldn't look pixelated. Colour should come in painted patches that span many voxels, with curvy borders.

- **A**: the current ground (default).
- **B**: `?ground=paint`, a shader-only change in `voxel-renderer.js`:
  - **Majority pick.** On soft ground tops (blade grasses and loose floors, not rock, snow or water), each pixel takes the material that covers most of the 3×3 columns around a noise-warped point. The warp is about 1 m, in metres, so the shapes stay put across LOD levels. Lone speckles (violet or sun-grass voxels) merge into drifts, and borders wander off the voxel grid. The generator supplies a new per-tile `groundMat` texture: the ground-top material of each column, with a two-column halo.
  - **No per-voxel grain** on soft ground and undergrowth tops. Loose floors get two soft tones in patches a few metres across instead.
  - **Undergrowth tones in patches.** Undergrowth (tufts, ferns, moss) takes one tone per wandering patch, from bands of a warped noise field. Before, it took a hash per 3×3-block cell, which read as a checker of squares from above.
  - **Soft moss blotches** instead of the 7 cm pixel stipple.

Headless captures with `tools/__ground-shot.cjs`, seed 203749, standing at (1079, 1017) looking −x:

| A | B | View |
| --- | --- | --- |
| `meadow-walk-a.png` | `meadow-walk-b.png` | Walk mode |
| `meadow-map-a.png` | `meadow-map-b.png` | Close map view (5 m scale bar) |
| `meadow-wide-a.png` | `meadow-wide-b.png` | Zoomed out 4 clicks (20 m scale bar) |

What changes: the grey/olive checker under the trees becomes one soft olive floor, violet speckle becomes wandering drifts, and the moss pixel mottling becomes soft blotches. Open grass looks the same (it was already painted).

Not done yet:
- A crisper moss blotch edge (`smoothstep(.4,.6)`). This was declined mid-run, so moss still uses the softer `.3–.7`.
- A second spot with other ground types (sand, dirt, gravel).
- Rock side faces keep their deliberate pixel-art stone.
- **Possible tile-edge seam.** At level 0 the warp (up to ±1.2 m, about ±5 blocks) can reach past the two-column halo of `groundMat`. Near a tile edge the lookup then clamps to the edge column, while the neighbouring tile reads the true columns. So a floor border crossing a seam could flatten on one side, every 8 m. Not checked yet. Either clamp the warp to the halo or widen the halo before making this the default.
