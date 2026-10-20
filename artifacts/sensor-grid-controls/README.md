# Sensor placement: tap controls

Headless screenshots of `prototypes/sensor-grid.html` after the switch from the Queens-style tap cycle
(empty → × → sensor) to a **Sensor | Cross** switch (option B).

| # | Image | What it shows |
|---|---|---|
| 1 | [Sensor mode](1-sensor-mode.png) | Default: one tap places a sensor, a second tap clears it |
| 2 | [The switch](2-switch-cross.png) | The two-way switch at the start of the toolbar, set to Cross |
| 3 | [Cross mode](3-cross-mode.png) | A tap marks ✕ (and clears a sensor); the status line confirms the switch |

Rules: a drag always paints ✕ whatever the switch says. Probe mode overrides both. The choice is saved in
`localStorage` (`spacologySensorTapModeV1`). Keys: M flips the switch, S and X still place directly. Each tap
pulses the cell briefly (off under reduced motion).
