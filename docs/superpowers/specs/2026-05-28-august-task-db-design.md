# August Task DB Design

## Intent

Replace Linear for August-owned AI task tracking with a local, deterministic SQLite system. The system is built for AI agents first: scriptable CLI, model-callable tool, durable audit trail, and no dependency on Linear or the Linear MCP.

## User-facing behavior

- `august task create "title"` creates an `AUG-N` task in the local OpenCode SQLite database.
- `august task list`, `show`, `update`, `comment`, and `relate` cover the core Linear replacement workflow.
- `--format json` is stable for agents; table/text output is for human debugging only.
- The model-callable `taskdb` tool exposes the same workflow without shelling out.

## Scope

The first version replaces the parts of Linear currently needed by autonomous August agents:

- issues/tasks with title, description, status, priority, project, labels, branch, delegate, assignee, due date, and parent task
- comments
- relations: related, blocks, duplicate
- task events for audit/debugging
- JSON import/export-friendly output via CLI and tool

Out of scope for the first ship: hosted UI, remote sync, notifications, Linear import, and multi-user permissions.

## Architecture

- SQLite remains the source of truth, using the existing OpenCode database and migration flow.
- `src/task/task.ts` owns task semantics and database access.
- `src/task/task.sql.ts` owns Drizzle table definitions.
- `src/cli/cmd/task.ts` exposes the agent-friendly CLI.
- `src/tool/taskdb.ts` exposes the same functionality as an LLM tool.
- `features/task-db/README.md` documents operational usage.

## Data model

- `task_counter`: durable `AUG-N` sequence allocation.
- `task_issue`: task fields and lifecycle timestamps.
- `task_comment`: append-only comments.
- `task_relation`: directed relations between tasks.
- `task_event`: append-only audit events for agent debugging.

## Upstream compatibility

This is an August feature and intentionally adds a downstream command/tool. It avoids changing upstream session semantics. Core edits are limited to registering the command and built-in tool.

## Extension-point preference

CLI and tool registration are existing OpenCode extension points. SQLite schema/migration is necessary because the task tracker must be durable and local.

## Validation strategy

- Service tests cover create/list/update/comment/relation/audit behavior against real SQLite.
- CLI tests spawn the real CLI with isolated home/database and assert JSON behavior.
- Tool registry/tool tests ensure agents can call `taskdb` directly.
- Package validation: targeted tests, `bun typecheck`, and `./scripts/doctor.sh`.
