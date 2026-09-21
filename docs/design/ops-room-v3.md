# Ops room v3 — working proposal

Status: interaction and balance proposal for the standalone `mockups/ops-room-v3.html` study. Values are first-pass tuning targets, not additions to the canonical design record yet.

## What the room is for

The ops room is where the player turns a destination into a plan. Everything on the screen should answer one of four questions:

1. What is happening to this voyage?
2. What is this crew trying to do?
3. What does the next observation require?
4. Which available card, character, gear item, equipment module, or Call changes that answer?

The room is one spatial workspace:

- **Top status bar:** integrity, gold, voyage difficulty, streak, phase, time until extraction, and run-wide modifiers.
- **Inline shop:** three consignments remain visible beside the most recently opened pack. Opening a pack does not replace the room.
- **Left harmony rail:** current team and element counts, current threshold, short effect, and contributors. Tap for exact tier rules.
- **Centre crew area:** one on-field row and one off-field row. Position icons show where each character keeps its unique rule.
- **Fieldwork brief:** selected world's observation objective, partial reward, equipped Calls, and launch.
- **Bottom inventory:** characters, personal gear, and expedition equipment. Selecting anything opens contextual detail without leaving the room.

## Interaction rules

- Every candidate card states its **build delta**: “completes Follow-up 3,” “adds Decay 5,” or “opens Ailment 2.” “Good fit” is too vague.
- Character detail names its harmony contributions and previews which thresholds change if moved on or off the field.
- Character detail recommends gear because of a specific kit interaction, and equipment because of the current fieldwork plan.
- Harmony detail lists exact rules, contributing characters, and the cheapest reachable next tier.
- Keep and Strip remain explicit actions. Pack contents remain visible until all cards are resolved.
- Moving a character to the wrong row is allowed, but the lost positioning rule appears on the card before launch.
- Any destructive or expensive action supports undo until launch.

## Content vocabulary

The current documents use **fitting** for a character-scale modifier. If the interface keeps both Gear and Equipment, they need distinct jobs:

- **Gear:** attached to one character; modifies a verb already in that character's kit. One slot per character.
- **Equipment:** installed on the vessel; changes the whole expedition, a fieldwork rule, or a shared resource. Two active slots.

If ship-wide equipment is not built, collapse both labels back into **Fittings**. Two labels for the same item class would make the inventory harder to learn.

## Team harmonies — first-pass values

Team harmonies describe *how abilities interact*. Their short 2/3/4 curves make hybrid crews viable. Tier 2 establishes the loop, tier 3 rewards commitment, and tier 4 changes a rule.

| Harmony | 2 characters | 3 characters | 4 characters |
|---|---|---|---|
| **Follow-up** | Follow-up hits deal bonus damage equal to **20% Attack**, once per source action. | Bonus becomes **35%**. Consecutive follow-ups generate **5 Focus**, up to 15 per round. | Bonus becomes **50%**. After the third follow-up before an enemy acts, advance the lowest-AV ally by **15**. |
| **Break** | Guard damage **+25%**. | Broken enemies take **+15% damage**. | **Dissection:** a broken enemy loses its next **two turns** before reforming. |
| **Barrier** | Barriers are **30% larger**. | **15%** of absorbed damage is stored as Retaliation. | **Ammunition:** when a barrier expires or breaks, return stored Retaliation to the attacker. |
| **Ailment** | Applications add **+1 stack**. | Tick and detonation damage **+30%**. | Detonating preserves **35%** of consumed stacks and spreads them to one adjacent specimen. |
| **Sustain** | Healing **+30%**. | **35%** of overhealing becomes barrier. | **Relief:** once per combat, prevent the first crew member from going Down and restore **25% HP**. |
| **Tempo** | Crew begin combat **8 AV** ahead. | Break or kill advances the next ally by **8 AV**. | **Relay:** after five crew actions without an enemy action, the next ally acts immediately; once per round. |

The numbers deliberately keep tier 2 useful and tier 4 qualitative. A flat “damage +60%” can be a temporary prototype value, but it should eventually become behavior the player can see happen.

## Element harmonies — first-pass values

Elements describe *how a character acts*. Their 2/4/6 curves create a real choice between broad weakness coverage and deep elemental commitment.

| Element | 2 characters | 4 characters | 6 characters |
|---|---|---|---|
| **Order** | First Order action each round uses **Fixed** variance and gains 10% power. | Every third Order action repeats its non-damage effect at **50%** strength. | Completing an exact three-character Order sequence locks the next enemy action; once per round. |
| **Chaos** | Chaos actions alternate between **85% and 125%** power; the next result is shown. | High results become **150%**; low results grant **15 Focus**. | First high result each round repeats at **60%** power, then delays that character by 10 AV. |
| **Growth** | Growth healing and barriers gain **10%** each round, up to 30%. | After the third Growth action each round, restore **8% max HP** to the lowest ally. | **Regrowth:** once per combat, the first Growth member to go Down returns at 30% HP after three allied actions. |
| **Void** | First direct hit against each Void member is reduced by **50%**. | The first enemy buff or charge each round is erased. | After six allied actions, remove the next enemy action from the turn track; once per round. |
| **Decay** | For the first two rounds, Decay members deal **20% more damage**. | For the first three rounds, bonus becomes **35%**; hits reduce maximum HP by 2%, up to 10%. | Bonus becomes **50%**. **Collapse:** the first target pushed below 25% HP loses its next turn and detonates its Decay stacks. |
| **Energy** | Energy members begin with **20 extra energy**. | Using an ultimate advances the next ally by **10 AV**. | First ultimate each round costs 20 less energy and splashes **25%** of its result to adjacent targets. |

These need simulation. The UI should expose the behavior first; exact values can move without changing the information architecture.

## Fieldwork

Every destination offers one optional observation tied to its creatures or conditions. The objective changes how the player prepares for and watches the fight.

Examples:

- Observe a Quickstep taking two consecutive actions.
- Break a Warden with two different elements.
- Keep an Anchor active until its scan completes.
- Spread an ailment across three specimens before detonating it.
- Recover a specimen without any crew member going Down.

Progress is granular:

| Result | Voyage reward | Persistent catalogue |
|---|---|---|
| Attempted | No Fidelity; normal combat payout remains. | Pencil sketch and the failed condition. |
| Partial | **+1 Fidelity** and 25% of the observation payout. | Partial behavior note and visible missing step. |
| Complete | **+3–5 Fidelity**, scaled by danger. | Illustrated entry, creature behavior, and the crew used. |
| Mastered | Complete the observation under an optional constraint. No extra run power. | Mastery mark, crew remark, and personal record. |

The recovery report must say why progress stopped: “Quickstep acted twice, but the second action occurred after its scan target went Down.” That makes a miss useful information.

## Voyage shape

Fourteen legs become three phases without adding a node map:

| Phase | Legs | Purpose |
|---|---:|---|
| **Survey** | 1–4 | Learn the world's ordinary specimens and establish a build. |
| **Containment** | 5–9 | First major specimen, paired conditions, and objectives that require timing. |
| **Extraction** | 10–14 | Second major specimen, visible plague pressure, and a final extraction encounter. |

Major specimens test rules the player has already observed. The final encounter combines one learned behavior from each earlier phase and makes the plague's arrival mechanically visible.

## Calls

Load two Calls in the fieldwork brief. Each can be used once per fight:

- **Focus:** mark a target; the crew prioritises it until it goes Down or the Call is cancelled.
- **Hold:** delay the next allied action by 20 AV, preserving its charge and target evaluation.
- **Fire:** immediately release the selected charged ultimate, interrupting the turn order.

Calls should solve timing and priority problems. They should not become a second ability bar or require reflexes.

## Memory and persistence

The catalogue is the persistent reason to begin another voyage. It broadens possibilities without permanent stat gains:

- incomplete specimen observations;
- illustrated world and condition entries;
- character, gear, and equipment sidegrades;
- relationship incidents unlocked by actual pairings;
- named combination cards discovered during play;
- personal records and observation mastery marks.

Crew writing surfaces in small reactive moments: a pair-specific line when fielded, a characteristic reaction when someone goes Down, and one exchange on the recovery report when a combination decides the result.

## Sound as feedback

Sound communicates the chain:

- each consecutive action rises one pitch step;
- a break resolves the ladder with a low impact;
- a follow-up adds a short answering note;
- an observation milestone uses a distinct two-note scan motif;
- spending a Call cuts the current sound bed before the intervention lands.

This is functional feedback first and atmosphere second. If the player can hear that a chain is still alive, the visual effects can remain restrained.

