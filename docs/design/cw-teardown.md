# Currency Wars — systems teardown

What it actually does, system by system, with a verdict on each. Sources are the
HSR wiki, guides, and the mode's own change history. Where something is a leak or
secondhand it is marked.

---

## 1. Run structure

Three planes. Each is a fixed pattern of nodes, not a branching map.

> Plane 1: Reward, Reward, Strategy/Combat, Combat, Supply, Combat, Encounter, Reward, Boss
> Planes 2 and 3: Combat, Strategy/Combat, Supply, Combat, Encounter, Reward, Boss

**What it solves.** Pacing, without a map. You always know a boss is coming and roughly
when. Reward nodes cluster early in plane 1 so the opening is generous.

**Worth noticing.** The pattern is *fixed*, not generated. All the variance comes from
the affixes, the opponents, and the shop. That is a far cheaper source of replay than a
branching map, and it means every run is directly comparable to the last — which is
what makes losing diagnosable.

**Verdict: take it.** A fixed spine with variable content beats a random map for a
knowledge game. It also kills the "did I take the wrong path" excuse.

---

## 2. Economy

Gold buys three things: characters, levels, and shop refreshes.

- Base income after each battle
- **Interest on your balance** — saving is an investment
- **Win streak bonuses** — pressure to win *now*, against the pressure to save
- Costs are 1 to 5, matching rarity grey / green / blue / purple / gold
- **Characters of the same cost are comparable in power** — cost is a tier, not a stat
- Your level raises both squad size and the odds of high-cost characters appearing
- The shop refreshes once per node free; manual refreshes cost; **you can lock it**

**What it solves.** The interest-versus-streak tension is the whole economy in one
line. Spend now and win the next fight, or hoard and compound. That is a real decision
every single node, and it costs almost nothing to implement.

**The lock is the most underrated feature here.** It turns "I saw something good but
cannot afford it" from a loss into a plan.

**Verdict: take nearly all of it.** Interest, streaks, and the lock are three cheap
mechanisms that between them make every shop visit a decision. This is also the direct
answer to the original grievance — the shop feels wasteful because rerolling is the
only lever; the lock gives you a second one.

---

## 3. Characters, cost, and the shop

Three characters to start, up to blue rarity. Everything else is bought.

Cost is a *tier*, and same-tier characters are deliberately comparable. Your level
shifts the odds toward higher tiers rather than unlocking them outright.

**What it solves.** It makes the shop a probability problem rather than a wishlist.
Levelling is buying better odds, which is a more interesting purchase than buying a
thing.

**Verdict: take the tier structure, question the rarity ladder.** Five tiers is a lot
of vocabulary for a small roster. Three would carry the same decision.

---

## 4. The roster split — on-field and off-field

Eight to ten characters owned. **Four fight.** The rest sit off-field and still matter:

- Off-field characters **can never be targeted**
- They act on their own, with different rules
- Off-field damage dealers target the strongest enemy, or one matching their element
- Off-field buffers prioritise the strongest on-field character
- Off-field shielders and healers prioritise whoever is lowest
- **Characters get different empowerments depending on which side they are on**

**What it solves.** This is the cleverest system in the mode. It makes a ten-character
roster meaningful without putting ten characters on the board, so fight length stays
fixed while build depth grows. And "different empowerment on-field versus off-field"
means a character is two characters depending on where you put them.

**Verdict: take it, and it answers a question we have been circling.** We kept asking
whether a bench should exist. This is the version that works: the bench is not reserves,
it is a second board with different rules.

---

## 5. Positioning

Frontline, Backline, and Front-Backline. Some characters are locked to a side; flexible
ones can go anywhere and are equally good there. *(This detail comes from pre-release
leaks and should be checked against the live mode.)*

**Verdict: this is the version of positioning that is worth having.** Not a grid, not
line of sight — a binary with position-locked characters, so a roster has a shape it
has to satisfy. Our own testing put grid placement at a 1.5× swing, well below tags at
2× and conditions at 4.7×. A binary gets most of the value at a fraction of the cost.

---

## 6. Bonds

Shared tags between on-field characters activate buffs, scaling with how many members
you field. Some tags are unique to a single character.

**Verdict: already taken.** This is the tag system, and the research already told us the
important part — two tiers, entry splashable, deep tier changes a rule.

---

## 7. Investment Environments and Strategies

**Environment**, chosen at the start from three: grants characters, raises the offer
rate of a set, or other perks. Refreshing rerolls *all three at once*.

**Strategy**, chosen after the first combat of each plane from three. And the important
part:

> Silver adds 0 difficulty. Golden adds 1 or 3. Prismatic adds 3 or 6.

You choose to raise the run's difficulty in exchange for a stronger perk. Strategies
refresh *individually*.

**What it solves.** Player-authored difficulty. Nobody sets a slider; you take the
strong thing and accept the cost.

**The flaw you identified.** The perks are random, so the trade is often not one your
build can use, and the escalation becomes a tax with a lottery ticket attached.

**Verdict: take the shape, fix the draw.** Opt-in escalation is excellent. Make the
perk offered relevant to what you are building — if the run is decay, offer decay.

---

## 8. Some strategies are genuinely wild

Worth quoting because they show how far the mode is willing to go:

- **Massive Layoffs** — sell every character for double gold, gain five or six free refreshes
- **Downsizing** — sell everything for double gold, next five or six purchases free
- **Struggle Protocol** — **purchasing EXP costs squad HP instead of gold**
- **Resolution: Planet of Entertainment** — take double damage; if you hold 180 gold, every remaining non-boss node becomes a reward node

**Verdict: this is the best idea in the mode and we have nothing like it.** These are
not stat buffs, they are *rule rewrites that restructure the run*. Struggle Protocol
changing the currency you pay with is a genuinely startling piece of design — it turns
your health bar into a wallet.

A pool of twelve or so run-rewriting options like these would do more for replay than
any amount of new characters.

---

## 9. Equipment

Gems and gear, synthesised and rerolled. Two red or blue gems make a **Wealth Gem**,
which raises the team size limit by one and pays gold while equipped. A Disassembly
Wrench reassigns gear freely. Rerolls exist at the item and character level.

**Verdict: skip most of it.** This is the layer that adds the most vocabulary for the
least decision. The one idea worth keeping is that **the strongest item raises a
structural limit** — team size — rather than a stat.

---

## 10. Squad HP

One health pool for the whole run. Failing to clear in time reduces it. At zero the run
ends. Your remaining squad HP determines your score and rank progress.

**What it solves.** It merges the fail state and the score into one number. You are not
just trying to win, you are trying to win *cheaply* — which gives a skilled player
something to optimise after winning stops being in doubt.

**Verdict: take it.** This is better than our round-limit-shrinks-on-death rule, and it
does the same job. It also creates the "win but barely" texture that makes a near-miss
feel like something.

---

## 11. Affixes

One or two guaranteed from rank A2, scaling with rank. They either buff the enemy or
debuff your party, and **debuffs on characters are mostly unremovable**. From 3.8, some
carry a red arrow whose *length* indicates how dangerous they are.

**Verdict: this is the system we are explicitly building against.** The arrow is an
admission — they label the run-ending combinations rather than removing them. Our cap
rule fixes it at the source.

But note the good part: **strategies exist that remove or prevent affixes.** The
counterplay concept is right; the delivery is random.

---

## 12. Ranks

A0 to A8. Automatic promotion up to a point, then **Ascension Matches** — significantly
harder, roughly matching the next difficulty's sixth level.

**Verdict: the ascension gate is worth taking.** A deliberate wall you choose to attempt
is better than a gradient you slide up. It also gives a loss meaning — you attempted
something, rather than drifting.

---

## What we should take

| System | Why |
|---|---|
| Fixed node spine, variable content | Replay without a map generator; losses stay comparable |
| Interest versus win-streak | The whole economy in one tension |
| **The shop lock** | Turns "cannot afford it" into a plan |
| **On-field / off-field split** | A ten-person roster, a four-person fight |
| **Different empowerment by position** | One character is two characters |
| Frontline / backline as a binary | Most of positioning's value, little of its cost |
| Opt-in difficulty for a perk | Player-authored ceiling |
| **Run-rewriting strategies** | The single biggest replay lever in the mode |
| Squad HP as score and fail state | One number for "did I win" and "how well" |
| Ascension gates | A wall you choose to attempt |

## What we should avoid

| System | Why |
|---|---|
| Stacking stat affixes | The gods problem; our cap rule exists for this |
| Unremovable party debuffs | Removes agency without opening an alternative |
| Random counterplay to affixes | If the answer might never be offered, there is no answer |
| Five rarity tiers plus gems plus synthesis | Vocabulary cost far above decision value |
| Danger-arrow labelling | Treating the symptom |

## The gap — where there is room to be different

Everything above is economy and structure. **CW's combat is functional but not
theatrical**, and its decisions all happen between fights. Once a battle starts you
watch numbers resolve.

Two openings follow from that:

**Decisions during the fight.** Two or three interventions at moments you choose. CW has
nothing here, and the turn track we have already built is the interface for it.

**Combat worth watching.** The call-and-response staging, the cascade, the turn track
getting shoved by an interrupt — none of this exists in CW. It is the one area where
what we have built is already ahead rather than behind.
