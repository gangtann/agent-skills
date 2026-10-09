"""Markdown subset -> Google Docs batchUpdate requests for an EMPTY tab, with a designed look.

Syntax: '@title ', '@sub ', '# ', '## ', '- ', '1. ', '> ' callout, ``` code, '|' tables,
inline **bold** and `code`. A table must follow a plain paragraph.
In table cells, '<br>' is a line break, and a cell made only of space-separated `code` spans
is split one span per line.

Usage: python3 md2gdocs.py <in.md> <tabId> <out.json> [start] [split]
  start: where content lands (default 1 = empty tab). With 'split', start is the endIndex of the paragraph
  to append after (insert in the middle of a tab); without it, start must be an empty paragraph.
"""
import json
import re
import sys

BODY_FONT = "Noto Sans SC"
MONO_FONT = "Roboto Mono"


def rgb(h):
    h = h.lstrip("#")
    return {"color": {"rgbColor": {"red": round(int(h[0:2], 16) / 255, 3), "green": round(int(h[2:4], 16) / 255, 3),
                                   "blue": round(int(h[4:6], 16) / 255, 3)}}}


INK = rgb("#2F3437")
MUTED = rgb("#6B7280")
ACCENT = rgb("#1F4E79")
ACCENT2 = rgb("#2E6DA4")
RULE = rgb("#D5DEE8")
CODE_BG = rgb("#F5F7FA")
CODE_BAR = rgb("#9DB4CC")
CODE_INK = rgb("#24292F")
INLINE_BG = rgb("#EEF1F5")
INLINE_INK = rgb("#8A2C2C")
CALLOUT_BG = rgb("#EEF5FC")
CALLOUT_BAR = rgb("#2E6DA4")
TH_BG = rgb("#1F4E79")
WHITE = rgb("#FFFFFF")
GRID = rgb("#D0D7DE")
ZEBRA = rgb("#F7F9FB")


def pt(x):
    return {"magnitude": x, "unit": "PT"}


def border(color, width, pad):
    return {"color": color, "width": pt(width), "padding": pt(pad), "dashStyle": "SOLID"}


def u16(s):
    return len(s.encode("utf-16-le")) // 2


def parse_inline(text):
    out, spans, pos = [], [], 0
    for m in re.finditer(r"\*\*(.+?)\*\*|`([^`]+)`|([^*`]+|\*|`)", text):
        if m.group(1) is not None:
            seg, kind = m.group(1), "bold"
        elif m.group(2) is not None:
            seg, kind = m.group(2), "code"
        else:
            seg, kind = m.group(3), None
        n = u16(seg)
        if kind:
            spans.append((pos, pos + n, kind))
        out.append(seg)
        pos += n
    return "".join(out), spans


def cell_text(cell):
    """Table cell: '<br>' -> newline; a cell of only space-separated `code` spans -> one per line."""
    cell = re.sub(r"\s*<br\s*/?>\s*", "\n", cell)
    if re.fullmatch(r"(`[^`]+`\s+)+`[^`]+`", cell):
        cell = re.sub(r"`\s+`", "`\n`", cell)
    return cell


def parse_blocks(md):
    lines = md.split("\n")
    blocks, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("```"):
            j, code = i + 1, []
            while not lines[j].startswith("```"):
                code.append(lines[j])
                j += 1
            blocks.append(("code", code))
            i = j + 1
            continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            blocks.append(("table", rows))
            continue
        if not ln.strip():
            i += 1
            continue
        if ln.startswith("@title "):
            blocks.append(("title", ln[7:]))
        elif ln.startswith("@sub "):
            blocks.append(("sub", ln[5:]))
        elif m := re.match(r"(#{1,3}) (.*)", ln):
            blocks.append((f"h{len(m.group(1))}", m.group(2)))
        elif ln.startswith("- "):
            blocks.append(("bullet", ln[2:]))
        elif re.match(r"\d+\. ", ln):
            blocks.append(("num", re.sub(r"^\d+\. ", "", ln)))
        elif ln.startswith("> "):
            blocks.append(("callout", ln[2:]))
        else:
            blocks.append(("p", ln))
        i += 1
    return blocks


def build(md, tab_id, start=1, split=False):
    """Build requests. Content lands at `start`.

    Default: `start` is an empty paragraph (index 1 of an empty tab, or what is left after deleting a range).
    split=True: `start` is the endIndex of an existing paragraph; a paragraph break is inserted before its
    newline and the new content follows it, so text before and after stays untouched.
    """
    reqs = []
    idx = start
    first = [True]
    seg = []
    after_table = False

    def rng(a, b):
        return {"startIndex": a, "endIndex": b, "tabId": tab_id}

    def ts(a, b, style, fields):
        if b > a:
            reqs.append({"updateTextStyle": {"range": rng(a, b), "textStyle": style, "fields": fields}})

    def ps(a, b, style, fields):
        reqs.append({"updateParagraphStyle": {"range": rng(a, b), "paragraphStyle": style, "fields": fields}})

    def inline(a, spans, code_size=10):
        for s, e, k in spans:
            if k == "bold":
                ts(a + s, a + e, {"bold": True, "foregroundColor": rgb("#1F2328")}, "bold,foregroundColor")
            else:
                ts(a + s, a + e, {"weightedFontFamily": {"fontFamily": MONO_FONT}, "fontSize": pt(code_size),
                                  "foregroundColor": INLINE_INK}, "weightedFontFamily,fontSize,foregroundColor")

    # namedStyleType 会把文字样式重置为该命名样式的默认值（Arial 11），
    # 所以同一段文字的段落样式必须先于文字样式发送
    order = {"insertText": 0, "deleteParagraphBullets": 0.5, "updateParagraphStyle": 1, "createParagraphBullets": 2, "updateTextStyle": 3}

    def flush():
        n0 = len(reqs)
        info = _flush()
        reqs[n0:] = sorted(reqs[n0:], key=lambda r: order[next(iter(r))])
        return info

    def _flush():
        nonlocal idx, seg, after_table
        if not seg:
            return None
        full = "\n".join(t for _, t, _ in seg)
        start = idx
        if first[0] and split:
            reqs.append({"insertText": {"location": {"index": start - 1, "tabId": tab_id}, "text": "\n" + full}})
        else:
            reqs.append({"insertText": {"location": {"index": start, "tabId": tab_id}, "text": full}})
        if first[0] and idx > 1:
            # 插入的段落会继承所在段落的列表、缩进、边框、底色，先清掉
            reqs.append({"deleteParagraphBullets": {"range": rng(start, start + u16(full))}})
        first[0] = False
        bounds, pos = [], start
        for kind, t, spans in seg:
            n = u16(t)
            bounds.append((kind, pos, pos + n + 1, spans))
            pos += n + 1
        end = bounds[-1][2]
        # 基础样式：正文字体、字号、颜色、行距
        ts(start, end - 1, {"weightedFontFamily": {"fontFamily": BODY_FONT}, "fontSize": pt(10.5),
                            "foregroundColor": INK, "bold": False, "italic": False},
           "weightedFontFamily,fontSize,foregroundColor,bold,italic")
        ps(start, end, {"namedStyleType": "NORMAL_TEXT", "lineSpacing": 150, "spaceAbove": pt(0),
                        "spaceBelow": pt(7), "indentStart": pt(0), "indentFirstLine": pt(0)},
           "namedStyleType,lineSpacing,spaceAbove,spaceBelow,indentStart,indentFirstLine,"
           "borderTop,borderBottom,borderLeft,shading")
        if after_table:
            ps(bounds[0][1], bounds[0][2], {"spaceAbove": pt(10)}, "spaceAbove")
            after_table = False
        k = 0
        while k < len(bounds):
            kind, a, b, spans = bounds[k]
            j = k
            while kind in ("code", "callout", "bullet", "num") and j + 1 < len(bounds) and bounds[j + 1][0] == kind:
                j += 1
            a2, b2 = a, bounds[j][2]
            if kind == "title":
                ps(a, b, {"namedStyleType": "TITLE", "spaceAbove": pt(0), "spaceBelow": pt(2), "lineSpacing": 120},
                   "namedStyleType,spaceAbove,spaceBelow,lineSpacing")
                ts(a, b - 1, {"fontSize": pt(24), "bold": True, "foregroundColor": ACCENT}, "fontSize,bold,foregroundColor")
            elif kind == "sub":
                ps(a, b, {"spaceBelow": pt(18), "borderBottom": border(RULE, 1, 8)}, "spaceBelow,borderBottom")
                ts(a, b - 1, {"fontSize": pt(9.5), "foregroundColor": MUTED}, "fontSize,foregroundColor")
            elif kind == "h1":
                ps(a, b, {"namedStyleType": "HEADING_1", "keepWithNext": True, "spaceAbove": pt(24),
                          "spaceBelow": pt(10), "lineSpacing": 120, "borderBottom": border(RULE, 0.75, 4)},
                   "namedStyleType,keepWithNext,spaceAbove,spaceBelow,lineSpacing,borderBottom")
                ts(a, b - 1, {"fontSize": pt(16), "bold": True, "foregroundColor": ACCENT}, "fontSize,bold,foregroundColor")
            elif kind in ("h2", "h3"):
                ps(a, b, {"namedStyleType": "HEADING_2" if kind == "h2" else "HEADING_3", "keepWithNext": True,
                          "spaceAbove": pt(16), "spaceBelow": pt(6), "lineSpacing": 120},
                   "namedStyleType,keepWithNext,spaceAbove,spaceBelow,lineSpacing")
                ts(a, b - 1, {"fontSize": pt(12.5), "bold": True, "foregroundColor": ACCENT2}, "fontSize,bold,foregroundColor")
            elif kind == "code":
                ps(a2, b2, {"shading": {"backgroundColor": CODE_BG}, "borderLeft": border(CODE_BAR, 2.25, 10),
                            "indentStart": pt(14), "indentFirstLine": pt(14), "indentEnd": pt(4), "lineSpacing": 125,
                            "spaceAbove": pt(0), "spaceBelow": pt(0)},
                   "shading,borderLeft,indentStart,indentFirstLine,indentEnd,lineSpacing,spaceAbove,spaceBelow")
                ps(a2, bounds[k][2], {"spaceAbove": pt(4)}, "spaceAbove")
                ps(bounds[j][1], b2, {"spaceBelow": pt(12)}, "spaceBelow")
                ts(a2, b2 - 1, {"weightedFontFamily": {"fontFamily": MONO_FONT}, "fontSize": pt(9),
                                "foregroundColor": CODE_INK}, "weightedFontFamily,fontSize,foregroundColor")
                for kk in range(k, j + 1):
                    for s, e, _ in bounds[kk][3]:
                        ts(bounds[kk][1] + s, bounds[kk][1] + e, {"foregroundColor": rgb("#6E7781")}, "foregroundColor")
            elif kind == "callout":
                ps(a2, b2, {"shading": {"backgroundColor": CALLOUT_BG}, "borderLeft": border(CALLOUT_BAR, 3, 10),
                            "indentStart": pt(14), "indentFirstLine": pt(14), "indentEnd": pt(4), "lineSpacing": 150,
                            "spaceAbove": pt(0), "spaceBelow": pt(0)},
                   "shading,borderLeft,indentStart,indentFirstLine,indentEnd,lineSpacing,spaceAbove,spaceBelow")
                ps(a2, bounds[k][2], {"spaceAbove": pt(6)}, "spaceAbove")
                ps(bounds[j][1], b2, {"spaceBelow": pt(14)}, "spaceBelow")
                ts(a2, b2 - 1, {"foregroundColor": rgb("#1E3A5F")}, "foregroundColor")
                for kk in range(k, j + 1):
                    inline(bounds[kk][1], bounds[kk][3])
            elif kind in ("bullet", "num"):
                for kk in range(k, j + 1):
                    inline(bounds[kk][1], bounds[kk][3])
                ps(a2, b2, {"spaceBelow": pt(4)}, "spaceBelow")
                ps(bounds[j][1], b2, {"spaceBelow": pt(10)}, "spaceBelow")
                reqs.append({"createParagraphBullets": {"range": rng(a2, b2 - 1), "bulletPreset":
                             "BULLET_DISC_CIRCLE_SQUARE" if kind == "bullet" else "NUMBERED_DECIMAL_ALPHA_ROMAN"}})
            else:
                inline(a, spans)
            k = j + 1
        seg = []
        idx = end
        return bounds[-1][0], end

    for kind, val in parse_blocks(md):
        if kind == "table":
            info = flush()
            if info is None or info[0] != "p":
                raise SystemExit(f"table must follow a plain paragraph, got {info}")
            i = info[1] - 1
            rows = val
            R, C = len(rows), max(len(r) for r in rows)
            reqs.append({"insertTable": {"rows": R, "columns": C, "location": {"index": i, "tabId": tab_id}}})
            parsed = [[parse_inline(cell_text(r[c] if c < len(r) else "")) for c in range(C)] for r in rows]
            for r in range(R - 1, -1, -1):
                for c in range(C - 1, -1, -1):
                    t = parsed[r][c][0]
                    if t:
                        reqs.append({"insertText": {"location": {"index": i + 4 + r * (2 * C + 1) + 2 * c,
                                                                 "tabId": tab_id}, "text": t}})
            total = sum(u16(parsed[r][c][0]) for r in range(R) for c in range(C))
            tstart = i + 4
            tend = i + 3 + R * (2 * C + 1) + total - 2
            loc = {"tableStartLocation": {"index": i + 1, "tabId": tab_id}, "rowIndex": 0, "columnIndex": 0}
            # 全表：字体、行距、边框、内边距
            ts(tstart, tend, {"weightedFontFamily": {"fontFamily": BODY_FONT}, "fontSize": pt(9.5),
                              "foregroundColor": INK}, "weightedFontFamily,fontSize,foregroundColor")
            ps(tstart, tend, {"lineSpacing": 130, "spaceAbove": pt(0), "spaceBelow": pt(0)},
               "lineSpacing,spaceAbove,spaceBelow")
            g = {"color": GRID, "width": pt(0.75), "dashStyle": "SOLID"}
            reqs.append({"updateTableCellStyle": {"tableRange": {"tableCellLocation": loc, "rowSpan": R, "columnSpan": C},
                         "tableCellStyle": {"borderTop": g, "borderBottom": g, "borderLeft": g, "borderRight": g,
                                            "paddingTop": pt(5), "paddingBottom": pt(5), "paddingLeft": pt(7),
                                            "paddingRight": pt(7), "contentAlignment": "MIDDLE"},
                         "fields": "borderTop,borderBottom,borderLeft,borderRight,paddingTop,paddingBottom,"
                                   "paddingLeft,paddingRight,contentAlignment"}})
            reqs.append({"updateTableCellStyle": {"tableRange": {"tableCellLocation": loc, "rowSpan": 1, "columnSpan": C},
                         "tableCellStyle": {"backgroundColor": TH_BG}, "fields": "backgroundColor"}})
            for r in range(2, R, 2):
                l2 = dict(loc, rowIndex=r)
                reqs.append({"updateTableCellStyle": {"tableRange": {"tableCellLocation": l2, "rowSpan": 1, "columnSpan": C},
                             "tableCellStyle": {"backgroundColor": ZEBRA}, "fields": "backgroundColor"}})
            offset = 0
            for r in range(R):
                for c in range(C):
                    t, spans = parsed[r][c]
                    st = i + 4 + r * (2 * C + 1) + 2 * c + offset
                    n = u16(t)
                    if n:
                        if r == 0:
                            ts(st, st + n, {"bold": True, "foregroundColor": WHITE}, "bold,foregroundColor")
                        elif c == 0:
                            ts(st, st + n, {"bold": True}, "bold")
                        if r > 0:
                            inline(st, spans, 9.5)
                    offset += n
            idx = i + 3 + R * (2 * C + 1) + offset
            def dispw(x):
                return sum(2 if ord(ch) > 0x2E80 else 1 for ch in x)
            ws = [max(8, min(46, max(dispw(parsed[r][c][0]) for r in range(R)))) for c in range(C)]
            widths = [468 * w / sum(ws) for w in ws]
            # 最小 72pt，超出部分从宽列中按比例扣回
            short = sum(max(0, 72 - w) for w in widths)
            big = sum(w for w in widths if w > 72)
            widths = [72 if w <= 72 else w - short * w / big for w in widths]
            for c in range(C):
                reqs.append({"updateTableColumnProperties": {"tableStartLocation": {"index": i + 1, "tabId": tab_id},
                             "columnIndices": [c], "tableColumnProperties": {"widthType": "FIXED_WIDTH",
                             "width": pt(round(widths[c]))}, "fields": "widthType,width"}})
            reqs.append({"updateTableRowStyle": {"tableStartLocation": {"index": i + 1, "tabId": tab_id},
                         "rowIndices": list(range(R)), "tableRowStyle": {"preventOverflow": True},
                         "fields": "preventOverflow"}})
            reqs.append({"pinTableHeaderRows": {"tableStartLocation": {"index": i + 1, "tabId": tab_id},
                         "pinnedHeaderRowsCount": 1}})
            after_table = True
        else:
            if kind == "code":
                for ln in val:
                    t = ln if ln else " "
                    cm = re.search(r"(?:^|\s)(#|//) ", t)
                    spans = [(u16(t[:cm.start(1)]), u16(t), "comment")] if cm else []
                    seg.append(("code", t, spans))
            else:
                t, spans = parse_inline(val)
                seg.append((kind, t, spans))
    flush()
    return reqs


if __name__ == "__main__":
    md = open(sys.argv[1], encoding="utf-8").read()
    start = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    split = len(sys.argv) > 5 and sys.argv[5] == "split"
    reqs = build(md, sys.argv[2], start, split)
    json.dump(reqs, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(reqs), "requests", len(json.dumps(reqs, ensure_ascii=False, separators=(",", ":"))), "chars")
