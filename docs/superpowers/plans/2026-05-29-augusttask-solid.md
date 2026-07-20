# AugustTask SOLID Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the local task tracker into a scalable `augusttask` feature with projects, issues-under-projects, clean service/repository/domain boundaries, and semantic MCP tools.

**Architecture:** Keep the existing SQLite tables and migrations as the persistence foundation, but move feature code under `packages/opencode/src/augusttask/`. Add a project table and project-scoped issue numbering. Expose CLI, legacy tool, and MCP as thin frontends over one service.

**Tech Stack:** TypeScript, Effect services/layers, Drizzle SQLite, Bun test runner, MCP TypeScript SDK, OpenCode CLI command framework.

---

## File Map

Create:
- `packages/opencode/src/augusttask/domain/project.ts` — project model, status values, key normalization.
- `packages/opencode/src/augusttask/domain/issue.ts` — issue model, status/priority/relation values, ID helpers.
- `packages/opencode/src/augusttask/domain/comment.ts` — comment model.
- `packages/opencode/src/augusttask/domain/event.ts` — event model.
- `packages/opencode/src/augusttask/repository/augusttask-repository.ts` — repository interface and errors.
- `packages/opencode/src/augusttask/repository/sqlite-augusttask-repository.ts` — Drizzle implementation.
- `packages/opencode/src/augusttask/service/augusttask-service.ts` — business use-cases.
- `packages/opencode/src/augusttask/frontend/cli.ts` — preferred `augusttask` CLI command implementation.
- `packages/opencode/src/augusttask/frontend/mcp.ts` — semantic MCP server/tools.
- `packages/opencode/src/augusttask/augusttask.sql.ts` — project table and re-exported/renamed task tables if needed.
- `packages/opencode/src/mcp-server/augusttask.ts` — executable stdio MCP entrypoint.
- `packages/opencode/test/augusttask/service.test.ts` — service/project issue tests.
- `packages/opencode/test/augusttask/cli.test.ts` — CLI tests.
- `packages/opencode/test/mcp-server/augusttask.test.ts` — semantic MCP tests.

Modify:
- `packages/opencode/src/task/task.ts` — turn into compatibility wrapper or delete internal logic after adapters compile.
- `packages/opencode/src/task/task.sql.ts` — keep existing table definitions until migration proves safe; import from `augusttask` only if low-risk.
- `packages/opencode/src/tool/taskdb.ts` — compatibility adapter over `AugustTask.Service`.
- `packages/opencode/src/cli/cmd/task.ts` — compatibility CLI alias over `augusttask/frontend/cli`.
- `packages/opencode/src/index.ts` — register `AugustTaskCommand` beside legacy `TaskCommand`.
- `packages/opencode/src/tool/registry.ts` — provide `AugustTask.defaultLayer` and keep legacy `taskdb` tool working.
- `packages/opencode/src/effect/app-runtime.ts` — use `AugustTask.defaultLayer`.
- `.opencode/opencode.jsonc` — replace `august-taskdb` MCP entry with `augusttask` entry.
- `features/task-db/README.md` — rename/update docs for AugustTask and project support.

## Task 1: Add domain models and project table

**Files:**
- Create: `packages/opencode/src/augusttask/domain/project.ts`
- Create: `packages/opencode/src/augusttask/domain/issue.ts`
- Create: `packages/opencode/src/augusttask/domain/comment.ts`
- Create: `packages/opencode/src/augusttask/domain/event.ts`
- Create: `packages/opencode/src/augusttask/augusttask.sql.ts`
- Test: `packages/opencode/test/augusttask/service.test.ts`

- [ ] Write a failing test asserting that creating project `VOICE` and issue `VOICE-1` works through the future service API.

```ts
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { testEffect } from "../lib/effect"
import { AugustTask } from "@/augusttask/service/augusttask-service"

const it = testEffect(AugustTask.defaultLayer)

describe("AugustTask service", () => {
  it.instance("creates project-scoped issues", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      yield* augusttask.createProject({ key: "voice", name: "Voice Companion" })
      const issue = yield* augusttask.createIssue({ projectKey: "voice", title: "Build talker" })
      expect(issue).toMatchObject({ id: "VOICE-1", projectKey: "VOICE", sequence: 1, title: "Build talker" })
    }),
  )
})
```

- [ ] Run: `bun test test/augusttask/service.test.ts --timeout 60000` from `packages/opencode`.
  Expected: fail because `@/augusttask/service/augusttask-service` does not exist.

- [ ] Implement domain files with branded schemas and values copied from the existing `src/task/schema.ts` naming, but exported under AugustTask names.

```ts
// packages/opencode/src/augusttask/domain/project.ts
import { Schema } from "effect"

export const ProjectKey = Schema.String.pipe(Schema.pattern(/^[A-Z][A-Z0-9_]{1,15}$/), Schema.brand("AugustTaskProjectKey"))
export type ProjectKey = Schema.Schema.Type<typeof ProjectKey>
export const ProjectStatusValues = ["active", "paused", "archived"] as const
export type ProjectStatus = (typeof ProjectStatusValues)[number]

export function normalizeProjectKey(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") as ProjectKey
}
```

- [ ] Implement `augusttask.sql.ts` with `AugustTaskProjectTable` and reuse/import existing task tables for this task to avoid destructive renames.

```ts
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"
import { TaskCommentTable, TaskCounterTable, TaskEventTable, TaskIssueTable, TaskRelationTable } from "../task/task.sql"
import type { ProjectKey, ProjectStatus } from "./domain/project"

export const AugustTaskProjectTable = sqliteTable(
  "augusttask_project",
  {
    key: text().$type<ProjectKey>().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(""),
    status: text().$type<ProjectStatus>().notNull().default("active"),
    default_assignee: text(),
    labels: text({ mode: "json" }).notNull().$type<string[]>().default([]),
    ...Timestamps,
  },
  (table) => [uniqueIndex("augusttask_project_name_idx").on(table.name), index("augusttask_project_status_idx").on(table.status)],
)

export { TaskCommentTable, TaskCounterTable, TaskEventTable, TaskIssueTable, TaskRelationTable }
```

- [ ] Run: `bun run db generate --name augusttask_project` from `packages/opencode`.
  Expected: new migration folder under `packages/opencode/migration/`.

## Task 2: Extract repository boundary

**Files:**
- Create: `packages/opencode/src/augusttask/repository/augusttask-repository.ts`
- Create: `packages/opencode/src/augusttask/repository/sqlite-augusttask-repository.ts`
- Modify: `packages/opencode/test/augusttask/service.test.ts`

- [ ] Extend the failing test to cover `listProjects`, `getProject`, and two project-specific issue sequences.

```ts
yield* augusttask.createProject({ key: "AUG", name: "August" })
yield* augusttask.createProject({ key: "VOICE", name: "Voice" })
expect((yield* augusttask.listProjects({})).map((project) => project.key)).toEqual(["AUG", "VOICE"])
expect((yield* augusttask.createIssue({ projectKey: "AUG", title: "First" })).id).toBe("AUG-1")
expect((yield* augusttask.createIssue({ projectKey: "VOICE", title: "First" })).id).toBe("VOICE-1")
```

- [ ] Implement repository interface with method names matching the spec exactly.

```ts
export interface Interface {
  readonly createProject: (input: CreateProjectInput) => Effect.Effect<Project, ProjectAlreadyExistsError>
  readonly listProjects: (input?: ListProjectsInput) => Effect.Effect<Project[]>
  readonly getProject: (key: ProjectKey) => Effect.Effect<Project, ProjectNotFoundError>
  readonly updateProject: (input: UpdateProjectInput) => Effect.Effect<Project, ProjectNotFoundError>
  readonly createIssue: (input: RepositoryCreateIssueInput) => Effect.Effect<Issue, IssueNotFoundError | ProjectNotFoundError>
  readonly listIssues: (input?: ListIssuesInput) => Effect.Effect<Issue[]>
  readonly getIssue: (id: IssueID) => Effect.Effect<IssueDetail, IssueNotFoundError>
  readonly updateIssue: (input: RepositoryUpdateIssueInput) => Effect.Effect<Issue, IssueNotFoundError>
  readonly addComment: (input: AddCommentInput) => Effect.Effect<Comment, IssueNotFoundError>
  readonly relateIssues: (input: RelateIssuesInput) => Effect.Effect<Relation, IssueNotFoundError>
  readonly listEvents: (id: IssueID) => Effect.Effect<Event[], IssueNotFoundError>
}
```

- [ ] Move database reads/writes from `src/task/task.ts` into `sqlite-augusttask-repository.ts`; keep helper functions local to repository.

- [ ] Ensure `createIssue` takes an already generated `id` and `sequence`; sequence generation is a service concern.

- [ ] Run: `bun test test/augusttask/service.test.ts --timeout 60000`.
  Expected: repository compiles; service may still fail until Task 3.

## Task 3: Implement service use-cases

**Files:**
- Create: `packages/opencode/src/augusttask/service/augusttask-service.ts`
- Modify: `packages/opencode/test/augusttask/service.test.ts`

- [ ] Implement `AugustTask.Service` with methods listed in the spec: project CRUD, issue CRUD, status, comment, relation, events.

- [ ] Use Effect service pattern with self-reexport.

```ts
export class Service extends Context.Service<Service, Interface>()("@opencode/AugustTask") {}
export const layer = Layer.effect(Service, Effect.gen(function* () { /* yield repository */ }))
export const defaultLayer = layer.pipe(Layer.provide(SqliteAugustTaskRepository.layer))
export * as AugustTask from "./augusttask-service"
```

- [ ] Business rules to implement:
  - normalize project keys to uppercase;
  - require project before issue creation;
  - generate issue IDs as `${projectKey}-${nextSequence}`;
  - backfill existing loose project strings to `AUG` only in migration/backfill code, not silently in regular create;
  - status changes update started/completed timestamps;
  - every mutation appends an event.

- [ ] Run: `bun test test/augusttask/service.test.ts --timeout 60000`.
  Expected: PASS.

## Task 4: Add semantic MCP frontend

**Files:**
- Create: `packages/opencode/src/augusttask/frontend/mcp.ts`
- Create: `packages/opencode/src/mcp-server/augusttask.ts`
- Create: `packages/opencode/test/mcp-server/augusttask.test.ts`
- Modify: `.opencode/opencode.jsonc`

- [ ] Write MCP test that expects separate tool names.

```ts
expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
  expect.arrayContaining(["create_project", "list_projects", "create_issue", "list_issues", "set_issue_status"]),
)
```

- [ ] Implement `createServer()` in `frontend/mcp.ts` registering semantic tools against `AugustTask.Service`.

- [ ] Ensure every MCP handler returns JSON text with stable field names and no SQL/query language.

- [ ] Add executable entrypoint `src/mcp-server/augusttask.ts` that connects stdio and closes the database on exit.

- [ ] Update `.opencode/opencode.jsonc` MCP config from:

```jsonc
"august-taskdb": {
  "type": "local",
  "command": ["bun", "--conditions=browser", "packages/opencode/src/mcp-server/taskdb.ts"],
  "enabled": true,
}
```

to:

```jsonc
"augusttask": {
  "type": "local",
  "command": ["bun", "--conditions=browser", "packages/opencode/src/mcp-server/augusttask.ts"],
  "enabled": true,
}
```

- [ ] Run: `bun test test/mcp-server/augusttask.test.ts --timeout 60000`.
  Expected: PASS.

## Task 5: Add CLI frontend and compatibility aliases

**Files:**
- Create: `packages/opencode/src/augusttask/frontend/cli.ts`
- Modify: `packages/opencode/src/cli/cmd/task.ts`
- Modify: `packages/opencode/src/index.ts`
- Create: `packages/opencode/test/augusttask/cli.test.ts`

- [ ] Add `AugustTaskCommand` with command name `augusttask` and subcommands `project create/list/show/update`, `issue create/list/show/update/status/comment/relate/events`.

- [ ] Keep `TaskCommand` as a compatibility alias that calls the new frontend service methods.

- [ ] Register `AugustTaskCommand` in `src/index.ts` next to `TaskCommand`.

- [ ] CLI test command sequence:

```bash
./scripts/august augusttask project create VOICE "Voice Companion" --format json
./scripts/august augusttask issue create VOICE "Build talker" --format json
./scripts/august augusttask issue status VOICE-1 in_progress --format json
./scripts/august augusttask issue list --project VOICE --format json
```

- [ ] Run: `bun test test/augusttask/cli.test.ts --timeout 60000` from `packages/opencode`.
  Expected: PASS.

## Task 6: Adapt legacy `taskdb` model tool

**Files:**
- Modify: `packages/opencode/src/tool/taskdb.ts`
- Modify: `packages/opencode/src/tool/registry.ts`
- Modify: `packages/opencode/src/effect/app-runtime.ts`
- Modify: existing `packages/opencode/test/tool/taskdb.test.ts`

- [ ] Replace direct dependency on `Task.Service` with `AugustTask.Service`.

- [ ] Keep old action names (`create`, `list`, `show`, `update`, `comment`, `relate`, `events`) working.

- [ ] Map old `project` field to new `projectKey`; default to `AUG` only for compatibility calls that omit project.

- [ ] Update registry/app-runtime layer provisioning to `AugustTask.defaultLayer`.

- [ ] Run: `bun test test/tool/taskdb.test.ts test/tool/registry.test.ts --timeout 60000`.
  Expected: PASS.

## Task 7: Migrate docs and validation scenario

**Files:**
- Modify: `features/task-db/README.md`
- Modify or create: `features/validation/scenarios/augusttask-tool.yaml`
- Modify: `docs/superpowers/specs/2026-05-29-augusttask-solid-design.md` if implementation choices changed.

- [ ] Rename docs language from Task DB to AugustTask.
- [ ] Document project/issue examples and MCP tool names.
- [ ] Add validation scenario that asks a real model to create a project and issue through AugustTask MCP/tooling.
- [ ] Run: `./scripts/validate-scenario features/validation/scenarios/augusttask-tool.yaml` from repo root.
  Expected: `PASS augusttask-tool`.

## Task 8: Remove Linear MCP and validate startup

**Files:**
- Modify: `~/.config/opencode/opencode.jsonc` only after project `augusttask` config passes.
- Modify: `.august/memory/MEMORY.md` in main repo or worktree if the memory file is present/tracked locally.

- [ ] Remove or disable the global Linear MCP entry named `linear` if present.
- [ ] Confirm project config has `augusttask` MCP enabled.
- [ ] Run: `./scripts/august mcp list` from repo root.
  Expected: `augusttask` connected and no Linear MCP listed.
- [ ] Update memory note to say AugustTask replaces Linear for August task tracking.

## Task 9: Full verification

**Files:**
- No new files.

- [ ] Run from `packages/opencode`: `bun test test/augusttask test/mcp-server/augusttask.test.ts test/tool/taskdb.test.ts --timeout 60000`.
  Expected: all tests pass.
- [ ] Run from `packages/opencode`: `bun typecheck`.
  Expected: exits 0.
- [ ] Run from repo root: `./scripts/doctor.sh`.
  Expected: exits 0.
- [ ] Run from repo root: `./scripts/august mcp list`.
  Expected: `augusttask` connected.
- [ ] Inspect diff: `git diff --stat && git diff --check`.
  Expected: no whitespace errors.

## Self-Review

- Spec coverage: project support, issues under projects, SOLID layering, semantic MCP, CLI compatibility, Linear removal, and validation all have tasks.
- Placeholder scan: no placeholder task remains; each task has concrete files and commands.
- Type consistency: plan uses `projectKey` in TypeScript and `project_key` only for MCP/JSON-facing input naming; repository/service names consistently use `AugustTask`.
