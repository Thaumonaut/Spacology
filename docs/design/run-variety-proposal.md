# Run variety: encounter formats and voyage modifiers

Status: design only, not implemented. The three-set route below is user-confirmed; encounter mechanics, reward contents and modifier details remain proposals. This document records the requested revision to the older run structure in the design record.

Requested direction: three sets of seven nodes. Set 1 follows Setup reward → Basic battle → Modifier selection → Basic battle → Elite battle → Reward → Boss battle. Sets 2 and 3 replace the opening reward with another basic battle; the initial reward exists to help establish the starting formation. Randomize encounter and reward types within a fair, recognizable formula. Difficulty increases after each boss before the next set; the third boss ends the voyage. Add a distinct boss format, mob swarms containing only small weak enemies and no elites, and other encounter variety within that structure. Modifier selection happens between battles. The encounter details and numbers below are starting proposals, not balance findings.

## What exists today

The playable prototype has six encounters, rather than the older design record's fourteen-leg voyage. `expedition-rules.js` names the route; `watchable-fight.html` builds each encounter from the same wave generator. “Major specimen” does not select a separate boss format. Later encounters increase field size, wave count, stats and elite frequency.

Three optional voyage modifiers exist: Reinforced specimens, Volatile atmosphere and Salvage contract. Players can add one before first launch and another at encounter four through Settings. They persist into future encounters. One removal is available from encounter three for 8 gold. These existing choice windows are a useful foundation, but the pool is small and the choices are buried in Settings.

Recovery currently counts defeated enemies across the complete enemy pool. A damaged survivor earns no points. That works for waves but would make an almost-cleared solo boss score zero.

## Give each format a different payoff

| Format | Encounter rule | What the player gets to watch |
| --- | --- | --- |
| Basic: Survey | Mixed regular-enemy waves; proposed to exclude elites so the dedicated elite node stays distinct | A balanced formation handling several threats |
| Basic: Swarm | Many small, weak enemies; no elites or bosses; very light guards | Area attacks, spreading conditions and kill chains clearing the field |
| Elite | A dangerous elite with regular escorts and one clear tactical problem | Focus and counterplay against a stronger enemy formation |
| Boss | One authored major specimen with readable phases and a signature action | Focused damage, breaks, protection and setup paying off against one important target |
| Containment | A finite assault against a research beacon; hold until extraction | Shields, healing and control preserving an objective |
| Interception | A marked carrier with escorts; recover it before its departure | Target priorities and concentrated damage solving an urgent problem |
| Reward | A setup reward at voyage start, then a noncombat reward choice before each boss | A chance to establish or improve the team before its next test |

Start with Survey and Swarm as basic-battle variants, plus distinct Elite and Boss formats. Containment and Interception are later candidates for basic-battle variety; they do not insert extra nodes into the confirmed route. Reward nodes should give an actual reward choice beyond the shopping already available in Ops.

For Interception, give the player a pre-battle focus order that the crew follows automatically. Do not require reactive tapping to make the objective achievable. For Containment, make the beacon an explicit objective target; enemies still cannot attack safe back-row crew.

## Swarms

Use a dedicated swarm roster of chaff variants. Merely disabling the elite flag would still allow durable regular wardens and bulwarks to dominate the encounter. Exclude protection loops and healing chains that turn the swarm into a wall.

Start with finite waves of six weak enemies, keeping the current maximum visible field size. Try three waves before increasing density. Smaller enemy cards and fast group entrances can convey scale without filling the tablet screen with unreadable targets. Health, guard and individual damage should be tuned so ordinary attacks finish weakened targets and area attacks produce visible multi-clears.

Keep kill effects, Aether and ultimate charge flowing across waves as they do today. Measure aggregate enemy damage: many weak attacks can still create more pressure than a normal fight. Do not combine a swarm with a modifier that turns its members into elites or durable enemies.

## Bosses

A boss needs an authored behavior, a forecast of its next major action, and a change in rhythm. Use existing hero specimens for eventual authored encounters, respecting their recorded cleansing problems. A generic prototype boss can prove the system before adapting a named hero.

First prototype: one large target with two phases. At 50% health, its shell opens: guard weakens and its next signature attack becomes stronger. Show this transition before launch and preview the attack in the timeline. A break can delay that attack; it should not require a particular character to answer. Damage and protection remain alternatives.

Do not clear accumulated conditions, reset health, or add blanket control immunity at the phase boundary. An unusually strong hit can cross the threshold or end the fight without forced invulnerability. Boss identity should survive through behavior and presentation, not repeated health bars.

Proposed recovery: 80% of the available score comes from health removed, using the lowest health reached so healing cannot generate repeated credit; the final 20% comes from completing containment. Thus leaving the boss at 1 HP still earns partial recovery, but securing the 88% no-loss band requires completion. Reuse the current recovery bands after normalizing this objective score. These weights need playtesting. If later bosses add helpers, helpers must not dilute or inflate the objective score through unlimited spawns.

## Run pacing — confirmed structure

The voyage consists of **three sets of seven nodes: 21 nodes total**.

**Set 1:** Setup reward → Basic battle → Modifier selection → Basic battle → Elite battle → Reward → Boss battle

**Sets 2 and 3:** Basic battle → Basic battle → Modifier selection → Basic battle → Elite battle → Reward → Boss battle

| Position in set | Set 1 | Set 2 | Set 3 |
| --- | --- | --- | --- |
| 1 | Setup reward (1) | Basic battle (8) | Basic battle (15) |
| 2 | Basic battle (2) | Basic battle (9) | Basic battle (16) |
| 3 | Modifier selection (3) | Modifier selection (10) | Modifier selection (17) |
| 4 | Basic battle (4) | Basic battle (11) | Basic battle (18) |
| 5 | Elite battle (5) | Elite battle (12) | Elite battle (19) |
| 6 | Reward (6) | Reward (13) | Reward (20) |
| 7 | Boss battle (7) | Boss battle (14) | Boss battle (21) |

That gives **14 battles** (8 basic, 3 elite, 3 boss), **4 reward nodes** (1 setup, 3 pre-boss), and **3 modifier selections**. The starting reward is unique: it helps assemble the initial team. Later sets begin by testing the crew already built. Reward and modifier nodes remain separate noncombat stops.

Battle-earned containers are opened in the Inbox between nodes; they do not occupy extra route slots or replace the guaranteed reward nodes. The [recovery inbox and equipment proposal](recovery-inbox-and-equipment-proposal.md) connects these drops to equipment choices and accounts for their value in the voyage economy.

Difficulty increases after boss 1 and boss 2, so each new set has a higher baseline. Boss 3 concludes the voyage. Within a set, basic, elite and boss encounters provide their own escalating challenge. Balance by set and encounter format, not by multiplying enemy stats on every global node advance; claiming a reward or choosing a modifier must not independently increase enemy strength. The first battle after a boss introduces the new baseline with a straightforward encounter.

Reveal each set's node types and boss before its first preparation opportunity, including the pre-boss reward type. Reward contents remain proposals. Rebalance total income and progression for fourteen battles plus four explicit reward nodes rather than copying the six-fight prototype payouts unchanged. The two additional battles replace rewards; they should not accidentally make later sets poorer simply because the old reward grant disappeared.

## Randomize the contents of fixed slots — proposed formula

Keep the seven slot roles fixed and roll the subtype inside each pool. This preserves one modifier selection, one elite, one pre-boss improvement and one boss per set. The player gets different situations while retaining the same preparation opportunities and broad challenge curve.

**Basic pool:** use Survey or Swarm for each set's first battle. In set 1, the other basic slot can be Survey, Swarm or an introductory objective encounter. In sets 2 and 3, draw at least one objective encounter across the other two basic slots. Do not repeat a basic subtype within a set for the initial generator. Guarantee at least one Swarm somewhere in the voyage, not necessarily in every set. Never promote enemies in the basic pool to elites.

| Basic subtype | Distinct task | Build payoff / fair baseline |
| --- | --- | --- |
| Survey | Recover a mixed regular-enemy formation | Straightforward test with several useful approaches |
| Swarm | Clear many individually weak enemies, with light guards and no elites | Area attacks, spreading conditions and kill chains; finite total population |
| Interception | Stop a carrier before its announced departure; escorts compete for attention | Focused damage and tempo; a pre-battle focus order is available to every crew |
| Containment | Protect a research beacon against a finite assault until extraction | Protection and control; the beacon has baseline durability so a rare healer is not mandatory |
| Salvage operation | Clear a normal encounter while optional salvage targets offer extra resources | Spare damage becomes bonus loot; ignoring salvage still earns the normal completion payout |
| Rescue | Clear captors to release a stranded specialist who helps for the remainder of the encounter | Target priority yields an immediate ally; the temporary specialist is not an unpriced permanent recruit |

Containment can finish early when every attacker is recovered; it need not force the player to wait out an empty timer. Avoid redundant escort and defense formats until they actually demand different preparation. New objectives need explicit completion, partial recovery and observation rules; the regular enemy-defeat denominator does not automatically fit them.

**Loot goblin bonus:** a compatible basic encounter can include an optional treasure carrier of any suitable species, dropping extra gold, rare loot and a Treasure cache with improved high-tier reward odds on defeat/death. Fleeing is the first proposed behavior, not a species requirement. It adds variety inside an existing node. Its escape does not reduce normal recovery or prevent mission completion; pursuing it costs actions that could serve the main objective. Keep opportunities bounded across voyages, preserve the no-elite Swarm rule, and preview the pursuit option before launch. See the [loot goblin and cache proposal](recovery-inbox-and-equipment-proposal.md#loot-goblins-and-treasure-caches) for proposed behavior and pools.

**Elite pool:** one encounter at position five, drawn from authored formations such as a leader empowering escorts, an armored guardian whose breaks create damage windows, or paired specialists whose abilities reinforce one another. Each presents one readable tactical problem. Tune each to the same set-specific challenge and payout band. An elite is a stronger tactical formation; a boss has bespoke staging, phases and a signature behavior.

**Reward pool:** one guaranteed useful improvement at position six. Randomize its presentation and choices, not whether it awards anything.

| Reward subtype | Reward choice | Fairness condition |
| --- | --- | --- |
| Supply cache | Crew, gear or currency | Always include a usable flexible option |
| Workshop | Improve owned gear, or choose an equivalent equipment grant | Works even when the player lacks eligible upgrade materials |
| Recruitment signal | Choose a crew member from a small offer | Include a currency alternative if roster space or composition makes recruitment unattractive |
| Research station | Improve a deployed crew member or take research currency | No mandatory rare duplicate or narrow tag requirement |
| Trading outpost | Spend a free voucher on a curated offer, with optional purchases afterward | Arriving with no gold still yields the guaranteed reward |
| Anomaly | Take a reliable improvement, or accept a clearly priced trade for a larger one | The baseline is safe; extra risk is opt-in and checked against existing modifiers |

Use a distinct reward subtype before each boss when the pool allows it. A repair-only stop is currently weak because crew health resets between encounters; recovery should not be invented just to justify a node. Do not make integrity restoration the sole benefit when the player is already at full integrity. Any such service needs an alternative of comparable usefulness.

**Boss pool:** one authored boss per set, with no repeat in a voyage. Choose from a set-appropriate pool and preview the relevant mechanics before the modifier decision. Preserve the hero catalogue's fixed identities and cleansing problems. Do not create variety solely by giving the same boss more health.

### Fairness rules for generated voyages

- **Same opportunities:** all routes retain the confirmed slot counts, a guaranteed setup reward and a useful improvement immediately before each boss. A noncombat subtype cannot silently replace a required fight or modifier selection.
- **Comparable challenge:** assign a measured challenge band to each set and slot, considering enemy action count, burst pressure, guards, deadlines and objective fragility. Similar total health does not imply similar difficulty. Keep completion time in a comparable range as well.
- **Comparable economy:** match baseline gold and progression for equivalent battle slots and bound the value of reward-node offers. Optional objectives add capped bonuses. Do not pay a swarm per kill or permit renewable spawns to generate unlimited gold, score or progression.
- **No repeated narrow tests:** reject routes that repeatedly demand the same specialist answer, especially across the final basic battle, elite and boss. Every mandatory encounter needs a broadly available completion path; optional mastery bonuses may favor particular builds.
- **No hidden escalation:** announce the next set's higher baseline. Preview node objectives, deadlines and expected rewards before preparation. Added modifier pressure must be checked against the whole remaining route, not just the next battle.
- **Stable randomness:** seed and persist the route and offers. Reloading does not redraw easier encounters or richer rewards. Filter incompatible combinations, then choose randomly among legal candidates; do not secretly scale enemies to punish a strong crew.
- **Measured validation:** compare representative area, focused-damage, condition and defensive formations over many seeds. Assess completion, partial recovery, time and earnings at equivalent team strength. These rules are constraints to test, not a claim that all generated routes are already equally difficult.

Example of one legal voyage once the objective formats exist:

| Set | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Setup reward | Survey | Modifier | Swarm | Leader elite | Workshop | Boss A |
| 2 | Swarm | Rescue | Modifier | Survey | Guardian elite | Recruitment signal | Boss B |
| 3 | Survey | Containment | Modifier | Interception | Paired elites | Supply cache | Boss C |

Start with Survey, Swarm and one objective format, plus a few reward subtypes. Widen the pools only when the formats produce genuinely different decisions and the reward values are understood.

One progression rule still needs agreement: whether partial boss recovery permits advancing to the next set, or boss completion is required. The proposed partial scoring above does not decide that gate.

## Three modifier selections

Each set has one dedicated selection at its third node: **global nodes 3, 10 and 17**. These replace the prototype's encounter-one and encounter-four Settings windows; there is no additional selection at voyage start or immediately after a boss.

**Set 1: choose a direction after the first test.** The player has already taken the opening reward and fought one basic battle. Offers should help develop that starting formation without requiring a rare crew member.

**Set 2: develop the team that emerged.** Use the actual crew, existing modifier and upcoming fights to offer meaningful improvements or a reachable pivot.

**Set 3: prepare the final version of the build.** Offer trades that remain useful over the final basic, elite and boss battles. Avoid economy benefits whose payback comes after the voyage ends.

Proposed selection behavior: offer three compatible trades, choose one or skip. At least two should have practical benefits for the current crew; a third can invite a reachable pivot. Show the remaining route alongside the offers. Apply the selected modifier only to future battles and purchases, after the preceding battle's rewards are settled.

Proposed persistence: modifiers accumulate for the rest of the voyage, allowing at most three selected modifiers before removals. Choosing none remains a valid baseline. Skipping closes that node; it does not bank an extra choice. Boss phase changes remain authored encounter behavior, separate from these choices. Stacking versus replacing modifiers is not yet user-confirmed.

Proposed removal: retain one guaranteed paid removal per voyage, available in Ops after the first selection, starting from the prototype's 8-gold price. Removing a modifier does not refund past costs or reopen its choice node. Recheck affordability against the new reward economy rather than making removal a random reward.

## A small pool with recognizable trades

These are candidate mechanics, not a commitment to ship every entry. Only the first three exist today. New values need testing against the current Aether and formation rules.

| Modifier | Benefit | Cost | When it makes sense |
| --- | --- | --- | --- |
| Reinforced specimens | +20% victory gold | Enemies have +25% health | An optional challenge for a team clearing comfortably; initially exclude from Swarm-containing routes because it works against that format's weak-enemy promise |
| Volatile atmosphere | Crew direct attacks deal +20% damage | Enemy direct attacks deal +20% damage | Faster clears with sufficient protection |
| Salvage contract | +6 gold per completed encounter | Supply packs cost +2 gold | A player planning to shop selectively |
| Deep reservoir | +2 shared Aether capacity | Start each encounter with 1 less Aether | Teams that can refill and turn a larger pool into a meaningful burst |
| Insulated hull | Stronger crew barriers | Reduced crew healing | A formation with accessible shielding; not offered as a useful match to a healing-only team |
| Concentrated fire | Stronger single-target direct attacks | Weaker area direct attacks | A focused team approaching a boss, with the remaining swarm clearly visible as the trade |

Concentrated fire should modify explicitly classified direct attacks, not silently rewrite damage-over-time, healing or every multi-hit ability. Exact percentages can wait until that classification is clear. Each card should show a concrete affected crew member or ability when available.

Start by testing Volatile atmosphere, Salvage contract and Deep reservoir. They touch different decisions: combat tempo, spending and Aether planning. Keep Reinforced specimens out of the first fixed route if the swarm must remain strictly weak. Insulated hull and Concentrated fire broaden the pool after compatibility checks exist.

Do not present three copies of “harder enemies, bigger reward.” At least one offer at each window should change how the crew works. Preview the combined result before selection: for example, current capacity and starting charge becoming the new capacity and starting charge.

## Compatibility and fairness

Check the full active stack, including the proposed third modifier, for compatibility. The existing category labels are insufficient: Volatile atmosphere is labelled “rule” but numerically increases damage. Check actual health, damage and speed pressure, not just labels. Keep at most one enemy-stat pressure modifier in the first version. The design record's category caps are a longer-term starting constraint, not proof that every combination is beatable.

Never let a modifier add elites to a Swarm, change a Boss into a generic wave fight, or invalidate the safe back row. For later shape modifiers, the selected node format takes precedence. Build-aware later-set offers should favor benefits the crew can use without always handing the strongest team its strongest multiplier.

Changing the offer pool must not become a reroll exploit: generate and save the offered choices once per window. Show benefits that are inactive because the crew lacks the relevant capability. Never silently add a modifier when the player skips.

## Scope of the first playable pass, after design agreement

1. Model three seven-node sets, distinguishing route position, set, node type and completed-battle count. Reward and modifier nodes do not launch battles. Migrate or restart old six-fight saves explicitly; do not reinterpret their encounter counter as a new node index.
2. Add structured Survey, no-elite Swarm, Elite and Boss definitions with objectives and partial boss scoring, then one objective encounter and the constrained subtype generator. Apply difficulty by set and format, with increases after the first two bosses.
3. Show node type, objective and rewards in Ops; give the boss distinct staging, a phase indicator and a forecast of its signature attack.
4. Implement the four reward nodes and three modifier selections at their confirmed positions, with persistent offers, exactly-once claiming, a combined-effect preview and removal access.
5. Validate swarm roster exclusions, boss threshold overkill, partial scoring, modifier stacking, save/reload consistency and exactly-once choice handling. A boss transition resolves once after the triggering action and its reactions, if the boss survives; a lethal hit can finish it immediately.
6. Verify the 21-node order, 14-battle count, both difficulty transitions and final-boss completion. Compare area, focused-damage and defensive teams across full runs. Check gold, progression and observation goals: objectives requiring several breaks may need format-specific equivalents. Test both skipping and taking modifiers.

Success means the same crew produces visibly different fights and preparation decisions across formats. Clear rates alone cannot establish that; watch complete runs as well as collecting combat outcomes.
