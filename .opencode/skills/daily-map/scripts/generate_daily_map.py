#!/usr/bin/env python3
"""Generate a concise draft AI work map from captured session markdown."""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime, timezone
from pathlib import Path


DEFAULT_SOURCE = Path("/home/may33/Documents/vbti/vbti/sessions/claude/rendered")
DEFAULT_OUTPUT = Path("/home/may33/Documents/vbti/vbti/sessions/daily-maps")


def generate(day: str, source_dir: Path = DEFAULT_SOURCE, output_dir: Path = DEFAULT_OUTPUT) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    sessions = _sessions_for(day, source_dir)
    target = output_dir / f"{day}_ai-work-map.md"
    target.write_text(_render(day, sessions))
    return target


def _sessions_for(day: str, source_dir: Path) -> list[dict[str, str]]:
    if not source_dir.exists():
        raise FileNotFoundError(f"Session capture directory not found: {source_dir}")
    return [_session_summary(path) for path in sorted(source_dir.glob(f"{day}_*.md"))]


def _session_summary(path: Path) -> dict[str, str]:
    text = path.read_text(errors="replace")
    return {
        "path": str(path),
        "file": path.name,
        "title": _first_match(text, r"\*\*Title:\*\*\s*(.+)") or _first_heading(text) or path.stem,
        "prompt": _first_user_prompt(text),
        "actions": _action_lines(text),
    }


def _render(day: str, sessions: list[dict[str, str]]) -> str:
    lines = [
        "---",
        "type: ai-work-map",
        "status: draft",
        f"date: {day}",
        "source: session-capture",
        f"generated_at: {datetime.now(timezone.utc).isoformat()}",
        "---",
        "",
        f"# AI Work Map — {day}",
        "",
    ]
    if not sessions:
        return "\n".join(lines + [
            "## What happened",
            "- No captured AI-agent sessions found for this date.",
            "",
            "## Decisions",
            "- None captured.",
            "",
            "## Changes shipped",
            "- None captured.",
            "",
            "## Open threads",
            "- None captured.",
            "",
            "## Source sessions",
            "- None found.",
            "",
        ])
    return "\n".join(lines + [
        "## What happened",
        *[f"- {session['title']}: {session['prompt'] or 'captured AI-agent work.'}" for session in sessions],
        "",
        "## Decisions",
        "- Draft: review source sessions for explicit decisions before promoting.",
        "",
        "## Changes shipped",
        *(_change_lines(sessions) or ["- Draft: no shipped changes detected automatically."]),
        "",
        "## Open threads",
        "- Draft: review unresolved asks, failed commands, and follow-up notes in source sessions.",
        "",
        "## Source sessions",
        *[f"- [[../claude/rendered/{session['file']}|{session['title']}]]" for session in sessions],
        "",
    ])


def _first_match(text: str, pattern: str) -> str:
    match = re.search(pattern, text)
    return match.group(1).strip() if match else ""


def _first_heading(text: str) -> str:
    return _first_match(text, r"^#\s+(.+)$")


def _first_user_prompt(text: str) -> str:
    match = re.search(r"\*\*User\*\*\s+(.+?)(?:\n---\n|\Z)", text, re.DOTALL)
    if not match:
        return ""
    return _one_line(match.group(1))


def _action_lines(text: str) -> str:
    items = re.findall(r"\b(?:Implemented|Added|Created|Updated|Fixed|Built|Wrote)\b[^.\n]*(?:\.|$)", text)
    return "\n".join(f"- {_one_line(item)}" for item in items[:3])


def _change_lines(sessions: list[dict[str, str]]) -> list[str]:
    return [line for session in sessions for line in session["actions"].splitlines() if line]


def _one_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()[:220]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an August AI work map draft.")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(generate(args.date, args.source_dir, args.output_dir))


if __name__ == "__main__":
    main()
