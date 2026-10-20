# Commander role design: cross-cutting theory and player-experience evidence

Scope note: about 18 search/fetch calls. Several sub-areas (Spaceteam, Mysterium, Through the Ages, Diplomacy, Mechabellum ready-up, Polytopia/Mini Metro/Rymdkapsel touch UX, academic studies of in-game leadership) returned thin or no primary material. Those are listed under Gaps rather than filled from memory. A few canonical sources (Bartle 1996, Apple HIG) are cited by their well-known URLs but were **not re-fetched in this session**; they are marked "[not fetched]".

---

## Q1. What design techniques reduce blame and stress for the commander while keeping their decisions meaningful?

### Takeaway
The evidence describes the commander seat as high-pressure and polarising: some players "thrive on the power", others avoid it. The stress comes from concentrated responsibility ("lose the command post, lose the game") combined with a high learning cost. The fixes found are structural: lower the cost of a mistake, keep part of the outcome out of the commander's hands (other players, randomness, autopilots), and give a way to learn the seat without carrying the team.

### Cited Findings
- Natural Selection 2's commander "handle[s] all the upgrades, base building and on-the-fly battle coordinating", and the role "places heavy pressure on one individual". "Some players thrive on the power of overseeing so many people's chance at victory, while others prefer the smaller goals of a ground unit." — [CGMagazine NS2 review](https://www.cgmagonline.com/review/natural-selection-2/)
- NS2 ties defeat directly to the commander's asset: if you lose all your command stations, you lose. Reviewers advise that "the best way to learn how to play commander is by not playing commander", and point to rookie servers run "under the watchful eye of a more experienced commander". — [CGMagazine](https://www.cgmagonline.com/review/natural-selection-2/); [GameSpot NS2 review](https://www.gamespot.com/reviews/natural-selection-2-review/1900-6399998/)
- NS2 players say the game "needs players who are willing to hop into the commander role", and that weak coordination leads to "absolute steamrolls that demoralize half the server". Blame for a loss falls on the visible leader. — [Steam community, NS2](https://steamcommunity.com/app/4920/discussions/0/611701999530939184)
- In an Aliens: Dark Descent thread comparing it to NS2, players say "being the commander is just not that exciting" and "having players who don't want to do your orders gets frustrating". This is anecdotal. — [Steam thread](https://steamcommunity.com/app/1150440/discussions/0/3807278817577950512)
- Keep Talking and Nobody Explodes allows two mistakes before the bomb detonates. A small error budget keeps the tension without making one mistake decisive. — [Destructoid](https://destructoid.com/?p=185268)
- Into the Breach is the standard example of "perfect-information" tactics. The enemy's next action is shown in advance, so the player's choices are meaningful and a loss reads as the player's own readable decision, not hidden dice. Its UI clarity is a stated design goal. — [GDC Vault: Into the Breach Design Postmortem (Matthew Davis, 2019)](https://gdcvault.com/play/1025772/-Into-the-Breach-Design); [80.lv GDC 2019 summary](https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach)
- Self-determination theory research finds that in-game **competence and autonomy** independently predict enjoyment and well-being after play, and **relatedness** predicts it in online/social play. Intuitive controls feed perceived competence. — [Ryan, Rigby & Przybylski 2006, Motivation and Emotion 30(4)](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf); [Przybylski, Rigby & Ryan 2010](https://journals.sagepub.com/doi/10.1037/a0019440)

### Inferences
- Blame comes from **sole visible authorship of a loss**. Ways to spread or soften it:
  - Make commander actions **advisory or boosting, not gating**. A day support call-in should add to the Lieutenant's fight, not be required for it to work. Autopilots provide a floor.
  - **Telegraph outcomes** in the Into the Breach style: show projected effects before the commander commits. A bad result then reads as a fair trade-off, not a betrayal.
  - Give an **error budget** in the KTaNE style: several soft failures before a hard one, and recoverable territory rather than "lose the HQ, lose the game".
- SDT suggests the commander's reward should be **competence feedback** ("your intel let the Lieutenant ambush; +X"), credited and visible to teammates (relatedness), not only win or loss.
- Learning the seat without carrying the team is a known need. An autopilot commander that the human can watch, or "suggested orders" a novice can accept, would act as the "rookie server".

### Gaps
- No academic study was found that measures commander stress or blame directly (CHI PLAY / FDG searches found nothing specific).
- No developer post-mortem on why players avoid NS2 or Savage commander roles was found.

---

## Q2. How do co-op designs keep the commander from bossing others around, or the others from ignoring the commander?

### Takeaway
The co-op board game field has a well-developed toolkit against "alpha players" or "quarterbacking":
- private or role-locked information;
- simultaneous or real-time play;
- time pressure;
- information placed physically in each player's own zone;
- asymmetric roles.

All of these make it hard for one person to see and decide everything. The reverse problem, others ignoring the commander, is solved by making the commander hold **information or capabilities others need**, as the KTaNE manual-holder does, rather than authority alone.

### Cited Findings
- **Hidden info plus restricted communication (Hanabi):** each player sees what teammates cannot, and communication is tightly limited, "so no alpha player can know for certain which moves will or will not be beneficial". — [Moontower Meta, "The Alpha Player Problem"](https://moontowermeta.com/the-alpha-player-problem/)
- **Time pressure (Space Alert, XCOM: The Board Game, Fuse):** information can in theory be shared, but time limits make sharing costly, so players must choose what is worth the group's time. — [Moontower Meta](https://moontowermeta.com/the-alpha-player-problem/)
- **Social or contract fixes:** the strong player accepts a less-than-optimal game, "optimal" is redefined to include developing others, or the group picks its teammates carefully ("in a group of alphas nobody is an alpha"). The author treats these as more effective than design nudges. — [Moontower Meta](https://moontowermeta.com/the-alpha-player-problem/); [Moontower Ch. 5](https://notion.moontowermeta.com/chapter-5-cures-for-pandemics-and-alpha-players)
- A catalogue of anti-quarterbacking mechanisms — [Don't Eat the Meeples, "Mitigating quarterbacking in cooperative games"](https://www.donteatthemeeples.com/p/mitigating-quarterbacking-cooperative-games):
  - **Information outside others' zone of play** (Daybreak, Leacock & Menapace): card text sits in front of each player and is hard to read across the table, drawing on Scott Rogers' "six zones of play".
  - **Simultaneous play** (Daybreak) is "a sort of forcing function" that pushes players onto their own tasks.
  - **Real-time play with short planning windows** (Now Boarding, Magic Maze, Hey Yo): "There simply isn't time here for a single player to rule proceedings." Magic Maze spreads movement *permissions* across players.
  - **Divided information** (Mental Blocks, The Mind, The Crew, The Gang): hidden information is central to these designs, and removing it "might torpedo its feasibility as a game".
  - **Asymmetric roles plus private hands** (Spirit Island): these do not remove quarterbacking but "add roadblocks that take time to get around".
  - **Player-specific info** (Pandemic) helps, but is still hard for new players.
  - The author's view: quarterbacking is "rarely a phenomenon of the game's design and more of the game's players."
- Pandemic designer Matt Leacock is reported as saying the designer has a responsibility to create mechanisms where everyone can shine and one player cannot dominate. This comes via a search summary; the primary quote was not retrieved. — [lestmyopinions summary](https://lestmyopinions.com/2018/07/29/the-alpha-gamer-problem-and-how-to-solve-it/)
- Another approach is to **rotate or share the alpha role** (Silentalk: the role "passes between players"), or to **harness** the alpha rather than block them (Boston Game Makers' Guild workshop). — [Silentalk](https://scrapbox.io/silentalk/Silentalk:_A_Board_Game_That_Turns_the_Alpha_Player_Problem_Into_Play); [MIT Game Lab, Recasting the Player](https://gamelab.mit.edu/research/recasting-the-player/)
- **Role-locked information creates mutual dependence (Keep Talking and Nobody Explodes):** the defuser sees the bomb but not the manual; the experts have the manual but cannot see the bomb. "At its heart [it] is a game about communication." The developers said they "needed to have a reason for the players to talk to each other." Random bombs stop memorisation, so communication stays necessary. — [GDC Vault: Designing Asymmetric Gameplay for KTaNE](https://gdcvault.com/play/1023113/Designing-Asymmetric-Gameplay-For-Keep); [Voices of VR #98, Ben Kane](https://voicesofvr.com/?p=927)
- Battlefield 4's commander gave orders by voice or VOIP and had powers (UAV scans, gunship, EMP, supply drops) that ground players could *feel*. Notably, the tablet app could **read chat but not type**, so communication was one-directional unless voice was used. — [Android Police](https://www.androidpolice.com/2013/11/21/new-game-ea-blurs-the-lines-between-mobile-game-and-companion-app-with-battlefield-4-commander/); [ifun.de](https://www.ifun.de/battlefield-4-der-commander-auf-dem-reissbrett-50673/)

### Inferences
- For a three-role game the KTaNE model fits best. The commander holds **intel the others cannot see** (the night war map, fog reveals). The Lieutenant and Logistics players hold **execution the commander cannot do**. Neither can boss the other because neither has the full picture.
- Prefer **requests and offers over orders**. The commander "marks" a target or "requests" a supply route, and the receiver accepts, which earns a bonus. This gives the receiver autonomy (SDT) and gives the commander a reason to be persuasive rather than dictatorial. BF4's "orders" carried a small bonus to the squads that followed them (well known, but not verified this session).
- To keep others from ignoring the commander, **make the commander's output something others *need***: reveals, buffs, call-ins, weather or route intel. Do not rely on authority alone.
- To stop the commander micromanaging other modes, the commander UI should **not** allow direct control of another human's units. Information about other seats can be summarised (Daybreak's "zone of play" idea in digital form).
- Simultaneous play on a shared clock is itself an anti-quarterbacking device: everyone is busy at once.

### Gaps
- Mysterium (the ghost communicates only through vision cards; a role-locked "commander" who cannot speak) is a highly relevant model, but no source was retrieved in this session.
- Spaceteam (each player's panel shows instructions meant for other players) was not covered by any retrieved source.
- No empirical data was found on how often followers ignore commanders in BF4, NS2 or PlanetSide 2.

---

## Q3. How should a strategic layer present information so it is readable and not overwhelming, especially on a tablet?

### Takeaway
The strongest design principle found is Zach Gage's "subway legibility" and "Three Reads": order screen information by prominence (identity at a glance, then key state, then fine detail on demand), and reveal detail contextually. Into the Breach and Hearthstone are the cited models; Slay the Spire is the counter-example. The BF4 tablet Commander App is the one direct precedent for a tablet command seat. It was received poorly (crashes, connectivity, interface) and retired in 2015 as commanders moved to PC and console.

### Cited Findings
- Gage's **subway legibility**: a game's content and appeal should be clear "only by looking at the screen". Benefits he cites are easier onboarding, better spectating and streaming, and screenshots that market the game. — [Gigazine summary of Gage, GDC 2018](https://gigazine.net/gsc_news/en/20180501-game-design-subway-legibility)
- Gage's **Three Reads**: (1) immediate hooks; (2) important but non-obvious information; (3) fine detail for those who engage further. In Into the Breach: Read 1 is the mechs, insects, grid and fire; Read 2 is the End Turn button, turn counter and terrain; Read 3 is the detailed rules. — [Gigazine](https://gigazine.net/gsc_news/en/20180501-game-design-subway-legibility)
- **Contextual reveal**: Hearthstone uses animation and colour changes to show information only when needed. Really Bad Chess hides its menu at the screen edge. Slay the Spire is the counter-example, with many small icons and numbers that are hard to read at a glance. — [Gigazine](https://gigazine.net/gsc_news/en/20180501-game-design-subway-legibility)
- The Into the Breach design postmortem covers the UI ("how they came up with that great UI"); the talk is free on GDC's YouTube. — [Game Developer](https://gamedeveloper.com/design/video-how-subset-games-designed-i-into-the-breach-i-); [GDC Vault](https://gdcvault.com/play/1025772/-Into-the-Breach-Design)
- **BF4 Commander App** (2013–2015):
  - It offered a top-down map with player locations, supply drop zones, spawn points and other information not normally visible. — [Android Police](https://www.androidpolice.com/2013/11/21/new-game-ea-blurs-the-lines-between-mobile-game-and-companion-app-with-battlefield-4-commander/)
  - A Czech site said it felt like "really holding the tactical tablets seen in other games" on an iPad mini. — [letemsvetemapplem.eu](https://www.letemsvetemapplem.eu/?p=48441)
  - Early reviews were "overwhelmingly negative", citing crashes, connection issues and a poor interface. — [Android Police](https://www.androidpolice.com/2013/11/21/new-game-ea-blurs-the-lines-between-mobile-game-and-companion-app-with-battlefield-4-commander/)
  - DICE reworked it from forum feedback and set a 7-inch-plus minimum screen on Android. — [Battlelog post (as summarised in search; fetch failed)](https://battlelog.battlefield.com/bf4/news/view/commander-app-improvements)
  - EA ended support on 11 August 2015, citing more commanders playing on PC and console. — [EA forums](https://forums.ea.com/discussions/battlefield-franchise-discussion-en/bf4-commander/6480798/replies/6480800)
- Bad North's developers say they drew their control scheme from **XCOM on a gamepad**, a grid plus slow-motion that feels "slightly turn-based". Its audio design aims that "you should be able to close your eyes and still understand what is going on", which is redundant, non-visual signalling of state. — [Nintendo Life interview](https://www.nintendolife.com/news/2018/05/feature_battling_the_viking_horde_with_bad_north_dev_plausible_concept); [Gaming Audio News](https://gamingaudionews.com/2018/04/26/bad-norths-developers-talk-about-inspiration-behind-audio-and-gameplay/)
- Polytopia is widely praised for a "sleek", touch-native interface and for "streamlining", and had about 25 million downloads by 2025. No developer UX write-up was found. — [Wikipedia](https://en.wikipedia.org/wiki/The_Battle_of_Polytopia); [Tech-Gaming review](https://www.tech-gaming.com/the-battle-of-polytopia/)
- Apple's HIG recommends minimum hit targets of about 44×44 pt. — [Apple HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) [not fetched]
- Battlefield callouts research: short, shared callouts build team-wide situation awareness and are "a precondition for coordinated play". This supports terse, standardised alert vocabulary. — [Rusk, Taylor & Ståhl 2024, Simulation & Gaming (via EMCA wiki)](https://emcawiki.net/Rusk2024)

### Inferences
- Apply the Three Reads to the night war map:
  - **Read 1** is a handful of glowing threats and opportunities on the globe.
  - **Read 2** is a short ranked "tonight's decisions" list of three to five items.
  - **Read 3** is tap-to-expand detail.
  - Avoid Slay-the-Spire-style icon soup.
- **Summarise other seats rather than mirror them.** Show "Logistics: 2 routes at risk", not the full network. This reduces load and also discourages micromanagement (see Q2).
- **Telegraph enemy intent** on the map in the Into the Breach style. That is the most "commander-ish" and most readable kind of intel.
- Lessons from the BF4 tablet app:
  - Reliability and latency are part of the UX.
  - Two-way communication matters; read-only chat was a gap.
  - A command seat that depends on another device or session is fragile.
  - Because players drifted back to the "main" platform, the commander experience must stand on its own, not as a companion app.
- On touch: use big targets and few precise drags, as in Polytopia, Mini Metro and Into the Breach. Pair them with slow-motion or turn structure so precision does not race the clock (Bad North's "slight turn-based feel"). Add redundant audio or haptic alerts.

### Gaps
- No primary material was retrieved on Mini Metro, Rymdkapsel or Polytopia touch design, or on grand-strategy alert systems (Paradox outliners, alert icons) and RTS alert design. Those are known patterns but unsourced here.
- No academic cognitive-load study specific to strategy-game UIs was retrieved.

---

## Q4. What are the best practices for a shared simultaneous day/night or turn clock, so the player who finishes early isn't bored?

### Takeaway
Civilization's lineage shows the standard toolkit:
- a turn timer that **scales with empire size**;
- **early end when everyone is ready**;
- visible "who is still deciding" status, which adds social pressure;
- options to speed up animations.

The persistent complaints are the "slow random player" and timers left at defaults that later become too short. Plan-then-resolve designs (Frozen Synapse, Mechabellum) remove waiting by having everyone plan at once and watch the result together.

### Cited Findings
- **Civ III: Play the World (2002)** had a "turnless" mode where a turn ends when the timer runs out, and a simultaneous mode where the turn ends early if all human players finish. The clock scaled with civilization size, and players could pick fast, normal or slow clocks. — [GameSpot preview](https://www.gamespot.com/articles/civilization-iii-play-the-world-updated-preview/1100-2894699/)
- **Civ V (2010)** made simultaneous turns the default. The timer started around 40 seconds and lengthened as empires grew. Problems noted in previews: processing slows late in the game; "players that click first get to act first" (a race condition); latency compounds with player count. — [Game Informer hands-on](https://gameinformer.com/games/civilization_v/b/pc/archive/2010/09/10/multiplayer-hands-on); [Shacknews](https://shacknews.com/article/65521/civilization-5-multiplayer-preview)
- **Civ VI**: custom turn timers advance early when all players finish, and the UI shows who is still working, which adds social pressure on the last player. Community advice is to turn on quick movement and combat (animations eat timer time) and to use multiplayer speed. The biggest delay source is "random players who are slow". A timer can become too short after 100+ turns. — [Steam discussion](https://steamcommunity.com/app/289070/discussions/0/340412734660313957); [Steam discussion 2](https://steamcommunity.com/app/289070/discussions/0/154644705028657540)
- The community "Fast Dynamic Timer" mod for Civ VI uses 70 s + 5 s per maximum city + 1 s per maximum unit, with extra time for World Congress turns. This is an example of timers scaled to workload. — [Steam Workshop changelog](https://steamcommunity.com/sharedfiles/filedetails/changelog/1431485535)
- Community proposals: queue economic decisions during other players' turns, with nothing finalising until your own turn; or a shared timeline that advances when everyone has run out of orders. — [CivFanatics thread](https://forums.civfanatics.com/threads/multiplayer-hybrid-and-sequential.571748)
- **Frozen Synapse**: both players plan about five seconds of action, both press PRIME, and the orders execute together; then everyone returns to planning. Hidden simultaneous orders turn waiting into prediction ("predict likely paths for your opponent"). — [Bit-tech interview](https://bit-tech.net/reviews/gaming/pc/frozen-synapse-interview/1/); [Destructoid review](https://destructoid.com/?p=83398)
- **Mechabellum**: a placement or planning phase followed by an automated battle that players cannot control. Everyone plans at the same time and then watches the resolution together. — [Steam discussion](https://steamcommunity.com/app/669330/discussions/0/3805027266432355508)

### Inferences
- Recommended pattern for a shared day/night clock:
  1. **Phase length scales with the busiest seat's workload**, like Civ III and the Civ VI mod.
  2. **Ready-up ends the phase early** when all humans are done. Autopilot seats are always "ready".
  3. Show **ready status per seat**, gently: a tick, not a shame banner.
  4. Have a **hard cap with autopilot fallback**, so unfinished orders get sensible defaults rather than nothing.
  5. **Shared resolution moments**: everyone watches the dawn battle or night results together, like Frozen Synapse's PRIME.
- Fill the early finisher's idle time with **optional, low-stakes, non-blocking tasks** that help the team. For the commander these could be scouting or reading intel, or pre-planning tomorrow's call-ins. Civ players' "queue decisions during others' turns" idea is the same move. The asker's memory notes that they enjoy steady small-task loops; that suits the support-side filler work.
- The Civ V race condition ("first clicker acts first") warns that simultaneous phases need deterministic conflict resolution, such as resolving at phase end.

### Gaps
- Diplomacy (simultaneous written orders with a negotiation phase) and Through the Ages (digital async play) were not covered by any retrieved source.
- No source was found for Mechabellum's exact ready-up or timer flow.
- No player-experience data was found on waiting-time tolerance thresholds.

---

## Q5. What does motivation research say about the share of players who like leading versus supporting, and how should a commander role serve both?

### Takeaway
No large-sample statistic was found for "% of players who want to lead". Quantic Foundry's model has no "leadership" motive. The closest proxies are Strategy (Mastery cluster), Competition and Community. Strategy is the motive that has declined most since 2015: the median gamer now sits at the 33rd percentile of the 2015 baseline. Field evidence from NS2 says players split between those who enjoy overseeing and those who prefer the smaller goals of a ground unit. A commander mode should therefore not assume a large, hardcore "strategist" audience.

### Cited Findings
- Quantic Foundry's **Gamer Motivation Profile** groups 12 motivations into 6 clusters: Action, Social, Mastery, Achievement, Immersion, Creativity.
  - Strategy (thinking ahead, making decisions) sits in Mastery.
  - Community (being on a team, chatting) sits in Social.
  - Completion sits in Achievement.
  — [Quantic Foundry GDC 2020 slides](https://quanticfoundry.com/wp-content/uploads/2020/08/GDC-2020-Slides-Player-Segments-Quantic-Foundry.pdf); [Quantic Foundry model page](https://quanticfoundry.com/gamer-motivation-model/) [not fetched]
- **Strategy decline**:
  - Across about 1.7 million respondents over nine years, Strategy fell from the 50th to the 33rd percentile relative to June 2015. Equivalently, 67% of gamers now care less about strategic thinking than the 2015 average gamer. Other motives stayed broadly stable.
  - Quantic Foundry did not claim a cause; press linked it to attention spans.
  — [Notebookcheck](https://www.notebookcheck.net/Strategy-a-dying-breed-in-gaming-study-claims-interest-wanes-in-tactical-gameplay-mechanics-despite-steady-player-counts.840658.0.html); [Push Square](https://www.pushsquare.com/news/2024/05/bombshell-report-finds-players-becoming-less-interested-in-deep-strategy-games); primary: [quanticfoundry.com/2024/05/21/strategy-decline](https://quanticfoundry.com/2024/05/21/strategy-decline/) (403 on fetch)
- The 2016 Quantic Foundry age data: Competition declines most with age, falling most between 13 and 35, while Strategy was the *most age-stable* motive. Men scored higher on Strategy than women across ages. — [PC Gamer](https://pcgamer.com/study-analyses-gaming-tastes-as-we-age)
- Gender: the most common primary motivations are Competition and Destruction for men, and Fantasy and Completion for women. These are population averages, and the sample skews heavily male (GDC 2020 deck: 87% male). — [Statista](https://www.statista.com/chart/amp/7350/compete-or-complete-gender-differences-in-gaming); [GDC 2020 slides](https://quanticfoundry.com/wp-content/uploads/2020/08/GDC-2020-Slides-Player-Segments-Quantic-Foundry.pdf)
- **Bartle's** player types (Achievers, Explorers, Socialisers, Killers) do not include a "leader" type. Leadership-like play appears across Achievers (acting on the world) and Socialisers (interacting with players). — [Bartle 1996, "Hearts, Clubs, Diamonds, Spades"](https://mud.co.uk/richard/hcds.htm) [not fetched]
- **SDT**: autonomy, competence and relatedness each independently predict enjoyment. The SDT model was explicitly compared with Yee's motivation taxonomy. — [Ryan, Rigby & Przybylski 2006](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf)
- **Leadership in online strategy games (Siitonen 2011, Illuria case):** players framed leadership as (a) a driving force, (b) needing authority, and (c) **leadership as work**. Paywalled; abstract only. — [Inderscience](https://www.inderscience.com/offers.php?id=41484)
- Lisk, Kaplancali & Riggio (2012) discuss transformational leadership in MMOs such as EVE. — [Simulation & Gaming via IDEAS](https://ideas.repec.org/a/sae/simgam/v43y2012i1p133-149.html)
- **Field split**: "Some players thrive on the power of overseeing… others prefer the smaller goals of a ground unit." — [CGMagazine NS2](https://www.cgmagonline.com/review/natural-selection-2/)

### Inferences
- **Design for two kinds of commander.**
  - *Strategists*: depth on the night map, prediction, and reading enemy intent.
  - *Supporters in the commander seat*: the day call-ins, where the satisfaction is "I helped my Lieutenant at the key moment". This fits Community and relatedness motives, and suits the asker's own taste.
  - The leading idea of a night war map plus day support call-ins already maps onto these two motives. Let either layer be autopiloted independently, so a support-minded player can play "commander" only through call-ins, and a strategist can play the night map and auto the call-ins.
- Because Strategy appeal is declining, the commander's **minimum viable play** should be a few high-impact, legible choices per night, not a spreadsheet. Depth should be optional (Read 3).
- "Leadership as work" (Siitonen) is a warning: if commanding means administration, it will feel like a job. Keep orders few and consequences dramatic.
- Since there is no leadership motive in the models, the seat should *pay out* in Mastery (prediction proven right), Social (thanks or credit from teammates) and Achievement (theatre or region objectives), not in "power over people".

### Gaps
- **No reliable figure was found for the share of players who prefer leading versus supporting.** This is a key open question. Direct survey or playtest data would be needed.
- No age or gender breakdown of the 2024 Strategy decline was retrieved (the primary page returned 403).
- No CHI PLAY or FDG paper on emergent leadership or shot-calling in team games was found in this pass. Searching ACM DL for "shotcalling", "in-game leader" and "emergent leadership" is the next step.
- No PlanetSide 2 squad-leader data was found.
