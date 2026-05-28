import tempfile
import unittest
from pathlib import Path

import generate_daily_map


class DailyMapGeneratorTests(unittest.TestCase):
    def test_generates_draft_map_with_source_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "rendered"
            output = root / "daily-maps"
            source.mkdir()
            (source / "2026-05-28_opencode_ses_abc.md").write_text(
                "# OpenCode Session ses_abc\n\n**Title:** Build capture\n\n---\n\n**User**\n\nmake it work\n\n---\n\n**OpenCode**\n\nImplemented capture."
            )
            (source / "2026-05-27_opencode_ses_old.md").write_text("# old")

            path = generate_daily_map.generate("2026-05-28", source, output)

            text = path.read_text()
            self.assertEqual(path, output / "2026-05-28_ai-work-map.md")
            self.assertIn("type: ai-work-map", text)
            self.assertIn("status: draft", text)
            self.assertIn("date: 2026-05-28", text)
            self.assertIn("# AI Work Map — 2026-05-28", text)
            self.assertIn("## What happened", text)
            self.assertIn("Build capture", text)
            self.assertIn("[[../claude/rendered/2026-05-28_opencode_ses_abc.md|Build capture]]", text)
            self.assertNotIn("ses_old", text)

    def test_generates_no_session_draft(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "rendered"
            output = root / "daily-maps"
            source.mkdir()

            path = generate_daily_map.generate("2026-05-28", source, output)

            text = path.read_text()
            self.assertIn("No captured AI-agent sessions found for this date.", text)
            self.assertIn("## Source sessions\n- None found.", text)


if __name__ == "__main__":
    unittest.main()
