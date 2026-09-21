# UI system v5 — cards, direct manipulation, and screen map

Status: interaction proposal accompanying `mockups/ui-system-v5.html` and `mockups/ops-room-v5.html`.

## Input grammar

The interface uses one consistent distinction:

| Input | Meaning |
|---|---|
| Tap or click | Inspect, select, focus, or open detail |
| Drag and drop | Move, equip, reorder, combine, or assign |
| Press and hold | Lift an object when a drag must begin without accidental scrolling |
| Double tap | No essential action; it is unreliable and hard to discover |

Every drag action also has a tap-based path for controller, keyboard, accessibility, and fatigue. Selecting an inventory character exposes `Place on field` and `Place off field`; selecting Gear exposes `Equip to…`; selecting crafting ingredients exposes `Add to socket`.

An object lifts after roughly 120–160 ms or eight pixels of movement. Valid destinations glow, invalid destinations dim, and the source location remains visible. A destructive drop enters an undo queue instead of resolving immediately.

## Card language

The supplied Dr. Stella card establishes a strong full-card format:

- large portrait and name for recognition;
- a top-right badge for level or power;
- upper-left swatches for two categorical properties;
- one central pentagon for role or harmony identity;
- three bottom sockets for attached objects.

The frame should define those meanings before more cards are produced. Recommended mapping:

| Card area | Meaning |
|---|---|
| Border colour | Element |
| Upper-left icon 1 | Primary harmony |
| Upper-left icon 2 | Secondary harmony |
| Top-right badge | Character level |
| Right-side pentagon | Combat role |
| Bottom-left socket | Gear slot 1 |
| Bottom-centre socket | Gear slot 2 |
| Bottom-right socket | Attunement |

Colour alone should never carry a category. Put a small glyph inside each swatch or socket. The full white card is appropriate for pack reveals, character detail, promotion, and the collection. The Ops board needs a compressed dark card because eight visible slots make full trading-card proportions too narrow.

Empty, compatible, equipped, locked, and upgrade-ready sockets need distinct states. Keep every bottom socket the same silhouette so players learn one target shape. The irregular outline can remain part of the wider card frame and level badge.

## Simple crafting

Crafting uses one rule: drag two identical items of the same tier into two sockets to produce the next tier.

```text
Recoil Spring I + Recoil Spring I → Recoil Spring II
```

The result appears before confirmation. There is no recipe list for ordinary upgrades. Invalid pairs remain in their sockets and explain why they do not combine. The player can drag an ingredient back out or press Reset.

This should apply to Gear, ship equipment, and duplicate character cards if character promotion uses duplicates. Attunement crafting is the exception because it converts collected fragments into a targeted card. Keep that recipe visible and fixed rather than creating a second general crafting grammar.

## Screen inventory

| Screen or menu | Primary job | Direct manipulation |
|---|---|---|
| Ops room | Build the team and prepare the next node | Crew to rows, Gear to sockets, ship items to ship slots |
| Character detail | Understand kit, pairings, and loadout | Gear and Attunement to card sockets |
| Inventory | Find, compare, lock, upgrade, or salvage | Reorder and drag to compatible targets in Manage mode |
| Crafting bench | Combine matching items | Two items to merge sockets |
| Ship equipment | Configure expedition-wide rules | Ship items to three vessel slots |
| Harmony index | Read breakpoints and contributors | Optional pin/reorder only |
| Field level | Buy shared team capacity | No drag; purchase requires a deliberate tap |
| Next round | Review objective, Calls, and playback settings | Calls may be reordered or replaced |
| Combat | Watch resolution and use limited interventions | Calls to a target or turn-track position |
| Recovery report | Explain outcome and award discoveries | No drag |
| Catalogue | Review persistent observations and mastery | Optional pinning and comparison |

## High-risk drag actions

Selling and dismantling should not use permanent trash zones during ordinary play. Those targets create accidental losses when the player intended to scroll or rearrange. Expose them only in Inventory Manage mode or pack resolution, label their exact return, and keep the action undoable until the player leaves that state.

Field leveling, pack purchases, crafting confirmation, and Barracks recruitment remain explicit taps because they spend a meaningful resource. Dragging should make spatial actions faster, not hide economic commitments.

## Remaining visual work

The click-through uses abstract portrait placeholders. A production card pass needs:

- a portrait-safe crop for full cards and a second crop for board cards;
- final element, harmony, role, Gear, ship, and Attunement glyphs;
- treatment for rarity that does not compete with the element border;
- level 1–99 badge tests with one, two, and three digits;
- socket states at actual iPad size;
- left-handed and right-handed drag tests so the lifted card does not hide its target;
- contrast testing for the white card under dark-room display conditions.
