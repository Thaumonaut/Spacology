# Voxel rendering: next visual passes (agreed order, 2026-10-22)

Goal: one consistent anime art style across the whole scene. Trees and grass are done; everything else still uses the
older flat look. Work through these in order, with a capture in `artifacts/voxel-rendering/` for each.

1. ✅ **Anime rocks and cliffs.** Three-band cel shading for basalt, stone, sandstone and gravel, as for tree crowns: sunny
   warm-grey tops, cool lavender-blue shadow faces, soft highlights on ridges (from the hillshade cavity).
2. ✅ **Drifting cloud shadows.** Large, soft, slowly moving shadows over land and water: one noise lookup in the sun term.
   Frozen when paused or with reduced motion.
   ✅ Also: Ghibli golden-hour cloud layer in wide views (banks + wisps, opacity slider).
3. ✅ **Ink outlines.** Thin dark lines around trees, rocks and cliff edges, from a depth/normal edge pass. (Moved ahead of
   water: the river rework is still in progress on the terrain side.)
4. **Stylized water.** Shallow turquoise to deep blue by depth, white foam lines at shores and around rocks (use the
   generator's foam material), gentle moving glints. Wait for the river merge. Stable: water id 7, foam id 24, and
   geography() keeps water, riverDistance, riverLevel, riverWidth, foam, spring.
5. **Close-zoom leaf cards.** Fade cards out over the nearest zoom step so they stop reading as cutouts; the leafy voxel
   texture carries the closest view.

Merge plan agreed with spacology-b0: it merges its four agent branches (rivers, mountains, biomes, vegetation) onto
devin/1792601000-microvoxel-world first, then sends the new head and the final material ids (marked leaf / bark-culm /
standing object). This branch (voxel-shadows) then rebases a28f9e8..HEAD onto that head (the snapshot commit a28f9e8 is
dropped), redoes the node()/column() additions on the new code, runs `npm test -- microvoxel`, and hands it back. Until
then, keep changes inside voxel-renderer.js to avoid more node()/column() conflicts.

Waiting on the terrain session (spacology-b0): final material ids for podzol and the new ground materials, birch, larch,
bushes and bamboo, tree size variety and fewer giants. When they land: rebase this branch onto its merged baseline, give
each new leaf material its own card shape and palette, and give each new ground material soft grass edges.

Still owed: a full `npm test -- microvoxel` pass (skipped while iterating), and an Economy-mode cap on grass and leaf
cards before phones.
