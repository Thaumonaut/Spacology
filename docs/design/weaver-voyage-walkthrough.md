# A voyage with the Weavers — walkthrough

**Clean-sheet exploration, 6 October 2026. Nothing implemented.** One team, one full voyage, traced
node by node, to see how building the team feels, how pick order changes it, and how equipment shapes
the power curve. Numbers are illustrative and internally consistent so the trace can be checked.
Fight outcomes are **design intent, not measurements** — the lab tests whether they hold.

**Correction to the first draft.** An earlier version of this document read the Weavers as a
break-and-cascade team. That was a misreading. Every team runs on the shared Aether pool; the Weavers
are the team family that makes collecting and spending it the main engine.

---

## Aether is every team's budget; Weavers make it the engine

Every team spends from the same pool, so every character has an **Aether profile**: how they
spend over time. The profile is separate from the character's combat role.

| Profile | Rhythm | Pool effect |
|---|---|---|
| **Generator** | Mostly basics; skills only when they add charges | Positive |
| **Cadence** | Skill when a timer, buff or stack runs out, basics in between | Roughly neutral, with a beat |
| **Consumer** | Skill whenever affordable, unless someone with priority needs the charges | Negative |
| **Weaver** | Either spends several charges a turn and needs a large supply to hit hard, or generates or stores far more than usual | Strongly positive or strongly negative; the economy is the job |

The references are the ones from the design conversation: a **generator / expander** in the shape of
Sparkle, a **multi-point consumer** in the shape of Archer, and, for contrast, a **debuff-fed carry**
in the shape of Acheron. That third kind of team still needs Aether to skill and build its ultimate,
but for it the pool is a budget to manage, not the thing being built.

**What this means for every team.** A team must fund its consumers, so pick order has Aether
pressure everywhere:

- A second consumer before a generator starves the team.
- A generator with nothing to spend on wastes charges.

Weaver teams don't avoid that pressure; they lean into it. Their bottleneck *is* the engine.

**On the card, and in Ops.** A character's profile is a second label on their card, beside their
combat role. Ops shows the team's projected budget in words — *"generates more than it spends"* or
*"two heavy spenders; one will wait"*. Per the [Aether proposal](aether-pool-proposal.md), it avoids a
numeric score until that can account for speed and reservations. Vouchers buy anyone; the role and
profile labels are information for the decision, not restrictions on it.

### The seven Weavers by profile

| Weaver | Combat role | Profile |
|---|---|---|
| Hanae | Support | **Weaver — generator** |
| Roonie | Support | **Battery** — Bypass buffs the spender (attack from his health) and refunds spends half the time |
| Ivara | Sub-DPS | **Weaver — expander** (+2 capacity); a conservative consumer otherwise |
| Arunima | DPS | **Weaver — multi-point consumer** (the full burst) |
| Silen | DPS | **Weaver — multi-point consumer** (rising-cost extra turns) |
| Veska | Sustain | **Cadence** — builds Refrains on basics; releasing them turns each into an Encore (+1 on a crew basic) |
| Daven | Sustain | **Cadence** — brace and hold until his next turn, refunds a charge on an absorbed hit |

Veska and Daven are sustain characters whose rhythm happens to pay back into the pool. That makes
them the bridge between a Weaver team and an ordinary one.

**Rules since 7 October 2026.** A skill costs 1 Aether unless its owner is a Weaver. No skill makes
Aether directly: skills open windows in which basics make more (Hanae's Resonance, Veska's Encores),
or bend spending (Roonie's Bypass). Ultimates may still refill the pool. Each crewmate's kit also
grows with one scaling stat (attack, health or defense). See the
[lab notes](../testing/weaver-voyage-lab.md) for the numbers.

## The Weaver team is a triangle

| Verb | Weaver | What they do to the pool |
|---|---|---|
| **Build** | **Hanae** — Gatherer | Basics generate 2; her skill nets +4 |
| **Hold** | **Ivara** — Reservoir | +2 capacity while alive; spends 2 at a time as focused sub-DPS |
| **Spend** | **Arunima** — Conduit | Full burst: every charge spent adds 100% attack to an area hit — 800% at 8, 1400% at 14 |
| Build | Roonie — Tuner | Skill nets +2; discounts the spender's next skill by 1 |
| Spend | Silen — Cascade | Extra turns at rising cost (2, 3, 4…), each 25 points stronger; kills carry to the next target |
| Keep | Veska — Cantor | Heals; her Refrains return up to 3 charges |
| Keep | Daven — Anchor | Barrier tank; an absorbed hit returns 1 charge |

The shared lore line describes this exact loop: *Hanae heard the wasted resonance; Ivara had somewhere
to hold it; Arunima knew how to open a route for it.*

**What this exploration keeps:** the shared pool, the three roles, every kit as written in
[aether-weavers.md](aether-weavers.md), and the rule that capacity is 6 plus 1 for each living
Weaver. **What it adds around them:** vouchers that buy anyone, equipment sets keyed to the pool's
three verbs, and a rule for what surplus Aether does. Kit changes are left for the lab to justify
(§9).

### The two things the pool already measures

The engine has two dials, and each recruit turns one of them:

- **How big** — the burst ceiling, set by capacity.
- **How often** — the fill rate, set by builders.

A builder makes bursts come sooner. A reservoir makes them larger. The spender decides what they hit.
Adding a character changes the rhythm of the fight: frequent medium bursts, or one huge one per wave.

### Team size is already a power limiter

Capacity is **6 + 1 per living Weaver**. So the berth schedule *is* the burst-ceiling schedule. With
3 / 4 / 5 berths across the three sectors, the ceiling is 9 / 10 / 11 before Ivara. The two limits
you asked for, how fast the team grows and how fast it gets strong, are one mechanism here, and it
already exists.

---

## 1 · The rules the trace needs

- **Crew.** Two free at departure. After that, a **voucher buys any crewmate you choose.** It costs
  **2 / 3 / 4 / 5 Writs** for the 3rd / 4th / 5th / 6th crewmate. Price rises with team size only.
  Combat roles — **Support** (Hanae, Roonie), **Sub-DPS** (Ivara), **DPS** (Arunima, Silen),
  **Sustain** (Veska, Daven), from [team roles and acquisition](team-roles-and-acquisition-plan.md)
  — are labels on the card, not price categories. *Restricting vouchers is deferred until play
  shows it's needed; §9 says what to watch for.*
- **Berths.** 3 in sector 1, 4 in sector 2, 5 in sector 3. A sixth can be bought once, at a reward
  node, for 3 Writs.
- **Equipment.** Three slots: **Core, Chassis, Shield.** Each piece gives a small stat. Three pieces
  of one set turn on its rule. Every battle drops one random piece. A crate is 8 Salvage for a random
  piece; crafting a chosen piece is 20; scrapping a piece returns 4.
- **Currencies.** **Salvage** (~8 per battle) buys equipment. **Writs** (1 per elite, 2 per boss)
  buy vouchers. **10 Salvage → 1 Writ, never back.**
- **Reward nodes** (6, 13, 20) offer one of: a free voucher, a free crafted piece, or a **second
  rig** (three more slots for one crewmate).

### Four sets, one per profile

| Set | Core | Chassis | Shield | Full set |
|---|---|---|---|---|
| **Wellspring** (build) | +speed | +health | +attack | Charges you generate while the pool is full become **10 barrier each** on the most hurt ally |
| **Deep Hold** (hold) | +health | +barrier | +attack | **+2 capacity**, and while the pool is full your basics hit 50% harder |
| **Overdraw** (spend) | +attack | +crit | +speed | Your skill can spend **up to 3 charges the pool doesn't have**; the debt is repaid from the next charges generated |
| **Metronome** (cadence) | +speed | +health | +effect duration | Your skill's effect lasts one turn longer, and a recast on the exact turn it expires is 50% stronger |

Every team touches the pool, so these sets fit any team. They suit a character *type* without being
tied to one team. Each changes how the pool flows:

- **Wellspring** makes surplus useful instead of wasted.
- **Deep Hold** makes bursts bigger.
- **Overdraw** makes them come sooner, followed by a drought while the debt is repaid.
- **Metronome** rewards keeping the beat instead of breaking it, so it stays a cadence set.

The trace below mostly uses the first three. Metronome matters for Veska and Daven, and for the
other team families.

### The same sets on a team that isn't Weavers

Take a debuff-fed carry team. The carry skills every turn to apply pressure and build its ultimate
(a consumer). Two debuffers recast on a timer (cadence). One sustain mostly basics (a generator).
Its Aether question is **"can the carry skill every turn?"** Its order pressure is the same as
the Weavers': **fund the generator before the second consumer, or the carry starves.**

The same sets do different jobs here:

- **Wellspring** on the sustain turns surplus into barrier.
- **Metronome** on the debuffers keeps pressure up with fewer recasts, which frees charges for the
  carry.
- **Overdraw** lets the carry skill through a dry turn.

That is the "strengthens character types, not one team" requirement. Whether it holds is a lab
question (§7).

---

## 2 · The Brief

| | Condition | Boss |
|---|---|---|
| **Sector 1** | **Short fuses.** Round limit one shorter; encounters start with 5 Aether instead of 3 | **The Brood** — summons small specimens every turn |
| **Sector 2** | **Deep reservoir.** +2 capacity; encounters start with 1 less Aether | **The Carapace** — one target, enormous shields, a long fight |
| **Sector 3** | **Everyone hits 40% harder** | **The Sprinter** — acts twice a round, hits hard |

**Reading it:** sector 1 rewards *frequent* bursts, because fights are short and the pool starts
half-full. Sector 2 rewards *big* ones, with more room and a long boss fight to fill it. Sector 3
punishes anyone who can't protect themselves.

---

## 3 · The order question: which bottleneck do you live with first?

There are three starting pairs, and each one is missing exactly one corner of the triangle. Your
third pick is less a new recruit than relief from that missing corner.

### Branch A — Builder + Spender (Hanae, Arunima)

**Missing: how big.** Capacity 8.

**Nodes 2–5.** *What you watch:* Hanae's skill dumps four charges in, and Arunima fires almost every
other round: 500–700% across the whole board. **Short fuses suits this exactly** — the pool starts at
5, so the first burst comes in round one. Early drops land on the two crew aboard: **Overdraw on
Arunima** (complete by node 5) and Wellspring pieces on Hanae. With Overdraw, Arunima fires even
sooner and accepts a short drought afterward.

**Node 6 — reward.** Free voucher, Sub-DPS: **Ivara.** Capacity 11. Bursts are larger and slightly
rarer.

**Node 7 — the Brood.** A swarm that refills every turn needs frequent area hits, and that's what A
does. **Perfect recovery.** 3 Writs.

**Node 8.** Berth 4. **Roonie**: 4th crewmate, 3 Writs. Capacity 12, his discount makes each burst one charge cheaper, and his refill
shortens the drought.

**Nodes 9–14 — sector 2.** Deep reservoir raises capacity to 14 and starts fights one lower. A copes:
two builders fill the extra room. At the Carapace, Overdraw lets Arunima fire a near-full burst a
round early. **Slight shortfall** — the boss outlasts A's tempo, and A never built for size.

**Node 15 — the second-spender decision.** Berth 5. Two candidates:

- **Silen** — a second DPS: 4 Writs. Auto reserves for Arunima first, so Silen chains in
  the window after her burst: one area peak, then a single-target run that carries kill to kill. **Two
  peaks per pool cycle, each smaller.** He also competes for the same charges.
- **Veska** — Sustain: 4 Writs. Her Refrains return three charges, so Arunima fires more often, and
  she heals through sector 3's +40%. **One peak per cycle, arriving more often, with the crew still
  standing.**

The Brief settles it. The Sprinter is a single target that hits twice a round. Silen can kill it
faster, while Veska keeps everyone alive through its hits. A, built for tempo, takes **Veska**.

**Final:** Hanae (Wellspring), Arunima (Overdraw), Ivara, Roonie, Veska. Capacity 13.

### Branch B — Reservoir + Spender (Ivara, Arunima)

**Missing: how often.** Capacity 10, but only basics fill it.

**Nodes 2–5.** *What you watch:* Ivara lances for 300% while Arunima waits. Under Auto she waits one
turn at most, then fires a 500% burst. Under **Save for this skill** she holds for a full pool. Either
way, Short fuses hurts: rounds run out before the pool fills. Drops land on these two: **Deep Hold on
Ivara** and **Overdraw on Arunima**. **Small loss at node 4. B is the wrong order for this sector.**

**Node 6.** Free voucher, Support: **Hanae.** The relief: bursts start arriving every other round,
into a pool that holds 13 thanks to Deep Hold.

**Node 7 — the Brood.** Recovering, but a swarm punishes rare bursts. **Small loss.**

**Nodes 8–14.** Roonie at 8. Then sector 2 — **B's sector.** Deep reservoir plus Deep Hold plus Ivara
puts capacity at 16 (6 + 4 crew + 2 Ivara + 2 Deep Hold + 2 Deep reservoir). At the Carapace, Overdraw lets Arunima spend 3 charges she doesn't have on top
of a full pool. **A 1900% hit on one target, the biggest single moment of any branch.** Perfect
recovery.

**Node 15.** B still has nothing that keeps the team alive, and sector 3 hits 40% harder. **Veska.**

**Final:** Ivara (Deep Hold), Arunima (Overdraw), Hanae, Roonie, Veska. Capacity 15.

### Branch C — Builder + Reservoir (Hanae, Ivara) — no spender

**Missing: anything to spend on.** The pool fills fast and sits full.

**Nodes 2–5.** *What you watch:* Hanae fills the pool in two rounds. Ivara lances for 2 at a time,
and the rest of her generation is wasted at the cap. This is the tedium case, and it depends entirely
on what surplus does. With **Wellspring** complete on Hanae, every wasted charge becomes 10 barrier,
and the team is hard to hurt even though it isn't fast.

**This is also where bad luck lives.** If Wellspring doesn't drop by node 4, C wastes half its
generation and gets nothing back. Two ways out:

- **The repair valve:** by node 5 C has 24 Salvage, enough to craft the missing Shield piece (20)
  instead of buying crates. That completes Wellspring for the elite.
- **Live with it:** skip the craft, keep the Salvage, and convert it into a Writ toward node 8.

**Node 6.** Free voucher, DPS: **Arunima.** She arrives to a pool that fills to capacity in two
rounds. **Her first burst is the largest opening move of any branch.** Of the three pairs, C waits
longest for its payoff and gets the most from it.

**Node 7 — the Brood.** Full bursts, but only one per two rounds against a swarm that refills. Slight
shortfall.

**Nodes 8–21.** By sector 2, C has **Wellspring on Hanae and Deep Hold on Ivara**, plus a spender
with no equipment. It plays like B with a defensive layer and a weaker spender. At node 15 it has the
most protection of any branch, so it can afford the second spender: **Silen**, for 4 Writs, to answer
the Sprinter.

**Final:** Hanae (Wellspring), Ivara (Deep Hold), Arunima, Roonie, Silen. Capacity 15.

---

## 4 · What the trace shows

### The same crew finish as different teams, because equipment lands on whoever is aboard

By node 6 all three branches own **Hanae, Ivara and Arunima**. Ceilings differ only through
equipment. Branches differ in which sets they completed, and those are the sets for the two verbs
they started with:

| At node 10 | Sets complete | Character of the team |
|---|---|---|
| **A** (Build + Spend) | Wellspring, Overdraw | **Fast cycle:** frequent area bursts, spend-ahead |
| **B** (Hold + Spend) | Deep Hold, Overdraw | **Huge, rare bursts:** the 1900% moment |
| **C** (Build + Hold) | Wellspring, Deep Hold | **Big and safe:** full bursts behind a wall of overflow barrier |

**The pair you start with decides which two dials get equipped.** The corner you pick third arrives
without equipment, at the point where the voyage has already shaped the team around the other two.

### The power curve, as a number you can read

**Typical burst** = what Arunima actually fires in an ordinary fight. **Ceiling** = capacity.

| Node | A typical / ceiling | B typical / ceiling | C typical / ceiling |
|---|---|---|---|
| 2–5 | **600% every other round** / 8 | 500% once a wave / 10 → 12 with Deep Hold | **none** — Ivara lances / 10 |
| 7 (Brood) | frequent, medium — **wins** | rare — loses | full but slow |
| 10–14 | 900% often / 14 | **1400–1900% rarely / 16** | 1300% / 16 |
| 14 (Carapace) | short of the kill | **wins** | close |
| 21 (Sprinter) | Veska holds | Veska holds | Silen kills it |

### Order works through three mechanisms

1. **Each starting pair lives with one bottleneck.** A waits on size, B on frequency, and C has
   nothing to fire with. The third pick removes that bottleneck.
2. **Equipment lands on whoever is aboard,** so the starting pair decides which two sets get
   completed.
3. **The Brief decides which bottleneck is affordable.** Short fuses in sector 1 favors A; Deep
   reservoir in sector 2 favors B and C. **Swap the sector conditions and the best starting pair
   changes.**

### Equipment shapes the curve, and so does team size

- **Team size sets the ceiling;** each Weaver adds one charge of capacity.
- **Sets bend flow:** surplus becomes defense, the ceiling rises, or bursts come early with a drought.
  Individual pieces nudge stats; a completed set changes how the fight plays.
- **Drop rates set when a set completes; the player chooses which set and on whom,** and whether to
  pay 2.5× a crate to craft the missing piece.
- **The exchange is the exit.** Salvage → Writs lets bad equipment luck bring the next crewmate
  sooner.

---

## 5 · The second spender is the clearest rhythm change in the engine

Every other recruit makes the existing rhythm faster, bigger or safer. Silen creates a *second
rhythm*. Auto reserves for Arunima first, so the cycle becomes: fill → area burst → Silen's chain
in the spending window → fill again. A team with one spender has one peak per cycle; a team with two
has two smaller ones, and each spender takes charges the other could have used. That tradeoff is the
best decision in the voyage. It competes with Veska for the same berth and the same Writs.

---

## 6 · Two settled questions from the voucher-and-set proposal

**Three slots, not six.** Two full sets on each of five or six crew is 30–36 pieces. One set each,
plus a second rig for one or two crew late, keeps the same arc at half the management.

**The exchange direction is right.** Salvage → Writs gives bad equipment luck an exit into crew.
Because equipment money can always buy crew, the **voucher price curve** has to be what keeps the team
small. Check: a player who buys no equipment converts about 11 Writs from Salvage, plus 7 from elites
and bosses before node 20. That's just over the 17 that six crew and a sixth berth cost. "Wide and
unequipped" is viable, and it must also be weaker. With capacity tied to crew count, it will have the
highest ceiling and no sets, which is exactly the comparison the lab should run.

---

## 7 · What the lab needs

**Built:** [`prototypes/weaver-voyage-lab.html`](../../prototypes/weaver-voyage-lab.html). First measurements, and the lab values that differ from this document's illustrative numbers, are in [the lab notes](../testing/weaver-voyage-lab.md). In that model, sector 1 behaves as predicted (build + spend leads under Short fuses). Later sectors don't separate the branches yet, because the scripted players converge on the same four crew by node 8. Wide-and-unequipped keeps pace with the equipped branches. **Berths were later removed** (no team-size cap); with that, wide-and-unequipped became the strongest line — see the lab notes.


1. The seven kits as written in [aether-weavers.md](aether-weavers.md), with capacity
   `6 + 1 per living Weaver + 2 for Ivara`.
2. **Four sets** — Wellspring, Deep Hold, Overdraw, Metronome — three pieces each, with set rules from §1.
   Every character card carries a combat role *and* an Aether profile.
3. **Three slots** per crewmate, plus a **second rig** at reward nodes.
4. **Vouchers** buy anyone, priced 2 / 3 / 4 / 5 Writs by team size. Starters free. Log every
   purchase so a later role limit can be evaluated against real choices.
5. **Berths** 3 / 4 / 5, plus one buyable sixth for 3 Writs.
6. **Economy:** Salvage ~8 per battle, scrap 4, crate 8, craft 20, Writs 1 per elite and 2 per boss,
   10 Salvage → 1 Writ one way.
7. **Drops:** one random piece per battle, uniform across nine pieces.
8. **This Brief as a fixed seed, plus a mirror** with the sector 1 and 2 conditions swapped.

### What to measure

| Question | Test | Passes if |
|---|---|---|
| **Is order a decision or a trap?** | A, B, C on the fixed Brief | Each pair wins at least one sector; no pair wins all three |
| **Does the Brief pick the pair?** | Same, on the mirror Brief | The sector winners change |
| **Is C tedious?** | C with and without Wellspring by node 4 | With it, C survives sector 1 comfortably; without it, the craft valve brings it back within a node |
| **Does the second spender change the rhythm?** | Arunima-only vs. Arunima + Silen, same capacity | Peaks per pool cycle go from one to two; total damage roughly comparable. If it is strictly higher, Silen is a must-pick |
| **Is wide-and-unequipped weaker?** | Buy no equipment, convert everything | Completes, scores below A/B/C |
| **Waste** | Share of generated charges lost at the cap, per branch | High in C without Wellspring, low elsewhere |
| **Are the sets generic?** | The same sets on a non-Weaver debuff-carry team at equal investment | Each set improves at least one character type there. If they only pay off on Weavers, they're Weaver-only |

---

## 8 · Charters, briefly

| Charter | Effect on this voyage |
|---|---|
| **Skeleton Crew** — max 4 crew; everyone starts one set piece | Ceiling capped at 10 before Ivara, so a team built for big bursts is forced toward frequent ones |
| **Quartermaster** — crates half price; vouchers +1 | Sets complete earlier and the third corner arrives later, so the starting pair matters even more |

---

## 9 · Open questions

1. **Is Ivara good enough at his job alone?** In B and C he spends a lot of the early voyage
   holding capacity that nothing fills. A small rule could fix that, such as his lance growing with
   the charges above half. Let the lab show whether it's needed.
2. **Should generation at the cap be wasted by default?** Wellspring makes it useful, but C without
   Wellspring may be too punishing. A global rule, like surplus becoming ultimate charge, would soften
   it at the cost of making the set less special.
3. **Daven's refund is one charge between turns.** That's honest, but small next to Veska's three.
   If cadence sustains are meant to pay for themselves in Aether as well as protection, he may need more.
4. **Are free starters too strong?** The most important pick of the voyage is the one with no price.
5. **Does extra capacity leak to every team?** Base capacity is 6 + 1 per crewmate for everyone. If
   Deep Hold is the main way a non-Weaver team gets more room, the Weaver economy leaks into every
   team through equipment, and Weavers stop being the family that owns it. The
   [Aether proposal](aether-pool-proposal.md) already warns against the type becoming mandatory.
6. **Do vouchers need limits?** They buy anyone for now. Add a limit only if play shows one of
   these: the same opening pair every voyage regardless of the Brief; two heavy spenders taken early
   with no cost felt (Aether starvation should be the cost; if it isn't, a price is needed); or
   choice paralysis at the voucher screen. The first limit to try is a +1 Writ surcharge for a
   repeated combat role, since that's the smallest change.
