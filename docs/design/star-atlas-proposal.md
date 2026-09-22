# Proposed star atlas and ancestral-world harmonies

Working proposal for the playable Ops prototype. Existing `world.md` and `crew.md` remain the source for recorded birthplaces. This file does not rewrite them. The atlas coordinates are a composition for a schematic map, not astronomical distances or the voyage's six encounter locations.

The user requested stars and planets that group peoples into homeworld harmonies. Use three distinct properties: **species**, **birthplace/cultural origin**, and **ancestral-world affiliation**. The last property drives this proposed harmony. Migration and shipboard birth do not erase it, and no planet is restricted to one species.

| Star/system | Inhabited world | Proposed lineage grouping | Current prototype crew | Existing information / proposed additions |
| --- | --- | --- | --- | --- |
| Sol | Earth | Human diaspora lineages | Tarn, Maul, Quill | Earth and human diaspora exist; a shared ancestral affiliation is proposed. Birthplaces remain Tannhul diaspora, Kessa Station and Iseul orbital diaspora. |
| Calyx | Calyx IV | Fungal peoples and oni; established human communities | Spore, Ash | Calyx is already mixed; Spore is from Calyx. Ash is the current combat slot associated with Stella in the lore, who is an oni raised on Utora VII. Assigning that slot Calyx ancestry is proposed, not a change of birthplace. |
| Ilex | Ilex Moraine | Cervine, ursine and canid lineages | Morrow, Bosk | Morrow's world already exists. Shared woodland ancestry, the star and glacial ecology are proposed. Bosk remains born aboard Good Weather. |
| Tessine | Tessine IX | Moth-folk, including shipborn diaspora | Coda, Ledger | Tessine IX is Aurel Cosma's recorded world. Coda and the Ledger/Aurelio slot retain shipboard birthplaces; shared Tessine ancestry is proposed. |
| Tannhul | Tannhul VI | Rock skins; settled human diaspora communities | Future Ojo slot | Existing high-gravity world. Tarn's birthplace remains here, with proposed human ancestral affiliation to Earth. |
| Iseul | Iseul III | Ossuan; human orbital communities | Future Navigator slot | Existing Ossuan world. Quill's orbital origin remains here, with proposed Earth ancestry. |

The first prototype groups give useful overlap without requiring a new cast: Earth has three crew, Calyx two, Ilex two and Tessine two. Ledger is available through Barracks or Order attunement using the existing combat kit and Aurelio portrait; the starter pool stays at eight characters.

## Prototype effect

Two distinct deployed crew with the same ancestral-world affiliation give all deployed crew **+8% base maximum health**. Three replace that with **+15%**. Bonuses from different worlds add together, then apply once. Reserve crew do not count, and one character contributes to one world. Both front and support count.

This common effect is deliberately a first balance test, not six final bespoke planet kits. It lets testers assess whether ancestry creates interesting formation decisions before introducing six more combat rules. Crew departments retain their existing separate bonuses.

The runtime source of truth is `prototypes/expedition-rules.js`, used by the Ops rail, atlas and battle loader. The visible star atlas is `prototypes/star-atlas.html`.

## Questions for the next lore pass

- Confirm ancestral affiliation separately for each diaspora character; birthplace alone should not decide it.
- Confirm whether Ash continues to represent the Stella slot or becomes an independent character.
- Expand canid, feline, avian, rock-skin and aquatic communities using the full lore roster, rather than inventing new crew solely to fill thresholds.
- Decide which planets deserve distinct higher-tier effects once the shared health bonus has been playtested.
