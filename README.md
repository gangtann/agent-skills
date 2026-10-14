# agent-skills

Personal [Agent Skills](https://agentskills.io) (SKILL.md format). Works with Claude Code and other agents that load skills.

| Skill | What it does |
|---|---|
| [gdoc-explainer](gdoc-explainer/) | Write explainer / study-note Google Docs (one topic per tab) with a consistent designed layout via the Docs API: restricted markdown → batchUpdate requests, then font tally + PDF render to verify. |
| [douyin-doc-video](douyin-doc-video/) | Make documentary-grade vertical knowledge videos for Douyin: sourced research notes → 3000–5000 字 article → shot-by-shot storyboard → frame-by-frame render (canvas + three.js in headless Chrome) with 云希 narration, synthesized score/SFX, safe-area QA, a 3:4 cover, and publishing through the Douyin desktop client. |

## Install

Copy a skill folder into your agent's skills directory, e.g. for Claude Code:

```bash
git clone https://github.com/gangtann/agent-skills.git
cp -R agent-skills/gdoc-explainer ~/.claude/skills/
cp -R agent-skills/douyin-doc-video ~/.claude/skills/
```

## Requirements (gdoc-explainer)

- Python 3.10+ (scripts use only the standard library, except `render_pdf.py` which needs `pymupdf`)
- Agent access to the Google Docs API (for reading / batchUpdate) and Google Drive (create file, PDF export), e.g. via a connector or MCP server

## Requirements (douyin-doc-video)

- macOS with Google Chrome (rendering uses headless Chrome with Metal GPU; set `CHROME=` for another path), Node.js, Python 3.10+
- `scripts/new_project.sh` installs the rest per project: `puppeteer-core` + `ffmpeg-static` (npm) and `numpy scipy pillow edge-tts` (venv)
- Network access for narration (`edge-tts`, Microsoft's 云希 voice). For monetized accounts, switch to the official Azure Speech service with the same voice.
