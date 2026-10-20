# Team building across a long voyage: independent design panel

28 September 2026. Five independent design agents contributed proposals for a single voyage of 20+ battles and events. This document synthesizes their arguments and records a proposed comparison. These are untested design hypotheses, not approved rules or measured player preferences. No prototype or gameplay code was changed for this panel.

## The user's proposal

Each character starts with a small personal equipment pouch. Small gear fits immediately; the player can selectively expand a pouch to admit larger equipment. Dragging compatible items over one another previews and creates a combined item. Complexity grows with the build instead of introducing a full inventory puzzle for every character at departure.

The core goal is repeated, satisfying small problems: selecting a crew, solving incoming threats, deciding who deserves investment, fitting equipment, and choosing useful combinations across a long voyage. Character choice must remain meaningful. Neither selecting passive buffs nor maintaining many inventories is sufficient.

The reference game's official description confirms that Backpack Battles combines item shapes, placement, and crafting. That supports the analogy, but does not establish that multiplying its inventory problem across a team is enjoyable. Immediate drag-to-fuse is a proposed Spacology interaction, not a claim about how that game's crafting resolves. [Official Backpack Battles description](https://store.steampowered.com/app/2427700/Backpack_Battles/).

## Current constraints worth preserving

- Characters work through their innate kits; equipment and partners amplify a functioning character. See [character construction](character-construction.md).
- Preserve hypercarry, multi-carry, follow-up, ultra-break, DoT, and retaliation families. Sustain can protect a payoff, restore resources, influence targeting, or preserve action timing.
- Enemy action advance creates a real enemy turn and real risk. Fast shield recovery can reward repeated ultra-break rather than simply invalidate breakers.
- A roster consists of unique people. Acquiring upgrade copies is separate from deploying duplicates.
- Current voyage code has 21 nodes, including fourteen battles. This panel uses **24 nodes total** as a test spine, not 24 battles plus events. Larger voyages can follow if that length remains enjoyable.
- The live formation capacity reaches twelve. Test four-, eight-, and twelve-unit cases rather than quietly solving management by reducing the roster.
- Acquisition remains undecided. Use fixed offers to compare the pleasures of building before choosing currencies, pack odds, or permanent collection.

## The five perspectives

| Agent | Assignment | Main contribution |
| --- | --- | --- |
| Kierkegaard | Develop and challenge growing personal pouches | Selective expansion and fusion can preserve individual ownership, but need explicit limits on item accumulation and how often pouches are reopened |
| Aquinas | Propose a relationship-based alternative | A few cooperative jobs connect characters by capabilities, with equipment modifying those jobs |
| Boyle | Propose a behavior/resource alternative | Characters bring authored reaction orders; choose a few to arm and divide limited charges among them |
| Einstein | Propose a voyage-structure alternative | Choose forecasted routes, nominate specialists, and adjust character commitments at camps |
| Gibbs | Audit pacing and scale; propose another direction | Limit attention demanded by each reward, measure management separately from enjoyment, and test personal commitments as another progression mechanism |

These are independent viewpoints, not a vote or empirical consensus. Their recurring recommendation is to grow the team's capabilities without requiring every character to be rebuilt at every stop.

## Option A: growing personal pouches

**The problem:** which items fit this character, what should be fused or removed, and whose pouch should grow next?

Prototype a 2×2 starter pouch, then 2×3 and 3×3 upgrades. Those dimensions are experimental. Bound object count separately from cell count: a larger pouch should often contain two or three significant items instead of many tiny ones. The pouch agent suggested a maximum of two, three, then four objects by tier, with only a few expanded specialists and a short shared stash.

Do not adopt all those caps as final rules. A hard limit of three expanded characters could favor a hypercarry package and frustrate distributed damage teams. Compare a flexible expansion budget with a hard specialization limit, and preserve endgame usefulness for a character whose pouch never grows.

**A concrete growth sequence:**

1. Early: Reva has a one-cell Threat Pin and a two-cell Return Spring in her 2×2 pouch. The pin increases targeting priority; the spring answers a received hit. Ilka's protection makes deliberate exposure safer. These are proposed item behaviors.
2. Mid: fuse them into a two-cell Challenge Coil. It attracts attacks while protected and answers absorbed hits. The smaller object count comes with a more specific trigger: without a barrier partner, the fusion can be worse than the original pieces.
3. Expand to a 2×3 pouch and add a four-cell Delay Bell. Define the coil footprint as 2 columns × 1 row and the bell as 2×2 so they genuinely fit together. The bell advances a selected enemy after a qualifying absorbed hit, capped once per wearer cycle. Extra enemy turns now require a sustainable protection engine.
4. Late: retain that arrangement through ordinary battles. A new follow-up recruit benefits from repeated counters; a DoT recruit benefits from more enemy turns. A dangerous enemy that grows stronger when it acts can instead make the bell worth replacing. Recruitment and threat changes alter the value of the equipment, not just its numerical wearer.

**Fusion design:** preview ingredients consumed, effects lost, output behavior, footprint, and whether it fits. Dragging opens that preview; an explicit combine action or deliberate drop confirmation finalizes it. Offer a tap-based equivalent. Keep undo before the next battle. A fused item may be larger than either ingredient but smaller than their combined footprint, which supports the user's expansion idea without flooding the pouch with objects.

Compression should not always preserve every benefit and add power. If fusion is always superior, it is obligatory housekeeping. Branches such as retaliation through absorbed damage versus retaliation through health loss create different sustain needs. Likewise, keeping ingredients on two allies can be preferable to concentrating them on one.

**Main risks:** ingredient hoarding, universal recipes, repeated full-team repacking, expansion becoming a mandatory power tax, and players selecting characters for bag geometry instead of kit identity. Different character pouches alone do not guarantee meaningful character choice.

**Cheap refutation:** a paper or lightweight drag prototype with a few recipes, limited upgrades, fixed recruits, and the same threat sequence. Check whether most rewards cause one useful adjustment or inspections of nearly every pouch. A six-stage lab cannot establish late-voyage manageability.

## Option B: cooperative jobs

**The problem:** which two characters should work together, and what job will lose access to a scarce cooperation slot?

Use two or three job cards initially, expanding to four. Each has two character sockets and a concrete trigger. Protection plus retaliation creates a guarding job; shield removal plus a reaction attacker creates a breach job. Eligibility comes from capabilities, not mandatory named partners. Each character still works independently.

Gear changes how a job operates. A guard tether protects a fragile ally; a recoil tool instead accelerates the attacker and accepts more danger. One tool per job makes a new drop a replacement decision rather than another inventory object to pack.

Early, pair a targeting sustain with a retaliation carry. Mid, a fast-recovering enemy makes an immediate break-follow-up job useful. Late, a new barrier sustain enables attacks from absorbed hits, changing both the desired partner and tool.

**Main risks:** recruiting may force evaluation of many possible pairs; characters outside jobs may feel second-rate. The agent's one-job-per-character restriction could also prevent several supports cooperating with a hypercarry. Test a version where a carry can receive two jobs while they still consume separate team job slots. Pairing limits must not suppress the ordinary support kit's effects.

**Cheap refutation:** character cards, four job cards, and a few tools. Reject the direction if players keep identical pairings despite changing threats, or if most thought goes into eligibility checking rather than anticipating a payoff.

## Option C: reserve orders

**The problem:** which reactions deserve limited charges, and in what order should they resolve?

Every character has an automatic base routine and one authored reserve order. Equip or arm up to three orders, rank their priority, and distribute a small number of charges. No player-written conditions or programming interface.

Examples: intercept an attack on the carry; crack a nearly depleted shield; strike immediately after a break; advance an enemy after retaliation. Each has a cost or sacrificed ordinary action. Gear could replace an order's consequence or trade charge cost against exposure, rather than add raw stats.

Early, spend most charges on protection and emergency recovery. Mid, shift to shield cracking followed by immediate damage against fast reformers. Late, allow exactly one deliberately advanced enemy turn because repeated provocation would make that enemy too dangerous. The original agent used four charges in a sample allocation; the actual budget needs testing.

**Main risks:** priority debugging, opaque nested triggers, and three armed characters overshadowing the rest of a twelve-person roster. Keep reaction counts bounded and ordinary kits valuable. This option changes the combat framework more substantially than pouch equipment.

**Cheap refutation:** six authored orders and physical charge counters against scripted threats. Reject the direction if players cannot predict or explain a sequence, always use the same allocation, or care more about acquiring charges than recruiting people.

## Option D: forecasted expedition preparation

**The problem:** which known threat should the team accept, and which specialist can handle it within the preparation budget?

Organize the test voyage into short legs. Before each leg, show two routes with an enemy behavior, an objective, and a preparation restriction. Gear has an operator and an opportunity cost: a shield clamp extends an opening but consumes its operator's next action; a targeting beacon attracts attacks but prevents another protective duty.

Characters gain a voyage specialization that develops their existing job. At camps, refund and redirect investment so an early plan does not trap the rest of the voyage. Upgrading one specialization postpones another.

Early, prepare interception for an enemy that focuses the strongest attacker. Mid, recruit a follow-up specialist to cover simultaneous launchers while a breaker opens brief windows. Late, surviving a required number of enemy actions makes retaliation and intentional exposure useful objective answers.

**Main risks:** forecast spreadsheets, repetitive camping, remote consequences that are hard to understand, and forced rebuilds at every leg. The agent suggested shared cargo slots, but those alone do not solve the user's desire for personal gear ownership. This proposal is primarily an alternative source of puzzles; its equipment ownership needs separate comparison.

**Cheap refutation:** two route cards, a few operator tools, and six battles. Reject if route choices are obvious, rarely change the specialists used, or consume more attention than the player finds enjoyable.

## Option E: personal commitments

**The problem:** which duty should a character develop, and when is it worth renegotiating that duty?

A character adopts one tactical commitment during the voyage, with occasional opportunities to revise it. A defender commits to protecting one ally or attracting attacks; a breaker commits to repeatedly exposing a priority target or distributing shield pressure. Equipment changes how that commitment is fulfilled.

This differs from reserve orders: a commitment persistently changes the character's routine instead of consuming a shared interruption budget. It differs from a generic skill tree only if fulfilling the duty creates a concrete tradeoff in encounters. Choosing between two permanent buffs would fail the brief.

Early, establish one duty. Mid, choose a branch that answers a new enemy but gives up part of the previous job. Late, decide whether to keep a proven specialist or redirect its investment to a new recruit. A character's innate behavior limits which commitments it can use.

**Main risks:** becoming a renamed talent tree, same-choice progression, and commitment regret. Test reversible changes at explicit milestones before introducing irreversible choices.

## A proposed 24-node pacing test

This is a common evaluation spine, not a requirement to ship every idea together. Nodes are battles or events; preparation can happen within a node. Reward quantities stay controlled across candidate systems.

| Nodes | What the player learns or solves | Proposed management demand |
| --- | --- | --- |
| 1–4 | A functioning starter engine, one gear choice, targeted pressure, first recruit | One small character or relationship decision at a time |
| 5–8 | Shield removal, first combination, fast recovery, first expansion or equivalent investment | One focused rebuild followed by battles that use it |
| 9–12 | Mixed targets, a second useful recruit, checkpoint boss | Stable loadouts should get several chances to work |
| 13–16 | Route choice, competing investment, changed enemy behavior | Choose who develops; avoid upgrading everyone |
| 17–20 | Endurance, second combination, final recruit opportunity | Test whether a new recruit disrupts the whole build |
| 21–24 | Finale forecast, last preparation, attrition, engine disruption, final battle | Let the completed build perform; do not force late inventory cleanup |

The pacing agent proposed six prominent equipment decisions in a 24-node run, with recruitment and route decisions filling other nodes. Treat that as a starting comparison, not a limit on voluntarily experimenting. Provide clear access to rearrangement, but do not present each reward as a request to audit every character.

## What should be measured

Count inspected characters, changed characters, items moved, recipes inspected, and relationships or orders revised separately. They are different kinds of work. Also record time and whether the player found the work satisfying. A longer decision can be enjoyable; a short repetitive one can still be a chore.

For four-, eight-, and twelve-unit cases, test:

- Can the player explain the reason for their latest recruit and the contribution of each deployed character?
- How many characters must they inspect after an ordinary reward, and how many actually change?
- Does a completed loadout remain useful for several fights, or immediately demand reconstruction?
- Is an unexpanded character still a good late pick? Does a new recruit require a total gear transfer to compete?
- Can hypercarry and distributed investment both develop satisfying answers?
- Do the same item or investment choices have different useful outcomes on distinct characters?
- Does fusion reduce object count while preserving a real tradeoff? Are players hoarding ingredients for hypothetical future recipes?
- Are players solving new threat problems, or repeatedly restoring an obvious maximum-power arrangement?

As provisional warning thresholds, the pouch agent suggested inspecting more than three pouches per ordinary stop or routinely spending over three minutes at late inventory stops. These are hypotheses to investigate, not universal player tolerances or measured results.

## Synthesis and next experiment

The growing-pouch idea deserves a direct test. It retains the tactile pleasure the user asked for, preserves personal equipment ownership, and can make fusion reduce clutter. Its weakest assumption is that gradual board growth also limits late-run attention. That must be tested rather than accepted.

A useful comparison is **growing pouches versus cooperative jobs**: both can make character identity and equipment interactions central, but one asks players to arrange possessions and the other asks them to arrange responsibilities. Reserve orders are a strong third candidate if sequencing is more enjoyable than placement. Expedition forecasts are useful test inputs for all candidates and should not become an additional full progression system during the comparison.

Start with a few functioning characters and six representative encounter problems. Keep recruitment, total reward value, and threats equivalent; provide the signature interaction each candidate needs to feel good. Then extend the promising candidates across the full 24-node spine and eight-/twelve-unit stress cases. Measure agency, attachment, anticipation, satisfaction, and unwanted maintenance separately from clears.

Do not pick a winner from agent agreement, layout solvability, or simulation damage alone. No acquisition or equipment system is selected by this panel.
