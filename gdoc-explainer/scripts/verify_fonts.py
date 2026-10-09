"""Tally font family / size per location in a saved read_doc result, and flag stray styles.

Usage: python3 verify_fonts.py <read_doc.json> [tabId]
Locations: heading / body / code (shaded + mono) / callout (shaded) / table.
Anything in Arial, without an explicit font, or outside the design fonts is listed as SUSPECT.
"""
import json
import sys
from collections import Counter

DESIGN = {"Noto Sans SC", "Roboto Mono"}


def find_tab(d, tab_id):
    if "documentTab" in d:
        return d["documentTab"]
    for t in d.get("tabs", []):
        if not tab_id or t["tabProperties"]["tabId"] == tab_id:
            return t["documentTab"]
        hit = find_tab({"tabs": t.get("childTabs", [])}, tab_id)
        if hit:
            return hit
    if "body" in d:
        return d
    return None


def walk(content, in_table, out):
    for el in content:
        if "table" in el:
            for row in el["table"]["tableRows"]:
                for cell in row["tableCells"]:
                    walk(cell["content"], True, out)
        elif "paragraph" in el:
            p = el["paragraph"]
            pst = p.get("paragraphStyle", {})
            named = pst.get("namedStyleType", "NORMAL_TEXT")
            shaded = "shading" in pst and "backgroundColor" in pst["shading"] and pst["shading"]["backgroundColor"]
            for e in p["elements"]:
                tr = e.get("textRun")
                if not tr or not tr["content"].strip():
                    continue
                st = tr.get("textStyle", {})
                font = st.get("weightedFontFamily", {}).get("fontFamily")
                size = st.get("fontSize", {}).get("magnitude")
                if in_table:
                    loc = "table"
                elif named != "NORMAL_TEXT":
                    loc = "heading"
                elif shaded:
                    loc = "code" if font == "Roboto Mono" else "callout"
                else:
                    loc = "body"
                out.append((loc, font, size, e["startIndex"], tr["content"]))


d = json.load(open(sys.argv[1], encoding="utf-8"))
tab = find_tab(d, sys.argv[2] if len(sys.argv) > 2 else None)
if tab is None:
    sys.exit("tab not found")
runs = []
walk(tab["body"]["content"], False, runs)
tally = Counter()
for loc, font, size, _, txt in runs:
    tally[(loc, font, size)] += len(txt)
print(f"{'location':9} {'font':14} {'size':>5}  chars")
for (loc, font, size), n in sorted(tally.items(), key=lambda x: (x[0][0], -x[1])):
    print(f"{loc:9} {str(font):14} {str(size):>5}  {n}")
bad = [r for r in runs if r[1] not in DESIGN]
print(f"\nSUSPECT runs: {len(bad)}")
for loc, font, size, i, txt in bad[:30]:
    print(f"  @{i} {loc} {font} {size} {txt[:40]!r}")
