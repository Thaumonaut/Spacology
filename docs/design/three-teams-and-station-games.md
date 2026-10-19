# Three teams and their station games

**Working direction, decided in conversation with the user, 6–14 October 2026.** This note records the
decisions, the reasons behind them and what is still open, so that any agent can pick the work up without
the conversation. It is the newest source for everything below. Where `design-record.md`,
`session-progression-proposal.md`, `modifiers.md` or `run-variety-proposal.md` disagree with it on these
topics, this note reflects the user's later decisions. Those documents are not yet reconciled; see
[§12](#12-documents-this-supersedes-or-contradicts).

Status words used below: **decided** (the user chose it), **built** (a playable prototype exists and its
tests pass), **proposed** (discussed and favoured, not confirmed) and **open** (undecided).

---

## 1 · The shape of the game: three modes on one globe

**Decided.** The game has three modes. A player picks one. In co-op each player plays their own mode, and
the modes feed each other.

| Mode | Old name | What it is | Its product |
|---|---|---|---|
| **Exploration** | Lieutenant, field team | The auto-battler: team building, equipment, route, the fights | Decisions, requests, and what the fights recover (samples, scrap) |
| **Research** | Commander, science | The lab aboard the ship | Knowledge: easier battles for exploration, blueprints and verified paperwork for logistics |
| **Logistics** | Logistics | Production, packing, launches and the transport network | Gear, supplies and samples delivered where they are needed |

**Why it changed from "commander".** The commander role had no strong spine, and the user, who plays support
roles, wasn't sure what commander players want. Our research report
([`reports/Commander role design in games.md`](../../reports/Commander%20role%20design%20in%20games.md))
found commander seats go empty when they mean real-time overload, responsibility without authority, and
blame. A research team fits the fiction better: the ship is a university, the mission is the Long Census,
and the score is recovered data integrity. It also removes the alpha-player problem, because research
discovers things rather than giving orders.

**Exploration is the lead team; the other two support it** (decided). Exploration decides what it needs
and posts it. Research and logistics decide how to deliver. Exploration's own activities are the
auto-battler's systems: team builder (with equipment), route choice and the battle. It does not have a
collection of mini-games.

**Logistics and exploration never work together directly** (decided). Orders go one way at dusk, and gear
comes back at dawn. Research is the bridge and always has a partner (see §2).

### What flows between teams

```
 Exploration ──samples, scrap──► Logistics ──rockets carry samples──► Research
      ▲   │                          ▲                                   │
      │   └── orders (dusk) ─────────┘                                   │
      │                                                                  │
      └──── easier boss, easier elective fight, flaw-free assistance ────┤
                                                                         │
                      Logistics ◄── blueprints, resource nodes, ─────────┘
                                    verified manifests
```

- Exploration's fights recover **samples** (for research) and **resources and scrap** (for logistics).
- Logistics **launches samples to the ship's lab** and **delivers gear to the fronts**.
- Research returns **easier battles** to exploration, and **blueprints, resource nodes and verified
  manifests** to logistics.

### One globe, autopilots, persistence

- **One generated globe per run** (decided). A run lasts one session or many, depending on the mode
  (decided). The world generator (`prototypes/worldgen.html`) is the intended source.
- **Autopilots always fill unplayed roles** (decided). Solo exploration is the existing game, with research
  and logistics delivering a steady baseline. That baseline must never make solo play worse than today.
  A human in a support role always beats its autopilot.
- **The globe is the shared space** for co-op (proposed): three views of the same planet. The user's
  reference for the feel is PlateUp: everyone in one space, each with a role.

---

## 2 · The shared clock: asynchronous day and night

**Decided.**
- Everyone shares one day/night cycle, Civ-style. Whoever finishes their phase first waits; the next phase
  starts when everyone is ready. The team acts as one.
- **Nothing is live.** Information changes hands only when the phase turns, at dawn and at dusk. The user
  rejected real-time coordination.
- **Day one** is set-up: exploration gears up, research plots where to fight, and logistics prepares orders.

**Inverse schedules** (decided). The two support teams alternate partners:

| | Exploration | Research | Logistics |
|---|---|---|---|
| **Night** | Plans: team, gear, route. Posts **orders** to logistics and **requests** to research | **Works with exploration:** makes tomorrow's battles easier | **Own focus:** fills exploration's orders so gear is ready at dawn |
| **Dawn** | Receives research's results and logistics' gear | | |
| **Day** | The battle (watch) | **Works with logistics:** blueprints, verification, resource surveys | **Builds capacity** with research's inputs |
| **Dusk** | Posts new orders and requests | Hands its output to logistics | Receives research's output |

**Open.** Whether each mini-game sits in the right phase. The user wants to test all the games running
together before settling this, and may replace the cycle if the test shows it isn't working (§11).

**Ideas from the commander research that still apply** (proposed):
- each phase can be handed to the autopilot on its own, and a player can drop in or out between phases;
- each morning opens with "what changed because of you";
- help from another team appears in your own screen (a marker, a revealed lineup, a stamped order), never
  as chat.

---

## 3 · Three systems that must never be mixed up

**Decided.** The user was explicit that these are separate systems, modelled on Currency Wars.

| System | Who sets it | When | What it does | Currency Wars equivalent |
|---|---|---|---|---|
| **Affixes** | The game | Shown at departure in the Brief | Make the voyage **harder**. Some have a minor upside, but overall they add challenge | The match's affixes |
| **Exploration environment** | Exploration picks one | At the start | A strategic opening perk that shapes the run | Investment Environment |
| **Research assistance** | Research prepares it; exploration picks | At checkpoints during the voyage | Helps the player. Tiers: **silver, gold, prismatic** | Investment Strategies |

Research assistance in detail (decided unless marked):
- **Cards arrive as prototypes with flaws that hurt the fight.** Research's job is to remove or replace
  those flaws before exploration chooses. Whatever flaws remain ship with the card. The user's reason:
  "that gives them a much clearer purpose."
- **Selecting a card has a cost**, and the cost rises if research has failed too often (decided in
  principle; the numbers are open).
- **Research mini-games therefore need to be failable,** with a real skill ceiling.
- Stronger benefits are more likely to carry a trade-off. Before the flaws idea, those trade-offs were
  economic only, such as earning fewer coins or losing stored coins. The flaws idea now adds trade-offs
  that hurt the fight, and they are the research team's to remove. Remaining economic costs are
  **open**.
- Tier odds follow research performance (proposed): on-time, complete work shifts the odds toward gold
  and prismatic. Prismatic may need a rare sample from exploration.

Exploration environment: whether its costs may touch the fight, how it is offered, and whether research
can influence it are all **open**.

---

## 4 · The voyage phase and research's targets

**Decided.** A **phase** is a run of nodes ending in a boss. When a phase opens, exploration sees everything
it offers: the elective fight and its reward, the pre-boss reward, the boss, and the checkpoint cards.
At dusk exploration tells the support teams what it wants, and they spend their effort accordingly.

| Target | Who works on it | Mini-game | What finishing it does |
|---|---|---|---|
| **Boss buffs** | Research, night | Aether attunement | Each clean sample strips one listed boss buff; "End on X" reveals the boss's weakness |
| **Elective fight** (easy fight for simple rewards, or a hard one for better rewards) | Research, night | Sensor placement | Lowers the hard fight's difficulty; a full scout strips one of its affixes |
| **Research assistance cards** | Research, night | DNA sequencing | Clears flaws from the prototype cards |
| **Pre-boss reward** | Logistics (moved from research) | Its gear and supply work | Better gear in the reward |

- Each target has a **completion percentage**, so its mini-game is played several times, and better
  results fill it faster (decided).
- Research makes fights easier **through knowledge, not stat cuts**: it reveals or removes a mechanic or
  an affix. The game's base difficulty stays (proposed, consistent with the affix rule).

### Rare research caches (decided)
The hard elective fight's **research cache** is the only source of certain rare rewards:
- **A free character token.** It is no longer available from the ordinary reward node, which gives an extra
  Writ instead, to slow team growth overall.
- Further candidates (proposed): prismatic assistance or an extra checkpoint pick, rare equipment set
  pieces, unique Census entries.

---

## 5 · How research makes the auto-battler better

Discussed and favoured; the details are **open**.
- **Battle AI improves with knowledge** (the user's idea). Make each level a visible behaviour rather than a
  hidden number. For example, studying an enemy teaches the crew to hit its weakness, then to hold burst
  for the break, then to focus its healer, shown as a tactics chip on the battle screen.
- **Split knowledge in two** (proposed):
  - **Enemy knowledge** belongs to the team and is never lost.
  - **Team familiarity** belongs to *pairs* of crewmates, so swapping one member resets only their links.
  - This rewards keeping a team without forbidding pivots.
- Other levers discussed: a dawn briefing, an overnight battle forecast run on the headless combat engine,
  and sample bounties. The modifier and card system in §3 has since become the main lever.
- **Samples as fuel** (proposed): each research attempt uses a sample. Samples come only from
  exploration's fights, carried by logistics' rockets, which ties all three teams together.

---

## 6 · The station games

Twelve team games plus one in reserve. All are in `prototypes/`, all are registered in
`prototypes/shared/minigames/minigame-kit.js` (`GAMES`, with `role` and `phase`), and all are listed on
`prototypes/minigames.html`. Each has a unit test and a headless browser test.

| Team | Phase | Game | File id | Produces | Status |
|---|---|---|---|---|---|
| Research | Night | Aether attunement: boss study | `aether-attunement` | Boss buffs removed, weakness found | Built |
| Research | Night | Sensor placement | `sensor-grid` | Elective fight scouted, difficulty lowered | Built |
| Research | Night | DNA sequencing | `dna-sequencing` | Assistance card flaws cleared | Built |
| Research | Day | Signal breach | `signal-decoding` | Blueprints for logistics | Built |
| Research | Day | Manifest checking | `intel-check` | Verified manifests; Null sabotage stopped | Built |
| Research | Day | Core assay | `core-assay` | Resource nodes for logistics | Built |
| Logistics | Night | Supply run | `supply-run` | Raw resources and crafted parts | Built |
| Logistics | Night | Gear assembly | `gear-pack` | Exploration's ordered gear kits | Built, but **the user finds it unfun**; see below |
| Logistics | Night | Rocket loading | `pallet-stacking` | Gear launched to the fronts, samples to the lab | Built |
| Logistics | Day | Route planning | `route-planning` | The road network | Built |
| Logistics | Day | Pipes | `pipes` | Base production layout | Built |
| Logistics | Day | Depot sorting | `depot-sorting` | Arrivals sorted for tonight's production | Built |
| Reserve | — | Synergy links | `synergy-links` | Not assigned (Flow Free) | Built, unassigned |

**Six games per support team, three per phase.** I recommended five; the user chose six (decided).

**Results don't feed anything yet.** Each game shows its output on the result card, and none of them
changes another game or the combat engine. Wiring them together is the joint-test work in §11. The kit
already broadcasts a `spacology:minigame-result` event when a game is embedded; another session added
that in preparation.

### What each game is now, and the decisions behind it
Each game went through several user playtests. The decisions are the user's; earlier versions they
rejected are listed so they are not rebuilt.

- **Aether attunement** (Flood-It).
  - Original look kept (per-cell tiles with element colour, glyph and stripe), with boards built from
    authored motifs and symmetry, about 5 moves.
  - One boss per round, with buff cards. Each sample targets one buff.
  - Objectives: **End on X** (X is the boss's weakness), plus Lead with Y at higher levels.
  - *Rejected:* random speckled boards ("colour sneezed onto the screen"); single-cell moves that felt
    accidental; blob territories with 5–10 move par; "Never twice" and "Spare Y" objectives (no effect, or
    impossible boards).
- **Sensor placement** (Catdoku / LinkedIn Queens).
  - One sensor per row, column and zone, never touching.
  - Assist levels: Puzzle, Guided and Relaxed, plus "Mark the obvious", probes, and domino-style
    auto-drops ("sometimes it is just fun to watch all the pieces fall into place").
  - Maps from 5×5 to 15×15, built **forced by construction**: answer first, basic pieces (strips, L, T, U,
    corner, square) placed in a solving order, then compact filler blocks.
  - The game's ×s look identical to the player's. Out-of-play cells go flat under a veil.
  - *Rejected:* Light Up / number clues; zones that weave through the map; a pale auto-×; brightness
    dimming that muddied the colours.
- **DNA sequencing** (shotgun-sequencing assembly).
  - Partial reads with missing data. Slide them into alignment by their overlaps.
  - A consensus row builds itself; then flag the stretch that doesn't match.
  - Three sequencing runs per sample.
  - *Rejected:* Phylo-style pairwise scoring with gap penalties ("I don't understand the answers").
- **Signal breach** (Cyberpunk 2077 Breach Protocol).
  - Every daemon can always be uploaded. Daemons overlap like `FF 55 1C | 55 1C E9 BD`, and the buffer only
    fits them if you chain the overlaps.
  - Daemons are blueprint fragments.
  - *Rejected:* Fallout word guessing (felt like chance); puzzles where not everything could be uploaded.
- **Manifest checking** (Papers, Please).
  - One-tap compare, a checklist, Check all, swipe and keyboard stamping, citations when you're wrong.
  - Checks include a field guide (species, element and glyph), seals, signatures, an X-ray, routes, codes,
    and cross-checks against a log.
  - Levels include Veteran and an endless night shift.
  - The user enjoys this one most, especially at the hardest levels.
- **Core assay** (spectrum decomposition).
  - Find which minerals, in what amounts, add up to a reading.
  - Every sample has exactly one answer, reachable by deduction. Three tests per sample.
- **Supply run** (walk-and-collect).
  - Free movement, ground zones, a tall carried stack, pay-to-unlock pads.
  - A crafting ladder from ore to Weaver relays, with recipes shown on every station.
  - Early automation: ore hauler, plate and cell runners.
  - *Open:* how to make repeat sessions as fun as the first (§9).
- **Gear assembly** (formerly gear packing).
  - Exploration's order card states the stats wanted. Parts show their stats up front.
  - Only two placement bonuses (power and focus).
  - *Rejected:* points scoring, star upgrades, slot keys, bag sections, unintuitive synergy markers.
  - **Still unfun, open:** the user said so and hasn't yet said why. Candidates: make the frame tight so
    fitting is the puzzle; replace it with another night game; or cut it.
- **Rocket loading** (formerly pallet stacking).
  - A voyage of legs. Goods arrive; you load rockets and launch them.
  - Rockets upgrade Hopper → Lifter → Heavy lifter. The fairing tapers toward the nose.
  - Each launch goes to the Front (gear) or the Lab (samples).
  - Other features: an End-leg guard, voyage settings and presets, and a single-launch practice mode.
  - *Rejected:* pure shape-tiling with no weights ("worse"); gaps caused by weight limits rather than
    space; separate vehicle purchases (replaced by an upgrade route).
- **Route planning** (roads: Mini Motorways / Cities: Skylines).
  - At night you build roads, bridges, one-ways, roundabouts and warehouses. By day you watch, with no
    edits, a heat overlay and a dusk report naming the top three problems.
  - The map grows each night.
  - *Rejected:* Mini Metro routes (confusing, unclear what produces and receives); two bridges per map;
    rerouting mid-day.
  - Routes may return later for trains.
- **Pipes** (rotate-to-connect).
  - Each extractor must reach its plant, with no leaks and no mixing of products. Bridges let lines cross.
  - Flow animates along connected pipe.
- **Depot sorting** (water-sort with crates).
  - Loading bays wanted by tonight's production, a one-crate holding bay, and a move budget at Expert.
  - Par is the proven minimum.

### Rules every station game follows (learned from playtests)
Treat these as requirements for any new game:
1. **One clear core rule set.** Extra variables that add nothing (keys, upgrade kits, weights that only
   create gaps) were rejected every time.
2. **Planned, earned decisions, never luck.** Generators prove a unique or deducible answer, and reject
   puzzles that greedy or random play solves too easily.
3. **Readable at a glance.** Show what something makes or needs, show consequences rather than answers,
   and avoid noisy random-looking layouts.
4. **Generous quality of life**, plus **assist levels** (Puzzle / Guided / Relaxed) for players who want
   the satisfaction without the strain. Relaxed is never Perfect.
5. **Juicy feedback.** Things pop, flow, snap and stamp.
6. **Failable, but fairly**, especially research games, which must have a skill ceiling.
7. **Every result says what it gives another team**, in one line.
8. **Touch first.** 44 px targets, playable on iPad at 1024×768. Browser tests run **headless**
   (`AGENTS.md`).

---

## 7 · Exploration

The auto-battler as it exists, plus:
- the team builder, with equipment (exploration equips what logistics assembles);
- orders and requests at dusk;
- phase previews (§4);
- choosing the exploration environment (§3).

Battle changes from research (§5) are **open**.

---

## 8 · Logistics' long arc: networking the globe

**Proposed** (the user's vision, favoured, not scheduled):
- Each run's globe is split into zones. Over time logistics networks the whole globe: roads within zones,
  then trains, boats, aircraft and space shipments between them.
- Each transport tier should add a new idea, not just bigger numbers:
  - roads: flow and congestion;
  - trains: stop order, where the routes puzzle returns;
  - boats: ports and bulk;
  - aircraft: point to point;
  - space: launch windows.
- Pallet stacking already became rocket loading. The container changes with the tier: truck bed, wagon,
  hold, cargo plane, fairing.
- Regions should differ by resources, terrain and one local rule (from the condition system), so repeated
  supply runs ask different questions (§9).

---

## 9 · Replay value and meta progression

From [`reports/Roguelite meta progression and endgame.md`](../../reports/Roguelite%20meta%20progression%20and%20endgame.md)
and the user's stated preferences (proposed):
- **No power grind.** Persistent progress unlocks options, knowledge and mastery marks, never stronger
  stats. The user likes grinding when small tasks pay steadily, but not grinding for power.
- **The Long Census is the meta.** It is a catalogue of species, weaknesses and recipes that research fills
  over many runs.
- **A short, skill-only ladder** built from charters and affix weight, where each step adds a condition
  rather than a multiplier.
- **Supply run replay ideas** for repeat sessions:
  - regions with different resources and a local rule;
  - limited build plots, where you choose what to build;
  - a pick-one-of-three upgrade draft;
  - older regions that keep producing slowly;
  - blueprints, so mastered chains can be placed in one action.

---

## 10 · What is still open

1. **Gear assembly:** why it is unfun, and whether to tighten it, replace it or cut it.
2. **Day/night assignment** of each game, or whether a different cycle works better. This will be decided
   by the joint test.
3. **Research's effect on battles:** AI levels and familiarity, and the size of each effect.
4. **Research assistance numbers:** card tiers, flaws per tier, selection cost and how failures raise it.
5. **The exploration environment's** costs and offer.
6. **How much lab work a night holds:** a fixed number of analysis slots, the samples available, or both.
7. **Persistence across runs** per mode, and what the Census keeps.
8. **What logistics does solo** when exploration is on autopilot, and how its orders are generated.
9. **Reconciling the older documents** (§12).

---

## 11 · Next steps, in the user's order

1. **Build every mini-game.** Done; all tests pass.
2. **Refine the games.** Done for every game except gear assembly, which is waiting on the user.
3. **Run everything in parallel** to see how the games work together, find problems, and decide what
   belongs in day versus night, or whether to rethink the cycle.
   - Another Claude session has started this: `minigame-kit.js` now has an embedded "station" mode that
     posts `spacology:minigame-result` (with a `delivery` payload) to a parent page.
   - Coordinate with that session before editing the kit or the games' result hand-offs.

**Operational notes for agents:**
- Long test runs on this Mac must stay awake. A full run was killed by the machine sleeping, not by a bug:
  use `caffeinate -i npm test`.
- Nothing here is committed yet. Commit before large rewrites; a rewrite once overwrote approved versions,
  which had to be rebuilt from agent transcripts.

---

## 12 · Documents this supersedes or contradicts

- **`design-record.md`:** names the roles commander and lieutenant, and describes difficulty and modifiers
  in a way that mixes affixes and modifiers. Superseded on the team structure (§1) and the three systems
  (§3).
- **`modifiers.md`** and **`run-variety-proposal.md`:** the modifier stops at nodes 3, 10 and 17 offer
  trades such as "+20% gold, enemies +25% health". By §3 anything that makes the fight harder is an
  **affix**, and the checkpoints become research assistance.
- **`session-progression-proposal.md`:** its Charters are close to the **exploration environment**. Some
  charters' fight costs (for example "Healing halved") may need to move to economic costs once §3's open
  question is settled.
- **`prototypes/README.md`:** must list the twelve games and their teams (updated alongside this note).
