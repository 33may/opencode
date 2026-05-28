# Daily AI Work Map Skill Design

## Purpose

August needs a lightweight way to turn the day's AI-agent work into a small, concise, structured map. The map should answer: what happened today, which projects/sessions mattered, what changed, what decisions were made, what is still open, and where to look next.

This complements session capture. Session capture preserves detailed transcripts; the daily map creates a reviewable index over those transcripts.

## User-facing behavior

- A new August skill, tentatively `daily-map`, lives under `.opencode/skills/daily-map/`.
- Trigger phrases include: `daily map`, `map today's work`, `summarize AI agent work`, `what happened today`, and `make a work map`.
- Default mode is non-interactive: generate the map, save it as a draft file, and report the path.
- Manual/iterative mode only happens when the user explicitly asks to review or shape it together.
- Every generated file uses frontmatter with `status: draft` so the user can review later before treating it as durable memory.

## Output format

The generated map is concise markdown:

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
- [[session-file|title or session id]]
```

The map should stay short. It is not a transcript, journal entry, or verbose report.

## Architecture

Use a skill plus bundled Python script:

- `.opencode/skills/daily-map/SKILL.md` describes when to use the skill and the exact workflow.
- `.opencode/skills/daily-map/scripts/generate_daily_map.py` finds captured session markdown for a date, extracts compact signals, and writes a draft map.
- The script reads from the existing session-capture output directory: `/home/may33/Documents/vbti/vbti/sessions/claude/rendered`.
- Draft maps are written under `/home/may33/Documents/vbti/vbti/sessions/daily-maps/`.

The first implementation can use deterministic extraction plus an agent-written synthesis: the script gathers source files and builds a scaffold; the skill instructs the agent to fill the concise sections from those sources and save the draft. This avoids adding model calls inside the script.

## Data flow

1. User invokes the skill.
2. Agent runs the bundled script with the requested date, defaulting to today.
3. Script locates `YYYY-MM-DD_*.md` and `YYYY-MM-DD_opencode_*.md` files in the rendered capture folder.
4. Script writes a draft map scaffold with source-session links and extracted headings/titles.
5. Agent reads the scaffold plus the most relevant source snippets, fills concise sections, and saves the final draft.
6. Agent reports only the output path and any skipped/ambiguous sources.

## Error handling

- If no session captures exist for the date, create a draft with `## What happened` saying no captured sessions were found, and report the path.
- If the capture directory is missing, stop and explain that session capture needs to run first.
- If a session file is too large, use title, first user prompt, explicit final summaries, and tool-command headings rather than loading the whole file.
- Never promote a generated map to permanent memory automatically.

## Upstream compatibility

This is an August project skill and bundled script. It does not modify OpenCode core, storage, APIs, or upstream behavior. It relies on the existing session-capture output format rather than OpenCode internals.

## Extension-point preference

The feature uses the OpenCode/August skill extension point. Core edits are not needed. A future `august daily-map` command or planner service can wrap the same script if the workflow proves useful.

## Validation strategy

- Unit-test the script with temporary fake captured sessions.
- Run the script against today's real captured sessions and verify it creates a draft file with frontmatter and source links.
- Run `./scripts/doctor.sh` from August to ensure the harness still validates.
- Restart OpenCode after adding the skill so the new skill is loaded.

## Future planner service note

The future planner service should manage notifications, reminders, plans, tasks, and timelines. That is explicitly out of scope for this feature. The daily map may later feed planner context, but it should not implement planner behavior now.
