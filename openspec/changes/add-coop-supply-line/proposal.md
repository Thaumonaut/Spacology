## Why
Jacob asked to turn the hex atlas into actual gameplay following Epic #8, with roles split between co-op players from the start and peer-to-peer online play joined by room code. The decided co-op contract (docs/design/three-teams-and-station-games.md §1–2) applies: one mode per player, a shared day/night clock, nothing live, information changes hands only at phase turns, and autopilots fill unplayed roles.

## What Changes
- Add a first co-op slice, "Open a second supply line", to the microvoxel World Lab on the default streamed world: the root Ferrite extractor alone cannot meet a rising daily delivery target, so the team must find, identify and connect a second resource.
- Add a deterministic, host-authoritative co-op session (phase machine, seats, role-private knowledge, handoff packets, autopilots) independent of rendering and transport.
- Add a transport adapter: PeerJS (vendored, MIT) over its public signaling service for online room codes, and a local BroadcastChannel/loopback transport for solo play and automated tests.
- Replace the always-on crew loop with phase-driven crew: crew carry out the planned day's tasks and rest at camp at night.

## Capabilities
### New Capabilities
- `coop-supply-line`: phase-based co-op loop over the shared hex atlas.
### Modified Capabilities
None formally; `microvoxel-world` crew become phase-driven inside this lab.

## Impact
World Lab only (`prototypes/microvoxel-world.html`, `prototypes/labs/microvoxel-world/`), its tests, offline cache and package tool. No game server, accounts, TURN relay, persistence across reloads, terrain modification, buildings beyond a single extractor type, or Svelte app integration. Peer-to-peer requires every player online at once and the public PeerJS signaling service; some restrictive networks will fail without a TURN relay. All numbers are illustrative playtest defaults.
