# Roster review

A pass over all 21 characters — names, lore, and what they can actually do. Read against one
test, which is the one that matters for whether a character is worth having:

> **What team exists because of this character that couldn't exist without them?**

If the answer is *the same team, but stronger*, the character is a magnitude on an axis, and they
have a shelf life — a bigger number replaces them. If the answer is a team shape that was
previously unbuildable, there is no better version of them, only a different one.

**Headline: three of twenty-one pass.** Four more are one half of a pair. The remaining fourteen
are magnitudes, and several are outright duplicates of each other.

---

## 1. Names

**Nineteen of twenty-one are common nouns, not names.** Vane, Ballast, Ferrule, Quill, Bosk, Tarn,
Fen, Mire, Sump, Mote, Halo, Maul, Rime, Wex, Corr, Vitre — objects, landscape features, and
one-syllable textures. There are no given names, no surnames, no species conventions, and no
culture anywhere behind them. Nothing about any of these implies a society someone grew up in.

**Four of them import an element system this game does not have.** Ash, Cinder, Pyre and Rime are
fire-and-ice words. The elements here are order, chaos, growth, decay, energy and void. Nothing in
the cosmology is fire. Those four are named for a generic fantasy wheel we do not use, and they
read that way — they are the most immediately replaceable-sounding names in the roster.

**Three are near-synonyms.** A fen, a mire and a sump are all boggy drainage. Fen and Mire are
*both Healers*, sitting next to each other in the same role with names that mean the same thing.

**Ledger is the one that works**, and it shows the pattern the rest should follow: a job-word that
became a name, on-theme for a ship's archivist, and faintly funny. It encodes something. A name
earns its place when it tells you what someone does, where they are from, or what happened to them.

---

## 2. Lore

**Every bio is the same shape.** Job title, full stop, one mannerism. All 21 of them, between 38
and 86 characters, almost all exactly two sentences. Uniformity at this scale is not a style, it is
a template, and it is why the cast reads flat even where individual lines are good.

The best of them are genuinely on-theme and worth keeping as seeds — *"Xeno-chemist. Aerosolises
samples and lets the wind do the rest"* (Ash), *"Field biologist. Corruption jumps hosts when one
dies; she counts on it"* (Sump), *"Xeno-botanist. Tags every specimen before she touches it"*
(Quill), *"Reactor engineer. Gives away her own power and runs cold doing it"* (Halo). These four
sound like people on a research vessel.

**Wex and Fen are the same person.** Wex *"patches things before they fail, including people."* Fen
*"treats the crew like equipment: patched before it fails."* Two characters, one personality,
written twice.

**Ledger's bio names Quill.** *"Answers every hit on anything Quill has written down."* A hard
mechanical dependency written into the fiction, which means Ledger cannot be reworked without
rewriting his lore, and cannot be fielded meaningfully without her.

**Nothing here is funny, and nothing here has a relationship or a cost.** No bio contains a flaw
that actually hurts the character, a history with another crewmate, or a joke. For a game whose
stated tone is humorous — a research vessel cataloguing a universe that is being erased — the cast
is uniformly competent and grim. Not one of them is bad at their job, annoying to work with, or
aboard for a reason they would rather not discuss.

**Pronouns are accidental.** Six bios say "she", one says "they", and fourteen say nothing. The
roster is not deliberately gendered either way; it simply was never decided.

---

## 3. Skills, attacks and passives

**In `sim/roster.js` these do not exist.** A character is up to 26 numeric fields — `dmg`, `speed`,
`shield`, `heal`, `thorns`, `armorShred`, `procDmg` and so on. There is no skill, no attack, no
passive, and no ability of any kind. Every character performs the same basic attack and differs
only in what numbers are attached to it.

**In the prototype they partly exist.** `watchable-fight.html` carries content that never made it
into the simulation roster:

| What a character has there | Notes |
|---|---|
| **One named ultimate** | e.g. Scatterfall, Full Survey, Arc Collapse, Slack Water |
| **An ultimate *kind*** | only four exist: `aoe`, `nuke`, `mend`, `lash` |
| **A targeting profile** | `bully`, `breaker`, `finisher`, `opportunist`, `tactician` |
| **A row** | front or back |

So the most a character currently is: a stat line, one ultimate drawn from four templates, a
targeting personality, and a row. There is no per-character basic attack, no passive, and no second
ability.

**Four ultimate kinds across 21 characters** means the ultimate is a shared template with a
different name and multiplier bolted on. Scatterfall and Full Survey are the same code. The
ultimate is therefore a magnitude too.

**The ultimate names are better than the character names.** Full Survey, Field Kit, Slack Water,
Arc Collapse, Deadfall, Hoarfrost, Seam Split, Overplate, Bloomtide. Several are on-theme, specific
and dry. Whoever named the abilities was working from the setting; whoever named the characters
was not.

**The best character writing in the project is in the AI.** `ultPolicy()` decides when to fire an
ultimate and states a reason in plain language — *"the board is full"*, *"someone is about to
fall"*, *"it finishes that one"*, *"no better moment coming"*. That is closer to characterisation
than any bio, and it is currently shared by everyone rather than being a trait of anybody.

---

## 4. Verdict per character

`OPENS A BUILD` — a team exists because of them. `HALF A PAIR` — they need a specific partner.
`MAGNITUDE` — a bigger number replaces them.

| Character | What they actually do | Verdict |
|---|---|---|
| **Tarn** | Fragile on purpose, taunts, reflects, requires a shield from someone else | **OPENS A BUILD** — the team that must protect the person who wants to be hit |
| **Nettle** | Follows up on any ally action, up to four times | **OPENS A BUILD** — rewards many cheap fast actions |
| **Sump** | Stacks jump to a new host when one dies | **OPENS A BUILD** — makes kill order a decision |
| Pyre | The only detonator in the game | HALF A PAIR — and the reason every damage-over-time team looks identical |
| Quill | Applies marks | HALF A PAIR — exists to feed Ledger |
| Ledger | Follows up on marked targets | HALF A PAIR — named in his own bio as needing Quill |
| Maul | Follows up when a shield breaks | HALF A PAIR — the obvious pairing, nothing more |
| Ferrule | Attacking produces shields | MAGNITUDE, with a mild loop |
| Halo | Grants energy to others | MAGNITUDE — feeds ultimates faster |
| Ash | Area damage + stacks + shred at once | MAGNITUDE ×3 — three axes on one body, which is why she is in everything |
| Cinder | More stacks per hit than Ash | MAGNITUDE — directly comparable, strictly narrower |
| Vane | Advances an ally's turn by a fixed amount | MAGNITUDE — precisely the character that gets power-crept |
| Corr | 25 damage | MAGNITUDE — the bio admits it: *"One target. One number."* |
| Bosk | 17 damage, more health | MAGNITUDE |
| Ballast | Health, taunt, lifesteal | MAGNITUDE |
| Wex | A 34 shield | MAGNITUDE |
| Fen | A 30 heal | MAGNITUDE |
| Mire | A 24 heal that overflows | MAGNITUDE |
| Rime | The most shred | MAGNITUDE |
| Mote | Area shred, slightly faster | MAGNITUDE — **a duplicate of Rime** |
| Vitre | Marks plus area shred, weaker | MAGNITUDE — **a duplicate of Quill** |

**Four pairs are near-duplicates of each other**: Rime/Mote, Quill/Vitre, Fen/Mire, Corr/Bosk. In
each case one character is the other with the numbers moved around. That is four roster slots
spent on nothing.

---

## 5. Things that are simply broken

Found while reading, and worth fixing regardless of what happens to the designs.

1. **Ten of twenty-one characters have a different element in each file.** `sim/roster.js` assigns
   elements by character identity; the prototype assigns them so each team happens to hold one of
   each. Wex, Tarn, Ferrule, Cinder, Vane, Nettle, Mote, Vitre, Rime and Mire disagree. There is
   currently no answer to "what element is Cinder."
2. **Three ultimate names are shared by two characters each** — Deadweight (Ballast *and* Maul),
   Strike (Corr *and* Bosk), Sweep (Rime *and* Mote).
3. **Three characters have a different ultimate depending on which team they are in** — Corr is
   either Arc Collapse or Strike, Rime is either Hoarfrost or Sweep, Bosk is either Deadfall or
   Strike. A character's signature ability is not stable.
4. **Ferrule's bio is corrupted.** It reads *"Throws plating overheal whoever is nearest"* — the
   bulk rename turned "over" into "overheal". The prototype still has the correct line.
5. **Wex is "Tank tech" in the roster and "Hull tech" in the prototype.** The rename reached one
   file.
6. **The prototype still uses the retired tag names** — Blight, Hull, Assay, Ordnance, Drive, Crew.

---

## 6. What is worth keeping

Not much of the roster, but more than none.

- **Tarn, Nettle and Sump as designs.** All three create a team rather than a number. They need
  names and lore, not mechanics.
- **The ultimate names**, most of them. They already sound like this game.
- **`ultPolicy`'s stated reasons.** Move them from being shared by everyone to being a trait of
  someone, and they become characterisation.
- **The targeting profiles** — `bully`, `finisher`, `opportunist`, `tactician`. A fifth axis nobody
  has designed against, and it decides who a character attacks, which is a personality.
- **Four bios as seeds** — Ash, Sump, Quill, Halo. They sound like people on a research vessel.

Everything else is a number waiting to be replaced by a bigger one.
