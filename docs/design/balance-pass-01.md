# Balance pass 01 · four-character prototype

Status: measurement only. These are calibration results, not final game values.

The current UI prototype and the existing simulator are out of sync. The prototype rule is **four total characters**, with at least one on field. The authored simulator mostly evaluates five or six character teams, and its element axis is still assigned by array position. No harmony is modelled in the simulator. Results below are useful for identifying scale and failure modes, but they do not validate the final game.

## Existing full-voyage smoke run

The existing voyage harness ran 40 scripted voyages using the older larger-team rules.

| Measure | Result |
|---|---:|
| Voyages completed | 24 / 40 |
| Voyages lost | 16 / 40 |
| Average legs reached | 11.7 |
| Average rounds per fight | 5.5 |
| Packs/crates opened | 4.3 per voyage |
| Gold earned | 534 per voyage |
| Gold spent | 121 per voyage |
| Median final integrity | 17% |
| Final integrity range | 0–100% |

Outcome bands were 43% perfect, 3% slight shortfall, 10% small loss, 12% mild loss, 11% heavy loss, and 20% crushing loss. That is too swingy for a first playable match: the player is often either perfect or nearly dead.

The economy signal is more useful. With a starting purse near 70 gold and average pack costs near 28–30 gold, the scripted run can afford roughly four packs while still having room for field upgrades. The 54–72 gold pack prices shown in the current full-flow mockup are too high for the opening shop; the 26–30 gold range in the Ops study is closer to the measured economy.

## Four-character combat sweep

I ran 500 seeds per row against a 12-enemy encounter with four simultaneous enemy slots. The plain four-character build used 14 base damage per character. At the first calibration point (`hpBase 51`, `dmgBase 10`), the plain build won 78.2% of fights, timed out 21.8%, and wiped 0%.

| Build shape | Win | Wipe | Timeout | Rounds | Interpretation |
|---|---:|---:|---:|---:|---|
| Plain four | 78% | 0% | 22% | 17.8 | Useful baseline, but fights are too long |
| One Assay/AoE breaker | 100% | 0% | 0% | 15.0 | Break access is already too efficient |
| Two ailment appliers | 100% | 0% | 0% | 9.4 | Ailment damage is massively over budget |
| One follow-up reactor | 100% | 0% | 0% | 14.6 | Follow-up needs a smaller multiplier or cap |
| Ailment + follow-up hybrid | 100% | 0% | 0% | 8.3 | Multiple systems compound too hard |

Increasing enemy damage by 50% produced a more useful spread: plain 11% wins / 6% wipes / 83% timeouts, Assay 94% / 0% / 6%, follow-up 89% / 2% / 9%, and a detonator build 76% / 15% / 9%. That suggests the encounter can produce meaningful separation, but only after reducing the synergy coefficients and giving the player a real failure mode.

## Values to use for the next calibration build

These are the starting values I would use before changing the UI again:

| System | Starting value |
|---|---:|
| Characters allowed | 4 total |
| Minimum on field | 1 |
| First field capacity | 2 |
| First match encounter | 4 enemy slots, 8–12 total enemies |
| Baseline character damage | 14 |
| Baseline character HP | 110 |
| Baseline encounter health | 51 per normal enemy |
| Baseline encounter damage | 10 per normal enemy hit |
| Pack price | 26–30 gold |
| Starting gold | 70 gold |
| Target baseline win rate | 65–80% |
| Target fight length | 8–14 rounds |
| Target wipe rate | 5–15% |

The next balance task is coefficient tuning, not encounter inflation. A single harmony breakpoint should make a build about 10–20% more effective, not turn a 78% baseline into a guaranteed clear. Ailment ticks, follow-up cascades, and break amplification need to be measured separately before they are allowed to stack.

## What is still invalidated

- The existing simulator does not measure real character elements.
- It does not measure harmonies.
- The older voyage harness uses larger teams than the current four-character rule.
- The current Ops and combat mockups still display 8/12 field capacity in places; those labels should wait for the four-character calibration pass.

The prototype is ready for a numbers-driven combat pass, but it is not ready for final prices, harmony rewards, or difficulty labels yet.

## Match scaling proposal

Difficulty should rise on a predictable voyage curve. The player needs to feel that every upgrade is preparation for a harder next fight, rather than an action that causes the next encounter to scale up and erase its value. Team size and gear describe the power the curve expects; they should not reduce the curve itself.

Use a twelve-fight voyage divided into three acts:

| Fight | Enemy scalar | Encounter job |
|---:|---:|---|
| 1 | 0.70 | Teach the basic target and break loop |
| 2 | 0.78 | Introduce a second enemy behaviour |
| 3 | 0.86 | First observation test |
| 4 | 0.95 | Act I specimen |
| 5 | 1.03 | Add a third character slot |
| 6 | 1.11 | Counter the player's strongest early tag |
| 7 | 1.19 | Act II specimen |
| 8 | 1.28 | Require a complete two-part chain |
| 9 | 1.36 | Add the fourth character slot |
| 10 | 1.44 | Elite behaviour or mixed counter |
| 11 | 1.52 | Final preparation fight |
| 12 | 1.60 | Culminating specimen / extraction |

The player should gain capacity and build power at the same time: begin at 2 characters, reach 3 after the first act, and reach 4 before the final act. Gear merges and pack rewards should add roughly 10–15% effective power per act. This lets the enemy scalar rise without making the final fight a pure stat check.

Composition should escalate by act:

- Act I: swarm, bruiser, and one readable weakness.
- Act II: skirmisher, cleanser, reflector, or a specimen that disrupts the first plan.
- Act III: layered armour, buffer, splitter, and one rule-changing specimen.

The four-character simulator sweep currently collapses at the extremes: the plain build falls from 98% wins in the early band to almost all timeouts in the pressure band, while the untrimmed ailment and detonator builds remain at 100%. That is evidence that coefficients need calibration before this curve can be accepted. The progression shape is useful; the current combat magnitudes are not.

## Linear enemy pressure and investment modifiers

Team level should improve the player's options without changing the voyage's enemy curve. The encounter director can use the deployed slot count to choose a formation and avoid generating an impossible number of simultaneous targets, but it should not lower the enemy scalar when the player brings fewer characters.

`character slots = 4 + floor(team level / 2)`

| Team level | Slots | Base threat budget |
|---:|---:|---:|
| 0–1 | 4 | 400 |
| 2–3 | 5 | 500 |
| 4–5 | 6 | 600 |
| 6–7 | 7 | 700 |
| 8 | 8 | 800 |

This gives the player a meaningful capacity increase without adding a new character every round. It also gives the economy time to provide duplicates, gear, and a reason to revisit formation. One slot per level would make roster growth too dominant: a player could gain four extra bodies before the enemy design has room to introduce new behaviours.

Use a fixed base budget multiplied by the fight's linear scalar:

`encounter threat = base threat × fight scalar × (1 + starting strategies × 0.12 + mid-match strategies × 0.12)`

For example, with a 500-threat base, Fight 1 is 350 threat, Fight 6 is 555, and Fight 12 is 800 before strategies. One strategy raises each value by 12%; two strategies raise it by 24%. This makes the cost of an investment visible and keeps the decision meaningful: the player accepts a harder future fight in exchange for a stronger economy, reward, or rule benefit.

The budget should be spent across enemy bodies and behaviours. A swarm can cost 40 threat, a bruiser 100, a specialist 120, an elite 180, and a major specimen 300–400. This lets a modifier add a cleanser, reflector, or short-clock rule instead of only adding health. The player should be able to inspect the resulting threat breakdown before committing.

Roster power and equipment should affect the recommended build and available counterplay, not secretly lower enemy stats. If the player refuses to upgrade, later fights should become slower, less reliable, and eventually unwinnable. If the player upgrades well, the same fixed curve should become manageable without becoming trivial.

## Alternating upgrade track

The level track can alternate between crew capacity and ship identity:

| Team level | Character slots | Ship equipment slots | Upgrade |
|---:|---:|---:|---|
| 1 | 4 | 1 | Starting loadout |
| 2 | 5 | 1 | Add a character slot |
| 3 | 5 | 2 | Add a ship equipment slot |
| 4 | 6 | 2 | Add a character slot |
| 5 | 6 | 3 | Add a ship equipment slot |
| 6 | 7 | 3 | Add a character slot |
| 7 | 7 | 4 | Add a ship equipment slot |
| 8 | 8 | 4 | Add a character slot |

I would start with one ship slot rather than zero. It gives the ship screen a purpose from the first voyage and teaches that ship items affect the whole expedition. The first starting item can be deliberately modest, such as a Survey Prism that improves observation progress without changing combat power.

This also gives each level a visible reward while keeping the two growth axes from competing on the same upgrade. Even levels expand formation; odd levels expand preparation. Modifiers can then alter the threat budget and encounter rules without consuming the player's permanent progression rewards.
