"""slidekit: a tiny layout layer for lecture-style decks.

Every primitive writes to the .pptx AND draws into a PIL preview image, so layout
(overflow, overlap, spacing) can be checked without PowerPoint or LibreOffice.

Units are inches on a 13.333 x 7.5 canvas. See ../SKILL.md for the API and style rules.
"""
import re, io
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.oxml.ns import qn
from lxml import etree
from PIL import Image, ImageDraw, ImageFont

DPI = 100
RED, INK, GRAY, LIGHT, MID = "8C1515", "1F1F1F", "5F6368", "F3F3F3", "BDBDBD"
FONTDIR = "/System/Library/Fonts/Supplemental/"
FONTFILES = {
    ("Arial", 0, 0): "Arial.ttf", ("Arial", 1, 0): "Arial Bold.ttf",
    ("Arial", 0, 1): "Arial Italic.ttf", ("Arial", 1, 1): "Arial Bold Italic.ttf",
    ("Times New Roman", 0, 0): "Times New Roman.ttf", ("Times New Roman", 1, 0): "Times New Roman Bold.ttf",
    ("Times New Roman", 0, 1): "Times New Roman Italic.ttf", ("Times New Roman", 1, 1): "Times New Roman Bold Italic.ttf",
    ("Arial Unicode MS", 0, 0): "Arial Unicode.ttf", ("Arial Unicode MS", 1, 0): "Arial Unicode.ttf",
    ("Courier New", 0, 0): "Courier New.ttf", ("Courier New", 1, 0): "Courier New Bold.ttf",
    ("Courier New", 0, 1): "Courier New Italic.ttf", ("Courier New", 1, 1): "Courier New Bold Italic.ttf",
}
_fc = {}
_FALLBACK = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"]
def pfont(name, b, i, px):
    """Preview font. Uses macOS Supplemental fonts (metric-true for Arial/TNR/Courier);
    falls back to whatever exists so previews still render elsewhere (widths approximate)."""
    key = (name, b, i, px)
    if key not in _fc:
        fn = FONTFILES.get((name, int(b), int(i))) or FONTFILES[("Arial", int(b), int(i))]
        for path in [FONTDIR + fn] + _FALLBACK:
            try:
                _fc[key] = ImageFont.truetype(path, max(1, px)); break
            except OSError:
                continue
        else:
            _fc[key] = ImageFont.load_default()
    return _fc[key]

def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# ---------------- text model ----------------
class R:
    def __init__(self, text, b=False, i=False, color=None, size=None, font=None, sup=False, sub=False):
        self.text, self.b, self.i, self.color, self.size, self.font = text, b, i, color, size, font
        self.sup, self.sub = sup, sub

MATH_TOK = re.compile(r"\^\{[^}]*\}|_\{[^}]*\}|\^.|_.|[A-Za-z]+|\s+|.")
def math(s, color=None, size=None, b=False):
    """Mini TeX-ish: ^{..}/_{..} super/subscripts; single letters italic, words upright."""
    out = []
    for t in MATH_TOK.findall(s):
        if t[0] in "^_":
            body = t[2:-1] if t[1] == "{" else t[1:]
            out.append(R(body, b=b, i=body.isalpha() and len(body) <= 2, color=color, size=size,
                         font="Times New Roman", sup=t[0] == "^", sub=t[0] == "_"))
        else:
            out.append(R(t, b=b, i=t.isalpha() and len(t) == 1, color=color, size=size, font="Times New Roman"))
    return out

MARK = re.compile(r"(\{\{.+?\}\}|\[\[.+?\]\]|\*\*.+?\*\*|__.+?__|\$.+?\$)")
def md(s, color=None, size=None, font=None, b=False, i=False):
    """{{red bold}} [[red]] **bold** __italic__ $math$"""
    out = []
    for part in MARK.split(s):
        if not part:
            continue
        if part.startswith("{{"):
            out.append(R(part[2:-2], True, i, RED, size, font))
        elif part.startswith("[["):
            out.append(R(part[2:-2], b, i, RED, size, font))
        elif part.startswith("**"):
            out.append(R(part[2:-2], True, i, color, size, font))
        elif part.startswith("__"):
            out.append(R(part[2:-2], b, True, color, size, font))
        elif part.startswith("$"):
            out += math(part[1:-1], color, size, b)
        else:
            out.append(R(part, b, i, color, size, font))
    return out

class P:
    def __init__(self, runs, size=18, color=INK, align="left", after=6, bullet=None, level=0, font="Arial",
                 before=0, spacing=None, b=False):
        self.runs = md(runs, b=b) if isinstance(runs, str) else runs
        self.size, self.color, self.align, self.after, self.bullet = size, color, align, after, bullet
        self.level, self.font, self.before, self.spacing = level, font, before, spacing

def paras(items, **kw):
    return [x if isinstance(x, P) else P(x, **kw) for x in items]

# ---------------- deck ----------------
class Deck:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(13.333), Inches(7.5)
        self.slides = []
        self.warnings = []

    def new(self, notes=None):
        s = Slide(self, self.prs.slides.add_slide(self.prs.slide_layouts[6]), len(self.slides) + 1)
        if notes:
            s.sl.notes_slide.notes_text_frame.text = notes
        self.slides.append(s)
        return s

    def save(self, path, prevdir):
        self.prs.save(path)
        for s in self.slides:
            s.img.save(f"{prevdir}/s{s.n:02d}.png")


class Slide:
    def __init__(self, deck, sl, n):
        self.deck, self.sl, self.n = deck, sl, n
        self.img = Image.new("RGB", (int(13.333 * DPI), int(7.5 * DPI)), "white")
        self.d = ImageDraw.Draw(self.img)

    def warn(self, msg):
        self.deck.warnings.append(f"slide {self.n}: {msg}")

    # --- text ---
    def _fill_tf(self, tf, ps, anchor):
        tf.word_wrap = True
        tf.auto_size = MSO_AUTO_SIZE.NONE
        for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
            setattr(tf, m, 0)
        tf.vertical_anchor = {"top": MSO_ANCHOR.TOP, "middle": MSO_ANCHOR.MIDDLE, "bottom": MSO_ANCHOR.BOTTOM}[anchor]
        for k, p in enumerate(ps):
            para = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
            para.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}[p.align]
            para.space_after = Pt(p.after)
            if p.before:
                para.space_before = Pt(p.before)
            if p.spacing:
                para.line_spacing = p.spacing
            if p.bullet:
                ind = Inches(0.32)
                pPr = para._p.get_or_add_pPr()
                pPr.set("marL", str(int(ind * (p.level + 1))))
                pPr.set("indent", str(-int(ind)))
                c = etree.SubElement(pPr, qn("a:buClr"))
                etree.SubElement(c, qn("a:srgbClr")).set("val", RED if p.level == 0 else GRAY)
                etree.SubElement(pPr, qn("a:buSzPct")).set("val", "75000")
                etree.SubElement(pPr, qn("a:buFont")).set("typeface", "Arial")
                etree.SubElement(pPr, qn("a:buChar")).set("char", "●" if p.level == 0 else "○")
            for r in p.runs:
                run = para.add_run()
                run.text = r.text
                f = run.font
                f.size = Pt(r.size or p.size)
                f.bold, f.italic = bool(r.b), bool(r.i)
                f.color.rgb = RGBColor.from_string(r.color or p.color)
                f.name = r.font or p.font
                if r.sup or r.sub:
                    run._r.get_or_add_rPr().set("baseline", "30000" if r.sup else "-25000")

    def _layout(self, ps, w):
        """returns list of (para, lines[(items, width, height)]) with items (x, run, font, text, dy)"""
        W = w * DPI
        out = []
        for p in ps:
            ind = 0.32 * DPI * (p.level + 1) if p.bullet else 0
            lines, cur, x, lh = [], [], ind, 0
            for r in p.runs:
                sz = (r.size or p.size)
                px = sz * DPI / 72
                fpx = int(px * (0.65 if (r.sup or r.sub) else 1))
                fnt = pfont(r.font or p.font, r.b, r.i, fpx)
                dy = -px * 0.33 if r.sup else (px * 0.25 if r.sub else 0)
                for tok in re.findall(r"\S+|\s+", r.text):
                    tw = fnt.getlength(tok)
                    if not tok.isspace() and x + tw > W + 0.5 and x > ind:
                        lines.append((cur, x, lh)); cur, x, lh = [], ind, 0
                    if tok.isspace() and x == ind and lines:
                        continue
                    cur.append((x, r, fnt, tok, dy, px))
                    x += tw
                    lh = max(lh, px * 1.2 * (p.spacing or 1))
            if not lh:
                lh = p.size * DPI / 72 * 1.2
            lines.append((cur, x, lh))
            out.append((p, ind, lines))
        return out

    def _draw_text(self, x, y, w, h, ps, anchor):
        lay = self._layout(ps, w)
        total = sum(sum(l[2] for l in ls) + (p.after + p.before) * DPI / 72 for p, _, ls in lay)
        total -= lay[-1][0].after * DPI / 72
        X, Y, H = x * DPI, y * DPI, h * DPI
        if total > H + 3:
            txt = "".join(r.text for r in ps[0].runs)[:40]
            self.warn(f"text overflow ({total / DPI:.2f}in > {h:.2f}in): {txt!r}")
        cy = Y + {"top": 0, "middle": (H - total) / 2, "bottom": H - total}[anchor]
        for p, ind, lines in lay:
            cy += p.before * DPI / 72
            for li, (items, lw, lh) in enumerate(lines):
                off = {"left": 0, "center": (w * DPI - lw) / 2, "right": w * DPI - lw}[p.align]
                if p.bullet and li == 0:
                    bf = pfont("Arial", 0, 0, int(p.size * DPI / 72 * 0.75))
                    self.d.text((X + ind - 0.32 * DPI, cy + lh * 0.12), "●" if p.level == 0 else "○",
                                font=bf, fill=hexrgb(RED if p.level == 0 else GRAY))
                for (ix, r, fnt, tok, dy, px) in items:
                    self.d.text((X + off + ix, cy + (lh - px * 1.2) + px * 0.05 + dy), tok, font=fnt,
                                fill=hexrgb(r.color or p.color))
                cy += lh
            cy += p.after * DPI / 72

    def text(self, x, y, w, h, ps, anchor="top", **kw):
        if isinstance(ps, (str, P)):
            ps = [ps]
        ps = paras(ps, **kw)
        if x < 0.3 or y < 0.2 or x + w > 13.1 or y + h > 7.35:
            self.warn(f"text box near/over edge at ({x},{y},{w},{h})")
        tb = self.sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        self._fill_tf(tb.text_frame, ps, anchor)
        self._draw_text(x, y, w, h, ps, anchor)
        return tb

    # --- shapes ---
    def rect(self, x, y, w, h, fill=None, line=None, lw=1.0, rounded=False, ps=None, anchor="middle",
             dash=False, pad=0.08, **kw):
        shp = self.sl.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE,
                                       Inches(x), Inches(y), Inches(w), Inches(h))
        if rounded:
            shp.adjustments[0] = 0.12
        shp.shadow.inherit = False
        if fill:
            shp.fill.solid(); shp.fill.fore_color.rgb = RGBColor.from_string(fill)
        else:
            shp.fill.background()
        if line:
            shp.line.color.rgb = RGBColor.from_string(line); shp.line.width = Pt(lw)
            if dash:
                from pptx.enum.dml import MSO_LINE
                shp.line.dash_style = MSO_LINE.DASH
        else:
            shp.line.fill.background()
        box = [x * DPI, y * DPI, (x + w) * DPI, (y + h) * DPI]
        r = int(0.12 * min(w, h) * DPI) if rounded else 0
        self.d.rounded_rectangle(box, radius=r, fill=hexrgb(fill) if fill else None,
                                 outline=hexrgb(line) if line else None, width=max(1, int(lw * DPI / 72)))
        if ps is not None:
            if isinstance(ps, (str, P)):
                ps = [ps]
            align = kw.pop("align", "center")
            ps = paras(ps, **kw)
            for p in ps:
                p.align = align
            tf = shp.text_frame
            self._fill_tf(tf, ps, anchor)
            for m in ("margin_left", "margin_right"):
                setattr(tf, m, Inches(pad))
            self._draw_text(x + pad, y, w - 2 * pad, h, ps, anchor)
        return shp

    def oval(self, x, y, w, h, fill, line=None):
        shp = self.sl.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
        shp.shadow.inherit = False
        shp.fill.solid(); shp.fill.fore_color.rgb = RGBColor.from_string(fill)
        if line:
            shp.line.color.rgb = RGBColor.from_string(line)
        else:
            shp.line.fill.background()
        self.d.ellipse([x * DPI, y * DPI, (x + w) * DPI, (y + h) * DPI], fill=hexrgb(fill),
                       outline=hexrgb(line) if line else None)
        return shp

    def line(self, x1, y1, x2, y2, color=INK, lw=1.5, arrow=False, dash=False):
        c = self.sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
        c.line.color.rgb = RGBColor.from_string(color)
        c.line.width = Pt(lw)
        ln = c.line._get_or_add_ln()
        if dash:
            etree.SubElement(ln, qn("a:prstDash")).set("val", "dash")
        if arrow:
            t = etree.SubElement(ln, qn("a:tailEnd")); t.set("type", "triangle"); t.set("w", "med"); t.set("len", "med")
        P1, P2 = (x1 * DPI, y1 * DPI), (x2 * DPI, y2 * DPI)
        self.d.line([P1, P2], fill=hexrgb(color), width=max(1, int(lw * DPI / 72 + 0.5)))
        if arrow:
            import math as m
            a = m.atan2(P2[1] - P1[1], P2[0] - P1[0]); L = 9
            pts = [P2, (P2[0] - L * m.cos(a - 0.45), P2[1] - L * m.sin(a - 0.45)),
                   (P2[0] - L * m.cos(a + 0.45), P2[1] - L * m.sin(a + 0.45))]
            self.d.polygon(pts, fill=hexrgb(color))
        return c

    # --- images ---
    def pic(self, path, x, y, w, h, halign="center", valign="middle", border=False):
        im = Image.open(path)
        ar = im.width / im.height
        pw, ph = (w, w / ar) if w / h < ar else (h * ar, h)
        px = x + {"left": 0, "center": (w - pw) / 2, "right": w - pw}[halign]
        py = y + {"top": 0, "middle": (h - ph) / 2, "bottom": h - ph}[valign]
        self.sl.shapes.add_picture(path, Inches(px), Inches(py), Inches(pw), Inches(ph))
        self.img.paste(im.convert("RGB").resize((int(pw * DPI), int(ph * DPI)), Image.LANCZOS),
                       (int(px * DPI), int(py * DPI)))
        if border:
            self.rect(px - 0.05, py - 0.05, pw + 0.1, ph + 0.1, None, MID, 0.75)
        return px, py, pw, ph

    # --- charts ---
    def chart(self, kind, x, y, w, h, cats, series, colors, title=None, ytitle=None, xtitle=None,
              legend=True, numfmt=None, xtick_every=None):
        cd = CategoryChartData()
        cd.categories = cats
        for name, vals in series:
            cd.add_series(name, vals)
        ct = {"line": XL_CHART_TYPE.LINE, "col": XL_CHART_TYPE.COLUMN_CLUSTERED}[kind]
        gf = self.sl.shapes.add_chart(ct, Inches(x), Inches(y), Inches(w), Inches(h), cd)
        ch = gf.chart
        ch.font.size = Pt(12); ch.font.name = "Arial"; ch.font.color.rgb = RGBColor.from_string(GRAY)
        ch.has_title = bool(title)
        if title:
            ch.chart_title.text_frame.text = title
            tp = ch.chart_title.text_frame.paragraphs[0]
            tp.runs[0].font.size = Pt(14); tp.runs[0].font.bold = True
            tp.runs[0].font.color.rgb = RGBColor.from_string(INK)
        ch.has_legend = legend
        if legend:
            ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
            ch.legend.font.size = Pt(12)
        for k, pl in enumerate(ch.plots):
            if kind == "col":
                pl.gap_width = 60; pl.overlap = 0
            for sidx, s in enumerate(pl.series):
                col = RGBColor.from_string(colors[sidx])
                if kind == "line":
                    s.format.line.color.rgb = col; s.format.line.width = Pt(2.25); s.smooth = False
                    s.marker.style = None
                    from pptx.enum.chart import XL_MARKER_STYLE
                    s.marker.style = XL_MARKER_STYLE.NONE
                else:
                    s.format.fill.solid(); s.format.fill.fore_color.rgb = col
        va, ca = ch.value_axis, ch.category_axis
        va.major_gridlines.format.line.color.rgb = RGBColor.from_string("E3E3E3")
        va.format.line.fill.background()
        ca.format.line.color.rgb = RGBColor.from_string(MID)
        ca.has_major_gridlines = False
        if numfmt:
            va.tick_labels.number_format = numfmt; va.tick_labels.number_format_is_linked = False
        if xtick_every:
            ca_el = ca._element
            for tag, val in (("c:tickLblSkip", xtick_every), ("c:tickMarkSkip", xtick_every)):
                e = etree.SubElement(ca_el, qn(tag)); e.set("val", str(val))
        for ax, t in ((va, ytitle), (ca, xtitle)):
            if t:
                ax.has_title = True
                ax.axis_title.text_frame.text = t
                r = ax.axis_title.text_frame.paragraphs[0].runs[0]
                r.font.size = Pt(12); r.font.bold = False; r.font.color.rgb = RGBColor.from_string(GRAY)
        # preview via matplotlib
        import matplotlib; matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(w, h), dpi=DPI)
        import numpy as np
        xs = np.arange(len(cats))
        for sidx, (name, vals) in enumerate(series):
            if kind == "line":
                ax.plot(xs, vals, color="#" + colors[sidx], lw=2, label=name)
            else:
                bw = 0.8 / len(series)
                ax.bar(xs + (sidx - (len(series) - 1) / 2) * bw, vals, bw, color="#" + colors[sidx], label=name)
        step = xtick_every or 1
        ax.set_xticks(xs[::step]); ax.set_xticklabels([str(c) for c in cats][::step], fontsize=9)
        if title: ax.set_title(title, fontsize=11, fontweight="bold")
        if ytitle: ax.set_ylabel(ytitle, fontsize=9)
        if xtitle: ax.set_xlabel(xtitle, fontsize=9)
        if legend: ax.legend(fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.18), ncol=len(series), frameon=False)
        for sp in ("top", "right"): ax.spines[sp].set_visible(False)
        fig.tight_layout()
        buf = io.BytesIO(); fig.savefig(buf, format="png"); plt.close(fig)
        self.img.paste(Image.open(buf).convert("RGB").resize((int(w * DPI), int(h * DPI))), (int(x * DPI), int(y * DPI)))
        return ch

    # --- chrome ---
    def title(self, t, sub=None, size=32):
        self.text(0.6, 0.38, 12.1, 0.75, P(t, size=size, color=INK), anchor="middle")
        self.pagenum()

    def pagenum(self):
        self.text(12.35, 7.0, 0.5, 0.25, P(str(self.n), size=10, color=GRAY, align="right"))

    def cite(self, x, y, w, t, align="center", size=13):
        self.text(x, y, w, 0.3, P(t, size=size, color=GRAY, align=align))


# ======================================================================
# Reusable components in the lecture style. All take inches.
# ======================================================================
def overview_slide(deck, items, cur=None, fig=None, fig_cite=None, notes=None):
    """'Lecture Overview' agenda. cur=None -> plain agenda; cur=k -> divider with item k
    red+bold and the others grayed out. Optional figure on the right (e.g. the paper's key figure)."""
    s = deck.new(notes or ("Roadmap." if cur is None else f"Next section: {items[cur]}"))
    s.title("Lecture Overview")
    ps = []
    for k, t in enumerate(items):
        if cur is None:
            ps.append(P(t, size=24, bullet=True, after=20))
        elif k == cur:
            ps.append(P([R(t, b=True, color=RED)], size=24, bullet=True, after=20))
        else:
            ps.append(P(t, size=24, bullet=True, after=20, color="9A9A9A"))
    s.text(0.8, 1.6, 8.9 if fig else 11.9, 5.2, ps)
    if fig:
        s.pic(fig, 9.7, 1.25, 3.3, 5.35)
        if fig_cite:
            s.cite(9.4, 6.65, 3.6, fig_cite, size=12)
    return s

def title_slide(deck, kicker, title, byline, sub=None, notes=None):
    """Centered title slide: black kicker line, big red bold title, byline, gray sub-line."""
    s = deck.new(notes)
    s.text(1.2, 2.05, 10.9, 0.6, P(kicker, size=28, align="center"))
    s.text(1.2, 2.75, 10.9, 1.0, P([R(title, b=True, color=RED)], size=48, align="center"))
    s.text(1.6, 4.25, 10.1, 0.9, P(byline, size=18, align="center"))
    if sub:
        s.text(1.2, 5.35, 10.9, 0.4, P(sub, size=16, color=GRAY, align="center"))
    return s

Slide.stat = lambda s, x, y, w, number, label, sub=None, size=54, align="center": (
    s.text(x, y, w, size / 72 * 1.3, P([R(number, b=True, color=RED)], size=size, align=align)),
    s.text(x, y + size / 72 * 1.35, w, 0.45, P([R(label, b=True)], size=18, align=align)),
    sub and s.text(x, y + size / 72 * 1.35 + 0.5, w, 0.8, P(sub, size=15, color=GRAY, align=align)))
Slide.stat.__doc__ = "Big red number + bold label + optional gray sub-line."

def _card(s, x, y, w, h, heading, body, highlight=False, size=16):
    """Rounded light-gray card (red outline + pink tint when highlight). body: str or list of str (bulleted)."""
    s.rect(x, y, w, h, "FBF1F1" if highlight else LIGHT, RED if highlight else None, 1.5, rounded=True)
    s.text(x + 0.25, y + 0.2, w - 0.5, 0.5, P([R(heading, b=True, color=RED if highlight else INK)], size=19))
    if isinstance(body, str):
        s.text(x + 0.25, y + 0.8, w - 0.5, h - 1.0, P(body, size=size))
    else:
        s.text(x + 0.25, y + 0.8, w - 0.5, h - 1.0, [P(t, size=size, bullet=True, after=8) for t in body])
Slide.card = _card

def _steps(s, x, y, w, items, gap=0.74, size=19):
    """Numbered steps: red circles with white numbers, text beside. items may use md markup."""
    for k, t in enumerate(items):
        yy = y + k * gap
        s.oval(x, yy + 0.07, 0.42, 0.42, RED)
        s.text(x, yy + 0.07, 0.42, 0.42, P([R(str(k + 1), b=True, color="FFFFFF")], size=15, align="center"), anchor="middle")
        s.text(x + 0.65, yy, w - 0.65, 0.56, P(t, size=size), anchor="middle")
Slide.steps = _steps

def _mapping(s, x, y, rows, left_w=2.9, right_w=3.9, gap=0.8, size=18):
    """'the model -> LLM Core' rows: gray right-aligned left text, arrow, bold right text."""
    for k, (a, b) in enumerate(rows):
        yy = y + k * gap
        s.text(x, yy, left_w, 0.7, P(a, size=size, color=GRAY, align="right"), anchor="middle")
        s.text(x + left_w + 0.15, yy, 0.5, 0.7, P("→", size=size, color=GRAY, align="center"), anchor="middle")
        s.text(x + left_w + 0.8, yy, right_w, 0.7, P([R(b, b=True)], size=size), anchor="middle")
Slide.mapping = _mapping

def _formula(s, x, y, w, h, lines, size=28):
    """Light-gray rounded box with one or more centered math lines (math() mini-TeX)."""
    if isinstance(lines, str):
        lines = [lines]
    s.rect(x, y, w, h, LIGHT, rounded=True, ps=[P(math(l), size=size, after=4) for l in lines])
Slide.formula = _formula

def _timeline(s, x0, x1, y, events, highlight=()):
    """Horizontal timeline: dates above, dots on a line, bold names below. events: [(date, name)]."""
    s.line(x0, y, x1, y, MID, 1.5)
    n = len(events)
    step = (x1 - x0 - 2.4) / max(1, n - 1)  # inset so edge labels stay on-slide
    for k, (d, nm) in enumerate(events):
        cx = x0 + 1.2 + k * step
        s.text(cx - 1.0, y - 0.55, 2.0, 0.35, P(d, size=16, align="center"))
        s.oval(cx - 0.09, y - 0.09, 0.18, 0.18, RED if k in highlight else "9A9A9A")
        s.text(cx - 1.2, y + 0.25, 2.4, 0.4, P([R(nm, b=True)], size=18, align="center"))
Slide.timeline = _timeline

def _checklist(s, x, y, w, items, size=20):
    """Summary list: red check + bold key + ': ' + text. items: [(key, text)]."""
    s.text(x, y, w, len(items) * size / 72 * 1.2 + len(items) * 0.15 + 0.2,
           [P([R("✓  ", b=True, color=RED, font="Arial Unicode MS"), R(a, b=True), R(": " + b)], size=size, after=10)
            for a, b in items])
Slide.checklist = _checklist
