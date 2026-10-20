# Call-in and Support-Style Commanding in Action and RTS Games

Research date: 2026-10-12. Around 20 search and fetch calls. Several primary pages (TL.net David Sum interview, Liquipedia, Quantic Foundry blog, Windows Central body) returned 403 or empty bodies, so some findings rely on secondary coverage. This is flagged where it matters. Coverage is deliberately uneven: Helldivers 2, SC2 Karax, World in Conflict, Supreme Commander and Quantic Foundry are reasonably sourced. DRG Mission Control, CoH2 doctrines, Dota/LoL global ultimates and BF4 cooldown numbers are thin; see the Gaps sections.

Relevance context (for the report writer): the target is a Commander mode for a premium iPad co-op game. It has a day phase with cooldown call-ins (strikes on auto-battles, supply drops to starving fronts, convoy escorts, scans) and a night phase with a strategic war map. Autopilots fill unplayed roles.

## Q1. How call-ins work per game: costs, cooldowns, delays, telegraphs, targeting

### Takeaway
The games that do this well all use the same core loop: a cheap, frequent call-in plus a few expensive, rare ones. Each call-in has an explicit gate, which can be a cooldown, a limited number of uses, a resource cost or an earned-points cost. Most also put a deliberate delay between calling and impact, so timing and placement become the skill. Targeting is usually a physical or visible marker (a thrown beacon, a ground-targeted area) that the allies can also see.

### Cited Findings

**Helldivers 2 (2024 to present)**
- To call a stratagem, the player opens the stratagem menu (CTRL on PC) and enters a directional arrow code. A wrong input, or closing the menu, means re-entering the whole code. Most stratagems then need a thrown "stratagem ball" to mark the target for the orbiting Super Destroyer. A loadout holds up to four stratagems. — [Helldivers 2 Wiki: Stratagems](https://helldivers.wiki.gg/wiki/Stratagems)
- Example codes: Orbital Precision Strike is Right, Right, Up. Eagle Airstrike is Up, Right, Down, Right. Reinforce is Up, Down, Right, Left, Up. Eagle Rearm is Up, Up, Left, Up, Right. — [Helldivers 2 Wiki: Stratagems](https://helldivers.wiki.gg/wiki/Stratagems)
- Base cooldowns from the wiki tables: Orbital Precision Strike 80s (free); Orbital Laser 300s (10,000 Requisition Slips to unlock); Orbital 380mm HE Barrage 240s; Eagle Airstrike 15s (4,000 Req); Resupply 180s; Reinforce, SoS Beacon and Eagle Rearm 0s. — [Helldivers 2 Wiki: Stratagems](https://helldivers.wiki.gg/wiki/Stratagems)
- Two cooldown models sit side by side. Orbitals go on cooldown as soon as they hit the surface. Eagles carry several uses each, then automatically return to rearm when the payload is spent, and the player can trigger an Eagle Rearm early once payload is below 100%. — [Helldivers 2 Wiki: Stratagems](https://helldivers.wiki.gg/wiki/Stratagems)
- Orbital strikes take longer to arrive than Eagle strikes. In Cities and Factories the Super Destroyer may need to reposition, which adds to orbital call-in time. Eagle strikes drop their payload perpendicular to the throw direction, except Strafing Run and the 500kg Bomb, which drop parallel to it, so the throw angle is part of the skill. — [Helldivers 2 Wiki: Stratagems](https://helldivers.wiki.gg/wiki/Stratagems)
- A single wrong input can produce a failed deployment or a different stratagem. This is guide-level commentary, not a developer statement. — [ec.farotech guide (low-quality aggregator)](https://ec.farotech.com/?p=15752)

**Deep Rock Galactic**
- Any class can order a Resupply Pod for 80 Nitra, deducted from the team's shared pool when the order is confirmed. The pod is aimed with a beacon and drills down onto it. Mission Control voices the order: "Supply pod requisitioned. Launching now." — [DRG Wiki: Resupply Pod](https://deeprockgalactic.wiki.gg/wiki/Resupply_Pod)
- The pod has four racks, one per side. Each rack refills half of one dwarf's ammo, fuel, grenades and health. In closed alpha there were separate health and ammo racks that each refilled 100%. The pod used to cost 100 Gold until Update 4 added Nitra (older fact). — [DRG Wiki: Resupply Pod](https://deeprockgalactic.wiki.gg/wiki/Resupply_Pod); [DRG Wiki: Update 4](https://deeprockgalactic.wiki.gg/wiki/Update_4:_A_Home_in_Orbit)

**StarCraft II co-op: Karax (calldowns from the top panel)**
- Orbital Strike: 5 energy, 0s cooldown, area damage of 50 (100 vs armored) per laser. Used to clear expansions and pick off key units. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- Solar Lance: 50 energy, 120s cooldown, three beams of 200 damage each. For hard attack waves and base pushes. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- Purifier Beam: 450s initial delay, then a 360s cooldown. Deals 1000 damage (2000 vs armored) over 20s and auto-targets if not controlled. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- Chrono Wave: 300s initial delay, then a 240s cooldown. Friendly structures produce at 500% speed for 20s, and this can include the ally's structures. The guide advises warning your ally 5 to 10 seconds before using it. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- Reconstruction Beam is a passive Spear of Adun ability: it repairs up to 3 mechanical units or structures at 5 HP/s (units) or 10 HP/s (structures), with no cooldown. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)

**StarCraft II co-op: Raynor**
- Banshee Airstrike calls down cloaked Dusk Wings with timed life that deal damage to the target area on arrival. It is cast from the top panel. — [starcraft2coop.com: Raynor](https://starcraft2coop.com/commanders/raynor)
- With full mastery, Dusk Wings can be on the field about 50% of the time because of a short 2-minute cooldown. This is a mastery-adjusted figure from a community guide. — [TL.net Raynor guide](https://tl.net/forum/starcraft-2/526722-co-op-commander-guide-raynor)
- Patch 4.2.4 (2018) raised the Hyperion cooldown mastery from -3s to -4s per point, with the maximum going from -90s to -120s. The base Hyperion cooldown was not found. — [Blizzard 4.2.4 patch notes](https://news.blizzard.com/en-us/article/21700683/starcraft-ii-4-2-4-patch-notes)

**World in Conflict (2007; older)**
- Tactical Aid (TA) points are earned by capturing and holding command points and by destroying enemy units. They are spent on off-map support: napalm, air strikes, artillery, paratroopers and a tactical nuke. — [Shacknews MP preview](https://www.shacknews.com/article/47404/world-in-conflict-multiplayer-preview); [Tropedia: World in Conflict](https://tropedia.fandom.com/wiki/World_in_Conflict)
- Strikes come in three strength tiers at rising cost. Some aids allow up to three deployments before recharging. — [Tropedia: World in Conflict](https://tropedia.fandom.com/wiki/World_in_Conflict)
- "There is a considerable delay on every inbound strike, so timing becomes key." The preview's example is a player baiting helicopters with tanks, then calling anti-air onto the spot. — [Shacknews MP preview](https://www.shacknews.com/article/47404/world-in-conflict-multiplayer-preview)
- Massive reportedly said the nuke is only tactical in size and very hard to get more than once per game. This comes from a pre-release, self-labelled speculative wiki mirror. — [Tropedia: World in Conflict](https://tropedia.fandom.com/wiki/World_in_Conflict)

**Battlefield 4 Commander Mode (2013; older; tablet/PC)**
- Default assets such as cruise missiles are the same on every map and refresh on a timer. — [WhistleOut BF4 Commander tips](https://whistleout.ca/CellPhones/Guides/Battlefield-4-Commander-App-tips-to-command-and-conquer)
- The Infantry and Vehicle scans are "main asset loop" resources, earned by holding specific capture points. — [Battlefield Wiki: Satellite Scan](https://battlefield.fandom.com/wiki/Satellite_Scan)
- While a point is held, its ability is available with a cooldown. — [PCGH preview (German)](https://www.pcgameshardware.de/Battlefield-4-Spiel-18685/Specials/Battlefield-4-Multiplayer-Commander-Battlelog-1072530/)
- The commander gives orders to squads, and squads that follow them are rewarded with squad assets such as Rapid Deploy, Supply Drop and Vehicle Drop. A Supply Drop is a parachuted crate that heals and resupplies nearby soldiers. — [Prima BF4 eGuide](https://primagames.com/eguides/battlefield-4-eguide/battlefield-bootcamp/extended-play); [WhistleOut](https://whistleout.ca/CellPhones/Guides/Battlefield-4-Commander-App-tips-to-command-and-conquer)
- The cruise missile has a telegraph and a counter. The enemy commander's EMP UAV can disable an incoming missile, and a guide notes a 15s gap between targeting and strike (so the EMP should go up about 11s in). — [WhistleOut](https://whistleout.ca/CellPhones/Guides/Battlefield-4-Commander-App-tips-to-command-and-conquer)

**Company of Heroes 3: Italian dynamic campaign (2023)**
- Call-ins in the Italian campaign depend on supporting forces being nearby. Unit access is gated by the company level the player has unlocked. — [Prima Games review](https://primagames.com/reviews/company-of-heroes-3-review)
- The map is turn-based: units take turns capturing territory and attacking. It borrows heavily from Ardennes Assault, the CoH2 expansion. — [Sportskeeda review](https://sportskeeda.com/esports/company-heroes-3-review-a-middling-war-effort-despite-ambitious-scope); [Entertainium review](https://entertainium.co/2023/03/02/company-of-heroes-3-review/)
- Fuel, ammunition and manpower set how many units, and which types, the player can build. — [NPR review](https://www.npr.org/2023/02/20/1158011960/company-of-heroes-3-review)

**Mechabellum (Game River; early access 2023, full release 2024)**
- Each round, players get supplies to buy and place units. Once placed, units cannot be moved or directly controlled during the battle. A tower ability can set a unit's path, but only before the round starts. — [Wikipedia: Mechabellum](https://en.wikipedia.org/wiki/Mechabellum); [Steam discussion](https://steamcommunity.com/app/669330/discussions/0/3805027266432355508)
- Mike Morhaime (Dreamhaven): it looks like an RTS, "but you can pause to think after each turn." — [GamesBeat](https://gamesbeat.com/mechabellum-gets-a-second-chance-as-dreamhaven-relaunches-the-mech-autobattler/)

**Supreme Commander (2007; older)**
- Strategic zoom goes from a single truck-sized robot to a whole 6,000 km² theatre. Maps reach up to 80 x 80 km, with up to about 1,000 units per player. — [PC Gamer: Making of SupCom](https://pcgamer.com/the-making-of-supreme-commander); [Wikipedia](https://en.wikipedia.org/wiki/Supreme_Commander_(video_game))
- Players get around by zooming out to strategic view and zooming back in, rather than scrolling or using the minimap. — [Shacknews 360 preview](https://www.shacknews.com/article/50813/supreme-commander-on-xbox-360)

### Inferences
- Common pattern: a cheap, spammable "bread and butter" call-in (HD2 Eagle at 15s, Karax Orbital Strike at 5 energy), a mid-tier call-in on a 1 to 3 minute cooldown (Precision Strike 80s, Resupply 180s, Solar Lance 120s), and one or two "ultimate" call-ins on 4 to 6 minute cooldowns or scarce resources (Orbital Laser 300s, Purifier Beam 360s, the WiC nuke). This three-tier rhythm keeps a supporter busy every few seconds while still giving them big moments to save up for.
- An initial delay before first use (Karax's Purifier Beam at 450s, Chrono Wave at 300s) stops the ultimate from deciding the opening and builds anticipation. For a day/night clock, the "ultimate" could unlock partway through the day.
- Two-step targeting (choose the ability, then place a marker the world can see) appears in HD2, DRG, WiC and BF4. On iPad, a drag-to-place marker with a visible arrival timer maps naturally onto this.
- Gating call-ins on the state of the map (BF4 scans tied to held points, WiC points from captures, CoH3 call-ins needing nearby forces) links the commander's power to how the other roles are doing. This is a good fit for supply drops that need logistics routes, or scans tied to held relays.

### Gaps
- No exact Helldivers 2 call-in arrival times (for example, Orbital Precision Strike's seconds-to-impact). The wiki page read did not list them.
- No official CoH2 commander-doctrine call-in costs or cooldowns were retrieved. CoH3 Battlegroup specifics were not found in reviews.
- WiC delay lengths and BF4 asset cooldown numbers were not found in reliable sources.
- No Dota or LoL global-ultimate numbers were gathered (Zeus Thundergod's Wrath, Silencer Global Silence, Shen's Stand United, Soraka's Wish, Karthus's Requiem). Coverage is missing, not deliberately left out.
- Starship Troopers: Terran Command was not researched.

## Q2. How call-ins land for the supported player, and how they create memorable moments without taking control away

### Takeaway
A call-in feels satisfying when the recipient can see it coming (a beacon, beam, voice line or warning), it arrives after a short, readable delay, and it changes the fight while the recipient keeps steering their own character or units. The strongest evidence is in HD2's and DRG's diegetic delivery (voice lines, physical drops) and in Karax's explicit "warn your ally" etiquette.

### Cited Findings
- The DRG resupply is visible to the whole team and voiced: it is ordered from a beacon, drills down to the beacon, and Mission Control announces "Supply pod requisitioned. Launching now." Each of the four racks serves one dwarf. — [DRG Wiki: Resupply Pod](https://deeprockgalactic.wiki.gg/wiki/Resupply_Pod)
- Karax's Chrono Wave speeds up the ally's production. The community guide recommends warning the ally 5 to 10 seconds beforehand so they have resources ready to spend, which means the buff only pays off if the recipient knows it is coming. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- The WiC strike delay creates tactics such as baiting with tanks, then landing anti-air when the helicopters arrive. Timing becomes "key". — [Shacknews MP preview](https://www.shacknews.com/article/47404/world-in-conflict-multiplayer-preview)
- The BF4 cruise missile is visible and counterable. The enemy commander can EMP it during the roughly 15s window between targeting and strike. — [WhistleOut](https://whistleout.ca/CellPhones/Guides/Battlefield-4-Commander-App-tips-to-command-and-conquer)
- The BF4 commander does not control squads directly. They issue orders, and squads that follow them get rewarded with assets (supply drop, vehicle drop, rapid deploy). The supported players keep their agency, and there is an incentive to cooperate. — [Prima BF4 eGuide](https://primagames.com/eguides/battlefield-4-eguide/battlefield-bootcamp/extended-play)
- In Mechabellum, all control happens before the fight. The battle is watched, with no input. This is the "plan, then watch" pleasure. Steam rating at time of search: Very Positive (about 17,840 reviews). — [Wikipedia](https://en.wikipedia.org/wiki/Mechabellum); [GamingOnLinux](https://gamingonlinux.com/2023/05/mechabellum-is-an-auto-battling-supreme-commander-im-completely-hooked)
- David Sum, lead co-op designer: some commanders start from the fantasy rather than a mechanic. For Karax, the starting point was wanting to rely heavily on powers, "because we want you to feel like you're playing that character." This is from a secondary summary because the TL.net original returned 403. — [TL.net interview with David Sum](https://tl.net/forum/starcraft-2/528581-interview-with-david-sum-lead-co-op-designer)

### Inferences
- For an iPad co-op commander, every call-in should have three things the recipient can read: a ground marker in the lieutenant's or logistics player's view, a countdown, and a voice or stinger on arrival. Without these, the help is invisible, and invisible help builds no gratitude or shared story.
- An "incoming" notice to the recipient (the Chrono Wave etiquette, built into the system) lets the supported player get ready, for example by holding the line for 10s because a strike is coming. This creates shared moments without removing anyone's control.
- The lieutenant's fights are auto-battles, close to Mechabellum's "watch". So a commander strike landing mid-battle is one of the few live interventions, and a cinematic arrival with a short delay will feel dramatic. Strikes should change the odds, not settle the fight on their own, so the auto-battle outcome still feels earned.
- The BF4 model (the commander issues orders, and following them earns the follower a reward) is a direct template for "commander marks a priority front, and the logistics player gets a bonus for supplying it".

### Gaps
- No developer quotes were found on why HD2 uses physical beacons or input codes. The Johan Pilestedt PlayStation Blog interview was only reachable via secondary summary.
- No sentiment data was gathered from recipients specifically (for example, "my friend's airstrike saved me" threads).

## Q3. How cooldowns and costs prevent spam while keeping the supporter busy

### Takeaway
Games mix gating types rather than relying on one: short cooldowns for low-impact abilities, use-count magazines with a rearm (HD2 Eagles), shared team resources (DRG Nitra), earned points (WiC TA) and initial delays for ultimates (Karax). The supporter always has something nearly ready, so they don't sit idle.

### Cited Findings
- HD2 Eagles use a magazine model: several uses, then an automatic rearm, or a manual early rearm. Orbitals use a single-shot cooldown that starts on impact. — [Helldivers 2 Wiki](https://helldivers.wiki.gg/wiki/Stratagems)
- Karax's Orbital Strike costs 5 energy with no cooldown, making it a spammable filler. Solar Lance costs 50 energy with a 120s cooldown. Purifier Beam has a 450s initial delay, then 360s. — [starcraft2coop.com: Karax](https://starcraft2coop.com/commanders/karax)
- The DRG resupply costs 80 Nitra from a shared team pool, so buying one competes with mining effort. Before Update 4 it cost 100 Gold. — [DRG Wiki](https://deeprockgalactic.wiki.gg/wiki/Resupply_Pod)
- WiC TA points come from captures and kills, so the supporter's budget scales with the team's success. Tiers cost more as they get stronger, and some aids are capped at three uses before recharging. — [Shacknews](https://www.shacknews.com/article/47404/world-in-conflict-multiplayer-preview); [Tropedia](https://tropedia.fandom.com/wiki/World_in_Conflict)
- BF4 scans are tied to held capture points, and each has a cooldown while the point is held. — [Battlefield Wiki](https://battlefield.fandom.com/wiki/Satellite_Scan); [PCGH](https://www.pcgameshardware.de/Battlefield-4-Spiel-18685/Specials/Battlefield-4-Multiplayer-Commander-Battlelog-1072530/)
- With full mastery, Raynor's Dusk Wings can be up about 50% of the time (about a 2-minute cooldown). Mastery points cut the cooldown, so player progression is partly spent on more frequent support. — [TL.net Raynor guide](https://tl.net/forum/starcraft-2/526722-co-op-commander-guide-raynor); [4.2.4 patch notes](https://news.blizzard.com/en-us/article/21700683/starcraft-ii-4-2-4-patch-notes)

### Inferences
- To keep an iPad commander busy across a day phase: one zero-cooldown or very short "ping-class" tool (scan, mark target, reroute), two or three mid cooldowns (strike, supply drop, escort) staggered so one is nearly always ready, and one ultimate locked until mid-day. Unlike WiC's or BF4's PvP economies, this is co-op, so there is no counter-play. The tension has to come from fronts competing for scarce charges.
- Tying charges to how the other roles are doing (supply drops cost goods that logistics delivered, strikes recharge faster when the lieutenant holds a point) makes the roles depend on each other. This is especially useful when autopilots fill roles, because their performance then visibly feeds the commander.
- Progression that cuts cooldowns, as Raynor's mastery does, is a power grind. Per the user's memory, the player dislikes power grind, so variety unlocks (new call-in types) may suit them better than more frequent ones.

### Gaps
- No designer statement was found on target "time between meaningful decisions" for supporters.
- No data was found on idle time or "bored commander" complaints for BF4 Commander Mode.

## Q4. Why support-oriented players enjoy enabling roles (motivation research and designer commentary)

### Takeaway
Direct research on "why people enjoy support" is thin. Quantic Foundry's Community motivation ("Being on Team", "Interacting") and a 2024 LoL role/personality study (support and jungle preference linked to coalition-building, cognitive empathy and leadership) are the best evidence. Everything else is player testimony.

### Cited Findings
- In Quantic Foundry's Gamer Motivation Model, Community is "the enjoyment of interacting and collaborating with other players". Its 2019 descriptors are "Being on Team", "Chatting" and "Interacting". It sits with Competition in the Social cluster, which the 2019 reference labels "Let's Play" in an Action-Social branch about excitement. — [QF Gamer Motivation Model Reference (PDF, 2019)](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf); [QF: How we developed GMP v2](https://quanticfoundry.com/2015/07/20/how-we-developed-the-gamer-motivation-profile-v2/)
- Quantic Foundry describes its motivation factors as spectrums, not categories, and the cluster labels have changed across model versions. — [QF Reference PDF](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf)
- Šajinović and Bodroža (2024) surveyed 3,220 LoL players. Preference for Jungle and Support was associated with dominant leadership, coalition building, extraversion, cognitive empathy and openness to experience. Avoiding Support was associated with lower honesty-humility and less affective resonance. These are correlations, not causes. — [Primenjena psihologija article](https://primenjena.psihologija.ff.uns.ac.rs/index.php/pp/article/view/2535)
- An informal Reddit survey (not peer-reviewed) found support mains scored higher on honesty-humility. The poster speculated this reflects "greed avoidance", since supports don't farm. — [GosuGamers summary](https://www.gosugamers.net/lol/news/49498-lol-main-role-and-personality-experiment-results)
- A long-time support main argues that players increasingly see support's potential to "influence the game to a victory" and says she "never got bored" because the role kept evolving. This is testimony. — [Mobalytics](https://mobalytics.gg/blog/lol-importance-good-support-itsamarantha/)
- PC Gamer notes that support covers several styles (healers, engage, disengage, crowd-control utility) and that support is often avoided by players. Enjoyment may depend on finding a fitting sub-style. — [PC Gamer](https://www.pcgamer.com/uk/will-league-of-legends-ever-conquer-its-support-problem)
- David Sum built Karax around "relying heavily on powers", a commander fantasy of enabling from above rather than massing units. — [TL.net (secondary)](https://tl.net/forum/starcraft-2/528581-interview-with-david-sum-lead-co-op-designer)

### Inferences
- Two motivations seem to drive support players: a social-teamwork drive (QF Community; coalition-building) and a strategic/empathic drive (reading what teammates need, cognitive empathy). The commander role should reward both: seeing that teammates benefited, and making the clever call.
- Support is not one taste. Offering commander sub-styles (strike-heavy vs logistics-heavy vs intel-heavy call-in loadouts) parallels the healer/engage/utility split in MOBAs.

### Gaps
- No Quantic Foundry data was found that maps motivations to support-role preference specifically. The QF blog post fetch returned 403.
- No GDC talk on "designing for supporters" was found in this pass.
- No academic work was found on co-op RTS commanders or call-in roles specifically.

## Q5. How games show the supporter their help mattered (feedback, stats, thanks, pings)

### Takeaway
Evidence gathered here is mostly indirect. Diegetic voice lines, visible arrivals and reward-for-following loops (BF4) are the documented mechanisms. Helldivers 2's own developers admit that showing whether community actions matter has been their biggest shortfall.

### Cited Findings
- DRG uses a Mission Control voice confirmation on each resupply, and the pod's arrival is a visible team event. — [DRG Wiki](https://deeprockgalactic.wiki.gg/wiki/Resupply_Pod)
- In BF4, squads that follow commander orders are rewarded with squad assets. — [Prima](https://primagames.com/eguides/battlefield-4-eguide/battlefield-bootcamp/extended-play)
- Arrowhead's Mikael Eriksson (2026) said it has "never been clear if the actions of the community actually lead to different outcomes". The new Galactic War Campaigns are designed so "it will always be clear what the active Campaign is, how it's going, what the outcomes have been, and what's at stake." — [GamingBolt](https://gamingbolt.com/helldivers-2-to-start-galactic-campaigns-this-month-studio-is-working-on-roguelite-planet-warfronts); [inkl/Windows Central mirror](https://www.inkl.com/news/helldivers-2-announces-huge-updates-with-the-next-evolution-of-major-orders-massive-progression-changes-and-new-rewards-oh-and-fixes-ive-been-praying-for-too)
- Players have complained about Major Orders progress being delayed or not registering, and asked Arrowhead to communicate MOs better. — [Yahoo/Tech summary](https://tech.yahoo.com/gaming/articles/helldivers-2-players-blaming-everything-185802980.html); [PC Gamer](https://pcgamer.com/games/third-person-shooter/arrowheads-latest-major-order-is-exploiting-the-helldiver-2-communitys-greatest-weakness-communication)

### Inferences
- For the target game, end-of-day and end-of-fight summaries should credit the commander: "your strike turned the Ridge fight", "your drop kept Front B fed for 2 hours". Arrival moments should show "Commander support" with the commander's name or callsign. A low-friction "thanks" ping from the recipient (or an auto-acknowledgement from an autopilot) closes the loop.
- HD2's lesson applies directly: if the night war map doesn't show clearly how day-phase actions changed outcomes, players will feel their contribution was meaningless.

### Gaps
- No sourced details were found on in-game "thank you" or commendation systems (for example, Overwatch endorsements or DRG salutes) specifically tied to support.
- No details were gathered on SC2 co-op's end-screen stats (it shows per-player kills and APM), and the claim is unverified.

## Q6. What Helldivers 2's Major Order / Galactic War layer teaches about community-level strategic commanding

### Takeaway
A human "Game Master" runs a narrative war like a tabletop DM. Players make the strategy collectively by choosing where to deploy, and the developers react. The design produced legendary emergent stories (Malevelon Creek, Joel memes), but it suffered from unclear cause and effect and poor coordination. In mid-2026 Arrowhead moved to 1 to 3 week "Galactic War Campaigns" built around clarity.

### Cited Findings
- Johan Pilestedt (PC Gamer, Feb 2024; older): "We have an actual person with the job title of Game Master." The role chooses "which major order takes place, what daily is active, and where the enemies attack. The war fought and liberation of planets — that's all you." Joel once got up in the middle of the night to reinforce the Automatons because a planet was falling too fast. The design was inspired by tabletop D&D. — [Kotaku](https://kotaku.com/helldivers-2-galactic-war-game-master-joel-1851297376); [PCGamesN](https://www.pcgamesn.com/helldivers-2/game-master); [Press Start](https://press-start.com.au/news/playstation/2024/02/29/helldivers-2s-game-master-is-a-guy-named-joel-and-hes-secretly-pulling-the-strings-in-real-time/)
- Community manager Katherine Baskin: the goal is "to keep the game exciting and keep the never-ending war engaging", beyond "a calendar with automated events tied to major holidays." — [GGRecon](https://www.ggrecon.com/articles/helldivers-2-has-a-game-master-designed-to-fight-for-the-automatons/)
- Shams Jorjani: "we run like you would any roleplaying game as a dungeon master... You plan for different outcomes along a rough campaign." He says no Major Order has been mathematically impossible, and some were deliberately hard to encourage coordination (single-source report, date unclear). — [Destructoid](https://www.destructoid.com/who-is-joel-in-helldivers-2/); [PCGH (German)](https://www.pcgameshardware.de/Helldivers-2-Spiel-74479/News/Update-2026-Entwickler-kuendigt-hohe-Verluste-an-1490396/)
- Malevelon Creek: despite weeks of player effort, the planet barely moved towards liberation and eventually fell. Players blamed Joel, and he became a meme. — [Kotaku](https://kotaku.com/helldivers-2-galactic-war-game-master-joel-1851297376); [Dead Game substack](https://deadgame.substack.com/p/helldivers-2-players-are-at-war-with)
- PC Gamer argues the community is good at simple, focused goals but historically bad at coordinating across multiple targets, and that Arrowhead deliberately exploited this with a split order. — [PC Gamer](https://pcgamer.com/games/third-person-shooter/arrowheads-latest-major-order-is-exploiting-the-helldiver-2-communitys-greatest-weakness-communication)
- Criticisms: planets with hours left on a defence timer ignored by 200,000+ players fighting elsewhere; faction fatigue (repeated Illuminate orders when bot players wanted Automatons); progress not registering; one order pulled within 24 hours because cheaters completed it. — [Yahoo/Tech](https://tech.yahoo.com/gaming/articles/helldivers-2-players-blaming-everything-185802980.html); [Fandomwire](https://fandomwire.com/helldivers-2-problems-highlighted-in-a-single-image/)
- 2026 evolution: Galactic War Campaigns of "roughly 1–3 weeks", with at least one reward always available if its conditions are met, and planned gameplay-altering effects. Progression is split into Community Progression (war contributions) and Player Progression. Also new: "Planet Warfronts", territorial skirmishes in Defend, Frontline War and Behind Enemy Lines modes. — [GamingBolt](https://gamingbolt.com/helldivers-2-to-start-galactic-campaigns-this-month-studio-is-working-on-roguelite-planet-warfronts); [GamesRadar](https://gamesradar.com/helldivers-2-major-orders)
- Major Orders are set manually by Arrowhead, not by an automated system. — [GamesRadar](https://gamesradar.com/helldivers-2-major-orders)

### Inferences
- In the target game, the night strategic map plays the part of HD2's galactic war. The main lesson is to make cause and effect legible: each day action should visibly move a night-map value, and the next morning should open with "what changed because of you".
- A hidden human Game Master is impractical for a premium iPad co-op title, but its function can be scripted: a "director" that reinforces fronts the team is winning too easily and announces it in fiction ("enemy reinforcements landed at Ridge"). Pilestedt's "the war is yours, we choose where they attack" split is a clean division between player agency and directed pressure.
- HD2 shows that splitting attention across several targets is a real coordination challenge for large crowds. For a small co-op group with a dedicated commander role, this becomes the commander's core decision, and it is far easier to coordinate in a 2 to 4 player group than with 200,000 strangers.
- Faction fatigue (players wanting to fight the enemy they enjoy) suggests letting the commander choose among fronts instead of facing a single mandated objective.

### Gaps
- The original Arrowhead progression blog post (June 2026) was not read directly. Quotes are via GamingBolt and Windows Central coverage. Whether Campaigns have launched, and their reception, is unknown.
- No direct Reddit or Steam sentiment sampling for the Campaigns change was done.
- No Deep Rock Galactic mission-select/strategy-layer details were gathered (Deep Dives, weekly assignments, Season events). This is a gap.
