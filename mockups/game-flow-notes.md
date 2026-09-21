# Spacology UI flow

Companion to `game-flow.html`. The mockup is a click-through map of the whole voyage at iPad landscape size. Its prototype-only **Flow** menu jumps directly to any screen.

## Core loop

`Ops room → destination → crew arrangement → fight → recovery report → ops room`

Destination choice comes before arrangement. World conditions, danger, and expected power give the player a concrete problem; arrangement is where they answer it. Pack selection and triage branch from the ops room and return there before the player commits to a destination.

## Screen jobs

| Screen | The decision or answer it owns |
|---|---|
| Title / resume | Start fresh or return to a clearly identified autosave. |
| Voyage briefing | Explain the run's objective, length, initial integrity, and starting crew once. |
| Ops overview | Understand the current build, inspect crew, and choose the next preparation action without losing context. |
| Consignment choice | Compare theme, fit, rarity composition, and price before spending. |
| Pack triage | Explicitly keep or strip every non-salvage card, then confirm once. |
| Destination choice | Choose difficulty through the world itself; compare risk, conditions, reward, and current crew power. |
| Crew arrangement | Answer the selected world's problem with formation and team composition. |
| Combat | Watch the build resolve while tracking intent, turn order, recovery band, and the acting ability. |
| Recovery report | Explain the score, integrity change, payment, streak, losses, and the combination that paid off. |
| Voyage summary | Make final integrity the headline score and give enough context to motivate another run. |

## Stable interface rules

- The left rail remains in the same place from ops through the result. Its contents change from voyage status to turn order during combat.
- The crew tray remains in the same place through the core loop.
- Amber marks the current action, green marks favorable state, red marks enemy pressure, and blue/violet identify crew roles and systems.
- Cards remain the strongest visual objects. The surrounding interface explains their consequences.
- Touch targets are at least 44px for primary actions. Pack destruction always requires an explicit **Strip** action and a final confirmation.

## Ops room hierarchy

The ops room is a working surface rather than a menu or status dashboard.

1. **Current build** is the largest region. It states the crew's actual sequence—who creates the opening, who cashes it out, and which thresholds are active or close.
2. **Selected crew** stays beside the build. Tapping any card in the persistent tray updates this inspector with role, pairing, fitting, and promotion progress.
3. **Next actions** contains the only three branches that matter before launch: compare consignments, review a ready promotion, or choose a destination.

The shop remains one tap away, but it no longer displaces the thing the player is shopping *for*. Crew power appears beside the build and in the persistent rail; a separate readiness dashboard would repeat information without helping the next decision.

## Questions for a five-run usability pass

1. How long does pack triage take, and does the eighth card still receive a real decision?
2. Does expected power clarify destination risk without making the choice automatic?
3. Does seeing the destination before formation cause meaningful crew changes?
4. During combat, can the player name why the last chain happened without opening a sheet?
5. Does the recovery report teach a useful lesson, or merely repeat what the player watched?
6. After returning to ops, is the next useful action obvious within three seconds?

## Prototype pass · full match

The current prototype is intentionally a complete match rather than a collection of menu studies:

`title → briefing → ops → consignments → pack triage → destination → formation → combat → recovery → voyage summary`

Combat now has a staged resolution beat. The player sees a target lock, the acting card pulses, the break produces a score float and recovery change, the follow-up is called out, and only then does **Resolve fight** become available. This gives animation a readable sentence: intent → action → consequence → chain.

The visual direction follows the useful pattern visible across the reference collection at [Interface In Game](https://interfaceingame.com/): each screen has one dominant job, a strong focal object, persistent context, and detail revealed through adjacent panels or overlays. Spacology should use that discipline without copying any individual game: Ops is the build story, combat is the stage, and secondary controls stay quiet until they support the current decision.
