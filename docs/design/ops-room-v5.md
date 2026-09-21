# Ops room v5 — shared field capacity and pack-resolution flow

Status: interaction proposal for `mockups/ops-room-v5.html`. All prices, odds, level costs, pack composition, and crafting requirements are first-pass tuning targets.

## Screen structure

The room keeps six stable regions:

1. The top bar combines voyage resources with a compact map of completed, current, and upcoming nodes in the round.
2. The supply area alternates between sealed-pack selection and one opened-pack resolution tray.
3. The left rail shows harmony icon, name, and breakpoints only.
4. The centre shows all possible on-field and off-field placement targets with one shared capacity control between them.
5. The right rail holds ship equipment.
6. Inventory occupies the lower left and centre. Next-node settings and Continue remain fixed at bottom right.

## Shared character capacity

All placement targets remain visible. Field level controls how many may be occupied across both rows.

- `4 / 4` means four characters are deployed out of a shared limit of four. It does not mean four per row.
- Characters may use either row in any combination.
- At least one character must remain on field.
- Attempting to place another character at capacity should animate the central capacity control and offer the field upgrade if affordable.
- Moving a deployed character between rows never consumes capacity.

First level curve:

| Field level | Shared capacity | Upgrade cost |
|---:|---:|---:|
| 2 | 2 | 8 gold |
| 3 | 3 | 12 gold |
| 4 | 4 | 18 gold |
| 5 | 5 | 26 gold |
| 6 | 6 | 38 gold |
| 7 | 7 | 54 gold |
| 8 | 8 | Maximum |

Starting a normal voyage at field level 2 preserves early harmony decisions without reducing the first fight to a single character. Higher difficulties can change starting level or prices.

## Harmony rail

Each row shows only an icon, name, and breakpoint sequence such as `2 | 4 | 6` or `1 | 2 | 3 | 4`.

- Reached breakpoints use green.
- The next breakpoint uses amber.
- Future breakpoints remain muted.
- Selecting a row opens exact effects, current contributors, and the cheapest way to reach the next breakpoint.

This keeps the rail useful as a build summary without forcing the player to read rule text on every visit.

## Pack state machine

Only one supply state is visible at a time:

```text
Sealed pack choices → Opened pack tray → Resolve every item → Sealed pack choices
```

Opening a pack temporarily removes the other pack choices. Currency and simple crafting materials are claimed automatically. Characters, Gear, and ship items remain unresolved until the player chooses one of three actions:

- **Move to inventory** keeps the card.
- **Dismantle** converts it to Scrap or its associated crafting material.
- **Sell** converts it to gold.

`Dismantle remaining` and `Sell remaining` resolve every unselected item. The pack cannot close while an item is unresolved. Actions should remain undoable until the pack closes.

Pack previews reveal possible categories, quantity ranges, theme bias, and pack-level Prime odds. They do not reveal exact cards or the actual rarity inside a sealed pack.

First composition target is seven rewards:

- two to four currency, Scrap, crystal, or crafting-material rewards;
- one or two personal Gear cards;
- zero or one ship item;
- one or two character cards.

The categories can vary, but most of the pack should remain economically useful even when its build pieces miss.

## Gear and ship equipment

- Every character has two visible Gear slots on their board card. Empty and occupied slots use different diamond treatments.
- Selecting a character opens both slots, current items, recommendations, and before/after build changes.
- Ship equipment has three dedicated slots in the right rail and affects the whole expedition.
- Inventory uses separate Crew, Gear, Ship, and Materials tabs so ship items are never mistaken for personal Gear.

## Crafting, attunements, and Barracks

Scrap upgrades characters and items or forges discovered sidegrades. Attunement fragments provide a targeted recovery path: twenty matching fragments craft a pack narrowed to an element or mechanic, without guaranteeing a particular character.

The direct-purchase Barracks should remain an experiment. Buying any exact character can make packs less exciting and turn gold into a deterministic solution. A safer version offers three previously discovered characters, costs roughly four ordinary packs, and can be used once per voyage. That preserves a recovery valve without replacing drafting.

## Quality-of-life details

- Auto-claim simple currencies and show them dimmed in the opened pack.
- Keep a visible unresolved-card count and disable Finish until it reaches zero.
- Preserve an undo history until the pack closes or the player enters the next node.
- When capacity is full, explain the shared limit at the placement target instead of silently rejecting the action.
- Highlight Gear slots when an inventory item is selected and show incompatible targets as unavailable.
- Let the player pin harmonies; do not reorder the rail automatically during comparison.
- Persist inventory tab, filters, sort, pinned harmonies, and next-round settings.
- Keep Continue fixed at bottom right and change its label to the next node type.
- Interrupt Continue only for unresolved pack cards, an illegal all-off-field formation, or another decision that makes progression impossible.
