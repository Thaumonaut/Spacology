# Game menus and combat continuation

Implemented 2026-09-22. The main menu reuses the existing Star Singer artwork and now offers Continue, New Voyage, Settings and How to Play. Continue is hidden for an unstarted voyage and becomes Continue Battle when a matching combat checkpoint exists. A save card shows difficulty, route position, integrity, currency and victories.

New Voyage opens dedicated difficulty selection. The current save is preserved while browsing or cancelling setup. Replacing an existing voyage requires an in-game confirmation that identifies any unopened caches and unclaimed characters being discarded. The regular, Weaver and Silen expeditions retain separate save slots.

## Pause and settings

- **Menu / Escape:** pause from Ops or combat. Nested Settings and Help screens return to Pause before resuming.
- **Space:** toggle combat playback when not interacting with a control or dialog.
- **Save & Main Menu:** preserve the open pack/formation in Ops, or the current fight in combat.
- **Retreat:** confirm before ending the voyage. Secured rewards remain available in the recovery inbox.
- Completed and retreated voyages offer a Main Menu button alongside their result and new-voyage controls.

Shared device settings provide 1× / 1.5× / 2× playback speed, particle detail, reduced motion, automatic battle startup, background pausing and recovery mode. Presentation speed does not change combat time. Reduced motion defaults to the operating-system preference on first use and removes combat animation; it yields between actions so controls remain usable. Recover remains the new-voyage default. Recovery changes apply between battles; the control is disabled during a live fight. Difficulty remains locked, with voyage rules available separately in Ops.

Menu dialogs trap keyboard focus and support Escape/back navigation. The title screen makes the underlying Ops controls inert. Layouts were inspected at desktop, both tablet orientations and phone width; this does not claim that the existing Ops/battle boards have been redesigned for phones.

## Combat checkpoint behavior

`game-preferences.js` owns normalized preferences and a checkpoint key derived from the expedition's save slot. The engine saves at completed-action boundaries. Opening Pause immediately stops scheduling further actions, waits for any current animation to finish, and saves the resolved state. An in-progress animation is not itself serialized.

Checkpoints retain units, HP, shields, status effects, action waits, wave progress, pending turn reset, Aether, boss state and combat counters. Presentation snapshots are discarded. Restoring a fight leaves playback paused even if auto-start is enabled. Continue cannot enter Ops and change a formation while that fight is suspended. Finishing, retreating or explicitly replacing a voyage clears its checkpoint. Voyage seed and node position prevent applying a checkpoint to another run. Combat log presentation is rebuilt rather than restored.

The background-pause setting opens Pause when the document becomes hidden. Returning to the tab does not automatically resume. Saves and preferences use browser storage on the current device.

## Validation

- `node tests/unit/game-preferences.cjs`: normalization, operating-system reduced-motion default, preference persistence, checkpoint identity, exact combat fields, ended/stale-save rejection and independent save slots.
- Existing voyage and treasure unit checks pass.
- Headless `/tmp/playwright-test-game-menus.js`: start/setup, settings/help, nested Escape, cancelled replacement, Ops pause, real combat pause, main-menu round trip and reload with matching HP/AV/shields/Aether, explicit retreat and replacement, tablet/phone menu bounds, and keyboard focus containment. No browser runtime errors.
- `/tmp/playwright-test-menu-background.js`: visibility-event handling with an overridden `document.hidden` value, opt-out behavior, manual resume, completed-battle checkpoint cleanup, one-time results and next-node continuation. This exercises the application handler; it is not an OS app-suspension test.
- `/tmp/playwright-test-menu-full-voyage.js`: all 21 nodes and 14 engine-resolved battles still complete through the new departure flow. Strong crew fixtures test progression, not balance.

Browser automation runs headlessly. Cross-browser/Safari testing and physical-device suspension remain unverified.
