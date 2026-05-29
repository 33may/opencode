# August task DB

Status: initial local Linear replacement.

August tasks are stored in the local OpenCode SQLite database and are designed for AI agents, not manual Linear grooming.

```bash
./scripts/august task create "Ship voice companion" --project august-talk --label voice --format json
./scripts/august task list --project august-talk --format json
./scripts/august task update AUG-1 --status in_progress --branch feat/august-talk
./scripts/august task comment AUG-1 "Validation passed" --author august
./scripts/august task relate AUG-1 AUG-2 --type blocks
./scripts/august task show AUG-1 --format json
```

Agents can call the `taskdb` tool directly with actions: `create`, `list`, `show`, `update`, `comment`, `relate`, and `events`.

OpenCode also loads the local `august-taskdb` MCP server from `.opencode/opencode.jsonc`. After restarting `aug`, the same tool is available through MCP as `august_taskdb_taskdb`.

Manual MCP server smoke test:

```bash
./scripts/august-taskdb-mcp
```
