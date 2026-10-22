## Context
The hex atlas (`hex-atlas.js`) already provides deterministic per-hex summaries, frontier/lead/identified states and task-linked crew on any world mode. The repo has no networking. The site is static (GitHub Pages).

## Decisions
### Phase clock (reuses the decided day/night contract)
| Phase | Exploration | Research | Logistics |
|---|---|---|---|
| Night (plan) | Choose frontier hexes to survey; total travel cost must fit the packed supplies | Mark up to 2 hint hexes from visible geology clues | Pack supplies (sets tomorrow's survey budget); queue builds |
| Day (watch/act) | Crew walk out, survey, bring back samples from leads | Study samples handed over at the previous dusk; identification yields a resource profile | Claim identified hexes, route them to camp over surveyed hexes, place extractors |
| Dusk (handoff) | Findings and samples go to Research; surveyed terrain goes to Logistics | Resource profiles go to Logistics | Delivery report against the day's target |
The next phase starts when every human seat is Ready; autopilot seats are always ready. Dawn delivers the night's hand-offs (supplies, hints) to Exploration.

### Role-private knowledge
Each seat holds its own knowledge map. Another role's results appear only after a handoff, as markers/stamps in your own view, never as chat. The host computes and sends each client only its own seat's view. The host's browser holds full state (acceptable for a cooperative prototype; not anti-cheat).

### Authority and sync
The host is authoritative. Clients send intents (`claimSeat`, `plan`, `ready`). The host validates, advances phases and broadcasts `{phase, day, seatView}` per client. Terrain is never sent: everyone regenerates it from `seed`, `extent` and `cell`. Day simulation is deterministic from the session seed and the accepted plans, so clients animate the same crew walk locally from the broadcast plan; only results come from the host.

### Transport
`createTransport(kind)` → `{host(code), join(code), send(to,msg), broadcast(msg), on(event,fn), close()}`. Kinds: `peerjs` (vendored PeerJS; room code → host peer id `spacology-<code>`), `local` (BroadcastChannel; used by solo play and the browser regression). Automated tests never touch the public signaling service.

### Economy (illustrative)
Root extractor yields 8/day. Target is 6 on day 1 and rises by 4 per day, so day 3 onward requires a second line. An extractor on an identified hex yields its profile's yield minus a route penalty of its hex-route cost (floor 1). Logistics has 3 build points per day: claim+extractor costs 2, each route hex 0 (route length only reduces yield). Supplies: 6 per night; a survey costs the hex's travel cost rounded up.

### Autopilots
Unplayed roles use today's automatic behaviour: Exploration picks cheapest frontier hexes within supplies; Research studies every held sample and hints the nearest exposed hexes; Logistics packs full supplies and connects the best identified hex. A human seat always beats its autopilot because it can pick, not just react.

## Risks
Public PeerJS signaling availability and NAT traversal without TURN; host leaving ends the room (no migration); no reconnection beyond rejoining between phases.
