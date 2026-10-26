# Imported asset provenance

Quaternius, **Medieval Village MegaKit — Standard (free)**.

- Author: https://quaternius.com/packs/medievalvillagemegakit.html
- Download: https://quaternius.itch.io/medieval-village-megakit
- License: CC0 1.0; included in `LICENSE-QUATERNIUS.txt`.
- Downloaded: 2026-10-25. Source archive checksum and selected models are in `manifest.json`.
- Only the freely downloaded Standard files are included; no paid models or engine projects.

Eleven glTF models were extracted. Vertex geometry, normals and UVs are unchanged.
Base-colour textures were resized to 512 px. Normal, roughness and occlusion texture
references were removed to keep this comparison small; roughness is fixed at 0.85.
Architecture is assembled from the author's wall, door-opening, window, floor,
roof and gable modules. Matching material names and repeated modules are shared
and instanced. `Prop_Crate` is retained for follow-up furnishing comparisons.

Three.js is vendored from the repository's installed version, with its MIT license
in `../vendor/three/LICENSE`. The voxel backend reuses CastleVox's existing dense
grid voxelizer/greedy mesher and sparse-brick raycaster. It uses procedural wall pieces and simplified
roof envelopes, rather than voxelizing the imported models.
