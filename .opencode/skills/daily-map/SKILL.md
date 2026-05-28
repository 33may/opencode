---
name: daily-map
description: Use when the user asks for a daily map, AI work map, summary of today's AI-agent work, what happened today, or to convert captured Claude/OpenCode sessions into a concise structured draft. Defaults to generating and saving a draft file without an iterative interview unless the user explicitly asks to review or shape it together.
---

# Daily AI Work Map

Create a concise structured map of the day's AI-agent work from captured Claude/OpenCode session markdown.

## Default behavior

When the user asks for a daily map or asks what happened today:

1. Run the bundled generator script.
2. Read the generated draft and the listed source sessions only as much as needed.
3. Improve the draft sections if the automatic extraction missed obvious decisions, shipped changes, or open threads.
4. Save the file with `status: draft` frontmatter.
5. Report the path and a short note about source count.

Do not start an interview by default. The user's preference is: if they did not initiate a manual iterative process, generate and save the draft so they can review later.

## Commands

Default for today:

```bash
python3 .opencode/skills/daily-map/scripts/generate_daily_map.py
```

Specific date:

```bash
python3 .opencode/skills/daily-map/scripts/generate_daily_map.py --date YYYY-MM-DD
```

The script prints the generated file path.

## Sources and output

- Source captures: `/home/may33/Documents/vbti/vbti/sessions/claude/rendered`
- Draft maps: `/home/may33/Documents/vbti/vbti/sessions/daily-maps`
- Output filename: `YYYY-MM-DD_ai-work-map.md`

## Map shape

Keep the map short:

```markdown
---
type: ai-work-map
status: draft
date: YYYY-MM-DD
source: session-capture
generated_at: ISO_TIMESTAMP
---

# AI Work Map — YYYY-MM-DD

## What happened
- ...

## Decisions
- ...

## Changes shipped
- ...

## Open threads
- ...

## Source sessions
- [[../claude/rendered/<file>|<title>]]
```

## Manual mode

Only switch to an iterative walkthrough if the user explicitly asks for it with phrases like:

- "let's do this together"
- "ask me questions"
- "review it with me"
- "manual mode"

In manual mode, ask one question at a time and shape the map with the user before saving.

## Boundaries

- This is not permanent memory promotion. The file remains `status: draft`.
- This is not the future planner service. Planner notifications, reminders, tasks, and timelines are a separate future August feature.
- Do not invent details that are not in the captured sessions or the current conversation.

## After installation

Because this is an OpenCode skill, remind the user to quit and restart OpenCode after the skill is added or changed.
