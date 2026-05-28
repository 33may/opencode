# Daily AI Work Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an August `daily-map` skill that creates concise draft maps from captured AI-agent session markdown.

**Architecture:** Implement a project skill under `.opencode/skills/daily-map/` with a bundled Python generator. The generator handles deterministic file discovery, draft frontmatter, source links, and scaffold extraction; the skill tells the agent how to fill or regenerate concise sections.

**Tech Stack:** OpenCode/August skill files, Python standard library, unittest, Obsidian markdown.

---

### Task 1: Generator tests

**Files:**
- Create: `.opencode/skills/daily-map/scripts/test_generate_daily_map.py`

- [ ] Write failing unittest coverage for: date-based capture discovery, draft frontmatter, source-session links, and no-session draft behavior.
- [ ] Run `python3 .opencode/skills/daily-map/scripts/test_generate_daily_map.py` and confirm it fails because the generator does not exist.

### Task 2: Generator implementation

**Files:**
- Create: `.opencode/skills/daily-map/scripts/generate_daily_map.py`

- [ ] Implement a Python standard-library CLI with arguments `--date`, `--source-dir`, and `--output-dir`.
- [ ] Default date to today, source dir to `/home/may33/Documents/vbti/vbti/sessions/claude/rendered`, and output dir to `/home/may33/Documents/vbti/vbti/sessions/daily-maps`.
- [ ] Write `YYYY-MM-DD_ai-work-map.md` with `status: draft` frontmatter.
- [ ] Include concise sections: `What happened`, `Decisions`, `Changes shipped`, `Open threads`, `Source sessions`.
- [ ] Run the unittest file and confirm it passes.

### Task 3: Skill definition

**Files:**
- Create: `.opencode/skills/daily-map/SKILL.md`

- [ ] Add required frontmatter with `name: daily-map` and trigger-rich description.
- [ ] Document default non-interactive mode: run script, inspect scaffold/sources, fill concise draft, save, report path.
- [ ] Document iterative mode only when user explicitly asks.
- [ ] Remind user to restart OpenCode after adding the skill.

### Task 4: Validation and commit

**Files:**
- Existing: docs/spec and plan files
- New: skill and generator files

- [ ] Run generator tests.
- [ ] Run the generator against today's real captures.
- [ ] Run `./scripts/doctor.sh` from August root.
- [ ] Inspect git status/diff/log.
- [ ] Stage only intended files and commit with `feat(august): add daily work map skill`.
- [ ] Push to the configured August remote branch.

## Self-review

- Spec coverage: skill, generator, draft frontmatter, same capture source, validation, and future planner out-of-scope are covered.
- Placeholder scan: no placeholders or deferred implementation steps.
- Type consistency: paths, script names, and output names match across tasks.
