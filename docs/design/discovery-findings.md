# Can you find combinations nobody designed?

Measured, not reasoned. Reproduce with `cd sim && node sweep.js && python3 build-workbook.py`,
plus `node verbs.js` for the census.

> ## Corrected: the engine was broken when §1–§4 were first measured
>
> `synergy.js` spawned every enemy with a `NaN` action value — `BON.foeSlow` was referenced and
> never defined — so **no enemy ever took a turn**, in any fight, ever. The crew was scored against
> a board that could not hit back, and the only way to lose was the twenty-round limit. A second
> undefined constant, `BON.tickMul`, made ailment ticks `NaN` and the poisoned enemy unkillable;
> it was dormant only because enemies never acted. Both are fixed; see `sim/README.md`.
>
> The correction is large — the top team fell from `6.44` to failing at difficulty `3.0` — and it
> reverses the two headline findings below. **Everything here has been re-measured against a model
> where the enemy fights back.** The verb census in §5 is unaffected; it never ran a fight.
>
> The same engine produced the tables in `roster-design.md`, `synergy-notes.md` and
> `pipeline-notes.md`, which are void for the same reason.

The design goal under test: *"finding characters who work together in unexpected ways… each
character should have a value where you can find alternate combinations that also work outside
the normal teams."*

**Short answer: yes, and better than expected. The good teams are cross-department and built from
verb chains rather than thresholds; no character is mandatory; and the top of the table holds
several mechanically different shapes. The remaining limit is the verb vocabulary — eight of
seventeen verbs sit on a single character, so a chain through any of them has exactly one possible
form — which is a ceiling on how many combinations exist rather than a fault in the ones that do.**

---

## 1 · The best teams are not committed teams

240 unique fives across five worlds, enemy fighting back, difficulty ceiling raised:

```
team                              avg    open  murk  hive  fort  bloom   tags at entry
Pyre, Ash, Mote, Rime, Vitre     4.28    3.67  2.45  5.89  3.70  5.70    Blightx2 Drivex2 Assayx3
Rime, Ferrule, Mote, Ash, Wex    4.10    3.97  2.87  5.56  4.34  3.74    Assayx2 Hullx2
Vane, Rime, Sump, Maul, Mote     3.79    3.70  2.45  5.22  3.67  3.93    Drivex2 Crewx2 Assayx3
Maul, Mire, Ash, Ferrule, Mote   3.73    3.47  2.22  4.36  4.34  4.27    Ordnancex2 Assayx2 Hullx2
Vane, Rime, Mire, Ballast, Ash   3.61    3.40  2.45  5.38  3.97  2.87    Crewx2 Hullx2
```

**Not one is a single-department team**, and this survives the correction — it was true in the
broken model and it is true now, which makes it the most robust finding in this document. Every
top team carries two or three departments at their entry tier and commits to none.

What they share is a **verb chain**, not a tag. The top team runs four characters carrying `shred`
and `aoe` — Ash, Mote, Rime, Vitre — to strip the board's shields in parallel, and one detonator,
Pyre, to cash the rot that Ash and Cinder seed. Three departments, one mechanism, and the mechanism
lives entirely in verbs.

## 2 · Superseded

This section held a tag-lift table measured before the engine was fixed. It reported `Ordnance×4`
at `+47%` and `Crew×4` at `-54%`, both artifacts of a model in which nothing ever attacked the
crew. **See §4 for the re-measured table**, in which Ordnance is no longer a build and Assay is the
only tag that rewards commitment.

## 3 · No character is mandatory

Re-measured with the enemy fighting back, 240 unique fives, baseline 1.67, ceiling 4.28.

```
character   hooks   in top 50   cost of banning
Mote          2        22          -15.6%
Rime          2        16          -12.8%
Ash           3        34          -11.4%
Vitre         3        12           -4.3%
Maul          1        17            0.0%
Wex           1        15            0.0%
Ferrule       2        14            0.0%
Tarn          3        12            0.0%
```

**The mandatory-unit problem was an artifact of the bug.** Ash was in all twelve of the top twelve
teams and banning her cost 37%; she is now in 34 of the top 50 and costs 11%. Nothing exceeds 16%,
and most of the frequently-used characters cost nothing at all, because more than one team reaches
the ceiling.

It is worth seeing why the artifact was so convincing. With enemies that never attack, a fight is a
pure damage race, so the best area-shredder is simply the best character and every top team wants
her. Restore the enemy and survival matters, which splits the top into several shapes.

## 4 · The top teams are genuinely mixed

```
team                                 avg    deep tags
Pyre, Ash, Mote, Rime, Vitre        4.28    Blightx2 Drivex2 Assayx3
Rime, Ferrule, Mote, Ash, Wex       4.10    Assayx2 Hullx2
Vane, Rime, Sump, Maul, Mote        3.79    Drivex2 Crewx2 Assayx3
Maul, Mire, Ash, Ferrule, Mote      3.73    Ordnancex2 Assayx2 Hullx2
Vane, Rime, Mire, Ballast, Ash      3.61    Crewx2 Hullx2
Cinder, Rime, Tarn, Quill, Ash      3.58    Blightx3 Ordnancex2 Assayx2
```

Every one carries two or three tags at their entry tier and none is a committed mono-tag build.
Hull and Crew — the two archetypes previously written off — appear in four of the six.

### Tag lift, and the one clean threshold curve

```
Assay   x1  -13.6%   x2  +13.9%   x3  +24.7%   x4  +37.5%
Blight  x1   -2.5%   x2   +7.8%   x3   +5.8%
Hull    x1   +1.9%   x2   -4.3%   x3  -24.8%
Crew    x1   +7.6%   x2   -7.3%   x3  -29.9%
Drive   x1   +1.6%   x2   -2.5%   x3   -0.7%
Ordnance x1  -0.2%   x2   -0.9%   x3   -9.9%
```

**Assay is the only tag where going deeper always pays**, and it rises monotonically across all
four tiers — the shape the two-tier design is aiming at. It is also the only one currently worth
committing to.

**Defence splashes, it does not commit.** Hull and Crew are fine at one or two and fall off a cliff
at three. That is arguably correct and matches the project's own rule that *"a team of five
shielders with nothing to shield should still lose"* — but it means neither is a build, only an
ingredient, which is a different claim from `roster-design.md`'s "Crew is not a build" and rests on
sounder measurement.

**Ordnance is no longer a build either.** It read `+47%` at four in the broken model, where raw
damage was the only thing that mattered. At three it now reads `-9.9%`.

### Which constants actually move the game

From the sensitivity sweep, the range each constant spans across its tested values:

```
                broken model    fixed model
SHPER                  6.4%          56.2%
UN                     1.9%          28.8%
VULN                  44.7%           9.5%
SOAK                   4.3%           9.4%
DELAY                  0.0%           5.7%
```

The inversion is the whole story. With no enemy turns the fight was a damage race, so `VULN`, a
flat damage amplifier, dominated and `DELAY` — which delays an enemy that never acts — was exactly
inert. With the enemy restored, **how long a shield keeps an enemy alive (`SHPER`) and whether you
can get through it (`UN`) are the two constants that decide the game.**

`UN` at 28.8% matters for the element question: the off-element shred rate is now second-most
load-bearing, so **element matching is high-stakes** even though element composition is still
assigned by array index rather than by character.

### Worlds

```
world      speed   median   max    spread
hive        1.00     1.64   5.89    14.7x
bloom       1.00     1.81   5.70    14.2x
open        1.00     1.46   3.97     9.9x
fortress    1.00     1.97   4.34     9.2x
murk        0.72     1.07   2.87     7.2x
```

`hive` and `bloom` separate teams most; `murk` separates least and has the lowest ceiling, so it is
the leveller rather than the discriminator. *(An earlier version of this document claimed murk was
the only world that discriminated at the top. That was drawn from ten teams whose other worlds were
censored at the measurement ceiling, and it was wrong.)*

## 5 · The ceiling: eight of seventeen verbs exist on one character

*This census never runs a fight, so it is unaffected by the engine correction. What changed is its
significance: it was originally offered as the cause of a concentration problem that turned out to
be an artifact. It is not a fault — it is a limit on how many distinct chains can exist.*

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
