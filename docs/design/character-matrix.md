# Character matrix

Four axes. Element is *when* a unit is strong, Shape is *how many* it reaches, Trigger is *when it fires*, Payload is *what it does*.

**1192 valid combinations** of 2,100. **18 filled** — 1.5%.

In the tables below: **bold number** = units occupying that pair · ✓ = valid and empty · · = structurally impossible.


## Element × Payload

| Element \ Payload | Damage | Break | Debuff | Control | Heal | Shield | Buff | Summon | Taunt | Drain |
|---|---|---|---|---|---|---|---|---|---|---|
| Order | **1** | ✓ | ✓ | ✓ | ✓ | **2** | ✓ | ✓ | **1** | ✓ |
| Growth | **1** | ✓ | **1** | ✓ | **1** | · | ✓ | ✓ | ✓ | ✓ |
| Decay | ✓ | ✓ | ✓ | **1** | **1** | ✓ | ✓ | ✓ | ✓ | ✓ |
| Energy | **2** | **1** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chaos | **2** | ✓ | **1** | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ |
| Void | **1** | ✓ | ✓ | **2** | · | ✓ | · | ✓ | ✓ | ✓ |

## Shape × Payload

| Shape \ Payload | Damage | Break | Debuff | Control | Heal | Shield | Buff | Summon | Taunt | Drain |
|---|---|---|---|---|---|---|---|---|---|---|
| Single | **7** | **1** | **1** | **2** | **1** | ✓ | ✓ | · | · | ✓ |
| Cleave | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ |
| AoE | ✓ | ✓ | **1** | **1** | **1** | **1** | ✓ | · | · | · |
| Chain | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ |
| Pierce | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ |
| Random | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · |
| Self | ✓ | ✓ | ✓ | ✓ | ✓ | **1** | ✓ | ✓ | **1** | ✓ |

## Trigger × Payload

| Trigger \ Payload | Damage | Break | Debuff | Control | Heal | Shield | Buff | Summon | Taunt | Drain |
|---|---|---|---|---|---|---|---|---|---|---|
| Cadence | **5** | **1** | **1** | **2** | **2** | **2** | ✓ | ✓ | **1** | ✓ |
| Follow-up | **2** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ |
| Counter | ✓ | ✓ | **1** | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ |
| Interrupt | ✓ | ✓ | ✓ | **1** | · | ✓ | · | ✓ | ✓ | ✓ |
| Standing | · | · | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · |

## Element × Shape — every cell valid, and this is where the variety lives

| Element \ Shape | Single | Cleave | AoE | Chain | Pierce | Random | Self |
|---|---|---|---|---|---|---|---|
| Order | **1** | ✓ | **1** | ✓ | ✓ | ✓ | **2** |
| Growth | **1** | ✓ | **2** | ✓ | ✓ | ✓ | ✓ |
| Decay | **2** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Energy | **3** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chaos | **3** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Void | **2** | ✓ | **1** | ✓ | ✓ | ✓ | ✓ |

## Element × Trigger

| Element \ Trigger | Cadence | Follow-up | Counter | Interrupt | Standing |
|---|---|---|---|---|---|
| Order | **4** | ✓ | ✓ | ✓ | ✓ |
| Growth | **3** | ✓ | ✓ | ✓ | ✓ |
| Decay | **2** | ✓ | ✓ | ✓ | ✓ |
| Energy | **2** | **1** | ✓ | ✓ | ✓ |
| Chaos | **1** | **1** | **1** | ✓ | ✓ |
| Void | **2** | ✓ | ✓ | **1** | ✓ |

## The current eighteen

| Unit | Element | Shape | Trigger | Payload |
|---|---|---|---|---|
| Ricochet | Chaos | Single | Follow-up | Damage |
| Cinder | Chaos | Single | Cadence | Damage |
| Backlash | Chaos | Single | Counter | Debuff |
| Rime | Decay | Single | Cadence | Control |
| Salve | Decay | Single | Cadence | Heal |
| Piledriver | Energy | Single | Cadence | Break |
| Piston | Energy | Single | Cadence | Damage |
| Arclight | Energy | Single | Follow-up | Damage |
| Grist | Growth | Single | Cadence | Damage |
| Trellis | Growth | AoE | Cadence | Debuff |
| Bloom | Growth | AoE | Cadence | Heal |
| Plumb | Order | Single | Cadence | Damage |
| Lattice | Order | Self | Cadence | Shield |
| Gantry | Order | AoE | Cadence | Shield |
| Cairnstone | Order | Self | Cadence | Taunt |
| Hush | Void | Single | Interrupt | Control |
| Wisp | Void | AoE | Cadence | Control |
| Toll | Void | Single | Cadence | Damage |

## A note on Self

A Self shape does not mean "targets nobody". It means the payload is turned **inward and paid as a
cost** to fuel something else. Every payload can be inverted this way:

| Self + | Reads as |
|---|---|
| Damage | wounds itself to build a resource — the Destruction pattern |
| Break | **shatters its own guard for a spike, then stands defenceless** |
| Debuff | weakens itself in exchange for power |
| Control | delays itself deliberately, hitting harder for the wait |
| Drain | spends a team resource rather than stealing one |
| Buff / Heal / Summon / Taunt | ordinary self-directed support |

Only Shield is blocked, and only for Chaos and Growth, where an unpredictable or late-arriving
shield fails at the one job a shield has.

**Self-break has a prerequisite: allies must carry guard.** Today only enemies do. Giving crew a
guard bar resolves several things at once — enemies can break *you*, a broken unit skips its action
and takes amplified damage, shields and Order gain a clearer job restoring guard rather than only
absorbing health, and self-break becomes a genuine trade. It also closes part of the enemy/player
asymmetry flagged as the largest gap in the design.

**The self-harm archetype**, sketched: break your own guard to deal double, triple, or a percentage
of the target's maximum health — and skip your next action, standing broken and exposed while the
enemy takes its turn. It reads clearly on the turn ribbon, because your skipped turn is visible
before it happens. Supports who restore guard or advance you up the track become its natural
partners, which gives the archetype a team around it rather than being a solo trick.



## Where the roster clusters

- **Element:** Order 4 · Growth 3 · Decay 2 · Energy 3 · Chaos 3 · Void 3
- **Shape:** **Single 12** · *Cleave 0* · AoE 4 · *Chain 0* · *Pierce 0* · *Random 0* · Self 2
- **Trigger:** **Cadence 14** · Follow-up 2 · Counter 1 · Interrupt 1 · *Standing 0*
- **Payload:** **Damage 7** · Break 1 · Debuff 2 · Control 3 · Heal 2 · Shield 2 · *Buff 0* · *Summon 0* · Taunt 1 · *Drain 0*
## Twelve empty cells worth filling

Chosen to cover the four unused Shapes, the unused Triggers, and the three unused Payloads. Each is a valid combination with nobody in it.

| Element | Shape | Trigger | Payload | What it would be |
|---|---|---|---|---|
| Chaos | Random | Cadence | Damage | scattered hits of wildly uneven size — secretly the best swarm clear you own |
| Order | Chain | Cadence | Damage | bounces predictably between enemies, growing every turn |
| Growth | Pierce | Cadence | Damage | nothing for ten turns, then reaches the enemy back rank and deletes it |
| Energy | Cleave | Cadence | Break | spiky guard damage that spills onto neighbours |
| Void | Self | Cadence | Summon | spends its turns adding bodies that suppress rather than attack |
| Decay | Single | Cadence | Drain | siphons one target dry and heals off every point taken |
| Order | Single | Standing | Buff | a flat, permanent multiplier on one ally — the reliable support |
| Growth | AoE | Standing | Buff | a team buff that compounds every turn it survives |
| Chaos | Single | Counter | Damage | hits back, sometimes for nothing, occasionally for everything |
| Energy | Single | Interrupt | Break | shatters guard the moment something starts charging |
| Decay | Cleave | Follow-up | Debuff | on any break, weakens the target and its neighbours, healing from it |
| Void | Chain | Cadence | Control | a delay that propagates — the whole enemy line stalls |
| Chaos | Self | Cadence | Damage | wounds itself every turn to fuel an escalating payoff — the Destruction pattern |
| Order | Self | Cadence | Debuff | weakens itself by a fixed step each turn in exchange for a fixed step of power |
| Void | Self | Cadence | Control | delays itself deliberately, hitting harder the longer the gap — the wind-up unit |
| Growth | Self | Standing | Buff | permanently strengthens itself while it lives, and does nothing else |
| Energy | Self | Cadence | Break | shatters its own guard for an enormous spike, then stands defenceless |
| Chaos | Self | Follow-up | Break | on any enemy break, breaks itself too — chained risk for chained reward |
| Decay | Self | Cadence | Drain | burns the team skill pool for damage, and heals off what it deals |