# Weaver voyage lab

Playable experiment for [the Weaver voyage walkthrough](../design/weaver-voyage-walkthrough.md):
one Aether Weaver team across a full 21-node voyage. Nothing in the live game changes.

## Play it

Serve the repository root and open the lab:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# then visit http://127.0.0.1:4173/prototypes/weaver-voyage-lab.html
```

The lab is one screen at a time. **The button in the bottom bar is always the next step**; the
bar at the top always shows the route, integrity, Writs, Salvage, berths and Aether capacity.

1. **Departure.** Read the Brief (three sector conditions and three bosses), write one sentence
   in *"This time I'm going to try…"*, and pick two free starters. *Voyage settings* at the
   bottom changes the Brief (*Walkthrough*, *Mirror*, *Random*) and the seed.
2. **Prepare.** The next node is described at the top. Three tabs:
   - **Crew** — kits, set progress (*"Deep Hold 2/3 — needs Shield"*), slots, and who gets first
     claim on the pool.
   - **Recruit** — vouchers buy anyone, with **no team-size cap**; the price rises with every recruit.
     **Releasing** someone refunds the next recruit's price minus one, so a swap always costs exactly
     1 Writ — a mid-voyage change of strategy is always possible.
   - **Equipment** — **Set perks** shows each set's perk and small portraits of who it suits
     (dimmed if not aboard); Metronome warns that its rule only works on Daven and Veska. Tap a
     piece in the hold, then tap a highlighted slot. Slots that would advance
     a set glow green, and pieces say *"Completes Daven's Deep Hold"* when they would. Crates,
     crafting and the Salvage → Writ exchange are under *Workshop*.

   At a reward node, pick one of the three rewards at the top, then press the bottom button.
3. **Fight.** Watch the shared pool fill and empty (red pips are Overdraw debt), or skip.
4. **Result.** The band, what you earned, the drop, and a short **Why** — for example *"Arunima
   went down at round 2 holding 12 of 13 Aether — before firing a single burst. The team had been
   saving it for her."* After a drop, Prepare opens on Equipment.
5. **Summary.** Rate agency and excitement separately, say what actually happened, and export.
   **Brief**, **Log**, **Notes** and **Export** are also in the top bar at any time.

Progress saves in this browser under its own key (`spacologyWeaverVoyageLabV1`), separate from
the main voyage.

**For the five-session test** in the [session progression proposal](../design/session-progression-proposal.md):
play five voyages in a row with different seeds, export each, and compare the opening pairs and
final crews. Sameness only shows up across sessions.

## Character stars, Insight, and a steeper sector 3 (8 October 2026)

**The playtest** (seed 67, 4 affixes, Hull and Drive, finished at 76 integrity) hit a ceiling. By sector 3
the crew was as upgraded as gear allows, and only going wider was left. The goal is to end a voyage
feeling you could have gone deeper or wider, with high-end fights you chase rather than coast through or
grind out.

**Stars ★1–★4.**

| | ★2 | ★3 | ★4 |
|---|---|---|---|
| Cost (Insight) | 2 | 3 | 5 |
| Health and defense | ×1.35 | ×1.8 | ×2.2 |
| Attack | ×1.25 | ×1.6 | ×2 |
| Kit | — | **one upgrade per crewmate** (`up3`, shown on every card) | — |

- **Multipliers** apply to base stats, not gear. ★2 and ★3 match the live game's crew ranks
  (`crew-progression.js`).
- **Insight**, a new currency, by the user's choice: stars don't compete with recruiting. Sources:
  - +1 per elite and +2 per boss;
  - Tier II caches (15%: 1) and Tier III caches (20%: 2);
  - Gold, at 25, then 30, 35 and so on, so late surplus Gold always has a use.
- **Typical supply** is about 9–11 Insight a voyage plus what Gold buys: roughly one ★4, or two or three
  ★3s, never the whole crew. That restraint is deliberate, after the design record's lesson that the old
  forge "promoted an entire crew to Prime, which is why nobody ever lost".

**★3 upgrades:**
- **Hanae:** Resonance basics +2.
- **Ivara:** +1 capacity.
- **Arunima:** 120% per charge.
- **Roonie:** Bypass refunds 75% of the time.
- **Veska:** +1 Refrain.
- **Daven:** draws fire for 2 turns.
- **Silen:** extra turns cost 1, 1, 1, 2, 2, 3…
- **Wren:** Shatter twice.
- **Maul:** +70% on Broken enemies.
- **Sevim:** Broken enemies take +45%.
- **Stella:** 3 poison.
- **Dolores:** detonate ×3.
- **Spore:** also heals everyone.
- **Reva:** returns 100%.
- **Tarn:** barrier of 150% of defense.
- **Ojo:** Containment cap 8.
- **Imke:** follows up twice.
- **Idris:** adds 80% to follow-ups.
- **Ekene:** carry +50%.

**Reva now returns a share of each attack's full strength, before her defense.** The test for her ★3
upgrade showed no gain: stars raised her defense, which shrank what landed on her and so what she
returned.

**Enemy scaling raised** to hp .8 / 3 / 7.5 and attack .85 / 2 / 3.4 by sector (was .8 / 2.5 / 5 and
.85 / 1.75 / 2.65). The goal is that a crew which doesn't upgrade falls behind. The scripted players now
spend Insight on the carry first, and buy Insight with surplus Gold from sector 3. At 2 affixes,
60 seeds:

| Line | Sector 3 recovery | Final boss | Finished | Integrity |
|---|---|---|---|---|
| A · build + spend (stars) | 54% | 51% | 55% | 19 |
| A, no stars | 36% | 37% | 22% | 4 |
| Hull + Drive (stars) | 62% | 51% | 43% | 12 |
| Wide, equipped (stars) | 86% | 80% | 88% | 65 |

Skipping stars costs about two-thirds of the finishes. The scripted players don't plan, so a human who
upgrades well should sit above these lines, chasing a win rather than taking one for granted. **Going
wide is still the strongest line.** More crew means more Aether, more sets and more stars to buy, and
that's the next lever to look at.

**Also fixed from the playtest:**
- Steady Hand is only valued at 5 pieces if that gear clears its crit threshold.
- Ekene fires his ultimate when it's ready.
- Recruits get all five slots.
- The promote message reported the old star.

## Sets redesigned on HoYoverse's pattern; Hull can clear alone (7 October 2026)

**What HoYo does** (HSR relics and planar ornaments, Genshin artifacts):
1. **The small bonus is a plain stat anyone can use.** Musketeer +12% ATK, Thundering Fury +15% Electro
   damage, Emblem +20% Energy Recharge.
2. **The big bonus rewards an action, never a character.** Band of Sizzling Thunder: +ATK after any
   skill. Musketeer: any basic attack.
3. **Some sets convert one stat into another.** Emblem of Severed Fate: Energy Recharge becomes burst
   damage.
4. **Threshold sets set build goals.** Rutilant Arena: at 70% crit, basic and skill damage +20%.
   Belobog: extra DEF at 50% Effect Hit Rate.
5. **Team buffs from a support.** Noblesse Oblige: after the wearer's burst, the party gains +20% ATK.

**Applied.** Every 2-piece is now a plain stat, so 2 + 2 is a stat build. Every 5-piece rewards an
action. Metronome no longer names Daven and Veska. Three new sets cover patterns 3–5. 11 sets in all:

| Set | 2 pieces | 5 pieces (the action it rewards) |
|---|---|---|
| Wellspring | +6 speed | generating at a full pool: surplus becomes barrier |
| Deep Hold | +12 health | holding: +3 capacity; full-pool basics +50% |
| Overdraw | +3 attack | spending: borrow up to 3 charges |
| Metronome | +6% healing & barrier | any timed effect lasts 1 turn longer (taunts, Resonance, Bypass, Refrains); on-beat recasts +50% |
| Fault Line | +3 attack | Breaking: +30% shield damage; your Breaks take +20% from everyone |
| Long Rot | +6 speed | poisoning: +25% poison; half spreads on death |
| Riposte | +4 defense | returning damage: +30%, and it heals you for 30% |
| Relay | +5% crit | extra hits (follow-ups, Shatters, Silen's extra turns, returned damage): +25%, next turn 5 AV sooner |
| **Steady Hand** | +5% crit | **threshold:** at 25% crit, skills and ultimates +20% |
| **Lodestone** | +4 defense | **conversion:** power + 40% of defense |
| **Chorus** | +12 health | **team buff:** on your ultimate, the crew deals +15% for 2 turns |

- **Steady Hand's threshold is a real build target:** five pieces plus a crit Lens fall short until
  crit substats are found. The unit test checks both sides of the line.
- **Every set is now worth something on everyone** (`setFit` > 0 for all 19 crew).
- **Packs:** 13 kinds, and every set is sold in at least one.
- **Saves still load.** Their pieces now give the new stats.

Full voyage, branch A, 2 affixes:
- finished 63 → 70%;
- complete sets per crew 4.9 → 3.7, because 2 + 2 is now worth wearing.

**Hull clears alone.** Pure Hull (Reva + Tarn + Ojo) cleared 0 of 60 of sector 1's first real fights.
Its damage was single-target against a swarm of 15. Changes:
- Reva's returned damage splashes 40% onto every other enemy.
- Tarn's skill (180%) also hits every other enemy for 70%.
- Ojo's skill is +60% per Containment, and at 3 or more Containment it hits every other enemy for 50%.
- Reva's skill is now 220%.
- Hull crew now treat their skill as always useful, because it's their damage.

Result: **12 of 60** (the swarm 12 of 20), in line with the other pure families (12–17), still with
no deaths.

## Four families, 12 crew, 4 family sets, 2-piece perks (7 October 2026)

**2-piece perks.** A set's first perk now turns on at 2 pieces, and the full perk stays at 5. With five
slots, 2 + 2 runs two sets' first perks at once. Every set on a crewmate's gear now counts. Before this,
only the leading set did. Set progress shows a line for each active 2-piece perk.

**12 lore crew, three per family**, with lab-native kits. They're adapted from the affix lab's kits
where it has them, under this lab's rules: skills cost 1, no skill makes Aether, and one scaling stat
each. Nour and Aurel were swapped for **Dolores** and **Idris**: both have Aether roles in the live
`aether-rules.js` (conduit and reservoir), so here they'd count as Weavers for capacity and spending.

| Family | Crew (scales with) | Engine |
|---|---|---|
| Break | Wren (attack), Maul (attack), Sevim (defense) | Shatter (Wren hits any enemy that Breaks); bonus damage on Broken enemies |
| Blight | Stella (attack), Dolores (attack), Spore (health, heals) | Poison; Dolores detonates it |
| Hull | Reva (health), Tarn (defense), Ojo (health) | Draw attacks and return the damage |
| Drive | Imke (attack), Idris (attack), Ekene (health, heals) | Follow-ups; Ekene amplifies the carry |

**Poison** matches the affix lab, as its owner specified:
- **Stacks:** up to 15. Each stack deals 0.4 × the strongest applier's power, and the last applier gets
  the credit.
- **Ticks:** at the start of the poisoned enemy's own turn, before any skip check. Damage goes straight
  to health through shields, and stacks drop by 1.
- **Detonation:** a strike, so Break vulnerability and marks apply.

**Other mechanics.**
- **Hit kinds use the affix lab's names:** `basic`, `skill`, `ult`, `follow`, `reflect`, `shatter`,
  `poison`, reported in `metrics.byKind`.
- **One kill path:** every kill (hit, poison tick or returned damage) goes through one function, so
  carriers always drop their caches.
- **No runaway chains or extra Aether:** follow-ups never set off follow-ups, and neither follow-ups nor
  returned damage make Aether.
- **Taunt** applies to every crewmate who draws fire, not just Daven.
- **Sustain and guard AI** keys on kit fields (`heal`, `guard`) instead of names, so Spore, Ekene and
  the Hull crew get carry protection.

**Family sets** (2 pieces / 5 pieces):

| Set | 2 pieces | 5 pieces |
|---|---|---|
| Fault Line | +30% shield damage | an enemy you Break takes 20% more from everyone until it recovers |
| Long Rot | your poison +25% | half a dying enemy's stacks move to the healthiest enemy |
| Riposte | returned damage +30% | returned damage heals you for 30% of it |
| Relay | follow-ups +25% | each follow-up brings your next turn 10 AV sooner |

Packs: the six Aether pairs plus four family pairs (ten kinds).

**First real fights** (swarm, elite and boss of sector 1, unequipped, 20 seeds each):

| Crew | Cleared | Recovery | Deaths per fight |
|---|---|---|---|
| Hanae + Arunima + Veska | 37 / 60 | 92% | 0.00 |
| Wren + Maul + Sevim | 17 / 60 | 70% | 0.65 |
| Stella + Dolores + Spore | 14 / 60 | 84% | 0.33 |
| Reva + Tarn + Ojo | 0 / 60 | 60% | 0.00 |
| Imke + Idris + Ekene | 12 / 60 | 64% | 1.12 |
| Silen + Roonie + Imke | 39 / 60 | 86% | 1.03 |
| Arunima + Wren + Spore | 32 / 60 | 88% | 0.02 |
| Dolores + Tarn + Veska | 0 / 60 | 40% | 0.00 |
| Maul + Sevim + Daven | 1 / 60 | 63% | 0.00 |

Every family works and leans on its own mechanic. Mixed teams that pair a family engine with a real
damage dealer do well. Pure families are weaker than the Weaver core. **Hull doesn't clear**: it
survives, then times out. It needs a damage partner, which may be the intended shape, but a player
picking three Hull crew will have a bad time.

The scripted voyage policies are still Weaver-shaped, so the sim's balance table says nothing about
the new crew yet.

## Upgrade suggestions follow set fit; quick equip (7 October 2026)

**The reported problem:** a piece's card showed its set suiting Roonie, but suggested equipping it on
Arunima. `rigValue` gave a set's perks the same worth on everyone, so stats decided. Arunima wants
attack and crit, two slots' main stats, so she won pieces of sets that do little for her. In the fight
model, Wellspring on a low-generation DPS really is nearly nothing.

**The fix:** set value is weighted by **fit**.
- **On the set's best-suited crew** (`bestOn`): 1.
- **On anyone else:** 0.3. Deep Hold is 0.7 there, because its capacity helps everyone.
- **Sets that only work on certain crew** (`onlyOn`): 0 off them.

Each piece toward a crewmate's leading set counts 2 × fit, so a set's own crew outrank a better main
stat on someone else.

Measured over 1,200 single-piece suggestions, with mixed crews that include someone the set suits:

| | Went to someone the set doesn't suit |
|---|---|
| Before | 354 |
| After | 103 |

92 of those 103 are Deep Hold, by design. When a suggestion still goes off-set, the verdict says so:
"Upgrade for Arunima — for the stats (Wellspring suits Roonie)".

**Quick equip** (Equipment tab) repeatedly makes the single biggest upgrade from the hold until none is
left. A replaced piece returns to the hold, and may go to someone else. Each move raises one crewmate's
value and changes no one else's, so it always ends and never leaves anyone worse off. It doesn't move
pieces already equipped between crewmates.

## Caches (7 October 2026)

Some enemies carry a **cache**: the corpus's Recovery caches, Currency Wars' crystals. The corpus already
uses "crystal" for Bloom crystals, so these are caches. Defeating the carrier drops it, and a marker
shows the carrier in the fight replay. Unopened caches wait in a tray on the Prepare screen. Tap one to
open it, press and drag across several to open them together, or use **Open all**. Keyboard: Enter on a
focused cache.

| Tier | Contents |
|---|---|
| I | Gold 4–7 (70%) · a piece at the sector's tier (30%) |
| II | Gold 9–14 (40%) · a piece one tier up (35%) · a Writ (25%) |
| III | two pieces one tier up (40%) · a free voucher (30%) · Gold 24–34 (30%) |

- **Scaling:** Gold scales ×1 / ×1.4 / ×1.8 by the sector the cache dropped in.
- **Seeding:** contents are seeded by voyage and cache, so reloading can't reroll them, and a cache
  opens once.
- **Sources** are fixed by the route, so a voyage's caches are bounded:
  - each Supply run carries three Tier I and one Tier II, and its flat Gold drops from 21 to 8;
  - surveys and swarms have a 30% chance of one carrier (Tier II 30% of the time);
  - each elite's Warden carries Tier II;
  - each boss carries Tier III.

**Too generous as tuned.** With the scripted players opening every cache:

| 2 affixes | Finished | Integrity |
|---|---|---|
| A · build + spend | 50 → 55% | 20 → 28 |
| Wide, equipped | 80 → **100%** | 58 → **88** |
| 4 affixes, Wide, equipped | 60 → **98%** | 34 → 74 |

This is the design record's warning ("the forge was a tide, not a decision") happening again. The wide
line turns every extra Writ, voucher and piece into more crew wearing more sets. Levers, in order:
1. smaller mid-voyage cache payouts (the 30% regular carriers and the Tier III vouchers);
2. Supply-run caches that lean to Gold and Tier I pieces rather than Writs;
3. a per-sector cache budget.

Not retuned yet: playtest first.

## Supply runs: a guaranteed opening (7 October 2026)

This follows Currency Wars' reward fights, at the user's suggestion: the first battles are a head start
for the build, not a test. Nodes 2 and 3 are now **Supply runs**. The survey and the modifier stop they
replace were a no-op here, because modifiers come from the Brief. Sector 1 is now Departure → Supply →
Supply → Swarm → Elite → Reward → Boss.

- **Many very weak enemies.** Two waves of crew size + 2 regulars each (four per wave for two starters),
  at a quarter of their health and 20% of their attack. Each has one shield layer, so Breaks still teach
  themselves. Horde doesn't double them. Across all 420 runs below, the lowest any crewmate fell to was
  44% health (median 77%). At 30% attack it was 7%, too close for a fight meant to be forgiving.
- **No deadline**, and the fight screen shows none.
- **Full rewards every time:** 21 Gold (a normal battle pays at most 14), no integrity change, and the
  usual choice of three pieces.

Checked: every one of the 21 starting pairs, across 10 seeds (each with its random Brief), cleared
both Supply runs: 420 of 420, with no crewmate down.

**Effect on the curve** (scripted players, 60 seeds, before → after):

| | Sector 1 recovery | Finished | Integrity |
|---|---|---|---|
| A, 2 affixes | 84 → 96% | 40 → 50% | 17 → 20 |
| Wide, equipped, 2 affixes | 76 → 98% | 27 → 80% | 15 → 58 |
| A, 0 affixes | 98 → 99% | 98% | 57 |

Two consequences to watch in play:
1. **Sector 1 is now easy** for every policy. Its real difficulty sits in the swarm, elite and boss, and
   those may need raising.
2. **The early Gold mostly rewards going wide.** The scripted wide player turns the head start into
   crew, and finishes 80% of 2-affix voyages against 50% for A. If that holds for a human, the
   opening's reward is deciding the strategy, and it may need to favour equipment, or offer a choice.

Not retuned yet.

## Sustain AI and a winnable first battle (7 October 2026)

**Sustain AI.** Veska and Daven forecast the damage each crewmate can take before the healer's next
turn:
- **The forecast:** every enemy action due in that window, weighted by who it is likely to target, after
  defense and barrier.
- **Danger levels:** *lethal* means the two biggest coming hits could down that crewmate; *low* means the
  expected damage leaves them under 40%.

The **carry** is the priority spender, or failing that the strongest attack scaler. When the carry is in
danger, the sustain acts at once, even out of the Aether held back for the burst.
- **Veska** otherwise holds One More Verse while she builds Refrains. She heals when Refrains are full or
  the crew is worn down.
- **Veska's ultimate** waits for danger: someone at lethal risk, the carry at risk, or two crew under 55%.
- **Daven's** team-wide barrier goes up whenever enemies will act before his next turn. Holding it tested
  worse, because a barrier prevents damage.

Each held or used turn is logged with its reason, e.g. "protecting Silen (the carry)".

**What the AI can't fix.** In the carry deaths I classified (unequipped crews, all battles):
- 294 of 319 went from above 60% health to down in one or two enemy hits.
- In 172 of them the sustain was already dead.

No healer answers that. Only prevention does: defense, barrier, taunt, and smaller fights. In the full
voyage sim, the AI alone was within noise of the old one.

**First battle.** Reported in play: a Silen start always lost the first battle with Silen dying.
Reproduced: every two-person start was close to unwinnable. Silen pairs cleared 0–1 of 40, and even
Arunima + Hanae cleared 3 of 40. Two causes:
1. **Survey size ignored crew size.** Two starters faced two waves of three regulars, about 1,180 health
   hitting for about 18 each, before the crew acted. Surveys now send waves sized to the crew: pairs for
   two crewmates, threes from three on.
2. **Silen couldn't afford a chain.** At an 8-charge pool his extra turns (2, 3, 4…) bought 3 hits at
   most. In the lab they now cost 1, 1, 2, 2, 3, 3…, so 8 charges buy 6 hits and 14 buy about 7. Flat
   1-cost steps were also tried. They fixed the start better, but give 14-hit chains late.

First battle, 40 seeds, no affixes, cleared (Silen down):

| Start | Before | After |
|---|---|---|
| Silen + Roonie | 0 (38) | 19 (4) |
| Silen + Hanae | 0 (36) | 0 (21) |
| Silen + Veska / Daven | 0 (12 / 0) | 0 (0 / 0), time runs out |
| Arunima + Hanae | 3 | 36 |

Silen + Roonie is now the natural chainer start, because Bypass refunds feed the chain. Silen with a
sustain partner no longer dies, but it lacks the damage to clear in time.

Full voyage, branch A, 2 affixes: sector 1 recovery 72 → 84%, finished 33 → 40%.

## Aether rules, scaling stats and elemental damage (7 October 2026)

**The rules** (set by the user):
- A skill costs 1 Aether unless its owner is a Weaver.
- No skill makes Aether. Skills open windows in which basics make more.
- Ultimates may still refill the pool.
- Every crewmate's kit grows with one *scaling stat*.

| Crewmate | Element | Scales with | Skill cost | What changed |
|---|---|---|---|---|
| Hanae | Energy | Defense | 1 | Skill no longer restores 5. It opens **Resonance**: for the next 3 crew turns, every basic gathers +1 |
| Ivara | Void | Attack | 2 | — |
| Arunima | Void | Attack | 3+ | — |
| Roonie | Energy | Health | 1 | **Battery.** Skill no longer restores 3. **Bypass** on the priority spender for 2 of their turns: +attack equal to 12% of Roonie's max health, and each Aether spend has a 50% chance to refund 1 |
| Veska | Growth | Health | 2 → **1** | Refrains no longer cash in as Aether. Each one becomes an **Encore**: the next crew basic gathers +1. Heals are a share of her max health |
| Daven | Order | Defense | 2 → **1** | Barriers are a share of his defense |
| Silen | Order | Attack | 2+ | — |

Veska and Daven are *cadence* crew, not Weavers, in the walkthrough's profiles, so their skills now
cost 1. Hanae's (+4) and Roonie's (+6) ultimate refills stay. So does Daven's passive refund on an
absorbed hit.

**Scaling.** A kit multiplies *power*:
- attack, for attack scalers;
- 0.18 × max health, for health scalers;
- 0.75 × defense, for defense scalers.

The constants keep each crewmate's base power near their old base attack, so 200% still means what it
did. The difference is which equipment grows it.

**New stats.**
- **Defense:** the Shield slot's main stat, and a substat. Opening barrier is now substat-only.
  Defense *D* cuts incoming damage by *D* / (*D* + 200), so about 7% at 15 and 14% at 32.
- **Elemental damage:** four substats, Energy, Void, Growth and Order damage, each +2–6%. A
  crewmate's hits gain their own element's bonus, so the same piece is worth different amounts to
  different crew.

**Roonie's number.** The suggested "40% of Roonie's max health" would be +36 attack on a 22-attack
DPS, about +160%, at this lab's stat scale. 12% (+11 attack, about +50%) is in line with what a
Sparkle-style buffer gives.

**Saves.** Saves keep working (state version 3). Existing Shield pieces now give defense instead of
opening barrier.

**What it did to the curve** (scripted players, 60 seeds, branch A, before → after):

| | Recovery, sec 1 / 2 / 3 | Final boss | Finished | Integrity |
|---|---|---|---|---|
| 0 affixes | — → 88 / 85 / 75 | — → 65% | — → 87% | 79 → 43 |
| 2 affixes | 81 / 79 / 74 → 72 / 64 / 65 | 60% → 61% | 57% → 33% | 34 → 15 |
| 4 affixes | — → 62 / 44 / 50 | — → 41% | — → 7% | 16 → 2 |

Aether is scarcer, as the rule intends: generation only comes from basics now, and skills that used
to refill now multiply basics. The pool's peak fell (11.1 at 0 affixes). I have not retuned
ECON or SCALE. Play it first: the scripted players don't steer Resonance or Encores into the
spender's turn, and a human will.

## Equipment tiers and a rising difficulty curve (7 October 2026)

**Playtest (seed 41, four affixes, 53 minutes):** two early losses (nodes 2 and 4), then every fight
from node 7 on was Perfect or nearly so, ending at 97 integrity. Five crew had full five-piece sets
by node 15. The player's notes: *"I was getting bored later into the voyage as it felt like my choices
mattered less and I was just building power for the sake of building power and not to keep up with the
enemies… my interest in the equipment fell as each unit started to get their sets with well rolled
stats."* They proposed tiered equipment so there is always something to upgrade.

**Tiers.** A piece rolls one substat per ★ (★1–★4), on top of its slot's main stat and its set.

| Sector | ★1 | ★2 | ★3 | ★4 |
|---|---|---|---|---|
| 1 | 70% | 30% | — | — |
| 2 | 10% | 50% | 40% | — |
| 3 | — | 10% | 50% | 40% |

Elite and boss drops are one tier higher; packs roll at the current sector's odds; crafting gives the
sector's baseline tier (a crafted reward one more). Pieces saved before tiers count as their number of
substats. Upgrade verdicts already account for tiers, since they compare total stats.

**The curve was the wrong shape.** For the scripted team, sector 1 was the hardest and sector 3 the
easiest (64% → 86% → 96% at two affixes): exactly the playtest. Enemy health by sector moved from
×1 / ×2 / ×3.2 to **×0.8 / ×2.5 / ×5**, and damage from ×1 / ×1.5 / ×2 to **×0.85 / ×1.75 / ×2.65**.

| Branch A, 40 seeds | Sector 1 | Sector 2 | Sector 3 | Final boss | Finished | Integrity |
|---|---|---|---|---|---|---|
| 0 affixes | 97% | 98% | 86% | 63% | 100% | 79 |
| 2 affixes | 81% | 79% | 74% | 60% | 57% | 34 |
| 4 affixes | 74% | 67% | 65% | 49% | 33% | 16 |

The scripted players are much weaker than a human (the playtester cleared four affixes at 97
integrity; branch A averages 16), so these are deliberately on the hard side for the simulation.
Re-tune against the next playtest.

## Affixes merged from the affix lab (6 October 2026)

The affix lab's conditions (`prototypes/affix-lab-model.js` on the `worktree-affix-team-building`
branch, read but not modified) now drive this lab's Brief.

**Shields and Breaks**, ported from the affix lab's `strike()` so its affixes behave the same here.
Every enemy carries shield layers (regulars 2, Motes 1, Wardens 4; the Brood 3, the Carapace 6, the
Sprinter 3). Hits chip layers first: basics at 0.75× attack, most skills 1×, Ivara's lance 1.5×,
Silen's chain 0.6× per hit, and Arunima's burst 1 + 0.25× the Aether spent. A shielded enemy takes
40% of health damage. Knocking off the last layer **Breaks** it: it's delayed by 35% of a turn, takes
35% more damage, and reforms its shields on its own next turn. The fight viewer shows layers (◆) and
BROKEN.

**The Brief is now affixes.** You pick how many (0–4, default 2); the voyage picks which, within the
category caps (one stat, one shape) and the compatibility rules (`requires`, `removes`, `touches`),
with the same reject-and-redraw roll as the affix lab. Affixes hold for the whole voyage, replacing the
one-condition-per-sector Brief. Each battle's result lists one line per affix.

| Affix | Tax | Gift | From |
|---|---|---|---|
| Spending Aether can freeze | Each Aether spent: 12% chance to freeze the spender (+60 AV) and the pool | A Break freezes the enemy through its recovery turn | affix lab |
| Shields harden | Shielded enemies take 85% less (not 60%) | A Break cracks a layer off every other enemy | affix lab |
| Shields snap back | Breaks don't delay; shields return 30 AV later | Shields soak 50% (not 60%) | affix lab |
| Breaks provoke a counterattack | A broken enemy strikes back at once | Ultimates charge 30% faster | affix lab |
| Healing is halved | Healing ×0.5 | Barriers ×2 | affix lab |
| Enemies hit 40% harder | Stat (at most one) | — | affix lab |
| Twice as many, half as tough | Shape (at most one) | — | affix lab |
| Short fuses | One round shorter | Start with 5 Aether | this lab, proposed in the affix doc |
| Deep reservoir | Start with no Aether | +3 capacity | the affix doc's version of this lab's card |
| Volatile atmosphere | Enemies deal 30% more | Crew deal 30% more | replaces this lab's "Everyone hits harder" |
| Lean reserves | −2 capacity | Basics +25% | this lab |

**Not ported:** *Poison withers* — no Weaver poisons, so its tax would be void and the card a pure
gift, which breaks the trade rule in [modifiers](../design/modifiers.md). *Concentrated fire* and
*Channelers* are still proposals in the affix doc, not in its pool. The design record's back-row
safety doesn't arise here (this lab has no rows), so *Breaks provoke* strikes any crewmate by the usual
targeting weights.

**Recalibrated** for shields: regular enemy health ×3.0 (was ×3.6); elites ×0.6 and bosses ×0.55 of
that, unchanged. The simulation now runs random Briefs at 0, 2 and 4 affixes (40 seeds each):

| Branch A (build + spend, equipped) | Elites won | Bosses won | Finished | Final integrity |
|---|---|---|---|---|
| 0 affixes | 87% | 83% | 100% | 94 |
| 2 affixes (default) | 63% | 69% | 83% | 58 |
| 4 affixes | 56% | 69% | 73% | 46 |

The count is the difficulty setting. One result worth noticing: **with affixes, five equipped crew beat
seven** (58 integrity against 52 at two affixes; 46 against 35 at four). Affixes punish breadth.

Saves reset (version 3).

## Elite and boss health (6 October 2026)

In play, a fully built team couldn't beat elites and bosses. Elites and bosses now have their own
health multipliers in `SCALE` (`eliteHp` 0.6, `bossHp` 0.55), separate from regular enemies, and the
simulation reports elite and boss win rates (recovery of 88% or more) separately.

| Walkthrough Brief, 40 seeds | Elites won | Bosses won | Final boss | Final integrity |
|---|---|---|---|---|
| A · build + spend, before | 63% | 36% | 56% | 68 |
| **A · build + spend, now** | **88%** | **85%** | **90%** | **94** |
| A, no equipment, now | 0% | 50% | 0% | 0 |

**Deliberate headroom.** The affix lab on the `worktree-affix-team-building` branch (a separate
prototype, not wired into this lab) has conditions that would make bosses much tougher if adopted
here — *Hits are capped* (no hit above 12% of an enemy's health) blunts Arunima's bursts against a
single large target, and *Shields harden* cuts damage to shielded enemies. A further step (elites
×0.5, bosses ×0.45) makes built teams win almost everything, so it was left as headroom for affixes
rather than spent now. Recalibrate bosses again when affixes are brought into this lab.

## Pack types, upgrade comparison and the Writ fund (6 October 2026)

- **Six pack types**, one per pair of sets (Wellspring & Deep Hold, …). **8 Gold for 5 pieces**, each
  from one of the label's two sets, in a random slot with random substats. Pack cards show the faces
  of crew who suit those sets. Reward nodes offer three packs of a type you choose.
- **Upgrade or scrap.** `compareFor` in the model scores a piece against what each crewmate wears in
  that slot: set perks gained or broken outweigh stats; wanted stats outweigh the rest; Metronome's
  perk counts only on Daven and Veska. Every piece shows *"Upgrade for Hanae"* (with any perk it
  unlocks or completes) or *"No upgrade for anyone — scrap"*. Tapping a piece opens a side-by-side
  comparison for every crewmate: what they wear now, stat changes, perks gained or broken, and an
  *Equip on…* button. **Scrap non-upgrades** clears every piece that helps nobody. The simulation's
  scripted players use the same function, so they and the UI agree on what an upgrade is.
- **Quick scrap.** Every piece in the hold has its own one-tap *Scrap* button. A toolbar at the top
  of the hold scraps every non-upgrade, or everything below a quality threshold, in one tap. With
  *Auto-scrap non-upgrades from packs* on, opening a pack keeps only pieces that upgrade someone
  (*"kept 2, scrapped 3 · +3 Gold"*). The setting is saved with the voyage. Equipped gear is shown as
  one row per slot with its full stats, so the comparison is readable.
- **Writ fund** replaces the all-or-nothing exchange: pay in +1, +5 or all of your Gold; every 18
  Gold becomes a Writ and the remainder carries over. The rate is unchanged. The HUD shows the fund.

With these, 40 seeds on the Walkthrough Brief: branch A finishes at 67 integrity with equipment and 0
without; seven equipped crew at 77. No recalibration was needed.

## Cheaper packs (6 October 2026)

Packs were too expensive for how much a battle paid (14 Gold against 30). Rather than raise income —
which would also have cheapened Writs and recruiting — the pack price came down: **packs 5 Gold,
scrap 1 Gold per piece, crafting 12 Gold**. A battle now buys 2–3 packs outright. Battle Gold and the
18-Gold Writ exchange are unchanged. Enemies moved to ×3.6 health and ×2.3 damage to absorb the
extra equipment.

| Walkthrough Brief, 40 seeds | Sector 1 | Sector 2 | Sector 3 | Final boss | Final integrity |
|---|---|---|---|---|---|
| A · build + spend (5, equipped) | 84% | 92% | 90% | 64% | 73 |
| A, no equipment | 69% | 67% | 46% | 0% | 0 |
| Wide, unequipped (7) | 70% | 82% | 59% | 40% | 7 |
| Wide, equipped (7) | 73% | 91% | 98% | 97% | 82 |

**Scrap compounds.** Scrapping returns about 60% of a pack's price, so a player who scraps everything
turns 14 Gold into roughly 35 Gold of packs: about seven packs and twenty pieces a battle. If that
becomes a sorting chore, lower the recovery (for example pack 6, scrap 1) rather than raising pack
prices.

## Five-piece sets, packs and rolled substats (6 October 2026)

At the user's direction, equipment now works like a collection hunt:

- **Five slots** — Core, Chassis, Shield, Lens, Coil. Three matching pieces turn on a set's first
  perk; all five turn on the full perk. The second rig is gone.
- **Every piece has a main stat from its slot** (Core +3 attack, Chassis +15 health, Shield +10
  opening barrier, Lens +5% crit, Coil +5 speed) **and two random substats** with rolled values.
  *Quality* is the mean roll, shown as a percentage on every piece, so triage is one number.
  Crewmates list the stats they **want**, and substats a suitable crewmate wants are highlighted.
- **Equipment packs**: 30 Gold for 2–5 random pieces. **Gold** (renamed from Salvage) pays 14 per
  battle; scrapping returns 5 per piece, so scrapping a whole pack recovers about half its price.
  **Scrap below N%** clears weak pieces in one tap. Reward nodes offer 3 packs instead of a second
  rig. The 1-of-3 drop after each battle and crafting (60 Gold, random substats) stay as the
  targeted routes.
- **Gold → Writ exchange is 18**, scaled so Writs per battle stay about where they were.
- **Saves reset**: the save format changed (version 2).

This reverses a cut in the design record, which removed equipment reroll economies as texture. The
lab is where that gets tested; the triage tools (quality, wants, bulk scrap) are there because the
risk is chore, not complexity.

**Calibration.** At first pass every equipped branch won every fight, so pieces were halved, battle
Gold set to 14 and packs to 30, and enemies raised to ×3.2 health and ×2.1 damage. Result, 40 seeds:

| Walkthrough Brief | Sector 1 | Sector 2 | Sector 3 | Final boss | Final integrity |
|---|---|---|---|---|---|
| A · build + spend (5, equipped) | 81% | 91% | 92% | 76% | 72 |
| A, no equipment | 78% | 76% | 46% | 14% | 0 |
| Wide, unequipped (7) | 78% | 89% | 78% | 52% | 44 |
| Wide, equipped (7) | 81% | 94% | 99% | 94% | 92 |

Equipment is now the difference between finishing the voyage and losing it. Seven equipped crew
remain the strongest line, which follows from having no team-size cap.

## Earlier equipment pass (6 October 2026)

The playtest and the no-cap measurement agreed: equipment wasn't worth chasing, and too few pieces
arrived to complete more than two or three sets. Three changes, all tunable in `EQUIP` and `SETS`
in the model:

1. **Two-piece perks.** Two matching pieces turn on half the perk (Wellspring 5 barrier per surplus
   charge, Deep Hold +1 capacity, Overdraw borrows 1, Metronome lengthens Daven's window or holds
   4 Refrains). Three pieces turn on the full perk, which also got stronger (Wellspring 15, Deep
   Hold +3).
2. **Choose 1 of 3 drops after every battle.** If anyone has started a set, one offer is always a
   piece it still needs. Offers are seeded, so reloading can't reroll them.
3. **Stronger pieces.** Roughly +60% to each piece's stat.

The simulation adds two controls: the same crew as branch A with **no equipment**, and **wide with
equipment** (all seven crew).

| Walkthrough Brief, 40 seeds | Sector 1 | Sector 2 | Sector 3 | Final boss | Final integrity |
|---|---|---|---|---|---|
| A · build + spend (5, equipped) | 97% | 96% | 96% | 87% | 94 |
| A, no equipment | 89% | 86% | 60% | 25% | 24 |
| Wide, unequipped (7) | 89% | 94% | 95% | 82% | 90 |
| Wide, equipped (7) | 96% | 99% | 100% | 100% | 100 |

**Equipment now matters**: the same five crew go from 24 integrity to 94 with it, and five equipped
crew beat seven unequipped. **But it overshoots**: seven equipped crew win every fight, so with no
team-size cap the voyage is too easy for anyone who recruits everyone. Difficulty or recruitment cost
needs recalibrating against this — that's the next measurement, not a design conclusion yet.

**Restart** is in the top bar at any time: restart the same voyage from node 1 (same Brief and seed,
to try a different opening), or roll a new one. Both take two taps.

## No team-size cap (6 October 2026)

Berths were removed at the user's direction: vouchers buy anyone, and the rising voucher price is the
only limit on team size. Set definitions now carry a short perk and a *best on* list, which the UI
shows as portraits and the simulation uses as each crewmate's home set.

**Measured consequence:** with no cap, the *wide, unequipped* policy (all seven crew, no equipment)
becomes the strongest line by a clear margin — 95% in sector 3 and 82% on the final boss, against
88% and 64% for the best equipped branch, finishing at 90 integrity against 76. The equipped
branches still follow the walkthrough's five-crew schedule, so this is seven unequipped crew
against five equipped. Because each Weaver adds a point of Aether capacity, recruiting is currently
stronger than equipping. Options if play confirms it: steeper voucher prices, capacity that doesn't
grow with every recruit, or stronger set perks.

## What the screen-flow rebuild fixes, and what it doesn't

After the first hand-played voyage (seed 41, Walkthrough), the UI was rebuilt around one screen
and one next step at a time, with tap-to-equip and set progress. **Rules and calibration are
unchanged.** From that playtest:

| Problem seen in the playtest | Status |
|---|---|
| No set completed in 19 nodes; set progress was invisible | **Visibility fixed** (progress on every crewmate, pieces say what they advance). Drop odds unchanged — whether sets are reachable enough still needs play |
| Losses couldn't be read | **Fixed** — each result explains itself from the fight log |
| Every fight had the same rhythm (one spender, one peak per cycle) | Not addressed — design work on kits and spenders |
| A free voucher needed a berth, which cost 7 Writs re-buying Ivara | Not addressed — the Recruit tab now warns, but the rule is unchanged |
| Difficulty spikes at elites, bosses and sector 3 | Not addressed — calibration |

## What's modelled, and what isn't

- **Spending decisions** come from the live [`aether-rules.js`](../../prototypes/aether-rules.js)
  `teamPlan`: reservations, Arunima's one-turn burst wait, Ivara's conservative spending, Roonie's
  discount, Silen's rising-cost chain. Kits follow [aether-weavers.md](../design/aether-weavers.md).
- **Capacity** is 6 + 1 per living Weaver + 2 for Ivara, +2 per Deep Hold set, ± the sector
  condition. It falls when someone goes down.
- **The fight** is a simplified simulation, **not the live resolver**: no rows or formation (everyone
  fights; Daven's draw-attack window is a targeting weight), no element weaknesses or shield layers,
  no Departments. Marks add 10% damage taken each, up to three.
- **Set rules** are hooked into the pool's own credit/spend path, so *wasted*, *converted* and
  *debt* are exact counts. Metronome acts on the only timed effects in the kits: Daven's draw-attack
  window, and Veska's release at exactly three Refrains.
- **Modifier stops** (nodes 3, 10, 17) pass: the Brief's sector conditions are the modifier layer.
- **Bosses** have one behaviour each: the Brood summons, the Carapace hits heavy every third attack,
  the Sprinter acts twice a round. No phases.

### Lab values that differ from the walkthrough's illustrative numbers

Calibration moved these so no branch saturates at 100%:

| | Walkthrough | Lab |
|---|---|---|
| Salvage per battle | ~8 | 8 × the band's pay share |
| Crate | 8 | 10 |
| Enemy health / damage | — | ×2.6 / ×1.8, then ×1 / ×2 / ×3.2 health and ×1 / ×1.5 / ×2 damage by sector |
| Metronome Shield | +effect duration | +10% healing and barrier |

## First measurement

`node sim/weaver-voyage.js 40` plays the walkthrough's branches as fixed policies over 40 seeds on
both Briefs ([raw results](weaver-voyage-lab-results.json)). Policies recruit on the walkthrough's
schedule, put drops on each crewmate's "home" set, and craft a missing third piece at reward nodes.
A *wide, unequipped* policy buys no equipment, converts all Salvage to Writs, and recruits whenever
it can.

| Walkthrough Brief | Sector 1 | Sector 2 | Sector 3 | Boss 3 | Final integrity | Waste |
|---|---|---|---|---|---|---|
| A · build + spend | 93% | 92% | 87% | 62% | 75 | 9% |
| B · hold + spend | 82% | 91% | 86% | 65% | 63 | 10% |
| C · build + hold | 67% | 92% | 82% | 51% | 45 | 15% |
| Wide, unequipped | 89% | 88% | 80% | 47% | 55 | 19% |

**What this says about the walkthrough's claims, in this model:**

1. **Sector 1 behaves as predicted.** Short fuses favours the build + spend pair (A 93%, B 82%,
   C 67%).
2. **Sectors 2–3 don't test crew order yet.** The scripted branches converge: by node 8 all three
   own Hanae, Ivara, Arunima and Roonie. From then on they differ only in which sets completed
   first, so A leading in every sector says more about *equipment landing order* than about the
   starting pair. Testing the walkthrough's claim properly needs branches that stay different
   longer (different fourth and fifth recruits), or hand-played voyages.
3. **The mirror doesn't flip sector 1.** With Deep reservoir in sector 1, B does *worse* there
   (70%), not better. More capacity doesn't help a team that can't fill it, which is the bottleneck B already
   had.
4. **Equipment sets are weak next to a sixth crewmate.** Wide-and-unequipped keeps pace with B and C
   in sectors 1–2, though it falls behind on the final boss. Capacity scaling with crew count may be
   doing the sets' job for them.
5. **C's waste is the highest of the equipped branches** (15%), as expected for a builder with no
   spender. How much Wellspring recovers isn't broken out yet; the per-fight `converted` count is in
   the export.

These are findings about a simplified model with scripted players, not about how the voyage feels.
They are the questions to bring to play: does A *feel* like the only sensible opening, and are the
sets worth chasing?

## Verification

- `node tests/unit/weaver-voyage.cjs` — set progress and which pieces advance a set, starters, voucher pricing by team size, berths, free
  vouchers, one-way exchange, set completion, craft/scrap, determinism, Overdraw debt and its −3
  floor, Wellspring debiting waste, Deep Hold and condition capacity, capacity falling on Ivara's
  death, a full voyage, seeded Briefs.
- `node tests/unit/aether-rules.cjs` — unchanged and still passing.
- `node tests/browser/weaver-voyage-lab.cjs` (headless) —
  the screen flow from departure through node 7: starters, prepare, fight, a result that explains
  itself, tap-to-equip with set progress, modifier stop, reward voucher, recruitment, the HUD capacity
  readout, reload persistence, export, and no horizontal overflow on any screen at 1280 and 390 pixels.

  The browser test needs Playwright on Node's module path and a matching Chromium. On this machine
  a cached install works:

  ```sh
  python3 -m http.server 4173 --bind 127.0.0.1 &
  NODE_PATH=~/.npm/_npx/e41f203b7505f1fb/node_modules node tests/browser/weaver-voyage-lab.cjs
  ```

  If that cache is gone, `npm i -g playwright && npx playwright install chromium` restores it.
