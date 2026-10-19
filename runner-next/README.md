# Relay Run: Horizon

An isolated 2.5D follow-up to [`prototypes/relay-runner.html`](../prototypes/relay-runner.html). The original game stays playable.

```sh
cd runner-next
npm install
npm run dev
```

For the browser benchmark on a fresh machine, install Chromium once with `npx playwright install chromium`.

Open the local URL Vite prints. Drag or use A/D or the arrow keys to steer. Fire is automatic. P pauses. The load-test button runs a separate benchmark scene with 2,000 moving enemies and 6,000 moving bullets; press it again to return to the menu. The FPS readout is measured in the current browser and device, so it is evidence for that environment only.

Normal play uses three lanes on a raised road. A moving blue squad fires at a continuous enemy stream in the middle. Every visible member shoots from their own position on a staggered timer. Squad shots have a limited range, so the red swarm remains visible as it approaches. When the squad moves to an upgrade lane, half of its members shoot the wall while the others cover the center. Recruitment walls move down the left lane and immediately add shooters when broken. The squad count is also health: each escaped enemy removes one shooter, a brute removes two, and a boss removes three. Breaking later left walls can rebuild the squad. The right lane offers tougher stationary gun walls starting in wave 5. The cannon fires aimed, stronger shots from a fixed emplacement. A shock gun becomes available from wave 8 after the cannon is installed; its pulses slow approaching enemies. Enemies rush faster than the walls. Brutes and bosses show health bars, and bosses become more frequent in later waves.

## Architecture

- `src/ecs.js`: dense entity IDs and typed-array components for position, motion, health, kind and damage. A fixed spatial grid limits collision candidates.
- `src/game.js`: movement, wave and gate scheduling, recruitment, stationary guns, collisions, squad health and benchmark simulation. It has no renderer dependency.
- `src/render.js`: perspective Three.js scene with a raised three-lane road, batched blue squad members, nearby red enemies, bullets and gates. Distant enemies and bullets use point LOD, so they remain visible without drawing full meshes at the horizon. New enemy models can replace the nearby archetype geometries without changing the simulation data.
- `src/main.js`: input, UI, timing and browser lifecycle.

The target is a 16.7 ms frame budget for a steady 60 FPS. The sidebar reports FPS and the 95th-percentile frame time; `window.relayRunner.performance` also exposes the 99th percentile. If the 95th percentile stays above 17.2 ms, the renderer lowers internal resolution in small steps, down to 70% of one CSS pixel per axis; a new run resets quality. Distant entities switch to point LOD and common nearby enemies use simple unlit materials.
Shaders and the first buffers for each model are prepared behind the title screen to reduce first-appearance stalls.

Acceptance on the chosen target device: run both normal late-wave play and the 8,000-entity load scene for five minutes each. After warm-up, require a 95th-percentile frame time at or below 16.7 ms and a 99th percentile at or below 20 ms, with no sustained drop below 60 FPS. Record the final quality percentage. Repeat this gate whenever enemy models, effects or bullet counts change.

Run a repeatable headless desktop benchmark with `npm run benchmark`. It starts and stops its own local Vite server and reports late-wave play plus the 8,000-entity scene. Set `SPACOLOGY_BENCHMARK_GATE=1` to make it exit nonzero when either scene misses the limits. For the five-minute acceptance run, set `SPACOLOGY_BENCHMARK_DURATION_MS=300000`. `SPACOLOGY_SOFTWARE_GL=1` forces SwiftShader for a reproducible CPU-rendered baseline; leave it unset to test the available graphics path. Browser runs are headless unless you explicitly set `SPACOLOGY_HEADED=1`.

This is a scale prototype, not a claim that every device will sustain 8,000 active entities at 60 FPS. The load test exercises movement, grid construction, local bullet collision queries and instanced rendering; it does not exercise full game progression or high-detail imported models at that count. Check those separately before choosing final art and target hardware.

Run the pure ECS checks with `npm test` and make a production bundle with `npm run build`.
