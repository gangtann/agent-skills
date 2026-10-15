# agent-skills

Personal [Agent Skills](https://agentskills.io) (SKILL.md format). Works with Claude Code and other agents that load skills.

| Skill | What it does |
|---|---|
| [gdoc-explainer](gdoc-explainer/) | Write explainer / study-note Google Docs (one topic per tab) with a consistent designed layout via the Docs API: restricted markdown → batchUpdate requests, then font tally + PDF render to verify. |
| [douyin-doc-video](douyin-doc-video/) | Make documentary-grade landscape (16:9, 1920×1080) knowledge videos for Douyin: sourced research notes → 3000–5000 字 article → primary-source fact-check of every number and quote → shot-by-shot storyboard → frame-by-frame render (canvas + three.js in headless Chrome) over graded free-to-use stock footage (Pexels, Pixabay, Coverr, Mixkit Free, Freesound CC0, with a licence ledger) with 云希 narration, synthesized score/SFX, safe-area and empty-frame QA, 4:3 and 3:4 covers (portrait 9:16 video still available via `format.json`), and uploading through the Douyin desktop client as a draft or a published post. |
| [lecture-slides](lecture-slides/) | Build academic-lecture-style PowerPoint decks (white slides, one cardinal-red accent, "Lecture Overview" section dividers, original paper figures/tables with citations, big stat callouts, native charts) with python-pptx. A small layout engine writes the .pptx and a PNG preview of every slide from the same code, flags text overflow with real font metrics, so decks can be checked without PowerPoint or LibreOffice. Includes PDF figure/table extraction and a 29-slide *Attention Is All You Need* walkthrough as a worked example. |

## Install

Copy a skill folder into your agent's skills directory, e.g. for Claude Code:

```bash
git clone https://github.com/gangtann/agent-skills.git
cp -R agent-skills/gdoc-explainer ~/.claude/skills/
cp -R agent-skills/douyin-doc-video ~/.claude/skills/
cp -R agent-skills/lecture-slides ~/.claude/skills/
```

## Requirements (gdoc-explainer)

- Python 3.10+ (scripts use only the standard library, except `render_pdf.py` which needs `pymupdf`)
- Agent access to the Google Docs API (for reading / batchUpdate) and Google Drive (create file, PDF export), e.g. via a connector or MCP server

## Requirements (douyin-doc-video)

- macOS with Google Chrome (rendering uses headless Chrome with Metal GPU; set `CHROME=` for another path), Node.js, Python 3.10+
- `scripts/new_project.sh` installs the rest per project: `puppeteer-core` + `ffmpeg-static` (npm) and `numpy scipy pillow edge-tts` (venv)
- Network access for narration (`edge-tts`, Microsoft's 云希 voice). For monetized accounts, switch to the official Azure Speech service with the same voice.

## Requirements (lecture-slides)

- Python 3.10+ and [`uv`](https://docs.astral.sh/uv/); build scripts run as `uv run --with python-pptx --with pymupdf --with pillow --with numpy --with matplotlib python build.py deck.pptx prev`
- Previews use the macOS Supplemental fonts (Arial, Times New Roman, Courier New) for metric-accurate overflow checks; on other systems they fall back to DejaVu Sans and widths are approximate
- Optional: the `pptx` skill's `validate.py` for a final OOXML check
