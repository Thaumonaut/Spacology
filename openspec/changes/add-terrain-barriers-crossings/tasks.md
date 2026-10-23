## Implementation
- [x] Generator: massifs, passes, gorges and rock field under revision `micro-wilds-2`; barrier-aware root search; catchment unchanged.
- [x] Atlas: 1 m grid classification with a walkable-share rule (`barrier`, `pass`, `highland`, `passable`, `rock`, `span`), infinite cost for barriers, path finder for crew.
- [x] Session: scout intent, rock samples and ratings, crossing start/progress/completion, passable-with-crossing routing and frontier, uplift seam profiles, report lines.
- [x] Autopilots for scouting, rock study and crossings.
- [x] Play UI: hex actions (Scout edge, Study rock, Plan ramp/cutting/bridge), briefs, inspector text, crossing progress; crew hex paths.
- [x] Overlay: barrier hatching, scouted labels, crossing glyphs with progress.
- [x] Seed survey reports barrier coverage, passes, gorges, nearest barrier and open start; thresholds tuned to the open-start rule.
- [x] Offline cache, package tool and README updated.

## Verification
- [x] Unit: classification determinism, barrier rejection, scouting handoff timing, rock pricing, multi-day progress, routing through a finished crossing, seam yields, autopilot crossing, privacy.
- [x] Browser: solo session reaches a finished crossing and a line beyond it; two-tab co-op still passes; existing World Lab suites pass with the revision bump.
- [x] Visual: headless screenshots of a massif wall, a pass and a gorge with a bridge.
