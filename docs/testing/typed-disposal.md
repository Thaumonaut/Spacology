# Typed disposal — playtest 5

- Characters sell for **3 gold per base copy**: ★ 3g, ★★ 9g, ★★★ 27g. Spare copies use the same values. No character-to-scrap action remains.
- Character gear and ship equipment dismantle for **4 scrap**, never gold. Loose inventory items have a Dismantle button; equipped items can first be removed using their existing equipment controls.
- Pack cards have Keep and one disposal action: Sell for crew, Scrap for equipment. Disposal amounts are visible on the buttons. Tap for detail, click the button, or drag onto the shared disposal target.
- Dispose remaining handles mixed contents by type and shows total returns. Take all remains separate. A held touch drop disposes only the dragged card, not the entire pack.
- Prime is credited once on resolution: +1 gold for a crew card, +2 scrap for equipment. The bonus applies to keeping/placing as well as disposal, so keeping then selling cannot duplicate it.
- Auto-disposal defaults to selling max-rank duplicates. Optional auto-sell-all-owned and manual choice remain. Saved auto-scrap preferences migrate to auto-sell.
- Selling a main reserve character returns equipment and preserves/promotes retained copies. Disposing of an already-resolved pack card or already-removed inventory item cannot pay again.

## Economy check

Every generated pack contains two ★ crew and at most one Prime card. Its maximum immediate gold return is the printed currency receipt + 6g for crew + at most 1g for a Prime crew. Gear/ship items never produce gold. This is at or below every current pack price; the cheapest packs can break even with a Prime crew but cannot directly profit.

Including the 16% Prime chance (2/5 of eligible cards are crew) and valuing the 8% crystal drop as half of a 3g targeted copy, expected gold returned remains below every base pack price. The lowest expected spend is 0.816g per completely disposed pack. Scrap crafting cannot convert directly into gold. The positive-cost pack modifier only increases this margin. These are prototype tuning values, not a final economy.

`tests/browser/typed-disposal.cjs` covers buttons/details, single and bulk resolution, mouse/touch drag, rank values, returned gear, loose gear/ship disposal, preference migration and every pack's cash-return bound. Existing copy, formation, crafting and full-voyage checks remain in the suite.
