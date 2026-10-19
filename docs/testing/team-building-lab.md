# Team-building lab

Playable experiment: [open the lab](../../prototypes/team-building-lab.html). No live voyage state, combat rules, packs, or balance values are modified. Acquisition is not settled by this experiment.

## Play it

Open `prototypes/team-building-lab.html` directly, or serve the repository with `python3 -m http.server 4183 --bind 127.0.0.1` and visit `/prototypes/team-building-lab.html`.

1. Pick a build direction and keep the same seed for comparisons. Start with seed 41 and retaliation or hypercarry.
2. Try **Themed packs**, **Choose-one draft**, and **Draft + nominated guarantee** separately. Restart begins a fresh run; export your record before switching if you want to retain it.
3. At each stage, buy a recruit, choose gear, change your formation, assign a carry and protection recipient, and test freely. You can skip purchases or save gold. Each stage permits one crew purchase, one gear purchase or craft, and one refresh per category.
4. Resolve six stages. Failed fights do not end the experiment; crew health resets. Capacity is four, growing to five for stage three. This keeps attention on preparation decisions rather than survival or travel UI.
5. Rate agency and reward excitement, write a note, and export. The record includes seed, configuration, acquisition actions, formations, gear, forecasts, resolved results, ratings, and elapsed wall time. Wall time includes inactive time and is not an engagement measurement.

**Free-build sandbox** removes acquisition constraints: every recruit is selectable, five formation slots are available, gear can be added freely up to ten items, and any of the six threats can be tested. Use it to compare sustain types or turn enemy advance on/off without needing lucky rewards. Characters are unique and have two equipment slots; equipment can be moved freely.

## What is being compared

All modes use the same sixteen-character roster, five build directions, six threats, seeded initial offers, 12 gold per stage, 6-gold recruitment, 4-gold gear, and 2-gold refresh. Draft and target modes receive identical offers before their guarantee is used. Packs use the same seeded sequence but reveal two candidates rather than three.

- Packs keep two random recruits and can produce more duplicate upgrades and reserves.
- Drafts select one recruit from three, sacrificing quantity for agency.
- Targeted drafts additionally let a player nominate an unowned recruit and take it instead of a draft card on the third recruit purchase. Progress survives target changes; naturally acquiring the target clears its nomination. The player may decline a ready guarantee and retain it.

Equal gold is **not equal reward quantity or power**: packs intentionally grant twice as many recruit outcomes. The sweep compares this initial quantity-versus-choice tradeoff, not a normalized test proving one interface is superior. Gear choices and recipes are held constant across the three modes. Comparing sealed gear drops, ingredient drafting, and direct crafting as separate systems is later experimental work.

Duplicate recruits add 12% base HP and attack per extra copy up to three copies. Further copies yield two scrap. Four scrap can craft a named gear item instead of that stage's gear purchase. These are lab rules, not proposals to replace the live copy economy.

## Shared model and limits

[The model](../../prototypes/team-building-model.js) runs identically in Node and the browser. It is an isolated AV event simulation, **not the live fight resolver**. Experimental kits borrow existing character names/art but are explicitly different from shipped kits.

It models direct damage, designated carry amplification and action advance, shared Aether, poison application and enemy-turn ticks, ultra-break, shields reforming on enemy turns, received-hit retaliation, ally targeting priority, barriers, healing, gear, and deaths. Enemy advance moves a genuine scheduled turn and can accelerate poison, incoming attacks, or shield reformation. Ultra-break belongs to Wren and triggers on allied final-layer breaks while she lives, avoiding last-hit ownership starvation. Fracture is not treated as poison.

It deliberately omits element weaknesses, deep synergy tags, live placement immunity, ultimates/personal charge, detailed enemy traits/cleanses, multi-hit rules, voyage integrity, automatic down recovery, permanent progression, and persistence of battle injuries. All lab allies can be targeted; area attacks ignore increased targeting weight. Targeting weight remains increased after the protection action for this first experiment. Poison lasts three enemy turns and has no stack cap; barrier values have explicit caps. Damage buffs are not attributed to supports as invented exact damage totals.

Forecasts and economic runs share code, but that only proves consistency within the lab. It does not establish parity with current gameplay. Numerical outcomes must not be imported into live balance without live-resolver validation.

## First sweep

Run `node tests/unit/team-building-lab.cjs` and `node sim/team-building-lab.js` from the repository. Set `LAB_SEEDS` to change the default 100 seeds. Pass an output path to the simulation command to preserve another run. [Raw results](team-building-lab-results.json) include a model hash and method metadata.

The initial sweep covers **3,000 acquisition runs / 18,000 resolved fights**, plus **3,000 combat fixture fights** across five engines, six threats, and five difficulty scales, and **160 enemy-advance comparisons**. Focused and random policies each receive 100 seeds per engine/mode cell. The focused policy uses authored preference weights, not an optimal combat search; random selection is a stress control, not a claim about player behavior.

Findings under the recorded model:

- Focused drafts connect the chosen engines in all sampled runs. Packs miss the simple connection check in 4% of hypercarry, 8% of ultra-break, and 3% of multi-carry runs. These checks require a defined mechanical partner, not full combat viability.
- Packs leave about 2.3–3.1 unique recruits outside the final formation, compared with about 0.04–0.95 for focused drafts. Packs also earn more upgrades and generally clear more encounters. This is consistent with their larger recruit yield, not evidence that they feel better.
- Guarantees have limited additional value with strong thematic offers and the focused policy. With random selection, multi-carry connection rises from 85% for drafts to 97% with targeting; ultra-break rises from 76% to 94%. Offer bias, the short run, and starter choices strongly affect this result.
- In the rapid-hunter comparison at 1.4× health/damage, enemy advance raises retaliation clears from 20/40 to 30/40. The DoT fixture falls from 40/40 to 37/40: additional turns also consume poison durations and create pressure, and Latch's skill competes for Aether. Enemy advance is useful conditionally, not a universal improvement.
- Twenty-five of the 150 combat fixture cells have mixed outcomes. Many cells saturate at all wins or losses; use the difficulty sweep and failure reasons, not just baseline clear rates. Ultra-break and poison are generous in this first pass; no fine balance conclusions are justified.

These findings identify experiments worth playing. They cannot measure anticipation, attachment, readable choices, frustration, or whether a duplicate feels rewarding.

## Questions for the playtest

- Is choosing the third recruit more satisfying than opening two, even when it gives less raw power?
- Does targeting relieve frustration, or remove too much surprise? Was the guarantee needed before it arrived?
- Does a duplicate improve a favorite character meaningfully, or feel like a missed team-building opportunity?
- Can you explain why you chose a sustain, why the protection recipient matters, and when advancing an enemy is worth the risk?
- Do gear and recipe choices suggest a different build, or only make the current one numerically stronger?
- Did you willingly pivot after seeing a threat, and could you acquire enough pieces to make that pivot useful?

Play each mode twice with paired seeds before recommending a direction. Keep enjoyment ratings separate from clear counts. After this first pass, normalize recruit power budgets and weaken thematic offer bias to test whether the preference survives. Add gear acquisition variants only after the character comparison is understandable.

## Verification

Unit checks cover guaranteed unowned recruitment, exactly-once purchase spending, deterministic non-mutating forecasts, actual enemy attacks, ultra-break/poison/retaliation triggers, finite health/metrics, and equipment capacity. Headless Playwright verification covers a six-stage target run, pack reveal, sandbox setup, gear assignment, forecast without stage advancement, save/reload, export, live-voyage save isolation, browser/Node fixture parity, resource loads, and overflow at 1440, 1024, 768, and 390 pixels. Screenshots are captured for visual inspection. The temporary browser script is `/tmp/playwright-test-team-building-lab.js`.
