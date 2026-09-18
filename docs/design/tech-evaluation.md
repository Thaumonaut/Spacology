# Technology evaluation

A full sweep, not a shortlist. My previous answer covered three options and skipped most of the
field. This corrects that.

---

## 1. What this project actually is, technically

Worth stating before evaluating anything, because it changes which tools are even relevant.

**This is a UI application with a simulation core.** Roughly 80% of the work is interface — shop,
character cards, forge, map, modals, tooltips, scrolling logs, drag-and-drop grids, damage number
overlays. The other 20% is a deterministic turn-based state machine.

There is **no realtime loop, no physics, no pathfinding, no collision, no lighting, no animation
blending, no netcode**. The heaviest fight is ~270 discrete integer operations across ~20 entities.

That means most of what a game engine sells you is irrelevant, and the things that usually don't
matter — text layout, scroll containers, focus handling, accessibility, retained-mode UI — matter a
great deal.

### Requirements, weighted

| Requirement | Weight | Notes |
|---|---|---|
| UI/layout capability | **critical** | most of the work |
| Systems-language quality (types, refactoring) | **critical** | data-driven kits, priority lists |
| iPad deployment | **critical** | the primary target |
| Fast iteration on Mac | **high** | design is still moving |
| Headless simulation for balance | **high** | already proved its value |
| 2D + shaders | high | pixel art plus juice |
| Switch path | medium | later, but don't paint into a corner |
| 3D capability | low–medium | speculative, possibly a trap |
| Hiring pool | medium | if an artist joins |
| Licensing risk | medium | premium model, margins are yours |
| Raw performance | **near zero** | genuinely does not matter |

---

## 2. The full field

### A. Full engines, editor-based

| Engine | Language | iPad | Switch | UI system | Verdict |
|---|---|---|---|---|---|
| **Godot 4** | GDScript / C# | yes | via W4 (paid, middleware-approved) | Control nodes — one of the best built-in | **contender** |
| **Unity 6** | C# | yes | first-party | UI Toolkit, capable but heavy | **contender** |
| **GameMaker** | GML | yes | official (Enterprise tier) | none — you build it | **contender, with reservations** |
| **Defold** | Lua | yes | via partners | none — you build it | plausible, weak fit |
| Unreal 5 | C++ / Blueprint | yes | first-party | UMG, powerful, heavy | overkill; C++ for menu work is a bad trade |
| Cocos Creator | TypeScript | yes | limited | decent | mobile/web focus, Western docs thin |
| Stride | C# | weak | no | basic | small ecosystem, 3D-oriented, slow releases |
| Flax | C# | limited | limited | basic | promising, too small to bet on |
| O3DE / CryEngine | C++ | no | — | — | non-starter |
| Construct 3 / GDevelop | visual | yes | limited | built-in | not enough programmatic depth for this design |
| RPG Maker | JS | yes | yes | fixed | wrong genre entirely |
| Solar2D | Lua | yes | no | manual | aging, no console |

### B. Code-first frameworks, no editor

| Framework | Language | iPad | Switch | Verdict |
|---|---|---|---|---|
| **MonoGame** | C# | yes | yes (Stardew, Celeste) | total control, but you build every scroll view by hand |
| FNA | C# | yes | yes | same, even more minimal |
| **Heaps** | Haxe | yes | yes (Dead Cells, Northgard) | proven, tiny ecosystem, you build UI |
| OpenFL | Haxe | yes | limited | Flash-lineage, fading |
| LibGDX | Java/Kotlin | yes | no official | aging, JVM on mobile is awkward |
| LÖVE | Lua | limited | no | lovely, wrong targets |
| Bevy | Rust | painful | no | ECS is the wrong shape for turn-based; UI immature |
| Fyrox / macroquad | Rust | limited | no | too early |
| raylib | C + bindings | yes | community | you build everything |
| Ebitengine | Go | yes | no | no console path |
| Phaser 4 / PixiJS / Excalibur | TS | yes (web) | no | web-only ceiling |
| Kaplay | TS | yes (web) | no | jam-scale |
| **Pygame** | Python | **no** | **no** | cannot ship to either target |
| Arcade / Panda3D | Python | no | no | same |

### C. Application frameworks — genuinely relevant here

Because this is mostly UI, these deserve real consideration rather than dismissal.

| Framework | Language | iPad | Switch | Verdict |
|---|---|---|---|---|
| **SwiftUI + SpriteKit** | Swift | **best possible** | never | the finest iPad experience available, and a dead end for everything else |
| **Flutter + Flame** | Dart | very good | no | excellent UI, real cross-platform, no console |
| Compose Multiplatform | Kotlin | good | no | improving fast, iOS still maturing |
| Avalonia | C# | possible | no | desktop-first |
| React Native / Expo | TS | good | no | UI fine, game feel harder |
| Tauri / Capacitor + web | TS | good | no | wraps the current prototype, ships this week |

### D. The ML question

**PyTorch is not a game engine** — it is a machine-learning library. But there is a real, relevant
technique hiding behind the question.

Your simulation is deterministic, headless, and runs in milliseconds. That makes it ideal for
**automated balance search**: run every team composition against every encounter across every act,
thousands of times, and find the degenerate builds before players do. This already proved its worth
in the prototype at a small scale.

You do **not** need ML for this. Exhaustive or random search over a space this size is sufficient,
and the results are interpretable, which matters more. Reinforcement learning to discover
exploit strategies is a genuine technique some studios use, but it is a post-launch luxury and it
requires the sim to be callable from Python — an argument for keeping the sim portable, not for
choosing Python as the language.

**Practical version:** whatever you build in, keep the sim as a headless library with a CLI entry
point. Then any analysis tool, in any language, can drive it.

---

## 3. Eliminations, with reasons

**Cannot reach the targets:** Pygame, Arcade, Panda3D, LÖVE, Ebitengine, LibGDX, all Rust options,
all web-only frameworks, Solar2D. Either no iPad, no Switch, or neither.

**Wrong tool for the job:** Unreal, O3DE, CryEngine (C++ for a menu-heavy 2D game), Construct,
GDevelop, RPG Maker (insufficient programmatic depth for data-driven kits and priority lists).

**Too small to bet a multi-year project on:** Stride, Flax, OpenFL.

**Best at the primary target, fatal at the others:** SwiftUI + SpriteKit. If you ever abandon Switch
and PC, revisit this — nothing else will feel as good on an iPad. As stated, it's a dead end.

---

## 4. The four that survive

### Godot 4 with C#
**For:** Control nodes are a real retained-mode UI system with anchors, containers, themes and focus
handling — you are not reimplementing scroll views. Excellent 2D. C# means the sim is portable.
Console solved via W4's middleware-approved ports. Free, no royalties, ever. Fastest iteration of any
editor-based engine on a Mac. Momentum is real: Godot went from 19% to ~40% of GMTK jam submissions
in two years while Unity fell from 61% to 36%.
**Against:** 3D is adequate rather than excellent. Console costs money and adds a vendor dependency.
C# support is less battle-tested than GDScript. Smaller hiring pool than Unity.

### Unity 6
**For:** Best 3D pipeline by a distance. Largest hiring pool — an artist will already know it.
First-party console support with no middleman. Mature C#. Enormous asset store.
**Against:** Heavier editor, slower iteration on a UI-heavy game. UI Toolkit is capable but verbose.
The Runtime Fee was cancelled outright and Personal now runs free to $200k revenue, but the episode
made licensing stability a due-diligence item rather than an assumption.

### GameMaker
**For:** Fastest path from zero to playable 2D. Official Switch export. Genuinely excellent sprite
and shader workflow.
**Against:** GML has no real type system, which is a serious problem for data-driven character kits
and rule-based AI — exactly the code most likely to break silently. No built-in UI system at all;
every scroll container and modal is hand-built. Console requires the Enterprise tier.

### MonoGame
**For:** C#, total control, proven on Switch by Stardew Valley and Celeste. No engine to fight.
**Against:** You build the entire UI layer from nothing. For a game that is 80% interface, that is
months of work reimplementing solved problems.

---

## 5. Recommendation, and the honest caveat

**Godot 4 with C#, sim as a standalone C# library.**

The reasoning is the UI weighting. This game is mostly interface, and among the options that can
reach both iPad and Switch, Godot has the only strong built-in UI system. GameMaker and MonoGame
would each cost months rebuilding what Control nodes give you. Unity has one, but pays for it in
iteration speed on the screen you'll edit most.

**The caveat:** if you become confident you want 3D and expect to hire, Unity is the better answer
and it is not close. The 3D pipeline and the hiring pool are both decisively better. Decide that
question deliberately rather than drifting into it.

**The hedge that makes either survivable:** write the simulation as a `netstandard` C# library with
no engine references. Both Godot and Unity run C#. Test it with `dotnet test`, run balance sweeps
headless, and treat the engine as a replaceable presentation layer. That converts a permanent
decision into a reversible one, and it costs nothing because the sim is already a pure function.

---

## 6. What would actually settle it

Don't decide on paper. Two days of work removes most of the uncertainty:

1. **Port the sim to C#** (mechanical — no DOM, no async, no framework) and get the tests green.
2. **Build one screen in Godot and the same screen in Unity.** Make it the store: a scrolling card
   grid, a modal, and a status strip. That is the most representative screen in the game.
3. **Deploy both to the iPad** and compare how they feel to touch, and how long the edit-to-device
   loop takes.

Whichever one you'd rather build twenty more screens in is the answer, and you'll know within an
hour of using both.


---

# Addendum — the smaller field, actually researched

The first pass was recall-driven and leaned on whatever is most written about. This section covers
what I skipped, with sources rather than memory. It also adds an axis the first pass omitted:
**community size and bus factor**, which matters enormously for a multi-year solo project.

---

## GameMaker — a proper look

I gave this one paragraph. It deserves more, because the picture changed recently.

**Pricing is now unusually good.** Free for non-commercial. **$99.99 one time** for commercial
desktop, mobile and web — not a subscription, no royalties, no revenue cap. That is one of the best
deals in the field, and it makes most older comparisons obsolete.

**Console is the catch.** Export to PlayStation, Xbox or Switch requires the **Enterprise tier at
$79.99/month**, plus platform-holder approval, which is a separate process regardless of engine.
Roughly $960/year, recurring, versus Godot's one-off W4 licence or Unity's included support.

**GML is better than its reputation.** It has structs, constructors and methods now, and **Feather** —
GameMaker's static analyser — provides type annotations, inline diagnostics and autocomplete. The
2026.0 release improved it further, renaming types and extending directives. That materially weakens
my earlier "no type system" objection, though it is still opt-in annotation rather than enforced
typing, which is weaker than C# for a data-driven rules engine.

**No built-in UI system.** Every scroll container, modal and card grid is hand-built with draw calls.
For a game that is 80% interface this is the real cost, not the language.

**3D is minimal.** Present, but GameMaker is fundamentally 2D.

**Proof:** Undertale, Hotline Miami, Hyper Light Drifter, UFO 50.

**Verdict:** a genuine contender for the 2D-forever version of this project. The recurring console
cost and the hand-built UI are what hold it back, not GML.

---

## The Cocos family — mostly a dead end

**Cocos2d-x is discontinued.** Updates ceased around 2019, the repository is archived as
`cocos2d-x-deprecated`, hundreds of pull requests sit unmerged, and the build scripts still want
Python 2. Do not start here.

**Axmol** is the live community fork of Cocos2d-x, and it is genuinely maintained — C++, open source,
supporting desktop, mobile, Xbox (UWP) and WebAssembly, with much of the Cocos2d-x documentation
still applying. It explicitly targets people who want a code-only engine with no GUI editor. **But
there is no Switch path**, and it is C++ for a UI-heavy game.

**Cocos Creator 3.x** is the living commercial product — TypeScript, rewritten in 2021 onto a new 3D
core, aimed at pan-mobile. No meaningful console story, and Western documentation is thin.

**Verdict:** ruled out. Axmol is respectable work aimed at a different problem.

---

## The MonoGame ecosystem — I dismissed this too quickly

My "you build every scroll view by hand" claim was wrong. There is a layer of tooling on top of
MonoGame I failed to check:

**FlatRedBall** — a 2D engine built on MonoGame/XNA, in continuous development for over twenty years,
MIT licensed, C# on full .NET with access to all NuGet packages. It ships an **editor**, content and
scene management, and the **Gum** UI system. Commits are near-daily.

**Nez** — a framework layer over MonoGame/FNA adding ECS, scene management and a UI system ported
from libGDX's Scene2D.

**Myra / Gum** — standalone retained-mode UI libraries for MonoGame and FNA.

This changes the calculus. C#, proven Switch shipping (Stardew Valley, Celeste), a real UI layer, and
instant startup with no editor to boot.

**The catch is bus factor.** FlatRedBall has roughly **543 GitHub stars** after two decades. That is
a small community for a multi-year commitment — few tutorials, few people to ask, and a real
single-maintainer risk. Nez and Myra are similar in scale.

---

## Others named for completeness

Researched enough to rule in or out; not deeply evaluated.

| | Language | Note |
|---|---|---|
| **Defold** | Lua | King-backed, tiny builds (~1.14 MB web), console via partners. Lean, quiet, credible. No built-in UI system |
| **KorGE** | Kotlin | Kotlin Multiplatform 2D, targets iOS/Android/desktop/web. Small community, no console path |
| **Ceramic** | Haxe | Cross-platform, cleaner than raw Heaps. Very small |
| **HaxeFlixel** | Haxe | Mature 2D, large-ish Haxe community, no first-party console |
| **Kha** | Haxe | Very low level, powerful, steep |
| **Orx** | C | Data-driven 2D, config-file oriented, tiny community |
| **Castle Game Engine** | Pascal | 2D and 3D, mobile export, genuinely maintained, very small community |
| **Evergine** | C# | Free personal tier, but aimed at industrial and enterprise 3D visualisation, not games |
| **Solar2D** | Lua | Corona's successor, mobile-first, no console, declining |
| **Stride / Flax** | C# | Real engines, 3D-oriented, too small to bet on |
| **Duality** | C# | 2D, dormant |
| **PICO-8 / TIC-80** | Lua | Fantasy consoles, hard resource caps. Wrong scale |

---

## The axis the first pass missed: bus factor

For a multi-year solo project, community size is a first-order risk, not a footnote.

| Tier | Options |
|---|---|
| **Very large** — answers exist for everything | Unity, Unreal, Godot |
| **Large** | GameMaker, Phaser, MonoGame, LÖVE |
| **Moderate** | Defold, Cocos Creator, HaxeFlixel, raylib |
| **Small** — you will read source and ask on Discord | Heaps, Ceramic, KorGE, Axmol, Nez |
| **Very small** — single-maintainer risk | FlatRedBall, Orx, Castle, Flax, Stride |

This does not disqualify the small ones. It does mean choosing one is a bet that you are comfortable
reading engine source when something breaks, with nobody to ask.

---

## Revised shortlist

Ordered by fit for *this* game, with the reason stated:

1. **Godot 4 + C#** — only option combining a real built-in UI system, C#, strong 2D, a console path
   and a very large community
2. **LÖVE2D** — Balatro is the proof; instant startup, minimal ceremony, console via porting partners.
   Cost: Lua's dynamism against a rules-heavy design, and no 3D headroom
3. **MonoGame + Nez or FlatRedBall** — C#, proven on Switch, instant startup, and a UI layer after
   all. Cost: small ecosystems around the UI tooling
4. **GameMaker** — best 2D pipeline and remarkable one-time pricing. Cost: $79.99/month for console,
   hand-built UI, opt-in typing
5. **raylib (+ C# or Zig bindings)** — thinnest, fastest, has real 3D. Cost: you build everything,
   including the Switch port
6. **Unity 6** — the answer if 3D and hiring become real. Cost: iteration speed on a UI-heavy game

**Still eliminated:** Cocos2d-x (dead), Cocos Creator and Axmol (no Switch), Unreal (wrong tool),
Pygame and all Python (no targets), all Rust options (immature UI, no console), web-only frameworks
(no console), Construct/GDevelop/RPG Maker (insufficient depth).


---

# Addendum 2 — disk footprint

A hard constraint, and it reorders the shortlist. Figures are approximate and grow with each release,
so treat them as magnitudes rather than exact.

## The elephant: Xcode

**Any native iPad build requires Xcode**, regardless of engine. That is roughly **15–25 GB** for the
app, plus **5–10 GB per iOS simulator runtime**, plus device support files that accumulate silently.
Realistically **25–35 GB** before you have installed a single game engine.

**The escape hatch:** a web build added to the iPad home screen needs **zero Xcode**. Full screen, no
browser chrome, live reload over the local network. You only need Xcode when you want TestFlight or
the App Store — which is a launch concern, not a development one.

For a storage-constrained Mac, that single fact may matter more than the engine choice.

## Tooling footprint, ranked

| Tool | Editor / core | Export or platform files | Per-project overhead | Realistic total |
|---|---|---|---|---|
| **LÖVE2D** | ~10 MB | none | negligible | **~10 MB** |
| **raylib** | ~50 MB | none | negligible | **~50 MB** |
| **Haxe + Heaps** | ~200 MB | small | small | ~250 MB |
| **Defold** | ~0.5–1 GB | bundled | small | ~1 GB |
| **Godot 4** | ~150 MB (~250 MB .NET build) | ~1–1.5 GB templates, only needed to export | small | **~0.3–1.7 GB** |
| **MonoGame** | ~100 MB packages | none | small | ~1 GB with the .NET SDK |
| **GameMaker** | ~1–2 GB IDE | ~1 GB per runtime version | moderate | ~3–5 GB |
| **Cocos Creator** | ~2 GB editor | ~1–2 GB per engine version | moderate | ~4–6 GB |
| **Unity 6** | ~500 MB Hub + **5–8 GB per editor** | +2–3 GB iOS module | **multi-GB `Library/` per project, regenerates** | **~10–15 GB and climbing** |
| **Unreal 5** | **30–50 GB** | large | 10+ GB derived data cache | **out of the question** |

Supporting tools, if needed: .NET SDK ~1 GB · Rider ~3 GB · VS Code ~500 MB · Android Studio ~10 GB.

## What this does to the ranking

**Unity is effectively eliminated on storage alone.** Ten to fifteen gigabytes before projects, and
Unity's per-project `Library/` folders are multi-gigabyte and rebuild themselves — the worst possible
profile for a constrained disk. If 3D and hiring later make Unity necessary, that is a decision to
take when you have more disk, not now.

**Unreal was already out; this closes it.**

**Godot is unusually good here.** The editor is a single self-contained app of a couple hundred
megabytes, and export templates are a separate optional download you do not need until you actually
export. You can develop for months on ~250 MB.

**LÖVE2D and raylib are in a different class.** Ten and fifty megabytes respectively. Both are
rounding errors.

**GameMaker sits in the middle** — a few gigabytes, and runtime versions accumulate unless pruned.

## Practical mitigations, whatever you choose

- Develop against a **web build on the iPad home screen** and defer Xcode entirely until launch
- If Xcode is already installed, delete unused simulator runtimes (Settings → Platforms) and clear
  `~/Library/Developer/Xcode/DerivedData` — routinely tens of gigabytes
- Godot: skip export templates until you need them
- GameMaker: delete old runtime versions after upgrading
- Unity, if ever: keep one editor version, and delete `Library/` on dormant projects

## Revised shortlist with storage weighted

1. **LÖVE2D** — ~10 MB, Balatro proves the fit, instant startup. Cost: Lua's typing, no 3D
2. **Godot 4 + C#** — ~250 MB while developing, best built-in UI, console path, huge community
3. **raylib** — ~50 MB, real 3D headroom, you build everything
4. **MonoGame + Nez** — ~1 GB with the SDK, C#, proven on Switch
5. **GameMaker** — ~3–5 GB, excellent 2D, $79.99/month for console
6. ~~Unity~~ — ruled out on disk unless circumstances change


---

# Addendum 3 — AI-assisted workflow and visual capability

The decisive axis, and the one the first pass ignored entirely.

## Why editor-bound engines lose here

AI coding assistants work well with every engine **at the scripting level**, but they share one
limitation: they can write code, they cannot operate the engine's editor.

In Godot that means scenes, node trees, anchors, containers and themes are hand-built in a GUI. The
`.tscn` format is text and can technically be generated, but it is verbose, order-sensitive, and the
editor rewrites it — so you fight the grain constantly. For a game that is 80% interface, the
interface is precisely the part AI cannot help with.

In a code-first framework, **everything is code**, so everything is generatable. Describe a card
grid, get a card grid, run it, iterate. That is a different working rhythm, and given a mostly-UI
game it is a large multiplier rather than a marginal one.

This reverses my earlier reasoning. I ranked Godot first *because* it has a built-in UI system. But
a built-in UI system authored in a GUI is worth less to you than a hand-rolled one an assistant can
write and rewrite in seconds.

## The training-data problem — and why it argues against Haxe

AI assistance quality tracks how much of a language exists in the wild.

| Language | AI assistance quality |
|---|---|
| TypeScript / JavaScript | excellent |
| C# | excellent — and the compiler catches what the model gets wrong |
| Lua | very good — huge corpus, small surface area, few ways to be wrong |
| Python | excellent (but cannot reach the targets) |
| GDScript | fair — improving, much smaller corpus |
| **Haxe** | **poor — niche language, thin corpus** |
| **GML** | **poor — proprietary, thin corpus, and Feather's annotations are non-standard** |

This is the strongest argument against Haxe, and it is somewhat ironic: Haxe is code-first, which is
exactly what you want, but it is the one code-first option where an assistant will be least
reliable. The same applies to GameMaker's GML.

**Lua is the sweet spot for AI-generated game code.** Small language, enormous corpus, minimal
syntax, and hard to write in a confusingly clever way.

**C# is the other sweet spot**, for a different reason: the compiler is a second reviewer. A model's
mistakes surface as build errors rather than runtime surprises, which matters a lot for a
data-driven rules engine.

## Visual capability — juice per option

You want particles, shaders and escalating numbers on pixel art.

| | Shaders | Particles | Post-processing | Notes |
|---|---|---|---|---|
| **LÖVE2D** | GLSL via `newShader` | built-in system | canvases + blend modes | **Balatro's entire look is LÖVE shaders.** `moonshine` gives a ready post-processing chain |
| **Godot** | own shader language, live preview | GPUParticles2D, editor-authored | built-in | best out of the box, but authored in the GUI |
| **GameMaker** | GLSL ES | strong built-in | surfaces | excellent for juice, historically a strength |
| **raylib** | GLSL | **you build it** | render textures | capable, more manual |
| **MonoGame** | HLSL via MGFX | **you build it** | render targets | most manual of the five |
| **Web (WebGL/PixiJS)** | GLSL | library-provided | filters | very capable, enormous ecosystem |

Worth noting: your prototype already produces most of the juice you designed — escalating numbers,
crit scaling, shake, reaction sizing — with plain DOM and CSS. The shader work is additive polish,
not foundational.

## Third-party libraries

- **LÖVE** — small but well-curated: `moonshine` (post-processing), `hump` (state, camera, timers),
  `flux` (tweening), `bump` (collision, unneeded here)
- **MonoGame / C#** — the entire NuGet ecosystem, by far the largest here
- **Web / TS** — npm, largest of all
- **raylib** — deliberately minimal
- **Haxe** — small
- **Godot** — asset library exists but is editor-oriented

---

## Final ranking, all constraints weighted

Constraints: mostly UI · AI-generated code is the working method · tight disk · wants shader juice ·
iPad primary · Switch possible · 3D speculative · solo.

### 1. LÖVE2D
~10 MB. Pure code, so an assistant can write all of it. Lua is among the best-supported languages for
generated code. Built-in particles and GLSL shaders, and **Balatro is the existence proof** — a
systems-heavy, mostly-UI, deterministic game with escalating numbers that shipped to Switch,
PlayStation, Xbox, iOS and Android.
*Costs:* Lua's dynamic typing against a rules-heavy design (mitigate with LuaLS annotations and the
test suite you already have); no 3D; iPad and console both need a wrapper or a porting partner.

### 2. MonoGame + Nez
C#, and the compiler reviews generated code, which is worth a great deal for a data-driven rules
engine. Proven on Switch. Instant startup, ~1 GB with the SDK. NuGet is the largest ecosystem here.
*Costs:* most manual for visual effects; Nez's UI layer has a small community.

### 3. TypeScript + PixiJS or plain WebGL
The best possible iteration loop: no Xcode at all, add to the iPad home screen, live reload. Best AI
support of any option. Smallest footprint. Largest ecosystem.
*Costs:* **no console path.** Only viable if Switch is dropped, or accepted as a later port.

### 4. Godot 4
Still the best engine on the list by most conventional measures, and now demoted for one specific
reason: its greatest strength for this game is a UI system you author by hand in a GUI, which is the
part of the work you most want to delegate.

### 5. raylib
Tiny, fast, real 3D headroom, thoroughly code-first. You build the particle system and the UI layer
from nothing, and there is no console path without doing it yourself.

### 6. GameMaker · 7. Haxe/Heaps
Both code-capable and both hobbled by the same thing: proprietary or niche languages where AI
assistance is weakest. Haxe in particular is a shame, since it is otherwise a good fit.

---

## The recommendation

**LÖVE2D, with the simulation written as plain Lua modules that never touch `love.*`.**

That keeps the sim headless and testable with `busted`, exactly as the DOM-stub harness works now,
and it means the sim can be ported later if console requirements push you to C#.

The counter-case is real and worth stating: **if you want the compiler as a safety net on
AI-generated rules code, choose MonoGame + Nez instead.** That is a genuine trade — Lua buys you
velocity and a proven template in Balatro; C# buys you correctness guarantees on the code most likely
to break silently.

Both are a few hundred megabytes at most, both are pure code, and both survive the storage
constraint. Godot and Unity do not survive the AI-workflow constraint and the storage constraint
respectively.


---

# Addendum 4 — the systems languages, and a correction

I wrote "no console path" across Rust, C, C++ and Zig. That is wrong for two of them and needs
splitting apart.

## Console: the actual picture

**C and C++ have the *best* console story of any language.** Nintendo's SDK is C++. Sony's and
Microsoft's are C++. Every engine that exports to Switch does so by compiling C++ underneath. If you
write raw C or C++ against SDL, raylib or sokol, you hold full source and the port is genuinely
doable — swap the windowing, input and audio backends for the platform SDK, adapt to its memory
model, pass certification. Small studios do exactly this. It is real work, but it is not a wall.

**Rust is the actual blocker.** There is no officially supported Switch target, no licensed Rust
toolchain, and getting there means FFI into a C++ SDK that sits under NDA. Homebrew Rust-on-Switch
exists; licensed retail development effectively does not.

**Zig is the same problem with less precedent**, and it is also pre-1.0 with breaking changes each
release — a poor bet for a multi-year project.

So the honest ordering on console is: C/C++ excellent, Rust blocked, Zig blocked.

## The real reasons I set them aside

**Compile time versus an AI-driven loop.** If the working method is generate, run, look, regenerate,
then compile time is the dominant cost. Lua and JavaScript are zero. C# is a second or two. C is
fast. **C++ with templates is slow, and Rust is notoriously slow.** A thirty-second rebuild between
every iteration is corrosive when you are iterating dozens of times an hour.

**UI from scratch is much harder down here.** Text layout, font rendering, scroll containers, focus,
input handling — all of it is significantly more work in C, C++, Rust or Zig than in Lua. The options
that exist are mostly developer tooling rather than shippable game UI: **Dear ImGui** looks like a
debug panel, **Nuklear** and **microui** are minimal, **Clay** is a good renderer-agnostic layout
library but still leaves you drawing everything. For a game that is 80% interface, this is the
decisive practical cost.

**You would be paying for performance you do not need.** Manual memory management and borrow checking
buy throughput. Your heaviest fight is a few hundred integer operations. There is nothing to optimise,
so the discipline is pure overhead.

**AI reliability varies more than corpus size suggests.** C++ has an enormous corpus but is where
generated code hides the subtlest faults — lifetimes, aliasing, undefined behaviour that runs fine
until it does not. Rust inverts this: the borrow checker rejects most bad generated code, which is
genuinely useful, but the corpus is smaller and the iteration cost is higher. Zig's corpus is small
and its API keeps moving.

## The specific options, for the record

| | Language | Console | Notes |
|---|---|---|---|
| **raylib** | C (bindings for C#, Zig, Odin, Go, Rust) | portable yourself | already ranked 5th — genuinely viable |
| **sokol** | C | portable yourself | even thinner than raylib, excellent cross-platform headers |
| **SDL3** | C | portable yourself | the substrate most things sit on |
| **SFML** | C++ | portable yourself | mature, 2D-oriented, comfortable API |
| **Allegro** | C | portable yourself | old, alive, small community |
| **Axmol** | C++ | no Switch | covered in addendum 1 |
| **Bevy** | Rust | blocked | ECS is the wrong shape for turn-based; UI still immature |
| **Fyrox** | Rust | blocked | editor-based, small |
| **macroquad / ggez / comfy** | Rust | blocked | pleasant, small, no console |
| **Mach** | Zig | blocked | ambitious, early, direction has shifted repeatedly |
| **zig-gamedev / raylib-zig** | Zig | blocked | bindings, pre-1.0 churn |

## When one of these would be the right answer

If you enjoy low-level work enough that it is a reason to build rather than a tax — that is a real
consideration and not a soft one. Motivation matters more than most technical arguments on a solo
multi-year project.

Otherwise: if the game ever became realtime with thousands of entities, or if you wanted to own the
console port outright rather than depend on a porting partner, **C with raylib or sokol** is the
serious version of this. Not Rust, and not Zig, until Switch toolchains exist for them.

**Revised placement:** raylib in C stays at 5th, and the reason is UI cost and self-owned porting
work — not a missing console path. Rust and Zig stay eliminated, now for the correct reason.
