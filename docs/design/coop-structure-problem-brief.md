# Design brief: how should three co-op teams share one game?

**Written 14 October 2026 to ask for an outside opinion** (for example from ChatGPT or another designer). It
is self-contained: you don't need the rest of the repository. Nothing here is decided unless it says so.

---

## 1 · What we're asking

We have a relaxed single-player auto-battler that works, and two support roles (Research and Logistics)
with a set of mini-games that work. We're stuck on **how the three roles should interact over a game day
so that co-op is fun, solo stays as good as it is today, and nothing becomes stressful.**

Please:
1. Point out the real tension in the problem, if we've framed it wrong.
2. Compare the candidate structures in §8 (or suggest a better one), against the constraints in §6.
3. Suggest what the **levers** between teams should be: what each team does that the others feel.
4. Name games that solved a similar problem, and what they did.
5. Recommend one structure and a cheap way to playtest it.

---

## 2 · The game in brief

**Spacology** (working title *Voyage*) is a premium iPad game. No gacha, no monetisation, played in short
sessions. Its origin is "Currency Wars without its frustrations": a roguelite auto-battler where you
assemble a crew, choose where to take them, and watch the fight resolve.

- A **voyage** is a run of legs across one generated planet. Legs are grouped into **phases**, each ending
  in a boss. A phase offers an optional, harder **elective fight** with better rewards.
- Between fights the player is in the **ops room**: team building, equipment, route choice. The design
  record says: "The ops room is the game; the fight is the answer coming back."
- The game is about **reading a situation and answering it**, not optimising an engine. Its four stated
  sources of fun:
  1. kits sharp enough to interact in ways nobody planned;
  2. conditions that forbid rather than tax ("ailments do nothing here");
  3. the build visibly coming online;
  4. losing in a way you can read.
- Three separate systems shape a voyage: **affixes** (the game makes it harder), the **exploration
  environment** (an opening perk the player picks) and **research assistance cards** (silver, gold and
  prismatic helpers, offered at checkpoints).

## 3 · Audience and feel (the owner's words, paraphrased)

- For **working adults, parents and older players** who can't always sit down for long sessions, or who
  want something laid back.
- **"More Stardew Valley than Call of Duty."** Nothing should feel stressful. **The fun is the reward of
  working together well.**
- Co-op means **playing at the same time as friends, but loosely.** One person can step away while the
  others keep going, and the group moves on to the next day when they're back.
- The owner's own favourite role is logistics. They like steady small-task rewards, but not grinding for
  power.

## 4 · Single player as it exists, and why it works

The current prototype is solo exploration:
- **Planning:** you make a lot of choices (team, synergies, equipment, route, responses to affixes).
- **Battle:** fully automatic. You sit back, enjoy the animations and see how well your build did.
- **The battle is deliberately a break.** You think hard, then relax and watch the payoff. The thinking is
  not very intense yet, which makes the game feel quite casual.

This rhythm is the thing we most want to protect.

## 5 · The co-op design so far

The game became **three modes on one shared planet**. A player picks one. In co-op each player plays their
own mode, and the modes feed each other. **Autopilots** always fill unplayed roles, and a human always beats
the autopilot.

| Team | What it is | What it produces |
|---|---|---|
| **Exploration** (the lead team) | The auto-battler: team building, equipment, route, the fights | Decisions and requests; samples and scrap from fights |
| **Research** | The ship's lab | Easier battles for exploration (knowledge, not stat cuts); blueprints and verified paperwork for logistics |
| **Logistics** | Production, packing, launches, the transport network | Gear, supplies and samples delivered where they're needed |

How the teams feed each other:
- Exploration's fights recover **samples** (for research) and **resources and scrap** (for logistics).
- Logistics **launches samples to the lab** and **delivers ordered gear to the front**.
- Research **strips boss buffs, scouts the elective fight and removes flaws from assistance cards** before
  exploration picks one. It also gives logistics blueprints and resource surveys.

**The current clock** (decided earlier, now in question):
- One shared day/night cycle, **Civ-style**. Whoever finishes a phase first waits; the next starts when
  everyone is ready.
- **Nothing is live.** Information only changes hands at dawn and dusk.
- **Inverse schedules:** at night research works for exploration and logistics fills exploration's orders;
  by day research works with logistics; exploration plans at night and fights by day.

**The support teams' mini-games** (all built as playable prototypes, three per phase per team):

| Team | Games |
|---|---|
| Research | Aether attunement (Flood-It style boss study), Sensor placement (Catdoku/Queens), DNA sequencing (align partial reads), Signal breach (Cyberpunk's Breach Protocol), Manifest checking (Papers, Please), Core assay (spectrum decomposition) |
| Logistics | Supply run (walk-and-collect with a crafting ladder and automation), Gear assembly, Rocket loading (gravity crate stacking with balance and upgrades), Route planning (Mini Motorways style roads), Pipes, Depot sorting (water-sort with crates) |

Rocket loading and supply run are the owner's favourites in logistics; manifest checking in research.
**Gear assembly is not fun:** it presents a packing puzzle, but the real task is picking parts whose stats
add up to targets, with no flow and no growth.

## 6 · The problem

**Research and logistics were designed to work together from the start. Exploration was designed on its
own.** Connecting it to the new direction without losing what's fun about it is the hard part.

The tensions:
1. **What makes the auto-battler fun alone is the opposite of what makes co-op fun.** Solo, the fun is
   quiet, deep planning and then a relaxing watch. Co-op fun is being busy together in a shared space and
   seeing your friends' work matter.
2. **Giving exploration levers during battle** would make it more interactive, but it would also break the
   "battle is a break" rhythm and change the single-player game. And it's unclear what those levers would
   even be, since the battle is intentionally hands-off.
3. **If support players simply watch exploration's battle,** they're idle. **If each team watches its own
   automated process** during the day, the three players drift apart at the moment they could come
   together.
4. **Live interaction** (support teams affecting the battle as it plays) is the most exciting option. But it
   needs everyone online together, and real-time networking, and it risks stress. That clashes with the
   audience and with "step away whenever".
5. **Solo must stay whole.** Solo exploration must play as well as today. A solo support player needs an
   autopilot exploration lead that feels like a partner.
6. **The day structure is unsettled.** Two phases (day/night) or three (morning/evening/night)? Which
   activities belong where? Exploration currently has no mini-games of its own.

**Constraints that any answer must meet:**
- Relaxed. No punishing timers, no fail-by-absence, no live coordination required.
- Any player can step away. Their autopilot covers their seat, and the day advances when everyone present
  is ready.
- Solo exploration is never worse than the current game.
- The battle stays a calm payoff for the exploration player.
- Touch-first, iPad, short sessions.
- No power grind. Persistent progress unlocks options, knowledge and mastery, never bigger numbers.
- Mini-games follow the playtest rules: one clear core rule, earned decisions (not luck), readable at a
  glance, generous assists, juicy feedback.

## 7 · A related idea: the ship as a shared space

While fixing gear assembly, a new idea came up:
- Turn gear assembly into a **top-down workshop** (PlateUp / Overcooked / The Sims / Diablo-style
  tap-to-move with action menus, so it plays differently from supply run). You walk between bins, machines
  and an assembly bench to build ordered kits, then upgrade the workshop over time. It must be Stardew-paced,
  not Overcooked-paced.
- The owner saw this working for research too, and possibly as a **meta game that hosts the mini-games**.
  Each team has a room on the ship (workshop, lab, ops room). Each mini-game is a station you walk to.
  Results become objects you carry (a crate to the rocket pad, a data card to the briefing table).
  Autopilots are visible as NPC crewmates working stations. Co-op happens in the same room.
- Exploration's station would be the ops room: sitting at it opens today's team builder unchanged, and
  other teams' work arrives there as objects.

## 8 · Candidate structures discussed so far

**A. The current one: async day/night with hand-offs at dawn and dusk.**
Each team plays its own games; results swap at the turn of the phase.
- *For:* simple networking, fully relaxed, nobody needs to be online together.
- *Against:* it doesn't feel like playing together. Exploration's link to the others is a list of results.

**B. The ship at night, each team's auto-play by day.**
Night is the ship meta game: everyone runs around preparing. By day each team has its own automated
"auto-play" process to watch, maybe with light input (exploration's battle, logistics' network running,
the lab running).
- *For:* great co-op energy at night; everyone gets a calm watching phase.
- *Against:* by day the teams drift apart; exploration's planning would become a room activity unless it
  stays at its console.

**C. Support teams play side games during the battle.**
Exploration builds the team and the plan, then relaxes and watches. During the battle, research studies
the enemy in short puzzles, and each completed study gives exploration a bonus ("next hit strips all
shields"). Logistics keeps stations powered and the fight supplied (resources that refill automatically in
solo), using a real-time version of route planning.
- *For:* everyone has a busy phase and a calm phase at different times; exploration's watch becomes livelier
  because things happen in the fight thanks to friends; the battle stays a break for exploration.
- *Against:* needs everyone online at the same time and real-time networking (light, since only small
  events are sent to a deterministic battle); risks stress for support players. The owner doesn't think
  this is the best solution, just one idea.

**D. Morning, evening, night.**
- Morning: active prep. Exploration gets its own prep mini-games (scouting, training, recruiting); research
  earns tokens; logistics builds.
- Evening: the battle, the shared show.
- Night: a cosy wind-down: payouts, upgrades, team building and orders for tomorrow.
- Levers without real-time play: support players **arm** their effects in advance with triggers ("strip
  shields on the boss's first shield", "resupply when power drops below half"), like setting up sprinklers
  in Stardew. If friends happen to watch together, an armed effect could be fired early by hand, as an
  optional bonus.
- *For:* fits the audience; nobody fails by being away; exploration gains mini-games.
- *Against:* three phases may be thin or overlap (morning and night are both "prep").

**E. Day/night with the ideas from D.** The owner's current leaning: "day/night does feel like a cleaner
design." Roughly:
- Day = the work: everyone prepares; support players earn and arm their effects.
- Night = the battle and the wind-down.
- (Or the reverse. Which half holds the battle is open.)

## 9 · Specific questions

1. Is there a structure where exploration stays a calm, deep, mostly solo planning game, and co-op still
   feels like playing *together*?
2. What makes a good lever between teams in a relaxed game? Is "earn it, choose when or where to spend it,
   see it land" the right model? What should exploration be able to do for the support teams, not just
   receive from them?
3. Armed triggers or light live input during the battle: which keeps the fun of working together with
   the least stress?
4. Two phases or three? What belongs in each, for each team?
5. Should exploration get mini-games of its own? If so, what kind fits a team-building auto-battler?
6. Is the ship-as-shared-space meta game worth its cost, or is a simpler hub enough?
7. How should solo work for each of the three roles?
8. Which games handle loose, drop-in co-op with distinct roles well (Stardew Valley, PlateUp, Don't
   Starve Together, Deep Rock Galactic, Sea of Thieves, Animal Crossing, others), and what can we borrow?

## 10 · What a useful answer looks like

- A short diagnosis of the core tension.
- A recommended structure, laid out as a table of phases × teams.
- The lever list per team, with how each shows up in the other teams' screens.
- How solo plays for each role.
- The biggest risk of the recommendation, and the cheapest playtest that would reveal it.
