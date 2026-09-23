# Recovery inbox and equipment

Playable update: treasure carriers and their top-left cache tray are now implemented in the current six-encounter prototype. See [behavior, actual loot pools and validation](../testing/treasure-carriers.md). The broader equipment/tool and voyage designs below remain proposals; their illustrative odds are not the shipped first-pass pools.

Status: design exploration, not implemented. The user wants the inbox to hold rewards earned during combat and opened afterward, including extra currency, and wants equipment to have artwork, greater visibility, easier handling and more gameplay value. The user also proposed a top-left container area, tier-specific loot pools and consumable tools for mid-voyage adjustments such as selling gear for gold or separating advanced gear into its ingredients. Specific mechanics below are proposals.

This extends the [run variety proposal](run-variety-proposal.md): three seven-node sets, fourteen battles, one setup reward, three pre-boss rewards and three modifier choices. Reward containers do not add route nodes.

## Current behavior

The following describes the starting point before the treasure-carrier implementation; carrier rewards now have their own saved drops and claimable caches as linked above.

`applyBattleResult()` in `prototypes/spacology-v0.1.0.js` credits battle gold, crystals and equipment immediately. `showInbox()` displays receipts marked “already credited.” A duplicate battle equipment drop becomes four scrap automatically. Pack equipment follows a different keep/equip/dismantle flow.

Crew have two equipment slots. Inventory gear sits behind a tab; crew cards show generic filled or empty diamonds. Item details already contain suggested wearers, effect descriptions and combination recipes. The Forge can make basic items or consume two ingredients plus scrap for an advanced item. Full equipment slots are disabled in the detail-panel equip flow, although other equip paths can replace an item.

Some existing gear already changes behavior: Ranging Sight adds a target, Tuning Fork adds ailment stacks and Quick Latch advances the opening action. The opportunity is to make those choices visible and legible, then broaden the effects worth building around.

## Inbox becomes a collection of unopened recoveries

Proposed working name for the objects: **Recovery caches**, with crystal or chest-shaped artwork still to be explored. These are containers, visually distinct from the existing **Bloom crystals** spent on copies and crafting. Do not represent a sealed reward and a spendable crafting resource with the same icon or counter. The final terminology remains open.

The loop is **earn in battle → collect in Inbox → open in Ops → use the contents**.

1. At a recoverable battle milestone, a small crystal travels to a collection indicator. Combat continues. The player sees that something was earned without interrupting the fight to inspect inventory.
2. The report separates credited battle income/progression from sealed recoveries: for example, “Battle income credited · 1 recovery cache collected.” Container contents are still unopened.
3. A persistent recovery tray in the requested top-left area displays illustrated unopened caches, their tiers, counts and an Open action. The count means unopened objects, not unread receipts. Exact placement within that area remains a layout decision.
4. Opening reveals item artwork and currency. Currency is credited on reveal; gear can be equipped immediately, kept, or explicitly dismantled. Crew rewards, if included, use the existing keep/merge/sell rules and preserve unresolved choices if reserves are full.
5. Opened rewards appear in a secondary history view alongside battle reports. Reading history never grants anything again.

Provide Open next and Open all. Open all reveals and credits currency in one batch, keeps equipment by default, and leaves any crew-capacity or choice rewards pending. It never silently scraps items or makes build decisions. Support skipping the reveal animation while retaining the result cards.

### Earning and value

Begin with one main container opportunity per battle. A visible recovery milestone secures the basic container; successful optional objectives can improve its quality or add a capped bonus. Elite and boss encounters have stronger baseline rewards for successful recovery. The exact threshold and tier values need tuning for each objective format. Once secured, a container remains earned even if extraction is partial or the player later retreats; abandoning before the milestone does not grant it.

Do not roll a payout independently for every swarm member. The total reward budget belongs to the encounter, so a swarm and a survey in equivalent slots have comparable baseline value. Healing, summoned enemies and replaying a result cannot farm extra containers. Fix the contents when the container is earned, so delaying opening, switching crew or reloading cannot reroll them. If a later milestone upgrades that encounter’s still-sealed container, replace its pending roll once using the predetermined upgraded pool; never grant both versions. Containers become openable after the battle resolves.

Keep ordinary battle income, field progression and integrity settlement immediate. Put bonus currency and item drops in the containers. This preserves the ability to prepare after a poor fight while making opening recoveries meaningful. Move existing bonus value into the new containers first, then tune the combined economy across fourteen battles, four reward nodes, packs and modifiers. Do not simply add a second full reward stream on top of the current one.

A reward node remains a guaranteed improvement or choice. A Workshop can improve gear just opened from an elite's container; it should not become another indistinguishable random container. Give enough equipment access in the setup reward to introduce equipping before the first fight.

At voyage end, retain access to earned containers and pending rewards on the settlement screen. Resolve them before discarding the old voyage state. The current game does not establish a cross-voyage inventory, so persistent carryover is an open design decision; do not silently turn these into permanent power or promise that final-boss gear helps an already-completed run. Final-boss rewards need an explicit settlement purpose before their pool is finalized.

### Top-left recovery tray

Use two clearly labeled rows in the same area: **Unopened** for caches and **Tools** for usable consumables. Equipment remains in its own tray beside the formation. Each cache tier has a different silhouette, a visible tier mark and an accent color; color alone is insufficient. Identical cache types can stack visually, with a count. Extra entries scroll or expand rather than hiding or discarding rewards.

Tap a cache to see its source, guaranteed contents, pool and odds, then open it. Keep Open all and History nearby. Tapping a tool shows its effect, eligible targets and a preview. Neither tapping for details nor opening all uses a tool. Battle drops should visibly arrive at the same recovery indicator so the player knows where to find them afterward.

### Three cache tiers with distinct weighted pools

Separate **tier** from **voyage set**. Tier controls the pool and its weighting; set controls the amount/value appropriate to progression. A Tier I cache earned in set 3 is still currency/basic-gear focused, but its useful resource amounts can be larger. Its tier and value are fixed when earned; saving it until set 3 does not improve it.

Proposed initial sources: regular recovery milestones award Tier I, successful elites award Tier II, and successful bosses award Tier III. Optional mastery can promote a cache within a bounded encounter budget. Partial elite or boss recovery needs its own lower-tier threshold, consistent with objective scoring. Final-boss contents still depend on the settlement decision above.

Start with a guaranteed small gold grant plus **one featured reward roll**. These are illustrative weights to prototype, not balance findings:

| Featured category | Tier I — Supply | Tier II — Specialist | Tier III — Exceptional |
| --- | --- | --- | --- |
| Currency bundle | 70% | 40% | 20% |
| Basic equipment | 25% | 35% | 20% |
| Advanced equipment | 0% | 10% | 40% |
| Consumable tool | 5% | 15% | 20% |
| Total | 100% | 100% | 100% |

After choosing the category, draw from its tier-specific eligible item pool. For an initial currency sub-pool, try gold 60%, scrap 30%, Bloom crystals 10%, with explicit quantity ranges by tier and set. Those conditional percentages must be distinguished from overall drop odds in the inspection view. A Tier I Bloom crystal featured outcome would therefore have a 7% overall chance under these sample weights.

Use different gear and tool lists by tier, not merely different border colors on the same pool. Higher-tier currency and basic-equipment outcomes must still meet that tier's minimum value target; a Tier III currency result should not feel like a Tier I miss. Compare total expected usable value, including the guaranteed gold, rather than rarity alone.

Keep crew and ship-module outcomes out of this first sample table; crew remain available through packs and recruitment nodes, and ship modules need their own explicit category if added later. Document exact eligibility and within-pool weights. Resolve empty pools deterministically to a disclosed currency substitute of the same reward budget. All weights and grants are saved with the earned container so future balance edits do not alter an unopened reward.

## Loot goblins and treasure caches

User-requested addition: loot goblins award extra rewards and caches with better chances for higher-tier contents. Their appearance rules, behavior and example odds below remain proposals. User clarification: “loot goblin” describes any enemy that hoards gold and rare items and drops them on death; it does not require a goblin species. Use **treasure carrier** as a descriptive role in the design. Actual goblin, undead, vampire and other new factions are [deferred future expansion ideas](fantasy-factions-proposal.md), outside current work. Treasure carriers use the existing faction roster for now.

Make the treasure carrier an optional bonus target in a regular encounter, carrying an unmistakable oversized cache. A fleeing, non-attacking carrier is the first behavior proposal, not a requirement of the role. Later variants might defend their hoard or attack; every variant releases its loot on defeat/death. Show its escape countdown in combat AV, with a marker in the timeline; animation speed and pausing do not affect it. Give the player a pre-battle “Pursue treasure” or “Prioritize mission” order so automatic combat can make a deliberate choice. Preview its presence before launch. Do not require an interrupting tap or a special crew member to pursue it.

Its defeat/death releases a visible hoard: **extra gold, rare item/tool loot and a Treasure cache**, separate from the encounter's normal rewards. The direct rare-item grant and its pool are proposed tuning choices, separate from the cache's featured-content roll. Collected item loot is revealed after battle, with caches waiting unopened in the top-left tray. Escaping forfeits only that bonus. The treasure carrier contributes no required recovery points: it cannot lower the normal recovery percentage, prevent wave advancement, hold the battle open after the objective is complete, or turn a successful mission into a loss. If the core encounter ends before it is recovered, it escapes with its remaining loot. Choosing to chase it can still cost crew actions and endanger the mission; that opportunity cost is the trade.

Start with a bounded, seeded opportunity per set, placed in a compatible basic battle, with the frequency subject to playtesting. Randomize the location and specimen rather than allowing one voyage to receive many more opportunities than another. Exclude the opening tutorial fight, bosses and objective formats already asking the crew to chase or protect a timed target in the first version. A swarm visitor must remain small, weak and non-elite. Encounter assembly needs a visible slot for it without removing required enemies or exceeding the supported board capacity.

Treasure caches have their own marked variant and richer pools. As an illustrative starting point, a defeated treasure carrier grants a Tier II Treasure cache 75% of the time and Tier III 25%. Then that cache uses the following **featured-content** weights, in addition to its guaranteed small gold grant:

| Featured category | Tier II Treasure | Tier III Treasure |
| --- | --- | --- |
| Currency bundle | 25% | 10% |
| Basic equipment | 25% | 10% |
| Advanced equipment | 25% | 50% |
| Consumable tool | 25% | 30% |
| Total | 100% | 100% |

These illustrative advanced-equipment chances improve on ordinary Tier II (10%) and Tier III (40%) caches. The Treasure tool pools can favor Disassembly and Reforge, with a useful alternative when their eligibility is absent. Cache-tier odds and within-cache odds are different rolls and must be shown separately; the combined advanced-equipment chance under this example is 31.25%. Do not describe an improved chance as a guaranteed advanced item.

Count direct gold, direct rare loot, guaranteed cache gold and featured contents in one bounded treasure-carrier bonus budget. Lock the visitor, escape rules and reward roll to the encounter seed. Defeating, healing, replaying or reloading the carrier cannot generate another payout. Once recovered, its reward remains earned even if the main encounter later ends in partial extraction. Preserve its Treasure identity and tier in the top-left tray; do not merge it visually with ordinary caches that have different odds.

Possible visual variants within the existing roster include a Custodian vault drone with an overfilled cargo compartment or an Ossuary creature carrying glittering equipment in its shell. Their shared read is conspicuous treasure, a unique marker and the same bonus-reward promise. Wealth is a role separate from elite status; applying it never silently creates an elite inside a Swarm.

Verify escape, simultaneous mission completion, area kills, queued reactions, partial extraction and reload behavior. In particular, removing the optional visitor from the scoring denominator is insufficient if victory or wave checks still require every enemy to be gone.

## Field tools for mid-voyage adjustments

Tools are consumable preparation items used in Ops, with their own illustrated icons and stack counts. They do not occupy either of a crew member's equipment slots. Their purpose is to recover value or change direction when the build needs help. Equip, unequip, transfer and ordinary dismantling remain free interactions with their existing resource outcomes; do not charge a tool for those actions.

| Tool candidate | One use does this | Why it helps |
| --- | --- | --- |
| Liquidation permit | Sell one selected piece of crew equipment for a displayed amount of gold instead of dismantling it for scrap | Converts an unwanted drop into pack, recruitment or field-progression money |
| Disassembly kit | Consume one eligible advanced item and recover the two basic ingredients in its recipe | Undo a combination, distribute gear across two crew or pursue another recipe |
| Reforge die | Exchange one gear item for one of three different, same-tier offers | Redirect a poor-fit drop toward the team being built |
| Recalibration kit | Replace one active voyage modifier with one of three compatible alternatives | Recover from a trade that no longer suits the crew without increasing the modifier count |
| Emergency supply cell | Start the next battle with extra shared Aether, capped at the crew's capacity | Provides a temporary opening boost when the team needs support immediately |

Start with Liquidation permit, Disassembly kit and Reforge die. They directly address equipment flexibility. Recalibration and the supply cell can follow once modifier replacement and one-battle effects have clear rules. Final tool names and quantities remain open.

### Exact exchanges should be clear

**Liquidation:** show the selected copy, whether it is equipped, its gold sale value and the scrap alternative. One confirmed use consumes that copy and one permit; it grants gold only. Price sales against acquisition and crafting costs so renewable buy/craft/sell paths cannot generate money. The rate is a balance question, not an automatic conversion of every scrap unit into gold. Ship equipment is outside the first version unless explicitly added to eligibility.

**Disassembly:** Survey Lance becomes Ranging Sight + Bore Bit. The advanced item and tool are consumed; the ingredients enter inventory. Prior crafting fees are not refunded. Items with no two-basic-item recipe, such as the current directly crafted Lumen Conduit, are ineligible. If the advanced item is equipped, show the slot becoming empty before committing. This is a deliberate reverse recipe, distinct from dismantling for scrap.

**Reforge:** offers exclude the input item and are saved for that tool instance and target copy. Inspecting, cancelling and reloading cannot reroll them. Changing targets must not let the same item copy be previewed repeatedly for fresh offers. Do not allow source gear or same-tier grant values that exceed the intended pool simply because a recipe is expensive. Spend the item and tool only when the player accepts a replacement; cancel keeps both.

**Recalibration:** show removal of the old modifier and addition of the new one as one exchange. Recheck the remaining route and full active stack. Never grant old choice rewards again or refund past costs. If no valid replacement exists, keep the tool and explain why. This does not consume or remove access to the separate guaranteed paid-removal option.

**Supply cell:** explicitly mark the next battle as its target. Consume it when that battle starts; reloading or leaving preparation does not lose it. Limit to one such consumable boost per battle for the initial design. Show its actual gain under the current Aether capacity before arming it.

### Available help without requiring a lucky drop

Cache tools provide surprise, but access to a recovery option should not depend entirely on those odds. At each pre-boss reward node, propose a **field-kit choice** alongside the normal gear/crew/resource choices. Taking it selects one useful tool from a small offer and uses that node's normal reward budget; it is not a free extra grant. Guarantee a relevant alternative when the crew has no disassemblable or saleable equipment.

Show which owned tools can help with the current preparation, without mandatory prompts: “Can separate Survey Lance” or “Can sell unused gear for gold.” Do not silently use them or describe recommendations as guaranteed victories. Some players should prefer keeping strong equipment over sacrificing a reward choice for flexibility.

All tool exchanges need the same exactly-once ownership guarantees as opening caches. Selecting an equipped item must remove its old effect; splitting, reforging or selling must not duplicate it. Failed or invalid operations consume nothing. Test both inventory and equipped copies, repeated use, cancellation, reload, full inventories where applicable, and combinations with crafting.

### Ownership and migration

Each container has a stable identity, source encounter, earned contents and claim state. Save the reward grant and opened state together before presenting completion. Interrupted reveals resume safely. A duplicate gear drop remains an owned copy until the player chooses otherwise: another crew member may want it, or it may be useful for crafting. Duplicate stacking on a single wearer remains an explicit balance rule to review.

Old inbox entries remain already-claimed history; converting them into unopened containers would pay twice. Keep old Bloom crystal balances intact. Test partial outcomes, duplicate copies, open-all, full reserves, reloads during reveals, final settlement and old saves.

## Equipment belongs beside the formation

Add an always-visible **equipment tray** alongside or beneath the crew formation, separate from the crew reserve list. It shows compact illustrated item cards, new arrivals, unassigned gear and a craftable-combination count. The full inventory can remain available for bulk management, but equipping should not require finding its tab.

On smaller screens, use a compact persistent equipment strip that expands into a tray while retaining the selected crew and their slots. Avoid adding so many permanent panels that the formation becomes unreadable.

- Replace generic diamonds on crew cards with each equipped item's actual icon. An empty slot opens compatible owned gear with one tap.
- Selecting a loose item highlights useful wearers and gives a short reason derived from implemented abilities: “adds a target to this attack,” rather than a vague power score.
- Selecting a wearer previews both slots, the proposed effect and the effect being removed. Full slots allow replacement instead of disabling the action. Return the replaced item to inventory.
- Support transferring gear directly between crew, with both owners visible in the preview. Retain free rearrangement between battles and tap controls alongside optional dragging.
- Provide New, Unassigned, Equipped and Craftable filters. A new-item marker clears after inspection or use; it should not demand equipping a bad fit merely to remove a notification.
- Keep dismantling secondary. Show the exact copy and owner before consuming gear, including recipe ingredients equipped to reserve crew.

Recommendations explain usefulness, not optimality. A bonus can be compatible but currently inactive, and the interface should say why. Compare actual effects rather than collapsing extra targets, guard pressure and Aether into an unreliable single equipment score.

## Give equipment a visual identity

Each item gets a recognizable science-fantasy instrument silhouette in the existing soft painterly style, with a simplified icon crop that reads on a crew card. Use consistent framing and lighting; show function through the object rather than relying on a rarity-colored border.

Examples: a ceramic tuning fork with resonant prongs; a pressure canister with a living spore chamber; an articulated ranging lens; a visibly coiled recoil mechanism; a layered mineral ballast plate. Avoid assigning an element color unless the item actually has that element mechanically.

Advanced combinations should visibly inherit features from both ingredients: Survey Lance combines the ranging lens and bore assembly. Reuse each item's identity across container reveals, the tray, crew slots, recipe previews and battle activation cues. Distinguish ship modules by scale and mounting shape while keeping them in the same equipment family.

Prototype one coherent contact sheet spanning basic gear and two upgrades before producing the entire catalogue. Art generation and UI mockups are later work; this proposal does not select final artwork.

## Increase gameplay value through different builds

Keep the two current slots initially. Two meaningful choices are enough to create competing combinations without introducing more inventory chores. Preserve simple gear that teaches its effect, then add a small number of stronger items with clear triggers, limits or tradeoffs.

| Family | Example candidate | Decision it creates |
| --- | --- | --- |
| Area coverage | Existing Ranging Sight / Survey Lance | Trade a slot for reaching more enemies and broad guard pressure |
| Focused pressure | New Focus Lens: successive direct actions against the same target build a capped damage bonus, lost on retargeting | Strong against a boss; awkward when targets change often |
| Aether support | New Capacitor: the wearer's first qualifying skill each combat round refunds one Aether, capped at what that skill actually spent | Supports costly skills without turning zero-cost casts into charge generators |
| Protection | New Relay Plate: once per round, a barrier broken by damage grants a small barrier to another ally | Turns frontline protection into team sustain; expiration and self-removal do not trigger it |
| Conditions | Existing Tuning Fork / Resonance Coil | Apply or spread more conditions; choose concentrated buildup versus coverage |
| Tempo and follow-ups | Existing Quick Latch / Recoil Spring / Overdrive Relay | Choose earlier setup, stronger reactions or a stronger ultimate payoff |

These are examples to test, not finalized kit text. New triggers need caps and consistent treatment of multi-hit actions, follow-ups, summons and skill discounts. Effects should remain understandable from one concise rule.

Make recipes visible from each ingredient and the equipment tray. Preview the complete exchange: ingredients and currency lost, output gained, owners affected and slots freed. Advanced gear should offer slot efficiency or a distinct useful interaction, not require combining every piece immediately. Keeping two ingredients on different crew must sometimes be the better choice.

Give equipment observable feedback: a small item icon on activation, an attributed battle-log entry, and a concise post-battle contribution where it can be measured directly. Count extra targets, refunds or barriers granted; do not invent precise “damage added” figures when overlapping effects make attribution unreliable.

## Suggested first design slice

1. Settle cache naming, tier pools, tool eligibility, the guaranteed reward floor and end-of-voyage handling.
2. Mock up the top-left cache/tool tray opening into equipment, with direct equip/replace, liquidation and disassembly flows plus two illustrated recipe chains.
3. Establish consistent existing-item descriptions, eligibility and replacement behavior before adding new triggers.
4. Test the current gear catalogue against Survey, Swarm and Boss formats; add a few missing build options such as focused pressure and Aether support.
5. Implement containers and equipment presentation together, preserving exactly-once rewards and all owned copies.

The intended payoff is a connected preparation loop: a battle earns something tangible, opening it creates anticipation, and the revealed item suggests a useful change the player can make immediately.
