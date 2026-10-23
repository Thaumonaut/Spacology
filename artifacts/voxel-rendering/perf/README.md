# Microvoxel performance surveys

`perf-survey.cjs` drives installed Chrome headlessly on the real GPU (Playwright `channel: 'chrome'`) through map views
at 4 km, a pan over the seed-2718 peak and Walk at home and on the peak. It records time until every visible node is
ready, frame p50/p95/p99, pan hitches, and mesh-cache size. Run it against a served copy of the site:
`NODE_PATH=<repo>/node_modules ONLY=home-4000,peak-4000,pan-peak-1200,walk-home,walk-peak node perf-survey.cjs out.json http://127.0.0.1:<port>`.
Frames are capped at 60 Hz in headless Chrome on this Mac, so frame times only show hitches; loading time is the signal.

| File | What |
| --- | --- |
| `coarse-trees-before.json`, `coarse-trees-after.json` | Before/after far-view tree sampling (8 m+ columns test two tree cells, not 25). 4 km map ready 10.5 s → 1.9 s (home), 11.6 → 3.0 s (peak); Walk at home 69 → 36 s; Walk on the peak 74 → 68 s (its mesh cache sits at the 384 MiB budget, so it evicts and regenerates). |
| `coarse-trees-before-4000.png`, `coarse-trees-after-4000.png` | The 4 km map view at home before and after: same forest cover and pattern. |
