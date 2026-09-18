#!/usr/bin/env python3
"""Writes docs/design/measurements.md from sweep.json.

    node sweep.js && python3 build-workbook.py && python3 report.py

Every number in the design docs that comes from a simulation should live here
rather than being typed into prose, because hand-maintained tables drift — and
a bulk rename across the docs mangled the aligned ones once already.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "sweep.json")
OUT = os.path.join(HERE, "..", "docs", "design", "measurements.md")

if not os.path.exists(SRC):
    sys.exit("sweep.json not found — run `node sweep.js` first")

D = json.load(open(SRC))
M = D["meta"]
W = M["worlds"]


def table(header, rows, align=None):
    align = align or ["l"] * len(header)
    sep = ["---" if a == "l" else "---:" for a in align]
    out = ["| " + " | ".join(header) + " |", "| " + " | ".join(sep) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def pct(x):
    return f"{x*100:+.1f}%"


L = []
L.append("# Measurements")
L.append("")
L.append("**Generated — do not edit.** `cd sim && node sweep.js && python3 build-workbook.py "
         "&& python3 report.py`")
L.append("")
L.append(f"{M['sample']} unique teams of {M['teamSize']}, {M['fightsPerProbe']} fights per "
         f"difficulty probe, difficulty ceiling {M['ceiling']}. Baseline (mean team score) "
         f"**{M['baseline']}**.")
L.append("")
L.append("A **breakpoint** is the difficulty a team still beats three fights in four. Higher is "
         "stronger.")
L.append("")
L.append("> " + M["caveat"])
L.append("")

# ---- roles ---------------------------------------------------------------
L.append("## Role lift")
L.append("")
L.append("Mean team score when N of a role are present, against baseline.")
L.append("")
by_role = {}
for r in D["roles"]:
    by_role.setdefault(r["tag"], {})[r["count"]] = r
rows = []
for role in sorted(by_role, key=lambda k: -max(v["vsBaseline"] for v in by_role[k].values())):
    cells = []
    for n in (1, 2, 3, 4):
        r = by_role[role].get(n)
        cells.append(pct(r["vsBaseline"]) if r else "—")
    rows.append([f"**{role}**"] + cells)
L.append(table(["role", "x1", "x2", "x3", "x4"], rows, ["l", "r", "r", "r", "r"]))
L.append("")

# ---- teams ---------------------------------------------------------------
L.append("## Strongest teams")
L.append("")
rows = [[t["team"], f"{t['avg']:.2f}"] + [f"{t[w]:.2f}" for w in W] + [t["rolesAt2"] or "—"]
        for t in D["teams"][:10]]
L.append(table(["team", "avg"] + W + ["roles at 2+"], rows,
               ["l", "r"] + ["r"] * len(W) + ["l"]))
L.append("")

# ---- characters ----------------------------------------------------------
L.append("## Is any character mandatory?")
L.append("")
L.append("`cost of banning` is how far the best achievable team falls if that character is "
         "removed from the pool.")
L.append("")
rows = [[c["name"], c["roles"], c["hooks"], c["topFreq"],
         ("—" if not c["costOfBanning"] else pct(-c["costOfBanning"]))]
        for c in D["characters"][:12]]
L.append(table(["character", "roles", "hooks", "in top 50", "cost of banning"], rows,
               ["l", "l", "r", "r", "r"]))
L.append("")

# ---- sensitivity ---------------------------------------------------------
L.append("## Which constants move the game")
L.append("")
L.append("Each constant varied alone across five values, everything else at default. `range` is "
         "how far the mean score travels across those values.")
L.append("")
by_const = {}
for s in D["sweep"]:
    by_const.setdefault(s["constant"], {}).setdefault(s["value"], []).append(s["bp"])
rows = []
for const_, vals in by_const.items():
    means = {v: sum(b) / len(b) for v, b in vals.items()}
    lo, hi = min(means.values()), max(means.values())
    rng = (hi - lo) / max(0.01, lo)
    ordered = sorted(means)
    rows.append([f"`{const_}`", f"{rng*100:.1f}%",
                 f"{ordered[0]} → {ordered[-1]}",
                 f"{means[ordered[0]]:.2f} → {means[ordered[-1]]:.2f}"])
rows.sort(key=lambda r: -float(r[1].rstrip("%")))
L.append(table(["constant", "range", "values tested", "mean score"], rows,
               ["l", "r", "l", "l"]))
L.append("")

# ---- worlds --------------------------------------------------------------
L.append("## Worlds")
L.append("")
rows = [[w["world"], w["speedMul"], f"{w['median']:.2f}", f"{w['max']:.2f}",
         f"{w['spread']:.1f}x", w["note"]] for w in D["worlds"]]
rows.sort(key=lambda r: -float(r[4].rstrip("x")))
L.append(table(["world", "speed", "median", "max", "spread", "note"], rows,
               ["l", "r", "r", "r", "r", "l"]))
L.append("")

# ---- verbs ---------------------------------------------------------------
L.append("## Verb census")
L.append("")
L.append("A verb carried by one character gives every chain through it exactly one possible "
         "shape. This never runs a fight, so it is unaffected by engine changes.")
L.append("")
rows = [[f"`{v['verb']}`", v["count"], v["holders"]] for v in D["verbs"]]
L.append(table(["verb", "characters", "who has it"], rows, ["l", "r", "l"]))
L.append("")

open(OUT, "w").write("\n".join(L) + "\n")
print(f"wrote {os.path.normpath(OUT)}  ({len(L)} lines)")
