# AugustTask SOLID Refactor Design

## Goal

Refactor the shipped local task tracker into a first-class August feature named `augusttask`. Keep the existing SQLite database work, but wrap it in clear domain, repository, service, and frontend boundaries so agents use semantic project/issue tools instead of a generic database action.

## User-facing behavior

- August/OpenCode exposes an MCP server named `augusttask`.
- MCP tools are explicit and typed:
  - `create_project`
  - `list_projects`
  - `get_project`
  - `edit_project`
  - `create_issue`
  - `list_issues`
  - `get_issue`
  - `edit_issue`
  - `set_issue_status`
  - `add_issue_comment`
  - `relate_issues`
  - `list_issue_events`
- Issues belong to projects. Agents pass `project_key` when creating or listing issues.
- Human-readable issue IDs are project-scoped, for example `AUG-1`, `VOICE-3`, or `TASK-12`.
- The existing `task` CLI and `taskdb` tool should remain as compatibility adapters during the refactor unless explicitly removed later.

## Domain model

### Project

`Project` is a first-class entity, not a loose string on an issue.

Fields:
- `key`: uppercase short identifier used in issue IDs, e.g. `AUG`, `VOICE`.
- `name`: display name.
- `description`: optional context for agents.
- `status`: `active`, `paused`, or `archived`.
- `default_assignee`: optional.
- `labels`: default labels available to the project.
- timestamps.

### Issue

`Issue` keeps the existing task concepts but belongs to exactly one project.

Fields:
- `id`: readable project-scoped ID, e.g. `AUG-1`.
- `project_key`: required.
- `sequence`: numeric issue sequence within that project.
- title, description, status, priority, labels, assignee, delegate, parent, due date, branch, source, timestamps.

### Comments, relations, events

The existing comments, relations, and events stay conceptually the same. They reference issue IDs and are surfaced through service methods.

## Architecture

```txt
packages/opencode/src/augusttask/
  domain/
    project.ts
    issue.ts
    comment.ts
    relation.ts
    event.ts
  repository/
    augusttask-repository.ts
    sqlite-augusttask-repository.ts
  service/
    augusttask-service.ts
  frontend/
    cli.ts
    mcp.ts
  augusttask.sql.ts
  schema.ts
```

### Domain layer

The domain layer owns types, branded IDs, allowed statuses/priorities, and small pure validation helpers. It does not import SQLite, MCP, CLI, or Effect runtime wiring.

### Repository layer

The repository layer owns persistence. It exposes an interface such as:

```ts
createProject(input)
listProjects(filter)
getProject(key)
updateProject(input)
nextIssueSequence(projectKey)
createIssue(input)
listIssues(filter)
getIssue(id)
updateIssue(input)
addComment(input)
relateIssues(input)
listEvents(issueID)
```

`sqlite-augusttask-repository.ts` implements that interface using the current SQLite/Drizzle tables plus a project table and per-project counters.

### Service layer

The service layer owns use-cases and business rules:
- create default project when needed only if explicitly allowed by the caller;
- require project existence before issue creation;
- generate project-scoped issue IDs;
- validate parent issue existence;
- update started/completed timestamps on status changes;
- append audit events for every mutation;
- return structured errors like `ProjectNotFound`, `IssueNotFound`, and `InvalidStatusTransition`.

### Frontend adapters

CLI and MCP are thin adapters over the service. They do not touch SQLite tables directly and do not duplicate business rules.

MCP should register separate semantic tools instead of one mega-action tool. Each tool has its own schema, description, and result shape.

## Database strategy

Keep the existing task DB tables where possible, but migrate naming and structure toward `augusttask`:

- add `augusttask_project` table;
- add project-scoped counters, either by extending the existing counter table or adding `augusttask_counter` keyed by project;
- migrate existing `task_issue.project` values into project rows;
- backfill missing project keys to `AUG`;
- keep old issue IDs valid;
- avoid destructive table rewrites unless required by Drizzle/SQLite constraints.

The DB layer is good enough to preserve; the refactor should focus on clean software boundaries and project support.

## Upstream compatibility

This is August-owned code. Keep upstream OpenCode behavior unchanged by isolating the feature under `src/augusttask/` and by registering MCP/CLI entry points through existing extension points.

Old `src/task/*` files may become compatibility wrappers during migration. Avoid touching unrelated upstream task/subagent code.

## Extension-point preference

Prefer:
- new August-owned module under `src/augusttask/`;
- MCP server registration through `.opencode/opencode.jsonc`;
- CLI command registration through existing CLI command structure.

Avoid invasive core edits except for command/tool registration and imports required to expose the feature.

## Validation strategy

- Unit tests for domain validation.
- Repository/service integration tests using the real SQLite test database.
- CLI tests for project + issue flows.
- MCP integration test that starts the local MCP server and calls semantic tools.
- Migration/backfill test for existing task DB rows.
- `bun typecheck` from `packages/opencode`.
- `./scripts/doctor.sh` from repo root.
- Update or add an API-first validation scenario for agent-visible AugustTask tools.

## Migration and compatibility

- Keep `./scripts/august task ...` working as an alias initially.
- Add `./scripts/august augusttask ...` as the preferred command.
- Keep the old `taskdb` model tool as a compatibility adapter that calls the new service, or deprecate it only after MCP semantic tools are validated.
- Remove Linear MCP from config only after `augusttask` MCP is registered and working.

## Self-review

- No placeholders remain.
- Scope is focused on wrapping the existing DB with SOLID boundaries, project support, and semantic MCP tools.
- The design preserves existing data and avoids a destructive rewrite.
- The word `task` remains only for compatibility; the feature namespace is `augusttask`.
