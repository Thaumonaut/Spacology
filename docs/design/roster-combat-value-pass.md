# Roster combat value pass

Working proposal, September 2026. Kit changes below are design targets, not implemented combat rules.

## What the current prototype actually does

- Ops describes individual kits, but most characters still borrow an older combat template. In `watchable-fight.html`, Aurel and Coda both resolve as Vane. Their different descriptions do not create different team choices in a fight.
- The roster has several healing or barrier actions with low direct damage. The Hull entry bonus makes barriers larger, while the damage payoff waits for four Hull characters. A mixed team that recruits one shielder often sees only a weak attack and more survival than it needs.
- The existing [roster design](roster-design.md) simulation already found Hull below the floor and noted that a shield needs a damage payoff. The [synergy notes](synergy-notes.md) found that a reflector with enough health needs no shielder, while a shielder without a reflector contributes little.

## Role test for every recruit

Each recruit needs one *visible combat job* and one *draft reason* that another recruit cannot perform the same way. Support characters can be valuable without being top damage dealers, but their value should show up as damage enabled, shield damage, enemy actions denied, or deaths prevented. A character whose only contribution is surplus healing or barrier fails the test.

For a first pass, aim for fewer pure healers and more hybrids: two reliable recovery anchors, several conditional healers whose primary job is damage or setup, and multiple sub-DPS units with different triggers and target shapes. These are targets for roster review, not quotas enforced by character tags.

| Character | Proposed combat job | Distinct payoff |
| --- | --- | --- |
| Aurel | Tempo support | Advances the ally whose action creates the best immediate opening; modest direct damage. He changes *when* a move happens. |
| Coda | Echo sub-DPS | Answers the first allied damaging action each cycle with a capped follow-up on the same target. His skill can echo a recent attack at reduced strength; copied bursts need a hard cap. He changes *how many hits* an opening produces. |
| Ekene | Ultimate charge support | Gives a large one-time charge pulse, then runs cold for a turn. Unlike Aurel, she trades her own next action for a teammate's ultimate. |
| Spore / Mary | Spread sub-DPS | Spreads Fracture or marks, then deals a small follow-up when a seeded enemy acts. Healing is conditional and secondary. |
| Abike | Conversion support | Consumes conditions for damage and recovery; the choice of when to consume them matters. |
| Redcap | Preservation support | Extends a useful effect and deals damage when that preserved effect triggers; avoid making her another passive healer. |
| Tomás | Growing barrier carry | His living barrier accumulates retaliatory damage while it survives, then releases it on a chosen target. His value rises with enemy attacks and protection of the barrier. |
| Ilka | Fixed barrier engineer | Predictable protection plus a small counterattack when her precise barrier absorbs a hit. |
| Reva / Tarn | Interception carries | Draw attacks deliberately and return damage; their fragility makes partner protection valuable. Give each a different trigger or target shape. |
| Ojo / Daven | Frontline anchors | Ojo buys time through taunt and self-sustain; Daven refunds Aether from a blocked hit. Avoid giving both a generic team shield as their main identity. |

Keep two clearly legible healing anchors, such as Nahana for immediate reliable recovery and Veska for delayed healing plus Aether generation. Navigator can remain a scaling hybrid if its attack or team payoff grows with time, rather than becoming a third plain healer.

## Hull and thorns experiment

Try a modest individual return on a successful block before the four-Hull bonus. A possible test rule is **return 20% of damage absorbed by a character's own barrier to the attacker**, then let the four-Hull bonus improve or redirect that return. This gives Tomás or Ilka a reason to join a mixed team without forcing four Hull recruits. Keep the existing 90% raw-hit return only as a comparison point; it may be too strong when accessible earlier.

Show absorbed damage, returned damage, taunts that changed the target, and barriers that expired unused in the battle report. If barriers routinely expire unused, more barrier strength will not fix the role. Test against single heavy attackers, multi-hit swarms, control enemies, and shield-breaking enemies so Hull is useful in some encounters and vulnerable in others.

## Balance gate for each new kit

Use fixed seeds and equal rank/gear when comparing a recruit swap. Record damage and shield damage per 100 AV, enemy attacks prevented, health saved, Aether generated/spent, and unused barriers or overheal. Test each unit in its intended pair and in at least one unrelated mixed team. A kit passes when it opens a distinct winning line in some encounters without becoming the best default choice everywhere. Check losses in battle logs so the player can identify the build decision that caused them.

Implement the Coda/Aurel split first because they are mechanically identical today. Then try one Hull payoff and one healer-to-hybrid conversion. Re-run seeded voyages before changing the rest of the roster.

## Species and names

Keep a small set of recognizable playable body families while allowing many cultures and homeworlds. A species describes anatomy; Orrowan's Ereta and Kalvec remain different peoples even when a crew member shares a body family with someone from another world. Tomás now uses the existing fungal body family with a golden chanterelle trumpet crown, distinct from Dolores, Mary “Spore” Achterberg, and Redcap. Ekene returns to the mana-born direction in the older crew lore. Liora Venn is the working personal name for Redcap; both she and Mary keep their nicknames as save keys and combat names.
