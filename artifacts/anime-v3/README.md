# Anime A/B, round 3: lush grass and flowers lit like the trees

On branch `anime-ab-flags` (built on `voxel-polish` `ce1af99`). Seed 203749, walk mode at (1079, 1017) looking south. Headless, `PORT=4174 VIEWS=walk WAIT=150 FLAG="ground=paint&flowers=anime&far=lobes&grass=lush" node tools/__ground-shot.cjs south 203749 1079 1017 1079 817`.

| A (defaults) | B (all four flags) | View |
| --- | --- | --- |
| `south-walk-a.png` | `south-walk-b.png` | Walk mode toward the mountains |
| `flowers-close-a.png` | `flowers-close-b.png` | The near flowers, cropped and enlarged 2× |

New this round:
- **`?grass=lush`** (new flag):
  - 40 tufts per m² instead of 24.
  - The Walk budget allows one tuft per 16 screen pixels instead of 40. Before, that budget capped how much grass showed, however much the generator placed.
  - Walk grass fades out at 60–120 m instead of 30–60 m.
- **`?flowers=anime`**:
  - Each petal gets its own cupped normal. Petals turned away from the sun fall into the mid or shadow band, like tree lobes, and each petal darkens toward its base. The centre is a small dome.
  - Edges are anti-aliased with alpha-to-coverage, which also gives them the trees' ink outline.
  - Heads are larger (card 1.9× instead of 1.6×).
