# Synergy systems — a deep dive

What synergies actually *are*, structurally; what other games do with them; what
players like and dislike; and which of it fits this game.

Rated against this game's constraints: solo dev, watchability first, ~47-minute
sessions, six crew against three to nine enemies, knowledge as the depth axis,
always a path to winning, matchup variance held between roughly 0.8 and 2.0,
over-performers acceptable because the meta can be cycled.

---

## Part 1 — The six axes

Every synergy system is a point in this space. Naming the axes lets you choose
coordinates deliberately instead of copying a game wholesale.

### 1. Trigger — what switches it on

| Kind | Example | Note |
|---|---|---|
| **Count threshold** | TFT traits, CW Astral Express | The workhorse. Two, three, four of a tag. |
| **Named dependency** | Himeko needs a Trailblaze Companion | Specific unit A enables unit B. |
| **Pairing** | Baron + Mime in Balatro | Two named things, neither sufficient. |
| **Purity** | "only one element on the team" | Rewards refusal, not accumulation. |
| **Order** | Balatro jokers resolve left to right | Sequencing as a resource. |
| **Event** | on break, on kill, on being hit | Already how follow-ups work here. |

### 2. Curve — the shape of the reward

**Step.** Discrete jumps at thresholds. Riot calls this *binary scaling* and treats
it as the point: going from four Brawlers to six is not a 50% increase, it's a
different trait tier. Your composition's identity is defined by which breakpoints
are lit.

**Linear.** Each member adds a fixed increment. Smooth, forgiving, forgettable.

**Multiplicative.** The Balatro model. Additive within a category, multiplied
across categories. Already validated in our own testing: additive stacking peaked
at 8.8× where bucketed multiplication reached 61×.

**Unlock.** The threshold grants a *new behaviour*, not a bigger number — the
Astral Express train arriving and attacking. Most memorable, most expensive to build.

### 3. Beneficiary — who gets it

Tagged members only · the whole crew · one designated carry · the board itself
(terrain, enemies, the turn order).

The third is what makes a "bad" character worth a slot, and the fourth is
underused almost everywhere.

### 4. Payload — what it grants

Stat multiplier · new action · resource (energy, skill points, turn position) ·
**rule change** (ignore shields, act twice, revive once).

Rule changes are the most interesting and the most dangerous. They don't scale
smoothly, so they can't be tuned with a number — only switched on or off.

### 5. Entry cost — how hard to reach

**Splashable** (2 members, fits any team) · **committed** (4+, defines the team) ·
**chase** (locked behind rare units).

TFT deliberately lowered Shurima from three members to two and calls the resulting
property *splashability*. A cheap two-piece trait and an expensive four-piece trait
are completely different design objects, and a system needs both.

### 6. Anti-synergy — what it fights

Rarely designed on purpose, always present. HSR players describe DoT compositions as
having **anti-synergy with break mechanics**, because breaking an enemy interrupts
the ailments on it. That's an accident that turned into an identity: DoT became the
archetype you take when break isn't available.

---

## Part 2 — Patterns, and what people say about them

### Count thresholds (TFT, CW factions)
**Liked:** legible, plannable, produces power spikes you can feel.
**Disliked:** being one short is miserable, and the miss is common. Riot repeatedly
nerfs items that grant +1 to a trait, because cheap access to a deep breakpoint
"gave a significant advantage" and had to be disabled.
**Rating here: essential.** It's the mechanic you already asked for and the one that
makes a weak character correct.
**Caveat:** the entry threshold and the deep threshold need different design intent.
Two members should be splashable and mild; four should change what the team *does*.

### Enabler and payoff (Balatro, Slay the Spire)
The strongest recurring structure in the research. Balatro guides converge on a
three-role core: **a score source, a multiplier source, and an enabler**. The stated
test for a good pair is "two jokers producing a result neither could approach alone."

The failure mode is documented too. A Banners of Ruin player complains that every
archetype "needs some basic cards that implement the mechanic, and execution cards
that take advantage of it" — and that only one archetype in that game has both. An
applier with no payoff is a dead build.

**Rating here: essential, and already half-built.** Quill applies Survey, Ledger
spends it. Ember applies decay, Pyre detonates it. What's missing is the *rule*: no
applier ships without a spender, and no spender ships without at least two appliers.

### Named dependency (HSR)
"Himeko needs at least one Trailblaze Companion." "Firefly teams require a Break
Effect buffer." Very strong identity, very brittle: if the required partner isn't
owned, the character is dead.
**Rating here: use sparingly.** With a small roster it collapses into "you must own
these two." Better expressed as a tag than a name.

### Order and position (Balatro)
Jokers resolve left to right, so placing a flat bonus before a multiplier is worth
more than after — and reordering is described as one of the highest-impact actions
in the game.
**Rating here: strong fit, and free.** You already have an ordering surface nobody
is using strategically: the turn order. A buff that lands before the carry acts is
worth more than one that lands after. Speed tuning is HSR's whole hidden skill layer.

### Environmental meta rotation (HSR endgame)
Pure Fiction and Apocalyptic Shadow apply mode-wide buffs that favour specific
archetypes — one cycle rewards follow-up teams, the next rewards ultimate-centric
ones. The meta rotates without a single balance change.
**Rating here: the highest-value idea in this document.** You said over-performers
are fine because you can cycle them later. This is the cycling mechanism, and it's
also your planet conditions. A planet that amplifies decay makes the DoT team the
answer this run without nerfing anything.

### Purity and exclusion
"Bonus if your team contains only one element." Rare, and interesting because it
rewards *not* taking the good thing.
**Rating here: worth one experiment.** It's the only pattern that makes a narrow
roster a strength rather than a limitation, and it's cheap to test.

### Board-level payloads
The Astral Express train attacking is a synergy whose payload is *an extra
combatant*. Very few systems do this.
**Rating here: strong, and you already have the vehicle.** A tag threshold that puts
an entity into the turn order is the bomb idea from earlier in this project. It is
the single most watchable synergy shape available, because the payoff occupies the
turn track and everyone can see it coming.

### Deliberate anti-synergy
**Rating here: adopt it explicitly.** Break delays an enemy; decay wants the enemy to
act. That tension already exists in this design by accident. Naming it makes both
archetypes sharper and gives a reason not to just take everything.

---

## Part 3 — Failure modes to design against

**Breakpoint tyranny.** The gap between tiers is enormous, so being one short is a
non-game. Mitigations: overlapping tags so a unit counts toward two things; a
two-member entry tier that is genuinely useful on its own; partial credit.

**Cheap access to deep tiers.** Riot's repeated problem. Anything that grants "+1
tag" needs to be treated as the most dangerous item class in the game.

**Enabler without spender.** The Banners of Ruin complaint. Ship them in pairs.

**Homogeneity.** If thresholds are the only source of power, every team is five of
one tag. The fix is that thresholds should raise a *ceiling*, not supply the floor —
a team of five shielders with nothing to shield should still lose, which is exactly
what our own testing showed at 0.73.

**Meta lock.** One comp dominates and the game becomes a checklist. Rotating
environment conditions are cheaper and better than balance patches, and they make
knowledge the skill rather than memorisation.

**Vocabulary sprawl.** Every tag is a word the player must learn. The dictionary's
promotion rule applies: a tag that only ever appears on two characters is flavour,
not a system.

---

## Part 4 — What I'd build, in order

1. **Six tags, two tiers each.** Entry at two members (mild, splashable), commitment
   at four (a rule change, not a bigger number). Six is the same count as the
   elements, which keeps the vocabulary flat.

2. **Every applier ships with a spender.** Written as a content rule, not a hope.

3. **Planet conditions as the meta dial.** Amplify a damage type, slow everyone,
   change the enemy mix. This is how the over-performer problem gets solved without
   nerfs, and how knowledge becomes the skill.

4. **One board-level payload.** The entity that joins the turn order. Pick one tag —
   Chaos is the obvious candidate — and make its four-tier bonus something that
   *appears on the track*.

5. **Turn order as a synergy surface.** Buffs that land before a carry acts should be
   worth more than after. This is free depth on a system already built and animated.

6. **One named anti-synergy.** Break and decay pulling opposite directions, stated
   openly in the dictionary so both archetypes have a reason to exist.

## Ideas noted but not recommended

| Idea | Why not, and what it would take |
|---|---|
| Named unit dependencies | Brittle on a small roster. Revisit past ~30 characters. |
| Chase tags behind rare units | Needs an acquisition economy that does not exist yet. |
| Trait-granting items | Riot's most-nerfed mechanic. Not worth it for a solo dev. |
| Positional grid synergy (adjacency) | Real depth, but invisible on touch and fights the card layout. |
| Deck-order effects on the crew | Balatro's ordering does not translate: crew act on speed, not sequence. |
