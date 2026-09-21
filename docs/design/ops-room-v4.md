# Ops room v4 — progressive disclosure proposal

Status: interaction and economy proposal for `mockups/ops-room-v4.html`. It keeps v3 available as the information-dense comparison. All prices, odds, rewards, and thresholds are tuning targets rather than canonical values.

## What changed

V4 preserves the same spatial model—status, shop, harmonies, crew, and inventory—but limits the default screen to information needed for the next decision.

| Always visible | One click away | Shown at commitment |
|---|---|---|
| Integrity, gold, run level, current capacity, phase | Exact difficulty and modifier rules | Launch readiness and unresolved pack choices |
| Pack theme, price, themed-draw chance, pack-level Prime chance | Full probability explanation | Actual card rarity after opening |
| Harmony icon, active count, near-threshold dot | Tier effects, contributors, cheapest next tier | Exact before/after change when moving a character |
| Crew names, rows, capacity, fieldwork-fit dots | Character kit, build delta, suggestions, salvage values | Sell/dismantle queue and resource return |
| Fieldwork name, short condition, reward | Full completion and partial-credit rules | Recovery report explanation |
| Inventory type, count, objective matches | Item details, best fit, filters | Equip and salvage preview |

This makes the main screen scannable without hiding information needed to make a deliberate choice.

## Run level and team capacity

Run level resets each voyage. Experience should come mainly from clearing encounters and completing observations. Capacity is one shared team limit across both rows, not a separate allowance for each row.

| Level | Total team | Maximum off field | System unlock |
|---:|---:|---:|---|
| 1 | 1 | 0 | One Call |
| 2 | 2 | 1 | Personal Gear |
| 3 | 3 | 2 | Second Call |
| 4 | 4 | 3 | Second ship Equipment slot; maximum team |

At least **one character must always be on field**. At level 4, every formation from four on field to one on field and three off field is legal. Moving a character between rows does not consume another team slot.

The two rows show placement targets rather than independent capacity pools. The persistent `Team 4 / 4` readout prevents players from reading empty placement targets as additional recruitment slots. The fourth off-field target is visibly unavailable because an all-off-field formation is illegal.

## Packs, pricing, and probability

An unopened pack must never announce the rarity it contains. It can communicate its strategic identity and honest probabilities:

- **Themed chance** is the probability that any non-salvage card supports the named mechanic or element pair.
- **Prime chance** is the chance that the pack contains at least one Prime card, not a promise about a particular card slot.
- A probability popover should explain pack-level versus per-card probability and show pity or protection rules if those systems are added.
- Exact rarity, build delta, Keep, and Strip appear only after the opening animation.

First economy target:

| Pack | Price | Themed chance | At least one Prime |
|---|---:|---:|---:|
| Rot & Bloom | 26 gold | 70% | 14% |
| Tempo & Follow-up | 28 gold | 65% | 16% |
| Order & Chaos | 30 gold | 55% | 20% |

A voyage starts with **70 gold**. Common encounter income should average 14–18 gold. This lets the player open two packs early, makes a third purchase a meaningful saving decision, and leaves enough price separation for premium breadth or higher Prime odds. Simulation must verify these targets against run length and reroll frequency.

## Sell and dismantle

Every owned character, Gear card, and Equipment card has two mutually exclusive salvage actions:

- **Sell** returns gold for immediate shop flexibility. A first target is 35–45% of the card's expected acquisition price.
- **Dismantle** returns Scrap for persistent sidegrade crafting. Element-specific material can be added later only if it creates distinct recipes; three currencies that serve the same purpose should be avoided.

The modal shows the exact return before either action. Both actions enter a pending queue and remain undoable until launch or departure. Locked, equipped, newly acquired, and favourite items are excluded from batch salvage by default. A newly acquired duplicate should offer Keep, Equip, Sell, and Dismantle in the same place.

Scrap should broaden choices rather than increase permanent stats. Example sinks include forging a known sidegrade, rerolling one Gear tag, or unlocking a catalogue-derived variant.

## Quality-of-life rules

- **Build delta everywhere:** candidates say “reaches Follow-up 3” or “opens Chaos 2,” with exact before/after values in detail.
- **Objective fit:** a quiet green dot marks crew and items that directly help the current observation. The detail explains why.
- **Smart filters:** completes a harmony, helps fieldwork, equippable now, duplicate, unassigned, and newly acquired.
- **Lock and favourite:** protected items never enter quick or batch salvage.
- **Undo queue:** all salvage remains reversible until launch. The top-level inventory Manage view lists pending actions.
- **Actionable launch check:** interrupt launch only for unresolved pack cards, an unused unlocked slot, incompatible placement, or an empty Call slot. Do not warn about valid strategic choices.
- **Remembered workspace:** inventory tab, sort, filters, pinned harmonies, and collapsed details persist between visits.
- **Pinning:** the player can replace the five visible harmony icons with the groups they are actively pursuing.
- **Duplicate handling:** duplicate cards stack visually and expose Promote, Sell extras, and Dismantle extras without opening each copy.
- **Drag preview:** while moving or equipping, changed harmony thresholds, position rules, capacity, and objective fit update before drop.
- **Input parity:** click, controller focus, and drag all reach the same commands. Dragging is a shortcut, never the only method.
- **Readable icon language:** every icon has a text label in its popover and accessible name. Icons reduce scanning cost only after the player can learn them.

## Intentional limits

The default screen does not show full character descriptions, all harmony prose, exact modifier text, or the entire observation condition. Those details remain one click away and keep their state when closed. The room should feel like a workbench with clear instruments, not a dashboard that tries to explain the entire game at once.
