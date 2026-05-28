# August Task DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local SQLite-backed task tracker that replaces Linear for August autonomous agent workflows.

**Architecture:** Add a focused task service, Drizzle schema/migration, CLI command, and model-callable tool. Keep state in the existing OpenCode database so all August entrypoints share one local task source of truth.

**Tech Stack:** Bun, TypeScript, Effect, Drizzle SQLite, OpenCode CLI/tool registry.

---

## Files

- Create `packages/opencode/src/task/schema.ts`: branded IDs and public enums.
- Create `packages/opencode/src/task/task.sql.ts`: SQLite tables.
- Create `packages/opencode/src/task/task.ts`: task service.
- Create `packages/opencode/src/cli/cmd/task.ts`: `task` CLI.
- Create `packages/opencode/src/tool/taskdb.ts`: LLM tool.
- Modify `packages/opencode/src/index.ts`: register CLI command.
- Modify `packages/opencode/src/tool/registry.ts`: register built-in tool.
- Create migration folder under `packages/opencode/migration/`.
- Create tests under `packages/opencode/test/task/`, `test/cli/`, and `test/tool/`.
- Create `features/task-db/README.md`.

## Tasks

- [ ] Add failing service tests for create/list/update/comment/relation/audit.
- [ ] Implement schema, migration, and task service.
- [ ] Add failing CLI test for JSON create/list/show/update/comment/relate.
- [ ] Implement `task` CLI command.
- [ ] Add failing tool/registry test for `taskdb`.
- [ ] Implement `taskdb` tool and registry wiring.
- [ ] Add feature docs.
- [ ] Run targeted tests, typecheck, doctor, then push and merge into `next`.
