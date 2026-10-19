# Team roles, enemy pressure, and acquisition

Working proposal, 28 September 2026. No combat or economy changes are implemented by this document. This proposes revisions to the current design record; it does not silently replace it. All numerical experiment ranges and acceptance targets below are provisional.

**Acquisition decision deferred:** compare options in the [dedicated team-building lab](../../prototypes/team-building-lab.html) before selecting a direction. [Playtest method, simulations, and limitations](../testing/team-building-lab.md) document the isolated experiment. Acquisition recommendations below remain hypotheses; the lab does not modify the live game.

**Equipment direction also open:** the [five-agent design panel](voyage-team-building-design-panel.md) evaluates growing personal pouches, drag-to-combine equipment, and distinct alternative sources of team-building puzzles across a long voyage. Earlier two-slot and shared-board experiments are comparison baselines, not settled solutions to the user's scaling concerns.

## Intended outcome

A recruit should change how a team wins. A defensive recruit should prevent a meaningful failure or help operate a particular damage engine. A reward should let the player make a useful build decision now, or visibly advance a chosen improvement.

Sustain-free teams remain possible through burst, control, break, or distributed recovery. They should accept weaknesses against sustained pressure. A dedicated sustain should sometimes be the strongest use of a slot, without becoming a compulsory tax in every encounter. Two defensive characters should be an intentional protection/counter engine, not the default composition.

## What the current prototype tells us

- [Formation rules](../../prototypes/formation-rules.js) combine damage, protector, support, and hybrid classifications with placement eligibility. This conflates combat job, resource behavior, and row access. Healing, action advance, and follow-ups need more precise distinctions.
- [The live fight resolver](../../prototypes/watchable-fight.html) borrows old templates for many newer characters: Aurel and Coda both borrow Vane; Spore and Abike both borrow Sump. Distinct kit descriptions are not evidence of distinct behavior. Dedicated Weaver combat definitions take precedence where supplied.
- Back-row crew are untargetable. Recover restores downed crew to 50% health while shortening the extraction deadline by 50 AV per down; Last Stand is a separate alternative. Together with low pressure, these rules can reduce the marginal value of protection. The exact contribution needs measurement.
- [Voyage rules](../../prototypes/voyage-rules.js) currently provide fourteen battles across three seven-node sectors. Sector damage scales from 0.9 to 1.5 of baseline while speed scales from 1.0 to 1.08, before difficulty modifiers. This establishes a tuning hypothesis, not proof of the cause of low sustain demand.
- Packs currently mix crew, gear, ship items, and resources. Copy creation costs two crystals and requires already owning the character. New-character discovery therefore still depends on random access. Gold also buys field XP, and crystals compete with crafting.
- The earlier [combat value proposal](roster-combat-value-pass.md) already recommends fewer pure healers, hybrid payoffs, and individual Hull value below the deep threshold. The historical [roster simulation](roster-design.md) found weak Hull and Crew teams, but those results are not measurements of the current roster. The retained enemy-pressure fixture explicitly excludes the expanded cast.

First establish a current baseline. Do not balance the current game against historical simulation rankings or authored kit text alone.

## 1. Separate roles, mechanics, and placement

Use four primary roles. Give each character one primary role and at most two secondary descriptors. Retain synergy tags as a separate axis, and preserve the six elements as ways of acting. No changes to the cosmology are needed.

| Primary role | What earns the slot | Subtypes | Resource expectation |
| --- | --- | --- | --- |
| DPS | Converts the team's setup and resources into its main damage payoff | Focused burst, area clear, sustained damage, DoT carry, counter carry | Usually receives priority spending; resource-light carries can exist |
| Sub-DPS | Adds meaningful damage alongside the main carry | Follow-up, mark proc, spread damage, break payoff, off-turn counter | Usually efficient or conditional spending; no constant competition with the carry |
| Support | Improves teammates or removes an enemy advantage | Tempo, ultimate charge, Aether supply, amplification, debuff, control, break setup | Spends when it creates a useful opening; can generate resources otherwise |
| Sustain | Keeps the team operating through incoming pressure | Barrier prevention, interception, immediate healing, delayed healing, cleanse | Spends in response to danger or planned prevention; useful basic while safe |

Tank is an interception sustain subtype. Breaker is support when its principal contribution creates a vulnerability window, and DPS/sub-DPS when it principally cashes that window. DoT is a damage mechanic, not a primary role. A counter carry can be DPS with secondary protection. A support that heals incidentally remains support if amplification is the real reason to draft it.

Classification test: at equal investment, which contribution disappears when this unit is replaced? Use actual logs and controlled swaps, not the portrait, tags, or strongest-looking ability.

Placement should be a separate explicit property. Initially preserve current valid formations during role relabeling. Review row access and Aether spending independently; changing a label must not accidentally move a character or change its AI budget.

### Sustain authoring rules

Every sustain needs a clear protection specialty and a useful action while nobody needs recovery. That useful action may be modest damage, Aether generation, a debuff, or setup; it need not equal an offensive support's full output.

Protection should have a second interaction where appropriate: absorbed damage stores retaliation, a successful interception refunds Aether, cleansing restores tempo, or protecting a prepared ally preserves a damage window. Avoid giving every sustain the same generic attack buff or unlimited overheal conversion.

Keep meaningful constraints. A barrier prevents damage but does not remove a debuff; a healer repairs damage but cannot reliably save a target from a lethal hit; a cleanser answers disruption but has lower raw recovery. A unit must not cover every defensive problem equally well.

## 2. Define teams by their damage engine

These are build families, not mandatory recipes or new tag quotas. At four crew, start with an engine owner, an amplifier, and two answers to the encounter. As capacity grows, add coverage, a second payoff, or resource infrastructure. Never require assembling four copies of a role before an individual unit becomes useful.

| Team family | Main payoff | Useful partners | Defensive approach | Natural weakness |
| --- | --- | --- | --- | --- |
| Hypercarry | Concentrate amplification, actions, resources, and gear into one primary DPS | Damage amplifier, tempo/charge support, Aether supplier, specialized sustain | Protect the carry and preserve its damage uptime | Carry disruption, poor buff alignment, resource starvation, inadequate target coverage |
| Burst | Coordinate damage into a short decisive window, through one or several damage dealers | Charge, debuff, opening advance, burst sub-DPS | Barrier or control buys the opening | Surviving enemies, multiple waves, poor recovery between windows |
| Break / ultra-break | Convert shield breaks into additional health damage, then exploit or repeat the opening | Shred, ultra-break amplifier, break follow-up, tempo, resource support | Break delays plus protection against recovery attacks | Heavy shield investment, disruption of setup, short exploitation windows |
| Follow-up / marks | Frequent qualifying events drive extra attacks | Marker, reactor, coverage, efficient resource support | Hybrid recovery or interceptor | Retaliation against many hits; trigger starvation |
| DoT / attrition | Build damage over time, accelerate qualifying enemy-turn ticks, and choose when to cash it | Application, spread, amplification, detonation, enemy action advance | Healing, barriers, or cleanse absorb the extra enemy pressure | Cleansing, short deadlines, competing stack consumption, advancing the wrong enemy |
| Thorns / retaliation | Invite attacks onto a prepared recipient and return them as damage | Counter carry, ally targeting support, barrier engineer, enemy action advance, resource recycler | Sustain keeps the retaliation recipient operating | Unredirectable attacks, shield disruption, dangerous on-turn enemy effects |
| Tempo / multi-carry | Efficient damage across several actors and waves | Advance, affordable skills, area coverage | Deny key turns or distribute small recovery | Resource-hungry recruits, opening burst against fragile crew |

Tempo and break can combine; teams need not fit exactly one family. Fracture is currently a damage-taken debuff, not DoT. Do not label a Fracture team as DoT until its implemented damage actually ticks over time.

### Hypercarry teams

Hypercarry describes how the team concentrates investment, not how quickly it deals damage. A hypercarry can deliver burst, sustained attacks, DoT, or counters. A burst team can instead distribute its damage across several units. Test both dimensions separately.

At four crew, a starting hypercarry composition is **one DPS + two complementary supports + one sustain**. A sustain-free variant replaces the sustain with control, another amplifier, or a resource support and accepts more exposure. As capacity grows, add supports only when their marginal contribution justifies the slot; a sub-DPS is optional, not a requirement for this team family.

The two supports should operate distinct levers, such as amplification plus action advance, or vulnerability plus Aether supply. Multiple supports must be able to select the same carry intentionally. Coordinate shared Aether priority, personal ultimate charge, buff durations, and action order so advancing the carry does not cause it to act before its setup is ready. Carry-focused equipment and support equipment should create different useful investments.

A sustain earns its hypercarry slot by keeping that DPS alive and active through a dangerous window: targeted prevention, interception, cleanse, or recovery that preserves uptime. Give these specialties appropriate offensive utility, while leaving meaningful differences between them. Team-wide healing is not automatically the best defense for a team whose main vulnerability is one disrupted carry.

Compare adding each support or sustain against adding a second DPS at equal total investment. Verify that concentrating investment can win without making the same carry or support package optimal everywhere. Use controlled swaps to measure enabled output, carry actions lost to disruption, buff coverage on carry actions, and resource starvation. Reports should expose support contributions even when the carry receives most direct-damage credit.

Keep entry tag bonuses useful and deep bonuses optional build transformations. Revisit Crew's healing-only threshold and Hull's protection-only entry bonus after individual kits work. Do not make stacking healers the only way to acquire an offensive payoff, or permanently ban defensive commitments without testing them.

### Deliberate enemy turns and targeting

Requested direction: DoT and thorns teams can intentionally advance enemy actions to create more damage opportunities. Sustain can help choose which ally receives those attacks, so keeping someone alive and making them a retaliation engine become connected jobs. These are proposed mechanics, not existing universal rules.

Enemy action advance is a distinct tempo tool from ally advance. It pulls a selected enemy's next scheduled turn closer without adding battle time or granting a harmless simulated attack. The enemy takes its real turn, including applicable damage, buffs, cleanses, shield recovery, summons, and phase behavior. A player should see the selected enemy, the movement on the turn track, and the intended recipient or targeting rule before committing.

For enemy-turn DoT, the advanced turn produces its normal tick and duration progression exactly once at the defined timing. Define whether each condition ticks at turn start or turn end; if start-of-turn DoT kills the enemy, it does not attack. Advancing enemies does not accelerate AV-timed effects, allied-turn effects, or Fracture simply because they are conditions. More frequent ticks can shorten the duration sooner, so application and preservation supports remain useful.

For thorns, advancing an enemy creates a real opportunity to hit the protected retaliation recipient. Enemy delay and break can conflict with this plan: a broken enemy cannot attack until its recovery rules permit it, and advancing its turn may close a vulnerability window. This is an intentional team decision, not a reason for AI to always advance enemies whenever the skill is affordable.

### Sustain specialties for these teams

| Sustain specialty | How it operates the engine | Tradeoff |
| --- | --- | --- |
| Targeting protector | Applies a declared increase in target priority to a chosen eligible ally and protects that ally | Concentrates risk; does not affect area or fixed-target attacks |
| Barrier engineer | Lets the recipient answer hits without repeatedly losing health | Needs a retaliation trigger that works on absorbed hits; insufficient for health-loss-only thorns |
| Recovery healer | Repairs health after deliberate exposure | Supports health-loss thorns but cannot replace prevention against lethal hits |
| Cleanse / resilience sustain | Removes or resists disruption that would stop the recipient retaliating | Lower raw prevention or healing; best against disruptive attackers |
| Interception sustain | Takes dangerous hits away from fragile allies and can operate its own counter loop | Can divert hits away from a separate retaliation carry; use selective protection rather than unconditional interception |

A targeting sustain can protect and provoke **another ally**, rather than always taunting enemies onto itself. In the first slice, use a single active designation, a visible duration, and explicit increased targeting weight. If a future kit guarantees redirection, describe it as a different, stronger effect. Only eligible frontline recipients can be designated under the current placement rules; this does not silently make back-row crew targetable. Preview targeting exceptions and clear the designation if its recipient dies or becomes ineligible.

Separate damage triggers when authoring kits: being targeted, receiving an actual damaging hit, absorbing damage in a barrier, and losing health are different events. A blocked hit can trigger a received-hit retaliation or barrier-absorption payoff, but contributes no health-loss damage to health-loss thorns. Being selected for an attack is not itself a damaging hit. Start received-hit retaliation at one proc per enemy action per recipient; explicitly author capped multi-hit variants later. Damage-based reflect uses actual absorbed damage or actual health lost as specified, not raw damage before prevention.

Example retaliation core: a counter carry, a sustain that designates and barriers that carry, and a support that advances an attack-focused enemy after protection is ready. The fourth slot adds recovery, amplification, or resource supply according to the threat. A DoT team can use the same advance support with a team healer or cleanser instead, deliberately accepting additional attacks for faster ticks. Neither team requires a single mandatory sustain partner.

Prototype enemy advance as an explicit player choice first. Automated use requires active DoT or a ready retaliation payoff, useful enemy behavior, and adequate protection; avoid advancing cleansers or lethal attacks merely to increase trigger counts. Advance changes the next scheduled action only and cannot recursively grant immediate extra turns. Enemy attacks created this way grant no additional loot, and retaliation cannot trigger retaliation chains between reflectors.

Recruitment and gear choices should recognize these engines: offer targeting protection, appropriate tick preservation, barrier-compatible retaliation, or recovery after exposure. A generic shield recommendation is wrong for a carry whose payoff requires health loss. Reports show deliberate advances, resulting ticks and retaliation, extra incoming damage, and whether the intended ally received the attack.

### Ultra-break: shield removal becomes a damage engine

Requested direction: breaking an enemy should deal additional **ultra-break damage**, beyond removing shield mitigation and opening the existing vulnerability window. This is a proposed new mechanic, not current runtime behavior.

Start with an immediate payoff when the final shield layer falls. A break-specialist kit can produce a modest ultra-break on its own; partners improve shield removal, payoff strength, coverage, or frequency. The archetype must work without a mandatory named partner or four-character tag threshold.

Proposed first-slice rules:

- A genuine shielded-to-broken transition produces one ultra-break damage event when the breaking actor has that capability or receives it from an explicit team effect. Ordinary breaks retain their existing benefits. Do not grant every damage team the full specialist payoff for free.
- Calculate the additional health damage from the breaking actor's authored break potency and a bounded shield-damage contribution from the breaking action. Prototype a flat potency term plus a coefficient on shield damage actually removed by that action. Discard overkill shield damage; multi-hit and area actions resolve at most one event per newly broken target. Test whether this overly rewards last-hit ownership before choosing the final formula.
- Ultra-break is separately attributed health damage. Initially it neither removes more shield nor triggers another ultra-break, counts as a fresh attack, or receives ordinary attack/critical/vulnerability multipliers. Explicit ultra-break amplification can apply under defined stacking rules. Revisit multipliers only after measuring the baseline.
- The ability can trigger again after that enemy genuinely reforms its shield and is broken again. No recursive triggering from follow-ups, zero-shield enemies, or scripted toggling without a real restored shield budget.
- A later experimental subtype may convert a qualifying attack's would-be shield damage into ultra-break damage while the enemy is already broken. Keep this separate from the immediate on-break payoff and test it independently; it favors extending windows and must be capped per action and target.

This creates two potential break strategies: repeated shield breaks with immediate payouts, and longer exposure windows with coordinated follow-ups or an eventual sustained ultra-break effect. A break hypercarry concentrates potency and support into one breaker; a distributed break team shares removal and uses a clearly attributed payoff rule. Both need validation, including the risk that teammates steal the final break from the intended carry.

### Fast recovery is also a break-team opportunity

The current resolver reforms shields and attacks on the enemy's recovery turn. Its break routine delays the next action; the broken-window length also depends on where that enemy already sits in the turn order. Enemy attack speed, added break delay, and shield recovery timing must be measured separately.

Introduce advertised recovery profiles rather than making every enemy equally vulnerable:

| Recovery profile | Behavior | Build decision |
| --- | --- | --- |
| Standard | Current full reformation and attack on the delayed enemy turn | Balanced shield removal and exploitation |
| Fast reformer | Shorter break delay, with a visible recovery marker; restores shield and attacks on recovery | Immediate ultra-break and repeated breaking retain value; protection covers the returned attack |
| Gradual reformer | Restores a declared portion of its shield on recovery, then rebuilds normally | Frequent smaller break opportunities; balance payout against restored shield budget |
| Long exposure | Longer delay before full reformation | Coordinate follow-ups, vulnerability damage, and window extension |

Begin with the fast reformer. Test added delays of 0%, 10%, and the current 25% of its normal turn wait at equal speed and shield strength. These are tuning experiments, not fixed enemy values. A 0% added delay does not mean an immediate recovery: show the actual remaining AV. Do not let the break-causing action interrupt itself with recovery; finish its defined resolution and immediate payoff first.

Fast recovery should shorten control uptime while offering another shield to break. This preserves enemy pressure and gives ultra-break a reason to exist beyond extended stun windows. Check existing Assay turn denial and ally delay effects so they cannot silently erase the profile; use explicit, bounded elite resistance if needed, while preserving useful control. Avoid unconditional instant recovery or break immunity as the default counter.

Track ultra-break damage, who caused each break, breaks per 100 AV, restored shield budget, broken-window AV, and enemy attacks after recovery. Test the same break team against all recovery profiles. It should have useful matchups against fast reformers, not merely lose its defining payoff because the enemy recovers sooner.

## 3. Give enemies enough opportunities to matter

Measure enemy actions before increasing raw damage. More readable, moderate attacks can exercise healing, interception, and counters better than an occasional lethal spike. Killing or breaking an enemy before its dangerous action remains a legitimate answer.

Create five benchmark pressure profiles:

| Profile | Threat | Answers that should matter |
| --- | --- | --- |
| Frequent single-target attacks | Repeated frontline attrition | Interception, reliable healing, counter damage, fast clears |
| Telegraph into heavy hit | A visible dangerous action on the turn track | Barrier, interrupt, break, burst before impact |
| Repeated area chip | Several crew lose health over time | Team recovery, distributed lifesteal, area clear |
| Debuff pressure | Poison, reduced recovery, or skill-cost disruption | Cleanse, priority targeting, control; raw healing alone has limits |
| Long boss / reinforcements | Survive setup and renewed pressure | Sustainable resource use, delayed sustain, maintained damage |

Show the threat before recruitment or equipment decisions and show telegraphed actions in combat. Avoid surprise unavoidable damage designed solely to force a healer.

### Experiments, one lever at a time

1. At fixed health, test enemy speed at baseline, +15%, and +30%. Record attacks that resolve, attacks denied by death/break/control, and incoming damage per 100 AV.
2. With a promising action frequency, test damage at baseline, +15%, and +30%. Watch frontline deaths before the first useful defensive action, not just final win rate.
3. Compare standard and fast-reformer recovery profiles with immediate ultra-break enabled for specialist builds. Test bounded delay resistance on selected elites separately. Preserve break's damage payoff while reducing excessive control uptime where needed.
4. Compare current back-row immunity with selected, advertised area or back-row threats. Keep ordinary attacks frontline-focused. Ensure affected back-row characters have survivable health and access to an answer before enabling this broadly.
5. Compare Recover, Last Stand, and no automatic recovery at identical investment. Retain an accessible recovery option; balance the default mode explicitly rather than accidentally relying on deaths as free healing.

Do not initially add persistent crew-health attrition between battles. It would make healing valuable through a different system and could conceal weak encounter design.

Provisional pressure goal: ordinary encounters allow several offensive solutions; attrition encounters favor suitable sustain; bosses contain a readable danger window that a prepared defense or aggressive interruption can answer. Defensive builds must still meet the extraction deadline.

## 4. Convert the roster in small slices

Audit every live recruit, including expanded Weaver entries. Inventory its implemented source, actual triggers, primary job, resource demand, threat answered, safe-state action, and two useful partners. Count the roster from code before deciding how many units to convert.

| Character / group | Proposed direction | First distinct behavior to implement or verify |
| --- | --- | --- |
| Aurel | Tempo support | Advance a useful ally; separate from Coda's borrowed implementation |
| Coda | Follow-up sub-DPS candidate | Capped echo of an allied damaging action; resolve overlap with his existing gatherer identity before replacing it |
| Ilka | Predictable barrier sustain | Fixed prevention with a small, capped payoff when protection actually absorbs damage |
| Tomás | Barrier/counter DPS candidate | Build and release retaliation; ensure he can start his own modest loop |
| Reva / Tarn | Interception/counter candidates | Distinct targeting or counter triggers; verify both can function without a mandatory partner |
| Ojo | Interception sustain | Reliable target redirection and self-recovery with a useful basic |
| Daven | Sustain / Aether support | Validate his already authored and implemented blocked-hit refund under real pressure |
| Nahana | Immediate recovery sustain | Reliable emergency healing plus a restrained safe-state utility action |
| Veska | Delayed recovery / Aether sustain | Validate her existing Refrain healing and resource return; avoid duplicating Nahana's timing |
| Navigator | Scaling support or sub-DPS | Make growth improve an offensive contribution, not only surplus recovery |
| Spore / Abike / Redcap | Spread sub-DPS, conversion support, preservation support | Separate application, consumption, and preservation; healing stays secondary |
| Ekene / Roonie | Charge support / Aether support | Distinguish personal ultimate charge from shared skill resources and action advance |

These assignments are kit hypotheses, not final labels. Preserve identities and lore. Begin with Aurel/Coda plus one sustain and one counter payoff; evaluate before rewriting the remaining cast. Keep two clearly different dedicated healing anchors as a starting direction, not an enforced final quota.

## 5. Make acquisition a sequence of build decisions

Recommended default: voyage-local drafting, with pack openings retained as bounded discovery moments. Permanent collection is a separate product decision. Do not add permanent stat growth until voyage balance and reward ownership are defined.

The loop becomes: **inspect the next threat → choose a recruit or gear improvement → prepare an engine → fight → see what worked → choose the next improvement**.

### Characters: discovery plus a guaranteed route to completion

- Departure supplies offer a choice of viable engine starters and a complementary recruit, with a small basic-gear choice. This establishes a direction without selecting a complete team for the player.
- At explicit recruitment opportunities, choose one of three characters. Offers can include an engine-compatible candidate, an answer to the upcoming threat, and a wildcard. Evaluate eligibility from actual mechanics, not merely matching tags. Show why each fits, while allowing off-plan choices.
- Nominate one unowned recruit as a target. Completed recruitment opportunities advance a visible requisition meter; an initial prototype grants the named recruit after three opportunities. Progress is earned by participation, not buying rerolls. Changing the target retains earned progress. A guarantee redeems as that opportunity's recruit choice, rather than silently adding an extra full reward.
- Existing packs remain an optional gold purchase with finite stock. Reduce redundant card handling and show the real pool. Buying packs accelerates discovery or offers pivots; it cannot be the only way to complete a viable engine.
- Recruitment must recognize hypercarry builds as complete engines even with only one DPS. Offer complementary amplifiers, resource support, or carry protection rather than repeatedly recommending another damage dealer. Targeting must support completing the support package as well as finding the carry.
- Keep known-character copy creation deterministic initially. Expose the full remaining cost of a rank upgrade and preview its benefit alongside a new recruit or gear option. New-character targeting must work for unowned recruits; Attunement currently does not.
- Retain reserves and free between-battle formation changes. No automatic sale or merge that destroys a player's unresolved choice. Ensure duplicate rewards advance a useful, visible upgrade or provide an explicit alternative.

Prefer extending existing route rewards and recruitment moments over adding mandatory stops to every battle. Keep anticipation between meaningful choices. Prototype the three-opportunity guarantee before adding another currency; a meter can live on the voyage state.

### Gear: choose a behavior, then improve it

- Separate primary crew offers from primary gear offers. Mixed packs can remain optional, but targeted recruitment should not fail because its reward budget rolled ship equipment.
- Give basic functional gear early. At selected supply/workshop nodes, choose one of three items or ingredients, with at least one candidate eligible for an owned character and one deterministic crafting alternative.
- Preserve two slots and free transfers. Support equip, replace, and move from the reward reveal; show the behavior gained and lost. Avoid returning the player to several inventory screens.
- Publish recipes. Let the player target a basic ingredient and acquire it within a bounded number of relevant supply opportunities. Test two opportunities as the first guarantee. Gear access must not require independently winning both an item roll and an ingredient roll.
- Advanced combinations offer a new interaction or slot efficiency. Keeping ingredients on two wearers must sometimes be better. Prototype coverage, break, follow-up, Aether, and protection gear before expanding the catalogue.
- Keep earned recovery caches as occasional surprise rewards alongside reliable choices. Their contents remain fixed when earned; opening order or reload cannot reroll them. Never auto-dismantle duplicates.
- Begin with gold for optional discovery/field growth, scrap for gear work, and crystals for existing copy creation/specialized crafting. Measure resource competition before changing currencies. If crystals make recruiting upgrades and gear mutually frustrating, revise their sinks or exchange options explicitly.

### Reward pacing and budget

Map the current fourteen-battle voyage, its four reward nodes, character drops, packs, caches, and crafting income before changing payouts. Replace portions of random rewards with choices and guarantees; do not add a second complete economy on top.

Sector 1 establishes a working engine and basic gear. Sector 2 supplies an engine improvement and an answer to a visible threat. Sector 3 supports specialization or a deliberate pivot before the final boss. By the first sector boss, a player who follows a coherent plan should have a carry, an amplifier, and access to a defensive answer without lucky packs.

Final-boss rewards need a settlement purpose. For a voyage-local prototype, use a clear completion result and cosmetic/discovery record if available; do not present unusable gear as a power upgrade to an already finished voyage. Persistent gear or roster ownership requires its own explicit design and save rules.

Example: start a counter engine with an interceptor and basic barrier gear; see a multi-hit elite ahead; select a barrier engineer over another damage recruit; the fight report shows absorbed damage and retaliation; the next workshop lets you choose stronger retaliation or Aether recycling. A bad optional pack still gives resources, while the nominated counter carry remains visibly obtainable.

## 6. Validation and acceptance

Use the real browser resolver as the primary source. Run headlessly. Historical simulations can screen hypotheses only after demonstrating parity for the tested mechanics.

Compare unique-character teams at equal crew count, ranks, gear quality, and investment. Use fixed seeds, the five pressure profiles, early/mid/late sectors, and default recovery settings. Include sustain-free, hybrid-recovery, one-dedicated-sustain, and two-defensive-unit variants. Test swaps within an engine as well as different engines. Start with twenty seeds per screening cell; expand promising and borderline cases, reporting sample size and uncertainty.

Record clear rate, extraction time, deaths/recoveries, resolved enemy actions, incoming damage, actual healing, overheal, absorbed damage, unused barriers, resource generation/waste, and payoff trigger counts. Separate pure recovery from prevented or delayed enemy actions. Attribute directly measurable events; estimate enabled damage through controlled swaps rather than summing overlapping buff claims.

Provisional gates:

- A suitable dedicated sustain improves an attrition benchmark's clear rate by roughly 15 percentage points over its comparable offensive replacement, or materially reduces recoveries/extraction penalties at comparable clears. Easy cells where everyone wins require a harder benchmark, not fabricated value estimates.
- Sustain-free builds remain competitive in short burst/control encounters, and sometimes succeed under attrition through excellent offensive preparation. They do not dominate every threat profile.
- Two defensive units can pass the deadline when they operate a protection/counter engine. Two unrelated healers need not be a good team.
- Hypercarry teams with one DPS and several complementary supports can complete a legal voyage. Compare sustained and burst hypercarries with multi-carry teams at equal investment; validate both dedicated-sustain and sustain-free variants. No sub-DPS or four-DPS tag threshold is required to make the archetype function.
- Ultra-break teams gain measurable health damage from breaking, beyond faster shield removal. Validate single-event attribution, repeated genuine breaks, last-hit ownership, and standard versus fast recovery at equal investment. Faster reformers must still resolve threatening attacks, and must not create infinite break/reformation loops.
- Enemy advance improves an intended DoT or retaliation engine in suitable matchups while exposing the team to real additional danger. Compare barrier, healing, targeting, and cleanse sustain swaps; test DoT duration consumption, targeting exceptions, lethal ticks, multi-hit proc limits, recovery timing, and reflector recursion. Validate that delaying enemies remains better for other engines.
- Every recruit has a useful safe-state action and a tested intended use with at least two partners. No recruit is mandatory across all team families.
- Chosen recruitment and gear guarantees actually deliver within the stated opportunity bound. Log time/opportunities to the first working engine, unusable offers, scrapped rewards, reserve friction, and gold/resource spent on failed targeting.
- Three distinct team engines complete an economy-constrained voyage before expanding the roster or adding more gear. Do not validate progression using fully upgraded fixtures that cannot be earned.

Watch failure modes: counter damage farming through harmless repeated attacks, endless healing, echo loops, free-skill refund loops, intentionally farming downs, broken deep-tag multipliers, and rewards duplicated by save/reload. Cap recursive effects and prevent reward credit from summons or repeated settlement.

## 7. Implementation sequence

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Baseline and audit | Live roster/kit matrix, reward-source ledger, seeded pressure and acquisition reports | Know which kits work, which threats resolve, and how a legal voyage pays for a build |
| 2. Role and pressure slice | Separate role metadata; frequency/damage experiments; one readable defensive threat | Offense, hybrid recovery, and dedicated sustain have distinguishable tradeoffs |
| 3. Four-character slice | Distinct Aurel/Coda behavior, one useful sustain, one counter payoff | Intended pairs and mixed teams produce visible, bounded contributions |
| 3b. Break slice | One self-sufficient ultra-break specialist, one amplifier, and a fast-reformer enemy | Break produces distinct damage; faster recovery restores pressure and allows bounded repeat breaks |
| 3c. Enemy-turn slice | One enemy-advance support, one ally-targeting sustain, and explicit DoT/retaliation triggers | Deliberate exposure produces useful damage, distinct sustain choices, and bounded real enemy turns |
| 4. Acquisition slice | Starter choices, three-way recruitment, nominated guarantee, basic gear choice and visible recipe | A complete engine can be assembled without lucky packs; reward value stays budgeted |
| 5. Full voyage test | Hypercarry, multi-carry burst, follow-up/break, and counter/attrition voyages with legal earned resources | Combat and acquisition gates pass together; players can explain their choices and losses |
| 6. Roster migration | Convert remaining redundant kits, revisit Hull/Crew thresholds, update cards and reports | Each recruit has a distinct job and displayed text matches runtime behavior |

Use one implementation backlog with separate combat and economy milestones. Land the small combat slice before making every acquisition offer depend on the new roles. Update the design record, glossary, and kit documentation once the revised direction is accepted and validated.

## Decisions to settle before the acquisition slice

1. Voyage-local drafting versus permanent character collection. This proposal assumes voyage-local power.
2. How central pack openings should remain relative to direct recruit choices.
3. Whether Coda should retain his gatherer identity or become the echo sub-DPS proposed in the earlier combat pass.
4. Whether advertised back-row threats are acceptable, or sustain value should initially come entirely from frontline pressure.

The baseline audit and enemy-frequency experiments can proceed independently of these decisions. Full kit implementations and acquisition rules should use the resolved direction.
