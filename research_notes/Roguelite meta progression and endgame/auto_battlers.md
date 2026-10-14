# Auto-battler long-term progression, retention and end game (TFT, SAP, Backpack Battles, HS Battlegrounds, The Bazaar, HSR roguelite modes)

Research date: 2026-10-08. Budget-limited pass (about 19 tool calls). Several primary sources (Prydwen, Icy Veins, HSR fandom wiki, SI.com TFT dev blog) returned 403/402/410 errors, so some HSR and Riot details come from secondary guides. Items I could not verify from a fetched source are in the Gaps sections, not stated as fact.

## What is the end game in an auto-battler, and does it depend on PvP?

### Takeaway
In the commercially dominant auto-battlers (TFT, Battlegrounds, SAP, Backpack Battles, The Bazaar), the end game is a rating ladder plus content rotation: seasons and sets that reset the meta and the ladder. Live PvP is not strictly required. Async PvP, where you fight stored "ghost" boards, keeps the ladder working at lower cost. But every one of these games relies on a human-generated opponent pool and an ongoing patch and content cadence. The biggest structural risk is server dependency, which Storybook Brawl's shutdown shows.

### Cited Findings

**Teamfight Tactics (Riot)**
- Riot now ships about three sets a year, each lasting about four months. From Set 1 to Set 9 (2019–2023) sets lasted about six months with a "mid-set update"; starting with Set 10 (Remix Rumble, November 2023) the mid-set was dropped. Reported reason: mid-sets felt like soft resets that disrupted the meta and used balance bandwidth that could go to the next full set. — [seasontimer.live set history](https://seasontimer.live/blog/tft-all-sets-dates/); the same claim appears on low-quality aggregator pages. Riot's SI.com dev-blog coverage ([SI.com](https://www.si.com/esports/tft/teamfight-tactics-dev-blog-set-10)) returned HTTP 410, so I could not verify against the primary source. Treat the rationale as probably right but secondhand.
- Riot's philosophy is to "bring new things to each set". Augments added game-to-game variance that makes TFT "fun to come back to again and again". Developers have discussed bringing back old sets such as Galaxies and Fates as modes, because many players joined in later sets. — [RiftFeed Mort interview (Set 7)](https://riftfeed.gg/more/tft-set-7-dargonlands-mort-interview); [Dexerto](https://www.dexerto.com/league-of-legends/riot-exploring-possibility-of-tft-galaxies-return-in-future-sets-1410605)
- TFT's lead has said the game came close to dying in 2020 and is now doing better than ever. This is evidence that the set-rotation model rescued retention. — [Mein-MMO (German)](https://mein-mmo.de/chef-tft-spiel-kurz-vor-tod-heute-besser-als-je-zuvor/)

**Hearthstone Battlegrounds (Blizzard)**
- Battlegrounds runs seasons that reset ratings and rotate whole mechanics. Season 9 reset ratings and rotated out Trinkets in favour of Anomalies, and Season 10 (starting April 29, 2025) brought Trinkets back. — [Blizzard Watch S9](https://blizzardwatch.com/2024/08/28/when-does-hearthstone-battlegrounds-season-9-start); [Blizzard Watch S10](https://blizzardwatch.com/2025/04/17/hearthstone-battlegrounds-season-10-start/)
- Each season the minion pool churns heavily. Season 8 removed 38 minions, brought back 18 and added 27 new ones. Season 10 had 75 new or returning minions and spells. — [Blizzard Watch S8](https://blizzardwatch.com/2024/05/01/hearthstone-battlegrounds-season-8-start); [S10](https://blizzardwatch.com/2025/04/17/hearthstone-battlegrounds-season-10-start/)
- Monetisation criticism: from Patch 24.2, picking from 4 heroes instead of 2 sits behind the paid Season Pass. Players saw this as pay-to-win because it is a real gameplay advantage. — [esports.gg](https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/); [esports.gg Season 2 rewards-track controversy](https://cache.esports.gg/news/hearthstone/hearthstone-battlegrounds-season-2-quests-heroes-minion-rotation-controversial-rewards-track)

**Super Auto Pets (Team Wood Games)**
- Released on Steam on Sept 24, 2021, on mobile in Feb 2022 and on macOS in Oct 2022. It is self-published and built in Unity. — [Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- Retention comes from packs rather than a power grind:
  - Turtle, Puppy, Star, Golden, Unicorn and Danger packs, plus a Weekly pack whose pet roster rotates every week.
  - The Unicorn pack added 96 pets and 20 foods.
  - Players can build custom packs from pets in packs they own.
  - Arena is async and ends at 10 trophies. Versus supports live or async 1v1 and 8-player lobbies with ELO starting at 1500.
  — [Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- Popularity spiked after Northernlion and Ludwig streamed it. — [Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)
- Players and press often credit the free weekly pack and rotating meta with keeping the game fresh. — [iphonesoft.fr, July 2026](https://iphonesoft.fr/2026/07/04/super-auto-pets-auto-battler-gratuit-plus-mignon-addictif-moment?AMP=1)
- I found no direct Team Wood interview on progression philosophy (see Gaps).

**Backpack Battles (PlayWithFurcifer)**
- Release timeline: free itch.io demo in June 2023, Steam early access on March 8, 2024, and 1.0 on June 13, 2025, which added the Mage and Adventurer classes. — [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)
- Format: async PvP. A run ends at 10 wins or 5 losses. Survival Mode continues to round 18. In Ranked, "As players attain higher ranks… they face other players of similar rank." — [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)
- Sales and launch: 500k sold in two weeks and 640k in the first month, with roughly half from China. Peak was over 36k concurrent players at launch. — [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)
- Updates: about 40 updates in a year and about 35 million hours played by 1.0. The 1.0 release added Steam achievements and trading cards. — [Mein-MMO](https://mein-mmo.de/90-prozent-positiv-auf-steam-indie-hit-backpack-battles/); [press release](https://gamespress.westeu-v2.propressroom.com/Backpack-Battles-10-Launches-June-13)
- Player counts: the all-time peak cited is 6,118, which conflicts with the 36k launch figure above and may refer to a different app ID or demo. June 2026 averaged about 1,576 players with a 2,643 peak. This is a long but modest tail on a paid game with no grind. — [steambase.io](https://steambase.io/apps/backpack-battles)
- Criticism: IGN gave it 6/10, citing insufficient item variety for replayability. — [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)

**The Bazaar (Tempo Storm / Reynad)**
- Run structure: you start with 20 Prestige and lose Prestige equal to the current day when you lose a fight. The goal is 10 PvP wins for maximum rewards. — [Mobalytics](https://mobalytics.gg/the-bazaar/guides/prestige)
- Backers and promises: Reynad's Indiegogo campaign raised over $115k on promises of no pay-to-win, fair progression and cosmetics-focused monetisation. In closed beta, a pack of about $30 bought currency to unlock the 3 heroes. — [Hofstra Chronicle](https://thehofstrachronicle.com/104592/arts-entertainment/full-release-of-the-bazaar-disappoints-after-phenomenal-open-beta); [GameStar](https://www.gamestar.de/artikel/the-bazaar-fast-von-gier-zerstoert,3432674.html)
- Open beta backlash (about March 2025):
  - New hero cards and expansions were gated behind a paid battle pass. Pygmalien cards required pass level 25.
  - Expansions cost 999 gems, about $10.
  - Free and paying players had unequal card pools, which breaks the shared-pool premise of an auto-battler.
  - Reynad responded to critics in a hostile way.
  - Streamers such as Northernlion refused to buy, and some players left for Backpack Battles.
  — [CardGamer](https://cardgamer.com/games/digital-card-games/the-bazaar/6-reasons-why-the-bazaars-open-beta-caused-an-uproar); [GameStar](https://www.gamestar.de/artikel/the-bazaar-fast-von-gier-zerstoert,3432674.html)
- A student-paper review called the full release disappointing after a "phenomenal open beta". — [Hofstra Chronicle](https://thehofstrachronicle.com/104592/arts-entertainment/full-release-of-the-bazaar-disappoints-after-phenomenal-open-beta)

**Server-dependence risk**
- Storybook Brawl (Good Luck Games) was acquired by FTX in March 2022 to add NFT integrations. After FTX went bankrupt, its servers shut down on May 1, 2023, and the game became unplayable. — [Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl); [Bloomberg](https://www.bloomberg.com/news/articles/2023-04-25/sam-bankman-fried-s-favorite-game-storybook-brawl-to-close-post-ftx-bankruptcy)

### Inferences
- **The PvP auto-battler end game is not a progression system.** It is the ladder plus scheduled meta disruption: sets, seasons, tribe or mechanic rotation, and weekly packs. Players return because the solved meta gets broken on a schedule and their rank resets. This requires:
  - a full team shipping new content every 4 months (TFT) or every season (Battlegrounds);
  - balance patching;
  - matchmaking and enough population to make it work.
- **Async PvP lowers the cost but does not remove it.** Backpack Battles, SAP and The Bazaar store opponent boards, so you do not need concurrent players. You still need servers, anti-cheat, a large enough ghost pool per rank, and balance patches. PlayWithFurcifer shipped about 40 updates in a year to keep the ladder alive.
- **Monetisation that touches the shared pool is poison.** Auto-battler players treat equal access to the unit or item pool as sacred. Both the Battlegrounds 4-hero pass and The Bazaar's card-gated pass drew pay-to-win backlash. A premium game avoids this by design.
- **Single-player auto-battlers without PvP have no built-in endless ladder.** They must replace it with authored difficulty tiers (Ascension-style), modifier or "seed" variety, collection and codex goals, and possibly daily or weekly seeded challenges that can be generated offline. A deterministic seed works without servers.

### Gaps
- I could not fetch Riot's primary dev blog on dropping mid-set updates (SI.com returned 410), so the rationale comes from aggregators. I also did not verify Revival or "Remix" set details, current TFT set numbering in late 2026, or TFT Pass pricing.
- I found no direct interview with Team Wood (SAP) or PlayWithFurcifer on progression philosophy. Both studios mostly communicate through Discord and Steam posts, which my searches did not reach.
- Tempo's later reversals of The Bazaar's monetisation, and its ranked tiers or seasons in 2026, are not verified here. GameStar's headline ("almost destroyed by greed") implies a partial recovery, but I did not read the detail.
- Battlegrounds Season 11 and later in 2026, and the current Season Pass terms, are not checked.

## How do HSR roguelite modes structure difficulty and cross-run progression, and what frustrates players?

### Takeaway
HSR's roguelites follow a consistent template:
- tiered difficulty that you unlock by clearing the previous tier;
- a permanent account-level ability tree (Simulated Universe Ability Tree, Divergent Universe Inspiration Circuit);
- weekly (later bi-weekly) point caps that pay Stellar Jade and gacha items;
- one-time Stellar Jade from first clears of each difficulty and from completing collection archives (Index, Gallery of Possibility).

Currency Wars (added in v3.7) is the most auto-battler-like mode. It has its own 9-rank ladder up to "A8 Wealth Creator 30", with Ascension Matches from Investment Master onward. It maps your owned characters to fixed "optimal" builds, which partly reduces account-power checking. Player frustration centres on HSR's wider gacha grind and chore load. I found little documented Currency Wars-specific complaint in fetched sources.

### Cited Findings

**Simulated Universe (base mode)**
- Simulated Universe is a weekly mode family. It hosts Domains, Expansion Modules, the SU Index and Weekly Points. The current mode list includes Simulated Universe, Divergent Universe, Unknowable Domain, Swarm Disaster and Gold and Gears. — [Prydwen SU guide (search snippet; page 403 on fetch)](https://www.prydwen.gg/star-rail/guides/simulated-universe)
- Weekly points: completing runs gives weekly points, and 3,500 cumulative points unlocks all rewards. This figure is from an older guide; the cap has changed across versions. — [Push Square](https://pushsquare.com/guides/honkai-star-rail-simulated-universe-explained-and-how-to-earn-points)
- Path Resonance: this permanent node in the SU Ability Tree lets you pick a Path at run start. Collecting 3 Blessings of that Path unlocks an active Path Resonance ability. — [Prydwen SU (snippet)](https://www.prydwen.gg/star-rail/guides/simulated-universe)
- Swarm Disaster and Gold and Gears introduced "Resonance Interplays", which are combination bonuses. Divergent Universe's "Equations" evolved from them. — [SI.com Divergent Universe explained](https://videogames.si.com/guides/honkai-star-rail-divergent-universe-explained); [AFK Gaming G&G Interplays](https://afkgaming.com/gaming/honkai-star-rail/all-simulated-universe-gold-and-gear-resonance-interplay-combinations)

**Divergent Universe: Protean Hero (v3.1)**
- **Difficulty:** Ordinary Extrapolation has tiers I–V. Clearing V unlocks the Astronomical Division at greatly increased difficulty. "Cyclical Extrapolation" is a weekly-rotating special challenge worth a one-time 1,000 bonus points per week. — [Tacter guide](https://tacter.com/honkai-sr/guides/honkai-star-rail-or-divergent-universe-protean-hero-gameplay-guide-585057b2); [Destructoid](https://www.destructoid.com/all-rewards-and-how-to-get-them-in-the-protean-hero-divergent-universe-in-honkai-star-rail/)
- **Permanent power:** the "Inspiration Circuit" talent tree gives permanent buffs. — [Tacter](https://tacter.com/honkai-sr/guides/honkai-star-rail-or-divergent-universe-protean-hero-gameplay-guide-585057b2); [Fandom: Inspiration Circuit](https://honkai-star-rail.fandom.com/wiki/Divergent_Universe/Inspiration_Circuit)
- **Reward accounting** — [Destructoid](https://www.destructoid.com/all-rewards-and-how-to-get-them-in-the-protean-hero-divergent-universe-in-honkai-star-rail/):
  - Synchronicity Level 60 takes 48 full-clear runs, at 800 points per level and at most 1,000 points per run. That is about 12 hours of runs at about 15 minutes each, or about 9 hours with weekly bonuses, spread over about 12 weeks. It pays 1,080 Stellar Jade.
  - The Gallery of Possibility codex has "almost 500 individual upgrades and items to find" and pays 1,070 Jade.
  - Difficulty first clears pay 120 Jade for tier I and 60 each for II–V.
  - The Stable Computation Array (objectives and Conundrums) pays 1,000 Jade.
  - Total for 100% completion is "a bit more than 3,500 Stellar Jades".

**Currency Wars (v3.7; updated through v4.2–4.4)**
- **Run structure:** you field a 10-character team with up to 4 active combatants. Characters not in combat "provide off-field support." Gold Coins buy characters, refresh the store and buy experience to level up. This is a TFT-style economy. — [Game8](https://game8.co/games/Honkai-Star-Rail/archives/550753)
- **Ranks:** there are nine: Black Iron, Viridian Bronze, Jade Steel, Cobalt Silver, Ice Titanium, Amethyst Gold, Investment Master, Monarch of the Capital and Wealth Creator. "Starting from the Investment Master Rank, you will have to complete Ascension Matches in order to move to a higher Rank." — [Game8](https://game8.co/games/Honkai-Star-Rail/archives/550753)
- **Climbing:** "Each successful Standard Gambit run at the highest difficulty available to you will increase your rank." The maximum is "A8 Wealth Creator 30". — [Icy Veins (snippet)](https://www.icy-veins.com/honkai-star-rail/currency-wars); [Prydwen (snippet)](https://www.prydwen.gg/star-rail/guides/currency-wars)
- **Difficulty effects:** higher ranks add enemy strength plus penalties such as reduced squad HP and a larger "action value penalty" when characters fall. — [Game8](https://game8.co/games/Honkai-Star-Rail/archives/550753)
- **Modes:** Standard Gambit is the ranked climb. Overclock Gambit is a shorter variant with fewer combat nodes and faster resource gain. — [Prydwen (snippet)](https://www.prydwen.gg/star-rail/guides/currency-wars)
- **Account link:** "Characters you own will also be mapped to a more optimal build when they're used in Currency Wars." This normalises gear, but ownership still matters. — [Game8](https://game8.co/games/Honkai-Star-Rail/archives/550753)
- **Reward cycle:** rewards reset every two weeks on Monday at 04:00 server time. Point thresholds pay Credit, Stellar Jade, Lost Gold Fragment, Herta Bond, Star Rail Pass, Tracks of Destiny and Fuel Vouchers. — [Icy Veins (snippet)](https://www.icy-veins.com/honkai-star-rail/currency-wars); [Prydwen (snippet)](https://www.prydwen.gg/star-rail/guides/currency-wars)
- A sub-event, "Currency Wars: Zero-Sum Game", exists. — [Fandom](https://honkai-star-rail.fandom.com/wiki/Currency_Wars:_Zero-Sum_Game)

**Player frustration (general HSR)**
- Critics describe HSR's grind as making content "feel more like a chore". Each character needs its own materials, light cone and relics. Power creep exists to drive sales, and RNG in reward systems is a recurring source of frustration. — [Boss Rush Network, Oct 2024 opinion piece](https://bossrush.net/2024/10/the-failure-of-honkai-star-rail/)
- Divergent Universe completion needs 48 runs over about 12 weeks, about 9–12 hours, to reach the level-60 reward cap. This is a concrete measure of the recurring time tax. — [Destructoid](https://www.destructoid.com/all-rewards-and-how-to-get-them-in-the-protean-hero-divergent-universe-in-honkai-star-rail/)

### Inferences
- **HSR's cross-run progression is mostly extrinsic.** The rewards (Jade, passes) are gacha currency for a different game loop. The permanent trees (Ability Tree, Inspiration Circuit) add raw power that makes early tiers trivial. The codexes (Index, Gallery of Possibility) work as one-time Jade bounties rather than meaningful collections. The weekly or bi-weekly cap turns the mode into a recurring obligation. This is the "chore" structure.
- **Currency Wars' rank ladder is effectively a single-player Ascension ladder with PvP-style branding.** Rank names mimic competitive tiers, but you climb by clearing PvE at your highest difficulty, with gated "Ascension Matches". This transfers well to an offline game.
- **Difficulty modifiers are mostly flat stat penalties** (enemy power, squad HP, action-value penalties) rather than rule-changing affixes. A premium design can do better with rule-changing modifiers, in the style of Slay the Spire's Ascension or Hades' Heat.
- **The "optimal build mapping" is a partial answer to the account-power check.** It still gates which characters you can field by gacha ownership. A premium game should give everyone the full roster in-run.

### Gaps
- Primary wiki pages (HSR fandom Currency Wars, Prydwen, Icy Veins) blocked fetching. The following are unverified:
  - exact bi-weekly point caps and Jade totals for Currency Wars;
  - the full list of difficulty modifiers per rank;
  - any permanent Currency Wars unlocks (investment environments or strategies, codex);
  - exact release dates (v3.7 is roughly late 2025 per Game8; versions 4.2–4.4 are 2026).
- I found no fetched Reddit or HoYoLAB thread specifically complaining about Currency Wars (RNG, rank grind, or Ascension Match walls). Search returned only generic HSR criticism. Whether players experience Currency Wars as a chore remains unverified.
- I found no HoYoverse developer statement on roguelite-mode design philosophy.
- Details of Unknowable Domain (a newer SU mode) and the current SU weekly cap (historically raised over time) are not verified.

## What lessons transfer to a premium single-player, offline auto-battler with no live service?

### Takeaway
Keep what makes Currency Wars and TFT fun (shop economy, synergies, interest, a rank ladder) and replace the live-service pillars with authored ones:
- **Instead of ladder resets:** an Ascension or rank ladder with rule-changing modifiers.
- **Instead of set rotation:** content packs, or several "sets" playable as selectable rule-sets.
- **Instead of weekly packs:** offline seeded daily or weekly challenges.
- **Instead of power trees:** collections and codex goals tied to knowledge rather than power.

Avoid weekly caps, gacha ownership gates and permanent stat trees.

### Cited Findings
- SAP's rotating Weekly pack is widely credited with preventing stagnation. Its custom packs let players author their own pools. — [Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets); [iphonesoft.fr](https://iphonesoft.fr/2026/07/04/super-auto-pets-auto-battler-gratuit-plus-mignon-addictif-moment?AMP=1)
- Battlegrounds and TFT rotate entire mechanics (Trinkets and Anomalies; set mechanics) to refresh the game. — [Blizzard Watch](https://blizzardwatch.com/2025/04/17/hearthstone-battlegrounds-season-10-start/)
- Backpack Battles' paid model and frequent free updates sustained sales of 640k in its first month and a long tail. IGN's main criticism was item variety, meaning content breadth. — [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)
- Paid gating of the shared pool (Battlegrounds hero choice, Bazaar cards) triggers pay-to-win backlash. — [esports.gg](https://esports.gg/news/hearthstone/hearthstone-battlegrounds-rewards-track-season-pass-is-bg-becoming-pay-to-win-with-runestones/); [CardGamer](https://cardgamer.com/games/digital-card-games/the-bazaar/6-reasons-why-the-bazaars-open-beta-caused-an-uproar)
- Divergent Universe's tier ladder (I–V, then the Astronomical Division) and Currency Wars' 9-rank ladder with Ascension Matches show the shape players already understand. — [Tacter](https://tacter.com/honkai-sr/guides/honkai-star-rail-or-divergent-universe-protean-hero-gameplay-guide-585057b2); [Game8](https://game8.co/games/Honkai-Star-Rail/archives/550753)
- Servers make the game mortal, as Storybook Brawl's May 2023 shutdown showed. An offline game is immune to this. — [Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl)

### Inferences (design lessons for "Currency Wars without the frustrations")
1. **Keep the rank ladder fantasy and drop the timer.** Climbing ranks like Black Iron to Wealth Creator by winning at your top difficulty is satisfying. Ascension Matches work as boss gates. No bi-weekly reset is needed: rank is permanent mastery.
2. **Make difficulty rule-changing, not just stat inflation.** HSR mostly adds enemy stats and squad penalties. Offline ladders stay interesting longer when each step adds a new constraint, for example:
   - shop or interest changes;
   - fewer bench slots;
   - enemy synergies;
   - elite affixes.
3. **Make unlocks horizontal (variety), not vertical (power).** HSR's Ability Tree and Inspiration Circuit make old content trivial. Unlock new units, synergies, starting "investment strategies" and rule-sets instead. If there is any permanent power, keep it small or optional.
4. **Make collections and codexes knowledge goals, not currency bounties.** The Gallery of Possibility has about 500 entries but exists to pay Jade. In a premium game the codex can reward with lore, cosmetics, challenge unlocks or mastery badges per unit or synergy.
5. **Recreate "set rotation" offline.** Possible approaches:
   - Ship several curated "sets" or rule-sets in the box and let players pick.
   - Add expansions as paid DLC or free updates.
   - Rotate a featured pool deterministically by date offline, like SAP's weekly pack, using a local seed.
6. **Use a deterministic seed to replace async PvP.** Daily or weekly seeded runs give the shared-challenge feeling (optionally with comparison via share codes) without servers. Authored "ghost" boards or AI opponent archetypes can stand in for the async opponent pool. That pool is what Backpack Battles and SAP need servers for.
7. **No obligation loops.** Avoid weekly point caps, dailies with loss-aversion rewards and time-gated completion. HSR Divergent Universe's 48-run, 12-week reward curve is the anti-pattern.
8. **Make everything available in-run.** Currency Wars still gates units by gacha ownership. A premium game should have the full pool from the start or unlock it through play.

### Gaps
- No primary data on long-term retention of premium offline auto-battlers compared with PvP ones was found.

## Notable single-player / offline auto-battlers worth noting

### Takeaway
Few auto-battlers have strong offline progression. Most notable titles are PvP-first. Despot's Game has a PvE roguelike structure. Mechabellum's single-player content was described as thin, at least as of 2023. Storybook Brawl shows the downside of an online-only design.

### Cited Findings
- **Despot's Game:** an auto-battler with RPG and roguelike elements. Players lead a group of heroes through a maze, gaining specialisations and equipment. It has PvE and PvP modes. — [esports.gg list](https://esports.gg/news/teamfight-tactics/auto-battler-and-deck-building-games-like-tft-to-try-now)
- **Mechabellum:** released in 2024 by Game River, published by Paradox and Dreamhaven. A Steam community thread from 2023 described single-player as limited to a "Survival" mode with weak AI and shallow strategy. This is an older fact and may have changed since. — [Wikipedia](https://en.wikipedia.org/wiki/Mechabellum); [Steam discussion](https://steamcommunity.com/app/669330/discussions/0/3819669605968592269)
- **Storybook Brawl:** online-only. Its servers shut down on May 1, 2023, after FTX's bankruptcy. — [Wikipedia](https://en.wikipedia.org/wiki/Storybook_Brawl)

### Inferences
- The offline auto-battler space with deep meta-progression appears under-served. That is an opportunity, but it also means few proven templates. The closest structural models are roguelite deckbuilders' Ascension systems, applied to a TFT- or Currency Wars-style economy.

### Gaps
- Not researched due to tool budget:
  - Hero's Hour (I am not confident it is an auto-battler; it is a HoMM-like with auto-resolved battles);
  - Auto Chess offline or bot modes;
  - Mechabellum's current campaign or co-op content in 2025–2026;
  - Despot's Game reviews and progression specifics;
  - other PvE auto-battlers.
