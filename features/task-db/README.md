# AugustTask

Status: August-native Linear replacement for agent task tracking.

AugustTask stores projects and issues in the local OpenCode SQLite database. It is designed for agents that need durable, project-scoped work tracking without Linear.

The preferred CLI is `augusttask`:

```bash
./scripts/august augusttask project create VOICE "Voice Companion" --format json
./scripts/august augusttask issue create VOICE "Ship voice companion" --label voice --format json
./scripts/august augusttask issue list --project VOICE --format json
./scripts/august augusttask issue status VOICE-1 in_progress --format json
./scripts/august augusttask issue comment VOICE-1 "Validation passed" --author august
./scripts/august augusttask issue relate VOICE-1 AUG-1 --type blocks
./scripts/august augusttask issue show VOICE-1 --format json
```

The legacy `task` CLI and `taskdb` tool are compatibility adapters over `AugustTask.Service`.

OpenCode loads the local `augusttask` MCP server from `.opencode/opencode.jsonc`. After restarting `aug`, agents get semantic MCP tools such as:

- `augusttask_create_project`
- `augusttask_list_projects`
- `augusttask_create_issue`
- `augusttask_list_issues`
- `augusttask_set_issue_status`
- `augusttask_add_issue_comment`

These are typed project/issue tools, not SQL or generic database query tools.

Manual MCP server smoke test:

```bash
./scripts/augusttask-mcp
```
