---
name: august-bootstrap
description: Use when setting up, syncing, validating, or evolving the August downstream OpenCode harness.
---

# August Bootstrap

Use this skill for August harness maintenance.

Checklist:
1. Check repo status in root and `opencode-fork/`.
2. Fetch `upstream/main` in `opencode-fork/`.
3. Integrate into `next`.
4. Resolve conflicts by preferring upstream behavior except documented August feature contracts.
5. Run `./scripts/doctor.sh`.
6. Update feature docs if merge strategy or affected files changed.
