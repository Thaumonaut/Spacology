# Enemy catalogue and procedural frontier

The enemy catalogue has two jobs:

1. Make every encounter readable as fieldwork in an unfamiliar ecology.
2. Support an effectively unbounded frontier without turning authored characters into random soup.

The solution is to separate **faction**, **archetype**, **specimen**, and **hero**.

Implemented combat behaviors and counterplay are documented in [enemy behaviors](../testing/enemy-traits.md); the original proposals and remaining expansion ideas are in the [enemy traits backlog](enemy-traits-backlog.md).

- A **faction** is an origin ecology or constructed lineage. It owns anatomy, materials, naming,
  behaviour, and a shared combat rule.
- An **archetype** is a combat job: Chaff, Bruiser, Warden, Cleanser, Reflector, Anchor, Bulwark,
  Quickstep, Sapper, or Mender.
- A **specimen** is a seeded combination of faction, archetype, element, body plan, adaptation,
  and Null stage.
- A **hero specimen** is authored. It has a fixed name, art, kit, cleansing objective, history, and
  outcome. Heroes are not assembled by the generator.

The same archetype must look radically different across factions. An Ossuary Warden is a walking
shell cathedral; a Glasswake Warden is a shield jelly; a Custodian Warden is a rotating vault orb.

## Why the crew fights

The factions are not inherently hostile. The crew meets them after the leading edge of the Null has
damaged their bodies, instructions, social bonds, or perception. Combat is a field procedure with
four possible outcomes:

- **Cleansed** — the original pattern is restored.
- **Stabilized** — corruption has stopped, but treatment must continue aboard ARC 017 - Star Singer.
- **Contained** — restoration is not yet possible; the target is isolated without being destroyed.
- **Lost** — the Null completes erasure before the crew can recover the pattern.

Health in the interface may remain a familiar bar, but fictionally it measures **Instability**.
Breaking guard exposes the corrupted pattern. Damage is force, restraint, resonance, and surgical
disruption rather than an automatic killing blow.

## The Null

The Null is both a phenomenon and, increasingly, an apparent actor. The crew cannot yet prove whether
it is one mind, a distributed ecology, or something assembling minds from what it removes.

Its progression has four readable states:

| Stage | Name | What remains |
|---|---|---|
| 0 | Clear | The original organism or machine |
| 1 | Touched | Repetition errors, wrong shadows, compulsive behaviour |
| 2 | Hollowed | Missing memories and anatomy; the host can still be recovered |
| 3 | Redacted | The host pattern is being overwritten by a Null construct |
| 4 | Erased | Nothing remains—not even debris or a reliable memory |

Three groups form the larger Null faction:

- **The Touched** are corrupted members of another faction. Their original identity remains primary.
- **Palimpsests** are bodies assembled from stolen fragments of erased organisms. They copy actions
  and may speak in several incompatible voices.
- **Interlocutors** are intelligent coordinators that claim to speak for the Null. Whether they are
  emissaries, prisoners, or elaborate reflexes is deliberately unresolved.

Null corruption is a visual overlay, not a universal monster costume: clean negative-space wounds,
repeated anatomy, missing color, displaced shadows, incomplete reflections, and an earlier pose
lingering behind the body. Avoid generic black slime, purple spikes, or identical glowing cracks.

## Launch factions

### The Ossuary Reef

The Reef is a calcifying ecosystem, not an insect species. Its organisms grow dark living tissue through
skeletal frameworks inherited from earlier generations. Natural bone is archive, shelter, nursery, and
sensory organ at once: marrow carries resonance, ribs regulate pressure, polished scapulae catch light,
and discarded skeletons become the foundations of new colonies. The result should feel anatomical and
organic rather than like identical armor panels applied to unrelated monsters.

Its body plans can range from schools of hollow needlefish and vertebral serpents to rib-canopied
leviathans, jawbone centipedes, radial marrow flowers, scapula-winged gliders, walking pelvic bowls,
and antler-rooted reef colonies. A recognizable bone vocabulary should connect them without forcing
bilateral symmetry, four legs, a conventional face, or an arthropod shell onto every type.

Shared rule: **Molt** — breaking one guard layer changes the creature's next action.

Signature roles: Chaff, Bruiser, Warden, Bulwark.

| Combat role | Ossuary type | Required silhouette |
|---|---|---|
| Chaff | **Needleling** | A school of hollow needlefish with no central body |
| Bruiser | **Rattleback** | A heavy vertebrate beneath a resonant rib canopy |
| Warden | **Shell Cathedral** | A walking colonial skeleton with nested sanctums |
| Cleanser | **Molt Scourer** | A long serpent escaping a cracked vertebral sheath |
| Reflector | **Marrow Mirror** | A radial flower of polished scapulae and wet marrow |
| Anchor | **Root Reliquary** | An immobile antler-and-pelvis reef with deep roots |
| Bulwark | **Ivory Bastion** | A walking pelvic bowl that closes around allies |
| Quickstep | **Skitterjaw** | A horizontal centipede assembled from articulated jaws |
| Sapper | **Ossicle Sower** | A scapula-winged glider that plants auditory bone seeds |
| Mender | **Sutureshell** | A delicate many-limbed weaver that knits broken bone |

### The Mycelial Choir

The Choir is a network civilization of distinct fruiting guilds, not one mushroom species repeated at
different sizes. A person may inhabit several bodies, and several fungal lineages may contribute bodies
to one communal mind. Their shared identity comes from visible hyphal communication, resonance gills,
spore notation, and the way light or status travels between them—not from giving every unit a cap, two
legs, and the same beige flesh.

Use recognizable fungal diversity aggressively: inkcap swarms, puffball beasts, towering shelf fungi,
oyster-gill ribbons, crystal earthstars, coral-fungus colonies, lacquered reishi fans, stinkhorn runners,
bird's-nest launch cups, and lion's-mane healers. Color is functional and should help identify the combat
role at a glance while remaining richly organic rather than looking like flat team-color paint.

Shared rule: **Communion** — status and recovery can pass through the colony network.

Signature roles: Chaff, Cleanser, Anchor, Reflector.

| Combat role | Choir type | Fungal vocabulary | Identity color |
|---|---|---|---|
| Chaff | **Chorusling** | A swarm of tiny walking inkcaps | Inky indigo and silver |
| Bruiser | **Puffball Ram** | A dense armored puffball that vents spores on impact | Ochre and tobacco brown |
| Warden | **Shelf Citadel** | A vertical stack of bracket-fungus guard layers | Rust orange and cream |
| Cleanser | **Gilled Ablutor** | Flowing oyster-mushroom ribbons that shed conditions | Cobalt and pearl |
| Reflector | **Sporeglass Earthstar** | A radial earthstar with crystalline spore mirrors | Violet and translucent white |
| Anchor | **Nine-Root Node** | A rooted coral-fungus colony with nine signal crowns | Coral red and bone |
| Bulwark | **Reishi Bastion** | Interlocking lacquered fans that shelter the choir | Lacquer red and amber |
| Quickstep | **Stinkhorn Skater** | A narrow many-legged runner with trailing hyphae | Scarlet and acid green |
| Sapper | **Nidularia Sower** | Bird's-nest cups that launch peridiole mines | Deep teal and copper |
| Mender | **Mercy Mane** | A soft lion's-mane body with restorative tendrils | Soft pink and luminous ivory |

### The Glasswake

Radial crystalline organisms, mirror membranes, floating prisms, lens jellies, and ray-like fliers.
Their bodies record light and vibration. Older individuals can be articulate and extremely alien.

Shared rule: **Refraction** — the first repeated action is bent toward a different target or outcome.

Signature roles: Warden, Reflector, Quickstep, Chaff.

### The Tideworn

Ribbon eels, siphon creatures, jelly bells, soft-bodied crawlers, and colonial ocean organisms.
They retain their aquatic body plans when encountered inside flooded reefs or suspended water spheres.

Shared rule: **Shed** — they periodically discard the oldest applied condition along with a layer of body.

Signature roles: Cleanser, Quickstep, Anchor, Chaff.

### The Tannhul Herds

“Tannhul” is a migratory covenant, not a species. On high-gravity worlds, unrelated organisms evolved
resonant ballast organs that let them share weight, heat, and momentum. Over millennia those temporary
survival formations became travelling societies: rookback grazers walk beside rolling scree colonies,
coiled ring-serpents, mica-winged cleaners, rooted menhir elders, burrowing mortar worms, and slow
salve-bearing mollusks. A herd is therefore a moving ecosystem whose members may have radically different
anatomy while sharing stone, iron, mica, and seismic-song motifs.

Old Rookback belongs to the six-legged grazer lineage; his body should remain iconic without becoming the
template for the entire faction. Only the Bruiser should closely resemble him. Other roles must differ in
locomotion, scale, symmetry, and sensory organs—not merely swap horns or back-mounted equipment.

Shared rule: **Formation** — nearby Tannhul synchronize gravity-resonance, changing who can be targeted and
how force travels through the caravan. Null corruption turns mutual support into forced synchronization:
infected members lock frightened neighbours into harmful formations they cannot leave.

Signature roles: Bruiser, Bulwark, Anchor, Chaff.

| Combat role | Tannhul type | Required silhouette |
|---|---|---|
| Chaff | **Screelets** | A rolling swarm of small trilobite-like bodies |
| Bruiser | **Crag Grazer** | The familiar low, six-legged rookback lineage |
| Warden | **Cairncoil** | A ring-serpent curled into concentric stone armor |
| Cleanser | **Dustwing** | A broad ray-like symbiote that scours damaged hide |
| Reflector | **Mica Crown** | A radial arachnid carrying a fan of mirror-mica |
| Anchor | **Herdstone** | A rooted living menhir with seismic song chambers |
| Bulwark | **Walking Escarpment** | A colonial cliff carried on many short legs |
| Quickstep | **Flintstrider** | A light, spring-legged runner with a narrow profile |
| Sapper | **Faultdrum** | A squat three-footed seismic mortar shaped like an inverted bell |
| Mender | **Salveback** | A stone-shelled mollusk carrying mineral salve pools |

### The Custodian Array

An entirely robotic preservation network: tripedal maintenance mites, quadrupedal cargo machines,
sterilizer centipedes, mirror satellites, command spires, vault orbs, and folding wall-crawlers.
The Null has changed "preserve life" into "prevent life from changing."

Shared rule: **Protocol** — repeated crew actions are scanned and receive a visible automated response.

Signature roles: all ten; the Array is broad because its machines were built for specialized work.

### The Redaction

Actual Null-aligned constructs rather than corrupted wildlife. Their bodies are incomplete composites
of patterns taken elsewhere: a limb from a species that no longer existed, a voice with no speaker,
or a machine instruction embedded in an animal gesture.

Shared rule: **Omission** — temporarily removes a rule, action, element, or unit from the encounter.

Signature roles: Warden, Cleanser, Reflector, Anchor, Quickstep.

The Redaction should be uncommon. If it appears in every encounter, the Null becomes ordinary.

## First hero catalogue

| Hero | Origin | Role | Authored cleansing problem |
|---|---|---|---|
| **The Cathedral That Walks** | Ossuary Reef | Warden | Open seven shell layers without breaking the living core |
| **The Ninefold Mother** | Mycelial Choir | Anchor | Stabilize nine bodies in the same action cycle |
| **Serein-of-Seven-Facets** | Glasswake | Reflector | Return its remembered light-pattern instead of overpowering it |
| **The Bell Below** | Tideworn | Cleanser | Follow its call through three flooded chambers and interrupt the false fourth note |
| **Old Rookback** | Tannhul Herds | Bruiser | Protect its uninfected calves while separating the corruption from the herd bond |
| **CURATOR // LAST INSTRUCTION** | Custodian Array | Anchor | Prove that change is not data loss by presenting three living catalogue revisions |
| **The Kindly Voice** | Redaction | Interlocutor | Survive a conversation in which it removes one combat rule after every answer |

Heroes use fixed portrait or full-body art and authored staging. They may recur after cleansing as
NPCs, research contacts, or evidence that recovery is possible.

## Procedural specimen grammar

A generated specimen is built in this order:

1. **Planet constraints** — gravity, medium, atmosphere, temperature, reef structure.
2. **Faction** — selects a coherent anatomy and material vocabulary.
3. **Archetype** — supplies the tactical job and its immediately readable silhouette cue.
4. **Body plan** — selected only from plans allowed by the faction and planet.
5. **Element** — determines reactions, internal light, and the portrait's circular background.
6. **Adaptation** — one locally sensible feature such as pressure sacs or magnetic feet.
7. **Null stage** — applies restrained corruption symptoms and changes the cleansing objective.
8. **Seeded name** — stable across saves, screenshots, and catalogue entries.

These dimensions must not be rolled independently. A vacuum reef cannot generate an ordinary gilled
fish, a high-gravity world should favour low bodies, and a radial Glasswake organism should not acquire
a humanoid animation merely because it rolled Warden.

## Procedural planets

A planet seed produces:

- astronomical form and gravity;
- two or three connected biomes;
- atmosphere or environmental medium;
- one dominant and zero to two visiting factions;
- an elemental tendency, never a single mandatory element;
- a local adaptation shared by native specimens;
- one environmental combat rule;
- evidence of the Null's distance and progression;
- catalogue questions, cultural hooks, and a reason this world cannot be replaced by another seed.

Most encounters use generated specimens. A hero appears only when authored conditions are satisfied:
a story route, a rare discovery flag, sufficient catalogue progress, or a specific seed feature.
The generator may choose **where** a hero appears but never rewrites who that hero is.

## Art production

Generated enemies should use modular in-game visuals, not runtime image generation. Each faction needs
several compatible body bases, heads or sensory organs, role-readable structures, adaptations, and
Null overlays. Hero enemies receive bespoke paintings in the shared soft painterly anime/JRPG style.

The authored catalogue currently includes **70 faction/type plates**: ten named types for each of the
seven launch factions. Every valid `faction + archetype` pairing has a checked-in portrait; seeded enemies
select that plate while specimen names, materials, adaptations, elements, and Null symptoms remain
procedural. Equal catalogue depth prevents the Custodian Array from visually dominating the archive.

Every catalogue portrait retains the element-matched circular field:
Order cyan-blue, Chaos rose-crimson, Growth green-teal, Decay sepia-ochre, Energy amber-gold,
and Void deep violet.

## Adding factions and types

`sim/enemy-catalogue.js` normalizes every unit into a single type record with its faction-specific name,
combat archetype, body plan, portrait, and optional identity palette. The lore gallery reads those records
directly, and the service worker derives its enemy-art cache from the same catalogue.

- Use `registerArchetype(id, definition)` only when a genuinely new combat job is needed.
- Use `registerEnemyType(factionId, archetype, type)` to add one type to an existing faction. The `type`
  object requires `name`, `body`, and `portrait`; `palette` is optional.
- Use `registerFaction(id, { ...metadata, types })` to add a faction. Each entry in `types` uses the same
  compact type object, so no parallel gallery or cache manifest needs editing.
- Check the portrait into `assets/factions/` before running the asset test.
- Keep at least ten launch types per faction, but future factions may exceed ten when the extra silhouette
  creates a real tactical and anatomical distinction.
