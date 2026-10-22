# Voxel rendering: shadows and grass

Headless captures of `prototypes/microvoxel-world.html?extent=infinite&seed=2718&cx=-30&cz=-32&lx=4&lz=4` (1280×675, paused, so no wind motion), except where noted.

| File | What it shows |
| --- | --- |
| `1-before-halo.png` | Main checkout with the first-pass hillshade: tree canopies counted as terrain, so a false ring circles the giant tree and smudges sit beside every tree. |
| `2-sun-shadows.png` | Ground-only hillshade plus the sun shadow map: trees cast soft cone shadows. Only things standing on the ground cast; terrain never does. |
| `3-blade-grass.png` | First grass pass: small five-blade tufts with flat colour. |
| `4-stylized-grass.png` | Stylized grass: seven long curved blades per clump, roots matched to a shared meadow colour field on the ground, sunny yellow-green tips, soft shadows. Wind gusts lean the blades and brighten their tips (live only). |
| `5-ridge-142m.png` | `cell=0.125&cx=39&cz=-151` at 142 m: crystal spires cast onto the ice; no stair moiré. |
| `6-anime-first-pass.png` | Anime pass 1: crowns lit by a smoothed canopy-shape normal in three flat bands (sunny yellow-green, leaf green, teal shadow); simpler two-colour grass. The light/shadow split reads as a straight line down each cone. |
| `7-anime-crowns-soft-edges.png` | Crowns broken into leafy puffs; a grass cover map gives a noisy, frayed border where grass meets other ground, with shorter, sparser tufts at meadow edges. The bare ring under the giant tree awaits the generator's podzol. |

The flat dark ring around the giant tree in 2–4 is a different ground material from the terrain generator, so no grass grows there.
