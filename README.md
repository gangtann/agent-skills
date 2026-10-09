# agent-skills

Personal [Agent Skills](https://agentskills.io) (SKILL.md format). Works with Claude Code and other agents that load skills.

| Skill | What it does |
|---|---|
| [gdoc-explainer](gdoc-explainer/) | Write explainer / study-note Google Docs (one topic per tab) with a consistent designed layout via the Docs API: restricted markdown → batchUpdate requests, then font tally + PDF render to verify. |

## Install

Copy a skill folder into your agent's skills directory, e.g. for Claude Code:

```bash
git clone https://github.com/gangtann/agent-skills.git
cp -R agent-skills/gdoc-explainer ~/.claude/skills/
```

## Requirements (gdoc-explainer)

- Python 3.10+ (scripts use only the standard library, except `render_pdf.py` which needs `pymupdf`)
- Agent access to the Google Docs API (for reading / batchUpdate) and Google Drive (create file, PDF export), e.g. via a connector or MCP server
