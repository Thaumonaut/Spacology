# First-person "Walk" mode for the microvoxel world

Status: design brief for implementation (2026-10-23). Owner: rendering. Branch to build on: `voxel-rendering-rebased`
(worktree `.claude/worktrees/voxel-rendering`), rebased on the terrain head `devin/1792601000-microvoxel-world`.

## Goal

Let the player drop from the overhead map into a first-person walk at eye height to experience the world from the ground:
the grass, flowers, mushrooms, palms, rivers and clouds we built for the overhead view, seen from among them. It is a
viewing mode, not a new game: no combat, no building. The overhead map stays the primary view.

Audience note (see project memory): relaxed drop-in co-op, Stardew-like. Walking should be calm, never motion-sickening,
easy to enter and leave, and work on a laptop trackpad and on touch.

## Player experience

- **Enter:** a "Walk" button in the main toolbar, and double-click / double-tap on the ground. The camera glides down from
  the overhead view to eye height (1.6 m) at the clicked point over ~0.8 s, facing the direction the overhead camera
  faced (35° yaw).
- **Move:** WASD / arrow keys walk (about 4 m/s, Shift runs at 8 m/s). Mouse look with pointer lock (click the canvas to
  lock; Escape releases). Touch: left half of the screen is a virtual stick, right half drags to look.
- **Ground:** the camera follows `world.ground(x, z)` (eye at ground + 1.6 m), eased so steps and smooth slopes feel
  smooth. No walking into water deeper than 1 m; slopes steeper than ~45° block movement (slide back, do not climb).
- **Leave:** "Map" button or `M`/Escape (when not pointer-locked) glides back up to the overhead view centred where the
  player stands.
- **Comfort:** field of view 70° (setting 60–90°), no head bob by default, no camera roll, smoothed turning on touch.

## What exists today (constraints you will hit)

The renderer is built around a fixed overhead orthographic camera (35° yaw, 50° pitch):

- **Projection is duplicated in every shader:** nine vertex shaders in
  `prototypes/labs/microvoxel-world/voxel-renderer.js` hand-write the same ortho projection
  (`q=p-center; forward=…; gl_Position=vec4(…/halfView.x, …/halfView.y, -(…)/depth, 1)`): main terrain, caster
  variant, grass, leaf cards, cloud plane, flowers, stalks, mushrooms and palm fronds.
- **Billboards face a fixed axis:** grass blades, leaf cards, flower and stalk cards build their quads along the camera
  right axis `(CY, 0, -SY)` and screen up. Leaf cards also offset in screen space (`gl_Position.xy += corner*size/halfView`).
- **Depth tricks assume ortho:** leaf cards pull toward the camera with `gl_Position.z -= size/depth`; the crew x-ray
  margin uses `gl_Position.z -= xray*1.5/depth`; the outline post pass converts depth to metres linearly with
  `depthRange` and inks depth jumps above a span-scaled `threshold`.
- **CPU-side camera helpers are ortho:** `project`, `screenDirection`, `pan`, `bounds`, `pick`, `lightBox`, `onScreen`
  on the `Renderer` class.
- **Streaming is footprint-based:** `lod-stream.js` `compute(L)` takes `renderer.bounds(camera, heightMetres)` (the
  overhead footprint) and keeps nodes whose projected box is on screen; the level comes from `autoLevel()` in
  `microvoxel-world.js` (≈5 px per voxel for the whole view).
- **Effects scaled by `camera.span`:** grass/leaf-card growth (`pixel=span/width`), cloud fade-in, shadow-pass and
  outline cut-offs, `visible(wavelength)` pattern fading (`pixelWorld` uniform), outline threshold.
- **Sky:** there is no sky. The canvas clears to a flat green-grey; clouds are a plane at 320 m drawn only in wide views.

## Implementation plan

### 1. One camera abstraction (prerequisite)

- Add a `view` object computed once per frame in `Renderer.begin`: `viewProj` (mat4), `eye` (vec3), `forward`,
  `right`, `up`, `near`, `far`, `fovY`, `ortho` flag, and a `pixelWorldAt(distance)` helper (metres per pixel at a given
  distance; constant in ortho).
- Overhead mode builds an orthographic `viewProj` that reproduces today's projection exactly. **Verify pixel-identical
  output** against current captures before going further (the streaming test compares paused frames pixel for pixel).
- Replace the nine hand-written projections with a shared GLSL snippet (like the existing `${SUNLIGHT}` / `${MEADOW}`
  includes): `uniform mat4 viewProj; uniform vec3 eye, camRight, camUp; vec4 toClip(vec3 p){return viewProj*vec4(p,1.);}`.
- Billboards: build quads from `camRight` / `camUp` uniforms (world-space) instead of the fixed axis; leaf cards
  should use a world-space offset toward the eye instead of a clip-space `z` pull: `p += normalize(eye - p) * size*.5`.
  Same for the x-ray margin (`p += normalize(eye-p)*1.5` in the x-ray draw).
- Port `project`, `pick`, `bounds`, `onScreen` to use `viewProj` (pick in walk mode: ray from the eye through the
  pixel, marched against `world.ground`).

### 2. Walk camera and controls (`microvoxel-world.js`)

- `camera.mode = 'map' | 'walk'`; in walk mode keep `{x, z, eyeY, yaw, pitch}`; pitch clamped to ±80°.
- Pointer lock + `movementX/Y`; keyboard motion relative to yaw; touch stick + drag-look.
- Ground follow with `world.ground`, slope/water blocking as above, eased eye height.
- Enter/leave transitions interpolate between the ortho and perspective `viewProj` (blend eye position, look direction
  and fov; switching projection type mid-glide is fine if done at the midpoint behind a short fade, or interpolate
  an ortho-to-perspective "dolly zoom"; keep it simple first).
- Keep the logical-position rebasing (`position.cx/cz`, `logical()`, `localPoint`) as it works today; the walker's
  position is the stream origin.
- Persist mode in the URL (`&walk=1&yaw=…`) like the existing `cx/cz/lx/lz` params.

### 3. Streaming by distance (`lod-stream.js`)

- New target selection for walk mode: rings around the walker with level by distance: L0 within ~40 m, L1 to 80 m,
  L2 to 160 m, L3 to 320 m, coarser beyond, up to a view distance (default 600 m, Economy 300 m). Keep the existing
  "coverage first" behaviour so coarse tiles fill the horizon before fine detail arrives.
- Cull to the view frustum (with a margin behind the camera so turning does not show holes); sort by distance.
- The existing per-group "finest complete coverage" draw list and dissolve logic should work unchanged with mixed
  levels; check seams between rings (skirts exist; smooth mode is the default and has no skirts between levels yet:
  expect cracks, see Risks).
- GPU budget: the 384 MiB desktop cache must hold the rings; measure.

### 4. Sky, horizon and distance

- Sky dome or full-screen gradient behind everything: warm golden-hour horizon fading to soft blue overhead, sun disc
  with a bloom halo toward the shadow-map sun direction (`SUN = normalize(-.5, 1, .4)`).
- Clouds seen from below: draw the existing cloud field (same `cloudField` noise, same world frame via `worldOffset`) on
  a sky plane at 320 m or as a dome projection, lit from below (darker undersides, golden rims). The cloud shadows on the
  ground already use the same field, so they will match.
- Aerial perspective / haze: blend fragments toward the horizon colour by distance (exponential, start ~150 m), which
  also hides the streaming edge and LOD pops. Apply in the main, grass, leaf, prop shaders (shared snippet).
- Far ocean beyond the macro map edge: haze carries it.

### 5. Effects that need re-scaling in perspective

- Replace every `camera.span`-based switch with per-fragment distance (`pixelWorldAt(distance)`):
  - grass blades and leaf cards: grow in by distance (full within ~30 m, gone by ~60 m), not by span;
  - `visible(wavelength)` uses the fragment's own metres-per-pixel;
  - cloud plane: always on in walk mode (it is the sky);
  - shadow pass: always on; fit `lightBox` to the near view (e.g. 120 m around the walker toward the view direction),
    optionally a second cascade for the mid-distance;
  - outlines: linearize perspective depth (`near*far/(far - d*(far-near))`) and scale the threshold with distance.
- Water facets, glints and caustics are world-space and should just work; the glint direction cheat (camera reflection
  angle) should switch to the true reflected sun direction using `eye` in walk mode, which gives a sun path on water.
- Peek (cursor canopy cut) is meaningless in first person; disable in walk mode.
- Crew x-ray: keep, with the world-space margin from step 1.

### 6. UI

- "Walk" button in the main toolbar (next to Pause crew); in walk mode the toolbar collapses to "Map", a compact
  compass, and the View menu. Hide hex overlay labels and markers that are screen-projected for the overhead view, or
  project them through `viewProj` and fade by distance.
- Crosshair dot and a hint ("Click to look around · WASD to walk · M for map") that fades after a few seconds.

## Acceptance

- Overhead mode is pixel-identical to before after step 1 (existing paused-frame comparisons in
  `tests/browser/microvoxel-world-streaming.cjs` keep passing).
- Walk mode: 60 fps on a mid laptop at 1280×800 with default settings; no holes when turning 360° at walking pace;
  horizon never shows the clear colour; grass, flowers, mushrooms, palms and water render correctly up close.
- New headless browser test: enter walk mode at a fixed seed/position, walk forward 10 m, turn 180°, assert no GL
  errors, terrain under the crosshair, camera above ground, and return to map at the same position.
- `npm test -- microvoxel` green (note: `tests/browser/microvoxel-world.cjs` has a check that is flaky in batch runs;
  see Risks).

## Risks and notes

- **Smooth-terrain seams between detail levels:** visible from the ground at LOD ring boundaries. Smooth mode currently
  has no skirts; add them (or stitch) before shipping walk mode.
- **Leaf cards up close** read as flat cutouts at eye level. Expect to fade them out below ~3 m and rely on the voxel
  crown there, or wait for tree objects from the terrain session's planned `world.objects()` API (trees, bamboo,
  boulders) and render crowns as card clusters around trunk meshes.
- **Performance:** perspective views see much farther; budget fragments (grass tuft budget already scales with screen
  area; keep it), and keep the post pass cheap (it reads ~30 samples per pixel today).
- **Flaky test:** `tests/browser/microvoxel-world.cjs` "terrain remains rendered while the next LOD loads" fails in
  batch runs and passes alone; investigate rather than relax it.
- Coordinate with the terrain session (`spacology-b0`) before touching `voxel-world-model.js` `node()`; walk mode
  should not need model changes.

## Files

- `prototypes/labs/microvoxel-world/voxel-renderer.js`: camera abstraction, shaders, sky, haze, billboards.
- `prototypes/labs/microvoxel-world/lod-stream.js`: distance rings and frustum culling.
- `prototypes/labs/microvoxel-world/microvoxel-world.js`: walk camera, controls, transitions, UI wiring, URL state.
- `prototypes/microvoxel-world.html`, `microvoxel-world.css`: Walk/Map buttons, crosshair, hint.
- `tests/browser/microvoxel-world-walk.cjs`: new headless test (run with `npm test -- microvoxel-world-walk`).
- Artifacts: captures in `artifacts/voxel-rendering/` with README rows (project convention: never `/tmp`).
