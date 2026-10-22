## Implementation
- [ ] Deterministic co-op session module: seats, phases, plans, role-private views, handoffs, economy, autopilots.
- [ ] Transport adapter with vendored PeerJS and a BroadcastChannel local transport.
- [ ] Phase-driven crew in the hex atlas; day replay from accepted plans.
- [ ] Co-op UI: host/join room code, seat claim, phase banner, Ready, role actions on hex tap, dusk report.
- [ ] Offline cache, package tool and library notes updated.

## Verification
- [ ] Unit: phase gating, autopilot fill, privacy (no cross-seat leakage before handoff), economy/target math, determinism.
- [ ] Browser: two pages over the local transport complete a multi-day loop with split roles; solo autopilot loop; existing World Lab suites still pass.
- [ ] Manual: one PeerJS room between two headless pages over the public signaling service (not in CI).
