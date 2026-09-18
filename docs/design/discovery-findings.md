# Can you find combinations nobody designed?

Measured, not reasoned. Reproduce with `cd sim && node search.js`, `node diversity.js`,
`node verbs.js`.

The design goal under test: *"finding characters who work together in unexpected ways… each
character should have a value where you can find alternate combinations that also work outside
the normal teams."*

**Short answer: the good teams are already cross-department and already built from verb chains
rather than thresholds, which is exactly right. But only about two genuinely different strong
teams exist, and the bottleneck is the verb vocabulary — eight of seventeen verbs sit on a single
character, so most chains have exactly one possible shape.**

---

## 1 · The best teams are not committed teams

`search.js`, sampling 220 random fives across five worlds:

```
team                                avg   open  murk  hive  fort  bloom
  Bosk, Nettle, Pyre, Maul, Ash     5.49  5.91  4.03  5.96  5.61  5.96
  Maul, Sump, Maul, Bosk, Ash       5.14  5.04  3.94  5.96  5.96  4.82
  Maul, Wex, Pyre, Ferrule, Ash     5.13  5.21  3.68  5.96  4.86  5.96
  Ash, Mire, Ash, Rime, Vitre       4.98  5.21  3.51  5.96  4.47  5.74
  Ferrule, Mote, Ash, Tarn, Pyre    4.85  4.86  3.16  5.96  4.29  5.96
```

Not one is a single-department team. The top entry spans Ordnance, Drive, Blight and Assay.

What they share is a **verb chain**, not a tag:

| Character | Verbs | Role in the chain |
|---|---|---|
| **Ash** | `aoe` `shred:12` `apply` `stacks:2` | Hits the line, shreds shields into breaks, seeds rot |
| **Maul** | `trig:'break'` `ratio:2.2` | Answers every break at more than double damage |
| **Pyre** | `detonate:1` | Cashes in the rot Ash left behind |

Three departments, one mechanism, and the mechanism lives entirely in verbs. This is the payoff
the search exists to find, and it found it unprompted.

## 2 · Thresholds mostly read negative on unplanned teams

Tag lift from the same run, baseline 2.26:

```
  Ordnancex4  +47%  (n=8)        Drivex2    -3%
  Assayx3     +28%               Hullx2     -9%
  Blightx2    +19%               Hullx3    -26%
  Assayx2     +17%               Crewx2    -21%
  Ordnancex3  +13%               Crewx3    -45%
  Blightx3     +6%               Crewx4    -54%
```

`Blight×3` (+6%) is *worse* than `Blight×2` (+19%). Hull, Crew and Drive all get worse the deeper
you go.

This does not contradict the breakpoint tables in `roster-design.md`, which used hand-authored
archetype teams. `synergy-notes.md` already named the effect: *"a tag threshold is only worth what
a kit can spend it on… averages hide conditional value."*

Read together, though, they say something useful: **commitment pays only when you have also
drafted the payoff to spend it, while the cross-department verb chains pay reliably.** The
threshold system is not the thing pushing players toward discovery, and it is not the thing
stopping them either — it is roughly neutral, and the verbs are doing the work.

## 3 · No character is mandatory — good news

`diversity.js`, 260 random fives, best team with each heavily-used character banned:

```
  with everyone          5.62   Ferrule, Maul, Maul, Ash, Vitre
  without Ash            5.39   Maul, Maul, Corr, Nettle, Corr
  without Maul           5.01   Ash, Rime, Rime, Cinder, Bosk
  without Nettle         5.62   (top team unaffected)
  without Mote           5.62   (top team unaffected)
  without Corr           5.62   (top team unaffected)
```

Banning the single most-used character costs **4%**. Banning the second costs **11%**. Neither is
a tax worth calling mandatory, and the three teams above are mechanically distinct:

- **break-answer** — shred into breaks, Maul answers them
- **burst** — raw damage plus a cheap ally-trigger reactor, no Blight at all
- **shred-and-seed** — area shredding with stacks, no reactor at all

Three viable cores is real. This is the part of the goal that already works.

## 4 · But the top end concentrates on five characters

Character frequency in the top 50 teams, 250 slots, even share would be 11.9:

```
  Ash      40  ####################
  Maul     29  ###############
  Nettle   18  #########
  Mote     18  #########
  Corr     18  #########
  Rime     17  #########
  Pyre     13  #######
  ...
  Vane      5  ###
  Mire      5  ###
  Ballast   3  ##
  Sump      3  ##
```

Ban all five of the top characters and the best remaining team scores **2.39** — dead on the 2.28
baseline. The other sixteen characters produce nothing above average.

Greedy disjoint teams tell the same story:

```
  1. 5.62   Ferrule, Maul, Maul, Ash, Vitre
  2. 3.78   Corr, Nettle, Tarn, Mote, Rime
  3. 1.39   Vane, Cinder, Ledger, Bosk, Cinder
  4. 0.78   Wex, Mire, Mire, Mire, Mire
```

*Caveat: this is greedy, so team 3 draws from only 11 remaining characters and team 4 from 6. Some
of that decline is forced by the method rather than by the roster.* Even so — two teams above
baseline, then nothing.

**Two genuinely different strong teams, not many.**

## 5 · The cause: eight of seventeen verbs exist on one character

`verbs.js`:

```
   1  detonate (spend seeds)  Pyre
   1  spread                  Sump
   1  advance                 Vane
   1  charge                  Halo
   1  drain                   Ballast
   1  needsGuard              Tarn
   1  onHitBarrier            Ferrule
   1  over                    Mire
   2  marks                   Quill, Vitre
   2  thorns                  Tarn, Mire
   2  taunt                   Tarn, Ballast
   2  barrier                 Wex, Ferrule
   3  apply/stacks (seed)     Ash, Cinder, Sump
   3  trig/react (answers)    Nettle, Maul, Ledger
   3  heal                    Sump, Fen, Mire
   4  shred                   Ash, Mote, Vitre, Rime
   4  aoe                     Ash, Mote, Vitre, Rime
```

A discoverable combination needs two characters whose verbs interlock. **A verb on one character
only gives every chain through it exactly one shape.**

- **One detonator.** Three seeders feed Pyre and nobody else. `seed → deton` has one shape, forever.
- **Three reactors, three different triggers** — Nettle on `ally`, Maul on `break`, Ledger on
  `mark`. They do not substitute for each other, so each reactor chain also has exactly one shape.
- **Two characters have no verbs at all.** Corr (`dmg:25`) and Bosk (`dmg:17`) are pure stat
  blocks. They can never be part of anyone's discovery — yet Corr appears 18 times in the top 50,
  because raw damage is strong. He is powerful and permanently uninteresting, which is the
  amplifier-without-enabler gap `explorations.md` §11 flagged.

Hooks per character: eleven have exactly one, two have none, and the maximum is three (Ash, Sump,
Tarn, Vitre, Mire). **Ash tops the frequency chart because she is one of only four shredders, one
of only three seeders, and has area — three hooks is the joint ceiling.** The concentration in §4
is not a balance accident; it is the verb census showing through.

## 6 · What follows

**See `character-construction.md`** — the prescription lives there, because the answer turned out
to be structural rather than a matter of adding more verbs.

The short version: the sparseness measured above is a symptom of **enablement**. A chain exists
only where a producer meets its specific consumer, so with one detonator serving three seeders,
`seed → deton` has exactly one shape however many seeders are added. Replacing enablement with
**amplification** — every character completes its own loop, and others make that loop bigger —
turns a sparse space of working pairs into a dense one, because anything touching a mechanic then
improves anything else touching it.

Three content rules fall out, detailed in that document: every verb on at least three characters,
no character with zero hooks, and trigger conditions that overlap rather than partition.

### A correction to §1 and §4

Both runs above sampled teams **with replacement**, and their best teams doubled up freely —
`Ferrule, Maul, Maul, Ash, Vitre`, `Maul, Maul, Corr, Nettle, Corr`. **Teams must be unique
characters**, so those teams are illegal and the concentration figures are measured against a
larger legal space than actually exists.

`sim/unique-teams.js` re-runs the same questions under the real rule. Its numbers supersede §3 and
§4; the verb census in §5 is unaffected, since it does not depend on team composition.

## 7 · What this cannot tell you

`sim/README.md` has the detail: **neither engine models element as a property of a character.**
Both assign it by array position, and Harmony is declared and never read. So everything above is a
finding about **verbs and departments only.**

Whether elements add a second, independent source of unexpected combinations — an order reactor
answering differently from a chaos reactor, per the adverb table — is unmeasured and unmeasurable
until characters carry an element. That is the prerequisite for the interesting half of this
question.
