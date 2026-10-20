# Cross-run meta-progression and end game in roguelike deckbuilders (Slay the Spire 1/2, Monster Train 1/2, Balatro, Inscryption, Wildfrost, Peglin)

Research date: 2026-10-08. Steam global achievement percentages were read from live Steam stats pages on that date. They are lifetime figures across all owners, so they understate the share of *engaged* players who clear content. Wiki pages describe current versions unless noted. Context for the reader: the asker is building a premium, no-monetisation iPad roguelite auto-battler with no power grind, self-contained runs and an always-available crew. Lessons for that design are flagged as "Relevance" under Inferences.

## Q1. What exactly persists between runs: content, power, difficulty or knowledge?

### Takeaway
None of these six games gives the player meaningful permanent stat power. What carries over is (a) a content pool that grows (cards, relics, characters, decks), (b) a per-character or per-deck difficulty ladder, and (c) records and collection (compendium, stickers, achievements). Monster Train's Pyre Hearts and clan-level unlocks come closest to "power", but they work as more options, not a stat grind. Above all, what carries over is the player's own knowledge.

### Cited Findings

**Slay the Spire (2019)**
- Card, relic and character unlocks are driven by *cumulative score* at the end of each run, win or lose. Threshold examples: 300 points (cards, character or key), 750 (relics), 1000 (cards), 1500 (relics), 2000 (cards). — [slaythespire.info unlock guide](https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/)
- Ascension is 20 cumulative levels. It unlocks after you defeat an Act 3 boss, and it is tracked **per character**. Any unlocked level can be replayed. A1 adds more Elites; A2–4 raise enemy, Elite and Boss damage; A5 cuts post-boss healing to 75%; A6 starts you damaged; A7–9 give enemies more HP and block; A10 adds the Ascender's Bane curse; A11 removes a potion slot; A12 means fewer upgraded cards; A13 means less boss gold; A14 lowers max HP; A15 makes events worse; A16 raises shop prices 10%; A17–19 give enemies harder movesets; A20 adds a double boss at the end of Act 3. — [Slay the Spire Wiki: Ascension](https://slaythespire.wiki.gg/wiki/Ascension). (The wiki summary said "simultaneously", but the A20 double boss is fought back-to-back. That correction comes from general knowledge and is not verified in the fetched text.)
- Daily Climb is a once-per-day seeded challenge with modifiers and a global leaderboard. In dailies everything is unlocked so scores are comparable. Custom mode allows any mix of positive and negative modifiers. — [Into the Spine: Daily Climb](https://intothespine.com/2018/03/05/slay-the-spire-daily-climb/); [slaythespire.info](https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/)
- Ascension began as an experimental mode, added because some players wanted extra challenge. Giovannetti framed it as a stratified ladder: "as players get better... they climb the Ascension ladder" at the difficulty they want. — [Slay the Spire with Anthony Giovannetti (podcast)](https://podcasts.apple.com/us/podcast/slay-the-spire-with-anthony-giovannetti/id1435365252?i=1000447140877); see also [GDC Vault: 'Slay the Spire': Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics). The talk covers balancing from aggregate run data. Its specific Ascension content was not verified.

**Slay the Spire 2 (Early Access since 5 March 2026; $24.99 in EA; PC, macOS, Linux; up to 4-player co-op)**
- EA launched 5 March 2026 with five characters: Ironclad, Silent, Defect, Necrobinder and Regent. — [Mega Crit news](https://www.megacrit.com/news/2026-02-19-release-date-trailer/); [Game Informer](https://gameinformer.com/2026/02/19/slay-the-spire-2-reveals-4-player-co-op-march-early-access-release-date); [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II)
- Meta-progression moves to a **Timeline of "Epochs"**, more than 50 in EA. Each Epoch unlocks characters, modes, relics, cards or potions. Locked Epochs show as blurred images with hidden conditions. They are earned through accumulated score, beating given Ascension levels with given characters, and specific objectives. Expect "dozens of runs" to finish the Timeline. — [GameSpot: How to unlock StS2 Epochs](https://www.gamespot.com/articles/slay-the-spire-2-epochs/1100-6538655/) (search snippet; the page returned 403 when fetched)
- Characters unlock in a chain. Each link only needs a run to be *played*, not won: Ironclad → Silent → Regent ("Anomalous Planet" Epoch) → Necrobinder ("Life and Death" Epoch, finish any Regent run) → Defect. — [Deltia's Gaming epoch list](https://deltiasgaming.com/all-slay-the-spire-2-epochs-and-their-unlocking-requirements/); [StS2 wiki: Necrobinder](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Necrobinder) (via search snippets)
- StS2 Ascension has **10 levels, not 20**. Each is per character and cumulative, with separate multiplayer Ascension tracking. A1 Swarming Elites (about 60% more Elites); A2 Weary Traveler (Ancients heal only 80% of missing HP); A3 Poverty (25% less gold); A4 Tight Belt (one fewer potion slot); A5 Ascender's Bane; A6 Inflation (card removal costs 100 gold, then +50 each time); A7 Scarcity (rare and upgraded cards appear half as often); A8 Tough Enemies; A9 Deadly Enemies; A10 Double Boss. — [StS Wiki: StS2 Ascension](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:Ascension); [TheGamer](https://www.thegamer.com/slay-the-spire-2-ascensions-levels-modifiers-how-to-unlock-explained-guide/)

**Monster Train (2020)**
- 25 Covenant ranks of stacking modifiers (more enemy HP, troop debuffs and so on), described as similar to StS Ascension. Beating Covenant 25 unlocks the credits and Expert Challenges. — [Monster Train fandom: Covenant Ranks](https://monster-train.fandom.com/wiki/Covenant_Ranks); [Wikipedia](https://en.wikipedia.org/wiki/Monster_Train)
- Clan XP: playing a clan levels it up (to 10), unlocking more cards and options. Achievements exist for level 10 on each clan and for "max level on all clans". — [Steam global stats, Monster Train](https://steamcommunity.com/stats/1102190/achievements)

**Monster Train 2 (May 2025)**
- Covenant runs **0–10**. Only 0 and 1 are open at the start, and each higher rank unlocks by beating the one below. Each rank 1–10 keeps its own win streak. Beating the Titans on Covenant 10 rolls the credits. Ranks: C1–2 stronger enemies and extra opponents; C3 merchant costs and purge scaling; C4 boss buffs; C5 two Vengeful Shards in the starting deck; C6 Calcified Ember in drafts; C7 no empty waves before bosses; C8 stronger enemies; C9 the Pyre starts the run with 30% damage; C10 Elite Chosen in flying boss fights. — [MT2 wiki (Miraheze): Covenant Ranks](https://monstertrain2.miraheze.org/wiki/Covenant_Ranks)
- Meta-progression is clan XP, which unlocks cards and a second hero per clan, plus unlockable **Pyre Hearts**. Each Pyre Heart grants a distinct power, such as gold when the Pyre is damaged or permanently expanding a floor. They are earned through in-run achievements. There are also cosmetic skins. Reviewers call this a "constant sense of progress". — [FullCleared review](https://fullcleared.com/reviews/monster-train-2-review/); [Saving Content review](https://www.savingcontent.com/2025/05/21/monster-train-2-review/)

**Balatro (Feb 2024)**
- No permanent upgrades to the player. Unlocks add new decks, Jokers and vouchers to the pool. Apart from the choice of deck, you never start a run with a permanent boon. — [CBR](https://www.cbr.com/losing-balatro-run-satisfying/) (secondary source)
- There are 8 stakes, unlocked **per deck**: you must win the highest stake currently unlocked on that specific deck. White = base; Red = Small Blind gives no money; Green = score requirement scales faster; Black = Eternal Jokers in shop; Blue = −1 discard; Purple = faster scaling again; Orange = Perishable Jokers; Gold = Rental Jokers. Winning a stake puts a coloured **Stake Sticker** on every Joker and deck used in that win. This is a collection layer ("Gold Sticker on all Jokers"). — [Balatro Wiki: Stakes](https://balatrowiki.org/w/Stakes); [Balatro fandom: Stakes](https://balatrogame.fandom.com/wiki/Stakes)
- There are 20 fixed-rule Challenge runs ("Rule Breaker: complete every challenge run"). — [Steam global stats, Balatro](https://steamcommunity.com/stats/2379780/achievements)
- LocalThunk added an "unlock all" option, which disables achievements: "I personally would never click that option myself... but when it was suggested I thought – why wouldn't I add that as an option? It's simply a net positive mechanic." — [TouchArcade interview, March 2024](https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/) (quote via search snippet; the page returned 403)
- LocalThunk told Bloomberg he planned to change Blue Stake in a 2025 gameplay update. — [Balatro fandom: Stakes](https://balatrogame.fandom.com/wiki/Stakes) (via search snippet; current status not verified)

**Inscryption (Oct 2021) and Kaycee's Mod (complete March 2022, free)**
- Kaycee's Mod turns Act I into a repeatable roguelike and unlocks after you beat the story. You reach higher "challenge levels" by winning a run with enough Challenge Points (skulls) active. Each level unlocks new cards, more challenges, and in-fiction dev logs written by the character Kaycee Hobbes. That gives the ladder a narrative layer. — [Inscryption fandom: Kaycee's Mod](https://inscryption.fandom.com/wiki/Kaycee's_Mod) (search snippet); [Game Informer](https://gameinformer.com/2022/03/17/inscryptions-free-kaycees-mod-roguelike-expansion-is-complete-and-available-now)
- Starting options grow from 4 to 15 by the end, per a guide. The snippet is unclear whether this counts starting decks or challenges. — [Indie Game Culture guide](https://indiegameculture.com/guides/inscryption-kaycees-mod-guide/)
- The top goal is "Skull Storm": win with every challenge active. — [XboxAchievements](https://www.xboxachievements.com/game/inscryption/achievement/289083-skull-storm.html)

**Wildfrost (April 2023)**
- The hub town **Snowdwell** is rebuilt between runs. Buildings (Pet Shop, Inventor's Hut and others) unlock new cards, tribes, cosmetics, challenges and events. — [Steam store page](https://store.steampowered.com/app/1811990/Wildfrost/) (via search snippet)
- At launch: 3 tribes, 4 difficulty levels (0–3 bells), daily runs, achievement-style unlock quests, and a secret true final boss that adapts to your previous wins. — [Steam discussion, April 2023](https://steamcommunity.com/app/1811990/discussions/0/3820783808430111599/)
- **Storm Bell update (v1.1.0, 11 Dec 2023)** lowered base difficulty (for example, companion injuries were removed) and replaced the bells with **13 selectable Storm Bells**, each worth points. A point cap rises after each max-point run, up to 10. Enough points open the True Final Boss. Gold frames on all Storm Bells unlock "Overcrank" mode, with guides citing 22 bell strength. The update also added Chiseled and Gold card frames for winning with specific cards, and Daily Voyages with random Storm Bells. — [Nintendo Everything patch notes](https://nintendoeverything.com/wildfrost-the-storm-bell-update-announced-version-1-1-0-patch-notes/); [Steam guide: Overcranked](https://steamcommunity.com/sharedfiles/filedetails/?id=3123763984)
- Later content updates followed: Teeny Tinkers (v1.1.1, Feb 2024), and Friends and Foes, billed as the biggest update yet. — [GoNintendo](https://www.gonintendo.com/contents/32186-wildfrost-updated-to-ver-1-1-1-teeny-tinkers); [SteamDeckHQ](https://steamdeckhq.com/news/wildfrost-receives-biggest-ever-content-update-friends-and-foes)

**Peglin (EA 2022, 1.0 2024)**
- **Cruciball** has 20 levels. It unlocks after a first win, and each level unlocks by beating the one before. 1: start with a −0/−1 Pebball; 2: minibosses in "?" nodes; 3: one fewer crit peg; 4: misnavigation damage 4; 5: one fewer refresh peg; 6: enemy and miniboss HP up; 7: post-battle heal 15%; 8: no starting gold, less battle gold; 9: rigged bomb self-damage 5; 10: boss HP up; 11: start with a Terriball; 12: weaker bombs; 13: boss heal only 50%; 14: −15% max HP; 15: enemies act while you reload; 16: start with an unremovable −1/−2 Horriball; 17: minibosses hit harder; 18: shop prices up; 19: extra enemies; 20: each boss gets unique modifiers. — [Peglin Wiki: Cruciball](https://peglin.wiki.gg/wiki/Cruciball)
- Orbs and relics record the highest Cruciball level you have beaten with them. This is a mastery and collection layer much like Balatro's stickers. — [Peglin fandom/wiki snippet](https://peglin.fandom.com/wiki/Cruciball)
- The first Cruciball levels arrived in v0.7.20 during Early Access. — [itch.io devlog](https://gedig.itch.io/peglin/devlog/383097/the-first-cruciball-levels-are-here-v0720)

### Inferences
- The genre's template is "content pool grows, then a cumulative difficulty ladder, then a collection or mastery overlay". Balatro's stickers, Peglin's per-orb Cruciball records and Wildfrost's gold card frames all reward winning with each item at high difficulty. They make the collection itself the long-tail goal without adding power.
- Ladders are getting shorter: StS1 had 20 levels and StS2 has 10; MT1 had 25 and MT2 has 10. Both sequels went shorter and more meaningful per step. Peglin kept 20 and Balatro 8 per deck (times 15 decks).
- Wildfrost's Storm Bells and Inscryption's skulls are *pick-your-modifiers* ladders. StS, MT and Peglin use fixed cumulative ladders.
- **Relevance:** a no-power-grind iPad game can borrow the whole toolkit except Pyre-Heart-style unlockable power: a short fixed ladder per crew or ship, an item-level mastery overlay (win-with stickers or frames), a seeded daily, and custom mode.

### Gaps
- No fetched primary source on how many runs or hours StS1 score unlocks take. The "about 4–5 unlock tiers per character" figure is commonly cited but was not verified.
- The exact current number of StS2 Epochs (EA patches may have added more) and their era structure could not be fetched. The aggregator pages returned 403 or 405, or would not resolve.
- MT2 Pyre Heart count and whether Pyre Hearts are pure sidegrades were not verified.
- Kaycee's Mod: the exact number of challenge levels (achievements suggest at least 12) and the per-level CP thresholds were not retrieved. The fandom page returned 402.

## Q2. How long does the unlock path last, and do players resent or enjoy the gating?

### Takeaway
Unlock paths are short: from a handful of runs (Wildfrost tribes, StS2 characters, which need only *playing* a run) to a few dozen (StS2 Timeline). Resentment centres on two patterns. The first is quest-gated unlocks the player cannot choose (Wildfrost at launch). The second is per-deck or per-character ladders that multiply the grind (Balatro's 15 decks × 8 stakes). Pure score-based unlocks (StS1) draw little complaint.

### Cited Findings
- Wildfrost launch complaints: progression was "not developed enough and took too long". Players had to clear building quests one at a time. Some quests forced off-strategy play inside an already harsh game. Runs that ignored quests felt unrewarded. Players wanted more concurrent quests with "more naturalistic conditions". Even so, the three tribes unlocked after only a handful of runs. — [Pixel Dive (Substack) review](https://pixeldive.substack.com/p/wildfrost-the-cutest-roguelike-deckbuilder); [Finger Guns Switch review](https://fingerguns.net/games/2023/05/02/wildfrost-review-switch-frost-smitten/) (via search snippets; the source for each claim is not separated)
- A Finger Guns reviewer was disappointed that they couldn't choose which unlock challenges to pursue to suit their current playstyle. — [Finger Guns](https://fingerguns.net/games/2023/05/02/wildfrost-review-switch-frost-smitten/) (via snippet)
- Wildfrost players asked for an option to reset meta-progression, a sign some valued the unlock journey itself. — [Steam discussion](https://steamcommunity.com/app/1811990/discussions/0/3820783808419440592/) (title only, not read)
- StS2: the character chain only needs a run *played*, and each run also feeds the global score pool. A guide comments that it "feels slow at first". — [Deltia's Gaming](https://deltiasgaming.com/all-slay-the-spire-2-epochs-and-their-unlocking-requirements/) (snippet)
- Balatro: a Steam thread titled "The low meta-progression kills this otherwise great game" shows some players want *more* meta progression. The opposite view, that losing a Balatro run is never a true loss because there is no power to bank, is argued by CBR. — [Steam discussion](https://steamcommunity.com/app/2379780/discussions/0/596263009070937123/) (title only); [CBR](https://www.cbr.com/losing-balatro-run-satisfying/)
- Balatro's "unlock all" toggle lets players skip gating at the cost of achievements. — [TouchArcade](https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/) (snippet)
- Kaycee's Mod: a Steam thread asks for "faster progression", meaning players found the CP-gated unlock pace slow. — [Steam discussion](https://steamcommunity.com/app/1092790/discussions/0/603035225279234646/) (title only)
- MT2 reviewers liked the steady flow of card, clan and skin unlocks. — [FullCleared](https://fullcleared.com/reviews/monster-train-2-review/); [Playday.one](https://playday.one/2025/05/21/monster-train-2-review/)

### Inferences
- Gating draws less anger when (a) every run, win or lose, moves something forward (score pools in StS1/2, clan XP in MT), (b) the player chooses what to chase, and (c) the gate is short. Wildfrost's launch failed (b) and partly (a).
- **Relevance:** with the crew always available, the asker avoids the main resentment vector entirely. If there are any unlocks (cosmetics, ladder rungs, codex entries), make them progress from every run and let the player choose goals.

### Gaps
- No reliable HowLongToBeat "completionist" figures were fetched for any of the six games.
- No developer statement from Deadpan Games on the town-pace criticism was found. The Storm Bell patch notes give no rationale.

## Q3. How does the difficulty ladder work, and does it keep the long-tail audience?

### Takeaway
Steam data shows a steep funnel. Roughly 50–75% of owners win once, 10–20% reach the middle of the ladder, and 2–8% clear the top. The ladder is what the long-tail core plays, while the median player stops after the content unlocks. Top-ladder clear rates: StS1 A20 7.3%, MT1 C25 8.0%, Peglin C20 2.0%, Balatro Gold Stake once 12.2% (all decks 1.6%), Inscryption Skull Storm 2.7%.

### Cited Findings
- **Slay the Spire** (Steam global): beat Act 3 as Ironclad 56.1%, Silent 50.4%, Defect 44.1%, Watcher 26.0%. Unlock Ascension 66.4%. Ascension 10 14.8%. Heart kill ("The End?") 13.0%. Ascension 20 7.3%. All achievements 2.7%. — [Steam stats 646570](https://steamcommunity.com/stats/646570/achievements)
- **Balatro**: win a run 71.6%; Red Stake+ 43.7%; Black+ 30.2%; Gold+ 12.2%; 100% collection 4.3%; Gold Stake on every deck 1.6%; Gold Sticker on all Jokers 0.9%; all challenges 2.2%. — [Steam stats 2379780](https://steamcommunity.com/stats/2379780/achievements)
- **Monster Train**: C5 win 34.1%; C10 20.5%; C15 13.8%; C25 8.0%; all clans max level 20.0%; per-clan C25-style wins about 5%. — [Steam stats 1102190](https://steamcommunity.com/stats/1102190/achievements). A secondary source notes C25 often needs an almost perfect deck. — [Monster Train fandom](https://monster-train.fandom.com/wiki/Covenant_Ranks)
- **Monster Train 2**: first win 75.1%; C4 42.2%; C8 25.4% (no C10 achievement in the data); all clans max level 10.4%; "Level up all Souls to max" 1.2%. The Railforged clan at 6.1% may be DLC; not verified. — [Steam stats 2742830](https://steamcommunity.com/stats/2742830/achievements)
- **Peglin**: Cruciball 5 25.6%; C10 10.6%; C15 4.5%; C20 2.0%. Boss kills: Slime 81.9%, Thesaurosus dragon 45.3%. — [Steam stats 1296610](https://steamcommunity.com/stats/1296610/achievements)
- **Inscryption**: story finale ("Dramatic Finale") 41.0%. Kaycee's Mod challenge level 1 18.3%; level 4 12.1%; level 8 8.6%; level 12 6.2%; Skull Storm 2.7%. — [Steam stats 1092790](https://steamcommunity.com/stats/1092790/achievements)
- **Wildfrost**: "Snowdweller" (win a run with a tribe) 32.0%; "Charmless" 6.0%. The page summary listed "Lone Survivor" at 84.6%, which looks implausible for a win-condition achievement and may be a parsing error. No Storm Bell or true-final-boss achievement was captured. — [Steam stats 1811990](https://steamcommunity.com/stats/1811990/achievements)
- Early Wildfrost players criticised the lack of a ladder ("Only the bells and achievements... after you beat that there's not much reason") against StS's "21 difficulty levels". Another reply: "Imagine playing games just for fun instead of playing for unlocks." Deadpan's answer was the Storm Bell system eight months later. — [Steam discussion, April 2023](https://steamcommunity.com/app/1811990/discussions/0/3820783808430111599/); [Nintendo Everything](https://nintendoeverything.com/wildfrost-the-storm-bell-update-announced-version-1-1-0-patch-notes/)

### Inferences
- In every game here, the content-unlock path ends long before the ladder does, and only single-digit percentages finish the ladder. The ladder is a cheap way to serve the top 5–15%, and its absence is a loud launch complaint (Wildfrost).
- Per-character or per-deck ladders multiply length (Balatro: 15 decks × 8 stakes) but produce the steepest drop-off (12.2% → 1.6%). For a crew-based auto-battler, the choice between a ladder per ship or crew and one global ladder is the key length lever.
- Sequel shortening (StS2 to 10, MT2 to 10) suggests the developers judged that 20–25 thin steps add grind more than meaningful difficulty. This is an inference. No developer quote explaining the cut was found.

### Gaps
- No developer statement found explaining why StS2 or MT2 halved their ladders.
- Steam percentages include owners who never launched the game, so the funnel among active players is shallower than shown.

## Q4. What did the developers say about why they chose these structures?

### Takeaway
Developer statements are thin. Mega Crit describes Ascension as an experimental, opt-in, stratified challenge added on player request, with balance driven by run metrics (GDC 2019). LocalThunk treats unlocks as optional, adding "unlock all" because it is "simply a net positive". He also cites StS and Luck Be a Landlord as inspirations. No Shiny Shoe, Red Nexus or Deadpan postmortem on meta-progression was found.

### Cited Findings
- Giovannetti (Mega Crit) said Ascension was an experimental mode added because players wanted more challenge. It is a ladder where each win unlocks the next level, letting players match the difficulty they want as they improve. — [Podcast: Slay the Spire with Anthony Giovannetti](https://podcasts.apple.com/us/podcast/slay-the-spire-with-anthony-giovannetti/id1435365252?i=1000447140877) (via search summary)
- GDC 2019 talk on metrics-driven design and balance (pick rates and win rates from player run data). — [GDC Vault](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics); [Game Developer: Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-)
- LocalThunk: "I ended up buying Slay the Spire to learn how they handled controller support for a card game and, of course, that game hooked me." "I was inspired by watching some videos of Luck Be a Landlord..." "There is a lot of randomness, possibly too much, but the metastrategy for Balatro is around mitigating risk..." — [Rogueliker interview, 7 March 2024](https://rogueliker.com/balatro-interview/)
- LocalThunk on the unlock-all toggle (quoted in Q1). — [TouchArcade](https://toucharcade.com/2024/03/18/balatro-interview-mobile-port-localthunk-dlc-plans-updates-new-jokers-demo-feedback/)
- Balatro's publisher Playstack beat Gold Stakes and the Jokerless challenge so fast that LocalThunk asked, "How did you do this so fast?" — [PC Gamer](https://www.pcgamer.com/games/card-games/balatros-publisher-beat-gold-stakes-and-the-jokerless-challenge-so-quickly-it-even-surprised-localthunk-how-did-you-do-this-so-fast/)
- Shiny Shoe CEO Mark Cooke has interviews on Monster Train's design ("poggable moments", systems for big combo turns), but none on Covenant specifically was found. — [Screen Rant](https://screenrant.com/inkbound-monster-train-mark-cooke-interview/); [AIAS Game Maker's Notebook](https://interactive.libsyn.com/shiny-shoe-gmn)
- Mega Crit's own StS2 page and Q&A (YouTube) exist but were not transcribed. — [YouTube Q&A](https://www.youtube.com/watch?v=8QBRmK4Ahk0)

### Inferences
- What developers do say points to *opt-in difficulty for mastery seekers* and *unlocks as onboarding pacing* (reveal complexity gradually), not retention through power. Balatro's unlock-all and StS dailies (everything unlocked) treat unlocks as removable scaffolding.
- **Relevance:** this supports the asker's stance. Unlocks in this genre mainly pace complexity, which a designer can do without grind, for example by revealing content through early runs or a tutorialised first voyage.

### Gaps
- No GDC talk or Game Developer postmortem from Shiny Shoe, Red Nexus (Peglin), Deadpan (Wildfrost) or Daniel Mullins on meta-progression was located within the search budget.
- No Mega Crit statement on why StS2 replaced score unlocks with the Epoch Timeline was found.

## Q5. Where does the end game run out, and what do long-term players do then?

### Takeaway
The end game ends at the top of the ladder plus the collection overlay (A20 Heart, C25, Gold Stake on all decks, Cruciball 20, Skull Storm, Overcrank). After that, the long tail lives on dailies (StS, Wildfrost), self-imposed challenges and win streaks, mods (StS's large mod scene), content updates and DLC (Wildfrost updates, MT DLC, Balatro updates and collabs), and sequels. Inscryption is the outlier: its story-first design meant most players never touched the roguelike mode.

### Cited Findings
- MT1 C25 wins unlock the credits and Expert Challenges. MT2 C10 Titans roll the credits. MT2 tracks a separate **winstreak** per Covenant rank, making streaks an official end-game metric. — [MT fandom](https://monster-train.fandom.com/wiki/Covenant_Ranks); [MT2 wiki](https://monstertrain2.miraheze.org/wiki/Covenant_Ranks)
- Balatro's post-ladder layer is Gold Stickers on every Joker (0.9%) plus 20 challenge runs (2.2%). — [Steam stats](https://steamcommunity.com/stats/2379780/achievements)
- Wildfrost's post-ladder layer is Overcrank (all Storm Bells gold-framed) plus gold card frames and daily voyages. — [Nintendo Everything](https://nintendoeverything.com/wildfrost-the-storm-bell-update-announced-version-1-1-0-patch-notes/); [Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3123763984)
- Wildfrost player feedback after the true final boss suggests little left to do. — [Steam thread "Feedback after finishing the true final boss"](https://steamcommunity.com/app/1811990/discussions/0/5440953210420885272/) (title only, not read)
- Inscryption: 41.0% reached the story finale, but only 18.3% cleared even Kaycee's Mod challenge level 1. Kaycee's Mod was a free post-launch addition, finished March 2022, that gave the game a replayable mode. — [Steam stats](https://steamcommunity.com/stats/1092790/achievements); [Game Informer](https://gameinformer.com/2022/03/17/inscryptions-free-kaycees-mod-roguelike-expansion-is-complete-and-available-now)
- StS Daily Climb provides a fresh seeded challenge with a global leaderboard each day, with everything unlocked. — [Into the Spine](https://intothespine.com/2018/03/05/slay-the-spire-daily-climb/)
- Peglin per-run challenge achievements serve as self-imposed challenges: "win with only your class relic" 0.3%; "win with only level 1 orbs" 1.6%. — [Steam stats](https://steamcommunity.com/stats/1296610/achievements)

### Inferences
- Even where ladders exist, only about 2–8% of owners exhaust them. Most players' "end" is reached when the novelty of the content runs out, not the ladder. For a premium game, run-to-run variety per hour matters more than ladder length.
- The cheapest long-tail tools that need no power grind: (1) seeded daily or weekly with a leaderboard or personal-best record, (2) optional modifiers (Wildfrost bells, Inscryption skulls) that double as a custom mode, (3) "won with X" mastery marks per item or crew member, (4) win-streak tracking, (5) official challenge runs with odd rules (Balatro's 20).
- Narrative across runs is rare: Inscryption's Kaycee logs and StS2's Timeline-as-history framing are the examples here. It is a low-cost way to give unlock progress meaning without power.

### Gaps
- No data on mod usage (for example StS's Downfall or BaseMod subscriber counts) or speedrun community sizes was gathered.
- No current (late-2026) concurrent-player or long-tail retention numbers were retrieved for any title.
- The StS2 Early Access roadmap contents (planned Ascension expansion, further Epochs, Watcher return) were not verified.
