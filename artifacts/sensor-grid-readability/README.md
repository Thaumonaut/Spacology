# Sensor placement: readability of crossed-out cells

Headless screenshots of `prototypes/sensor-grid.html` (seed 11, Theatre 11×11), comparing ways to show which cells
are out of play. The user wanted the in-play cells to stand out at a glance while keeping the connected zone look
at the start, with a Catdoku-style board as the reference.

| # | Version | Verdict |
|---|---|---|
| 1 | [Darkened in place](1-before-darkened.png): out cells go flat under a veil | Helps only a little |
| 2 | [Islands, full colour](2-islands-full-colour.png): out cells break away as their own tiles | Crossed tiles still compete with open ones |
| 3 | [Islands with a bold white ✕](3-islands-bold-x.png) | Same issue: too bright |
| 4 | [Islands, bold ✕, faded](4-islands-bold-x-faded.png) | **The user's favourite**, but the ✕ faded with the tile and open areas kept square corners |
| 5 | [Dynamic islands, mid-solve](5-dynamic-islands-mid-solve.png) | Only the tile dims and the ✕ stays bright, and each zone's open part is its own rounded shape. But every crossed cell was a separate tile with a wider gap than between zones |
| 6 | [Dynamic islands, late in the solve](6-dynamic-islands-late.png) | The remaining open cells read as small, separate shapes |
| 7 | [Solved](7-solved-rejoined.png) | Everything rejoins its zone for the reveal |
| 8 | [Merged parts, mid-solve](8-merged-parts-mid-solve.png) | Each zone splits into an open part and a crossed-out part, each one rounded shape, with the same gap as between zones |
| 9 | [Merged parts, late in the solve](9-merged-parts-late.png) | The open cells left are bright, textured shapes; crossed parts are dimmed shapes with bold ✕s |
| 10 | [Deep and thin gaps, start](10-deep-gaps-start.png) | Zones now have deeper gaps between them (6 px) |
| 11 | [Deep and thin gaps, mid-solve](11-deep-gaps-mid-solve.png) | Deep gaps between zones; a thin gap (2 px) where a zone's open and crossed parts meet, too thin for clean islands |
| 12 | [Deep and thin gaps, late in the solve](12-deep-gaps-late.png) | Colours stay clearly apart while each zone's split is quieter |
| 13 | [Wider gaps, start](13-wider-gaps-start.png) | Zones 8 px apart |
| 14 | [Wider gaps, mid-solve](14-wider-gaps-mid-solve.png) | 8 px between colours, 4 px within a colour. Edges stepped, because each side could be inset 4, 2 or 0 px |
| 15 | [Wider gaps, late in the solve](15-wider-gaps-late.png) | |
| 16 | [One border width, on the crossed side](16-single-border-on-crossed-mid-solve.png) ([late](16-single-border-on-crossed-late.png)) | The user's idea: each colour borders its outside (two borders between colours), and a split has one. Still steps: a one-sided border moves that edge off the grid line |
| 17 | [One border width, on the open side](17-single-border-on-open-mid-solve.png) ([late](17-single-border-on-open-late.png)) | Same problem from the other side |
| 18 | [Aligned seams, start](18-aligned-seams-start.png) | Every gap the same width, so every edge sits on the grid |
| 19 | [Aligned seams, mid-solve](19-aligned-seams-mid-solve.png) | Aligned, but drawn with inset shadows: ghost rings at rounded corners and notches where seams met dark gaps. Gaps between colours are dark; where one colour splits, the seam is a dim shade of that colour. Corners round only where two colours meet |
| 20 | [Aligned seams, late in the solve](20-aligned-seams-late.png) | |
| 21 | [Pastel crossed parts](21-pastel-crossed.png) | Mock-up. Crossed parts wash toward a soft pastel with a tinted ✕, so they recede without going dark. Light zones (ice, salt) get close to their open parts |
| 22 | [Greyed crossed parts](22-greyed-crossed.png) | Mock-up. Crossed parts become a muted grey version of the colour with a white ✕, mid-tone rather than dark |
| 23 | [Soft slate gaps](23-soft-slate-gaps.png) | Mock-up. Gaps in dark slate instead of black, with the current dark crossed parts |
| 24 | [Pastel crossed, slate gaps](24-pastel-and-slate.png) | Mock-up. 21 and 23 together |
| 25 | [Layered cells, start](25-layered-start.png) | Rebuilt with layers instead of inset shadows |
| 26 | [Layered cells, mid-solve](26-layered-mid-solve.png) | The dark board shows through every gap; each tile is its own rounded layer; seams inside a colour are their own strip |
| 27 | [Layered cells, zoomed 2×](27-layered-zoom.png) | No ghost rings, but inner corners were still square steps and icons were tight |
| 28 | [Per-cell fillets, mid-solve](28-fillets-mid-solve.png) ([zoom](29-fillets-zoom.png), [top](30-fillets-zoom-top.png)) | Rounding each cell on its own left dark pockets and wedges at seams. Drawing per cell can't do this cleanly |
| 31 | [Outlines, start](31-outlines-start.png) | Each zone drawn as one smooth outline |
| 32 | [Outlines, mid-solve](32-outlines-mid-solve.png) | **Shipped.** Each zone's open and crossed parts are single traced outlines with curved outer and inner corners; seams show the zone's underlay |
| 33 | [Outlines, zoomed 2×](33-outlines-zoom.png) | Clean outer and inner curves; smaller ✕ and sensor icons with more colour around them |

How it works:
- The coloured shapes are drawn by one layer under the cells (`.sg-shapes`, filled by `paintShapes()` in
  `prototypes/minigames/sensor-grid/sensor-grid.js`). For each zone it draws an underlay in the zone's seam shade, then its open part and
  its crossed-out part. Each is a single `clip-path` outline traced from the union of its cells, pulled in 3 px on
  every side, with outer corners curved at 10 px and inner corners at 6 px.
- Between zones the dark board shows through a 6 px gap. Inside a zone, the two parts sit 6 px apart over the
  seam-coloured underlay. Every edge is 3 px from a grid line, so edges align.
- The cells are transparent tap targets on top. They carry the ✕, sensors, glyphs and overlays. `render()` marks a cell
  **out** when it carries a ×, or when a placed sensor rules it out, and repaints the shapes. Zooming repaints them too.
- **Why the gap widths can't differ:** a gap that is wider on one side of an edge, or drawn on one side only, moves
  that edge off the grid line while its neighbours stay put, so edges step. Versions 14–17 all show this.
- `.sg-out` in `prototypes/minigames/sensor-grid/sensor-grid.css` dims the tile with `color-mix` (not `opacity`, so the ✕ is unaffected),
  removes the texture, and draws the bold white ✕.
- When the map is solved, islands are cleared. This works with or without reduced motion.
