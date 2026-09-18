# Universal terms

The shared vocabulary. Every player learns this list once and it never changes.
Anything not on this list is archetype or character vocabulary and lives elsewhere.

---

## The three tiers

**Universal** — produced by more than one archetype. Must be learned to play at all.
Break, Weakness, Shield, Vulnerable, Charge, Ultimate, Advance, Delay.

**Archetype** — shared by a build family, learned when you draft into it.
Fracture (Swell), Survey (Ledger), Stored (Bulwark), Harmony.

**Character** — one unit only. Flavour names for a specific ability.
Full Survey, Deadweight, Slack Water, Recoil.

**The promotion rule:** a term is only Universal if **two or more characters can
produce it**. If exactly one character makes it, it is a character term wearing a
universal costume, and it belongs on that character's card. This is the single rule
that keeps the glossary from doubling every time a unit is added.

**The demotion rule:** if an archetype term ends up on three or more characters
across two archetypes, promote it. Don't invent a second word for the same thing.

---

## Naming conventions

| Kind | Form | Examples |
|---|---|---|
| Something you do | verb | Break, Shred, Survey, Advance, Delay |
| A state a unit is in | adjective or past participle | Broken, Vulnerable, Surveyed, Recovering |
| A thing that accumulates | countable noun | Fracture, Charge, Survey (stacks) |
| A number on the board | plain noun | Speed, Layers, Charge |

Three hard rules:

1. **One concept, one word.** Never "break" in a tag and "shield broken" in a log.
2. **One word, one concept.** If a word is both a verb and a stack name, split it.
3. **Never name a thing after its number.** "−2 rounds" is a consequence, not a term.

---

## The dictionary

### Combat state

**Speed** — how often a unit acts. Higher goes more often. The only stat that
touches turn order.

**Action Value** — the number beside each name in the turn column. Counts down to
zero; zero acts now. Lower is sooner.

**Advance** — reduce a unit's Action Value, moving it earlier in the order.
*On screen:* its token slides up the column, ribbon card lifts.

**Delay** — increase a unit's Action Value, moving it later.
*On screen:* its token slides down the column and flashes.

### Defence

**Layer** — one ring of shield around an enemy. Drawn as a ring outside the card.
An enemy has one to three.

**Shield** — the pool inside the current Layer. Drawn as the thin bar under health.

**Weakness** — the elements an enemy is soft to. Two per enemy, drawn as letter
pips on its card. Bright if someone on your crew has that element, dim if nobody does.

**Soak** — damage is cut to **40%** while any Layer is intact. This is why hits look
small before a Break.
*Currently invisible. Needs a tag.*

**Shred** — remove Shield. A Weakness hit shreds at full rate; anything else at 20%.

**Break** — the last Layer is gone.
*Effects:* the enemy is **Delayed**, becomes **Vulnerable**, and loses its next turn.

**Broken** — the state after a Break. Soak is off, so damage lands in full.

**Reform** — a Broken enemy spends its next turn restoring every Layer instead of
acting. Break duration is measured in turn order, not rounds, so Delay lengthens it.

**Vulnerable** — takes **+35%** damage. Applied by Break, cleared by Reform.

### Offence

**Charge** — energy toward an Ultimate. Gained by acting, by each enemy hit, and by
taking damage. AoE units charge faster because they hit more.
*On screen:* thin gold bar under the crew card; the card outlines in gold at full.

**Ultimate** — spends all Charge. Fires before the unit's normal action, takes the
full stage, and is the only action that stages every target.

**Follow-up** — an **extra attack outside the turn order**, fired by one unit in
response to something another unit did. Not a damage bonus — a whole extra action
with its own damage number.

**Harmony** — allies sharing the acting unit's element strike immediately after a
Break. A Follow-up whose trigger is Break and whose condition is element.

**Drain** — the attacker restores a share of the damage it dealt.

**Reflect** — a defender returns a multiple of damage taken to its attacker.

### Consequences

**Down** — reduced to zero health. A crew death costs **2 rounds** off the limit and
leaves that unit **Recovering**.

**Recovering** — returns next fight at 65% damage.

**Round limit** — the number after the slash in the header. Reach it and the fight is
lost. It shrinks when crew go Down.

---

## Archetype terms

Kept separate on purpose. A player only learns these when they draft the archetype.

**Fracture** *(Swell)* — a stack on an enemy. Each adds **+12%** damage taken, to a
maximum of six. Applied by AoE units, spent by the finisher.

**Survey** *(The Ledger)* — a stack on an enemy that lets Follow-ups trigger against
it. Applied three at a time, one spent per Follow-up.

**Stored** *(Bulwark)* — damage a unit has absorbed, converted by its Ultimate into a
board-wide return.

---

## Audit of the current build

Problems found by reading every string the prototype puts on screen.

| Issue | Where | Fix |
|---|---|---|
| Three names for one system | `break`, `shield broken`, `shield reforms` | Use **Break** and **Reform** only |
| Two names for shield damage | `shred`, `shield −2` | Use **Shred**, with the count |
| Generic word for a specific stack | `stacks spent` | **Fractures spent** |
| Soak never named | nowhere | Add a **soaked** tag on any hit against an intact Layer |
| Advance has no tag | log only | Add an **advance** tag on the moved unit |
| Charge has no label | bare gold bar | Label it, or show a **charged** tag at full |
| Flavour text posing as a term | `just in time` | Keep, but as flavour — never define it |
| Character name in a mechanical slot | `second swing` | It is a **Follow-up**; put "second swing" on Bosk's card |

## Words deliberately not used

**Null** — reserved for the cosmic plague. Never a mechanic, never a damage type,
never an element. The original design had Void as an element *and* Null as a
reaction *and* Null as the antagonist; only the antagonist keeps the name.

**Stagger, Toughness, Weakness Break** — HSR's words for adjacent ideas. Avoid, or
the game reads as a reskin rather than its own thing.

**Buff, Debuff** — fine in design conversation, never on screen. Name the specific
effect instead.
