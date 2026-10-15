---
name: lecture-slides
description: Build PowerPoint (.pptx) decks in the user's preferred academic-lecture style (clean white slides, dark titles top-left, a single cardinal-red accent, red bullets, "Lecture Overview" dividers, real paper figures with citations, big red stat callouts), with a built-in layout preview so every slide is checked before delivery. Use this whenever the user asks for a PPT, slides, a deck, a presentation, 课件, 讲义, 幻灯片, 做个 PPT, a paper walkthrough / 论文精读 / paper-reading slides, lecture or teaching material, or says "用我喜欢的风格 / 老样子 / 之前那种风格" — even if they don't mention a style. Prefer it over generic slide design for any NEW deck; for editing an existing .pptx, use the pptx skill instead.
---

# Lecture Slides

The user likes the look of a university lecture deck (their reference was Stanford CS329Z
"Intro to Agentic Systems", lecture01.pdf): calm, text-light white slides where the
**content** carries the design, a single red accent for emphasis, and the original
figures from papers shown with proper citations. This skill reproduces that look and
bundles a small engine (`scripts/slidekit.py`) that writes the .pptx **and** a PNG preview
of every slide from the same code, so you can verify layout even when PowerPoint and
LibreOffice are unavailable.

A finished 29-slide example (Transformer paper walkthrough) is in
`references/example_transformer_build.py`. Skim it before writing a new deck; it shows
every component in real use.

## Style spec

Why these rules: the reference deck feels credible because it looks like a professor's
slides, not a marketing template. Decoration would undercut that; restraint and real
evidence (figures, tables, numbers) are the style.

- **Canvas** 16:9, 13.333 × 7.5 in, white background. Margins ≥ 0.5 in.
- **Titles** top-left (x 0.6, y 0.38), Arial 32 pt, near-black `1F1F1F`, regular weight.
  No underline, no bar, no accent stripe.
- **One accent color: cardinal red `8C1515`.** Use it for bullets, emphasized words,
  key numbers, the highlighted card. Everything else is black/gray (`5F6368` for secondary
  text, `9A9A9A` for de-emphasized items, `F3F3F3` for soft card fills).
- **Bullets** are red filled dots, 18–24 pt body text. Emphasize 1–3 words per bullet in
  red (`[[text]]`), not whole sentences.
- **Title slide**: centered; black kicker line (28 pt) → big red bold title (48 pt) →
  authors (18 pt) → gray sub-line. No logos, and don't copy a real institution's name,
  logo or course code; mimic the look, not the brand.
- **"Lecture Overview"** slide after the title listing sections with durations
  ("(10 mins)"), then the same slide repeated as a **section divider** before each major
  section, with the current item red and bold and the rest gray. Use 3–5 dividers; don't
  put one before every section of a short deck.
- **Figures from the source** (paper figures, tables) at a generous size, with a small
  gray citation under them: `(Figure 1, Vaswani et al., 2017)`. Crop figures without
  their captions; the citation replaces the caption.
- **Evidence over boxes**: stat callouts (54–60 pt red numbers + bold label + gray
  sub-line), formula boxes (light gray rounded rect, Times New Roman math), mapping rows
  ("the model → **LLM Core**"), numbered red-circle steps, small hand-built diagrams using
  the paper's own palette, native PowerPoint charts for anything numeric.
- **Summary** slide: red ✓ list (bold key + short phrase), optionally a timeline.
- **Page number** bottom-right, 10 pt gray, on every slide except the title.
- **Speaker notes** on every slide: 1–3 sentences on what to say.
- Vary layouts: figure left with text right, figure right, three cards, full-width table
  with criteria underneath, stats row. Don't repeat the same layout on consecutive slides.

## Workflow

### 0. Pin down the few things that change the deck
Ask only what you can't infer. Offer a recommended default for each:
- **Language**: the user chose all-English for the reference-style deck; Chinese with
  English terms is the other common choice.
- **Length**: ~8 (compact) / ~15 (one lecture) / ~25 (detailed). About 25 slides took 29
  once dividers were included; say so if you go over.
- **Source**: if it's about a paper, get the PDF. Downloading needs the user's OK: state
  the filename, source (e.g. arxiv.org) and size (`curl -sIL URL | grep -i content-length`)
  before you download.

### 1. Outline
Write the section list first (it becomes the overview slide), then one line per slide:
title + the single visual that carries it (figure, table, chart, diagram, stats).
Every content slide should have a visual element; a bare title plus bullets is a last resort.

### 2. Extract figures (paper decks)
```bash
S=~/.claude/skills/lecture-slides/scripts
uv run --with pymupdf python $S/pdf_figures.py scan paper.pdf          # images + caption positions
uv run --with pymupdf python $S/pdf_figures.py image paper.pdf 128 fig/fig1.png   # raster figure
uv run --with pymupdf python $S/pdf_figures.py blocks paper.pdf 8      # find a table's y-extent
uv run --with pymupdf python $S/pdf_figures.py clip paper.pdf 8 125 93 487 246 fig/table2.png
```
Raster figures (architecture diagrams) usually come out via `image` at native resolution.
Tables and plots are usually vector, so use `clip` at 300 dpi. Put the tiles in one
contact sheet (`contact_sheet.py`) and look at them before building, to catch crops that
cut into a heading or caption. You can also crop sub-parts of a figure with PIL (e.g. the
encoder half of an architecture figure) to zoom in on one component.

To study a new reference deck the user supplies: `pdf_figures.py thumbs deck.pdf thumbs/`
then contact-sheet a sample of pages.

### 3. Write `build.py` with slidekit
Work in the scratchpad (or the user's folder). Skeleton:

```python
import sys, os
sys.path.insert(0, os.path.expanduser("~/.claude/skills/lecture-slides/scripts"))
from slidekit import *

OUT, PREV = sys.argv[1], sys.argv[2]
D = Deck()
title_slide(D, "Attention Is All You Need (NeurIPS 2017)", "The Transformer, Explained",
            "Ashish Vaswani, Noam Shazeer, …", "A paper walkthrough · arXiv:1706.03762",
            notes="What this lecture covers.")
OV = ["Motivation (10 mins)", "Architecture (10 mins)", "Results (10 mins)"]
overview_slide(D, OV, fig="fig/fig1.png", fig_cite="(Figure 1, Vaswani et al., 2017)")

s = D.new("Speaker notes for this slide.")
s.title("Model Architecture")
s.pic("fig/fig1.png", 0.6, 1.2, 4.4, 5.55)                 # fits inside the box, keeps aspect
s.cite(0.6, 6.8, 4.4, "(Figure 1, Vaswani et al., 2017)", size=12)
s.mapping(5.2, 1.45, [("Left stack", "Encoder: N = 6 layers"), ("Right stack", "Decoder: N = 6 layers")])

overview_slide(D, OV, cur=1, fig="fig/fig1.png")          # section divider
...
D.save(OUT, PREV)
print(len(D.slides), "slides"); print("\n".join(D.warnings) or "no layout warnings")
```
Run it (uv caches the packages after the first run; the first install needs network, so
if pip is blocked by the sandbox, rerun that one command with the sandbox disabled):
```bash
uv run --with python-pptx --with pymupdf --with pillow --with numpy --with matplotlib \
  python build.py deck.pptx prev
```

### 4. Preview QA loop (don't skip this)
`build.py` prints layout warnings: text that overflows its box (measured with real font
metrics) and boxes near the slide edge. Fix all of them, then look at the slides:
```bash
uv run --with pillow python $S/contact_sheet.py prev/sheet --deck prev     # 6 slides per sheet
```
Read every sheet. Look for: labels overlapping shapes or other labels, text not centered
inside shapes, big empty regions (enlarge the figure or add a stat row), crowded slides
(split them), missing-glyph boxes (see Gotchas), wrong crops. Fix, rebuild, re-sheet only
the changed slides (`contact_sheet.py out.png prev/s03.png prev/s11.png …`). Usually 2 passes.

### 5. Validate and deliver
- If the pptx skill is installed, run its validator:
  `python <pptx-skill>/scripts/office/validate.py deck.pptx`
  (needs `defusedxml`; run through `uv run --with defusedxml --with lxml`).
- `uv run --with "markitdown[pptx]" markitdown deck.pptx | grep -c "Slide number"` to check the slide count.
- Copy the deck to where the user wants it and send it. Tell them the preview uses the same
  fonts but isn't PowerPoint itself, so they should open it once to confirm. Say which content
  isn't from the source (simulated charts, illustrative numbers).

## slidekit API (inches; colors are hex without `#`)

Text markup inside any string: `[[red]]`, `{{red bold}}`, `**bold**`, `__italic__`,
`$math$`. Math is mini-TeX: `x_{t}`, `QK^{T}`, `√d_{k}`; single letters italic, words
upright, Times New Roman.

| Call | What it does |
|---|---|
| `D = Deck()`, `s = D.new(notes)`, `D.save(pptx, prevdir)` | deck / slide / write pptx + `prevdir/sNN.png` |
| `s.title(text)` | slide title + page number |
| `s.text(x, y, w, h, P(...) or [P, …], anchor="top")` | text box; `P(text, size, color, align, bullet=True, level, after, b)` |
| `R(text, b, i, color, size, font, sup, sub)` / `math("…")` | explicit runs when markup isn't enough |
| `s.rect(x, y, w, h, fill, line, lw, rounded, ps=…, align="center")` | shape with optional centered text |
| `s.oval`, `s.line(x1, y1, x2, y2, color, lw, arrow, dash)` | dots, connectors, arrows |
| `s.pic(path, x, y, w, h, halign, valign)` | image fit into box; returns placed rect |
| `s.cite(x, y, w, text, size=12)` | gray centered citation line |
| `s.chart("col"/"line", x, y, w, h, cats, [(name, vals)], colors, title, xtitle, ytitle, numfmt, legend, xtick_every)` | native chart (+ matplotlib preview) |
| `title_slide(D, kicker, title, byline, sub)` | title slide |
| `overview_slide(D, items, cur=None, fig, fig_cite)` | agenda / section divider |
| `s.stat(x, y, w, "28.4", "BLEU EN→DE", "sub-line")` | big red number callout |
| `s.card(x, y, w, h, heading, body_str_or_list, highlight)` | light card; highlight = red outline |
| `s.steps(x, y, w, ["**MatMul**: …", …])` | numbered red-circle steps |
| `s.mapping(x, y, [(left, right), …])` | "left → **right**" rows |
| `s.formula(x, y, w, h, ["line 1", "line 2"], size)` | gray math box |
| `s.timeline(x0, x1, y, [(date, name)], highlight=(0,))` | dated dots on a line |
| `s.checklist(x, y, w, [(key, text)])` | summary ✓ list |

Constants: `RED INK GRAY LIGHT MID`. For diagrams about a paper, borrow the paper's own
palette (e.g. Transformer Figure 1: attention `FCE0B6`, FFN `C3E7F5`, Add&Norm `F2F5C4`,
embedding `FADADD`, linear `DADCF0`, softmax `CDE8D2`).

Layout grid that works: content area x 0.6–12.7, y 1.3–6.9. Three columns are
`x = 0.6 + k*4.15, w = 3.8`. Figure-left / text-right splits are about 4.4 in + 7.5 in.

## Gotchas (learned the hard way)

- **Missing glyphs in Arial**: `∝ □ ■ ✓` and Unicode superscripts like `ᵀ`. Write `~`
  instead of `∝`, describe legends in words, set `font="Arial Unicode MS"` on a ✓ run
  (`checklist` already does), and use `$QK^{T}$` rather than `QKᵀ`.
- **math() braces don't nest**: `10000^{2i/d}` works, `10000^{2i/d_{model}}` doesn't.
  Write it simpler and define the symbol in a gray note.
- The preview wraps at run boundaries (a red run followed by `,` can wrap before the comma).
  PowerPoint doesn't do this; rephrase only if it looks wrong in PowerPoint too.
- Keep boxes inside x 0.3–13.1 and y ≤ 7.35, or the edge warning fires.
- Label simulated or illustrative data on the slide itself ("Simulated with random Gaussian q, k").
- Quotes from a paper: keep them under 15 words, in quotation marks, with a citation.
- The first `uv run --with …` has to download packages. If it fails inside the sandbox,
  that's a network block, not a code bug.
