# Working vocabulary

Standard game-industry terms only. The point is that we can both read a table or a
message and know what it means without translating.

**These are working names, not player-facing ones.** The fiction layer — departments with
names like Ordnance and Assay, the worlds, the capstone bonuses — is a separate decision
recorded in `decisions.md`. Keeping them apart means the flavour can change without
touching a line of logic.

---

## Roles

What a character is for. Previously called departments or tags.

| Now | Was | What it does |
|---|---|---|
| **Tank** | Hull | Shields, taunts, thorns |
| **DoT** | Blight | Applies damage over time, then detonates it |
| **Speed** | Drive | Acts sooner, and pushes allies up the turn order |
| **DPS** | Ordnance | Raw damage |
| **Breaker** | Assay | Strips enemy armour so others hit harder |
| **Healer** | Crew | Healing, and a revive at the deep tier |

Two of a role is a splash, four changes a rule rather than a number.

## Character properties

| Now | Was | Meaning |
|---|---|---|
| `dmg` | `dmg` | Damage per hit |
| `speed` | `sp` | How often it acts. `sp` read as "skill points" |
| `hpMul` | `hpMul` | Health multiplier against the baseline |
| `aoe` | `aoe` | Hits every enemy |
| `appliesDot` | `apply` | Applies damage over time |
| `dotPerHit` | `stacks` | DoT stacks applied per hit |
| `dotSpread` | `spread` | DoT jumps to another enemy |
| `detonate` | `detonate` | Consumes DoT stacks for burst damage |
| `armorShred` | `shred` | Strips enemy armour |
| `marks` | `marks` | Marks a target, which other characters can proc off |
| `procOn` | `trig` | What makes this character act out of turn: `break`, `mark` or `ally` |
| `procDmg` | `ratio` | Damage of that proc, as a fraction of a normal hit |
| `procMax` | `react` | How many procs it gets per turn |
| `thorns` | `thorns` | Returns a share of damage taken |
| `taunt` | `taunt` | Draws enemy attacks |
| `shield` | `barrier` | Absorbs damage before health |
| `shieldOnHit` | `onHitBarrier` | Shields an ally when it attacks |
| `needsShield` | `needsGuard` | Fragile; wants a shield source |
| `heal` | `heal` | Restores health |
| `overheal` | `over` | Healing past full becomes a shield |
| `lifesteal` | `drain` | Heals for a share of damage dealt |
| `turnBoost` | `advance` | Moves an ally up the turn order |
| `energyGain` | `charge` | Gives an ally energy toward their ultimate |

## Enemy archetypes

| Now | Was | What it punishes |
|---|---|---|
| **swarm** | chaff | Nothing — the fight where your build just works |
| **bruiser** | bruiser | A mild tax on everyone |
| **armored** | warden | Direct damage; DoT walks straight past it |
| **cleanser** | cleanser | DoT builds |
| **reflector** | reflector | Cascades and chains |
| **buffer** | anchor | Slow clears |
| **guardian** | bulwark | Single-target burst |
| **fast** | quickstep | Teams that need setup turns |

Enemy properties: `armorLayers` (was `shl`), `dotTaken` (was `rot`), `buffAllyDmg` (was
`empower`), `protectAlly` (was `guard`), `multiHit` (was `volley`), `cleanse`, `thorns`.

`evasive` was removed — it sat on one archetype and nothing ever read it. That archetype's
"acts twice as often" comes from its speed, not from the flag.

## Combat constants

The five numbers the fight runs on. Sweepable via `setTuning()` in `synergy.js`.

| Now | Was | Meaning | Default |
|---|---|---|---|
| `ARMOR_PER_LAYER` | `SHPER` | Armour points in each layer | 14 |
| `OFF_ELEMENT_SHRED` | `UN` | Shred rate when the element does not match | 0.2 |
| `ARMOR_MITIGATION` | `SOAK` | Damage that gets through intact armour | 0.55 |
| `VULN_BONUS` | `VULN` | Extra damage taken once broken | 0.35 |
| `BREAK_DELAY` | `DELAY` | Share of a turn a break costs the enemy | 0.35 |

## Fight terms

| Term | Meaning |
|---|---|
| **break** | Armour is stripped to zero. The enemy is delayed, takes extra damage, and loses its next turn restoring armour |
| **vulnerable** | The state after a break |
| **DoT** | Damage over time. Was called ailments, rot, blight or fracture depending on the document |
| **proc** | An out-of-turn action triggered by something else. Was trigger, reaction or follow-up |
| **follow-up** | A proc that is a full extra attack, not a damage bonus |
| **breakpoint** | The difficulty a team still beats three fights in four. The score used everywhere |

## Two the rename did not settle

**Harmony.** Allies sharing the acting character's element attack after a break. It is a
follow-up whose condition is an element match, and it has never fired in any build — see
`discovery-findings.md`.

**Element.** Six of them — order, chaos, growth, decay, energy, void — in three opposed
pairs. They are not a damage type; an element says *how* a character acts, so a Speed role
with an order element is precise and rhythmic where a chaos one is erratic. Neither
simulation models them, which is the largest gap in the tooling.
