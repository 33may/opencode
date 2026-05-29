# August Task DB MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose August's SQLite task database to `aug` through a local MCP server that OpenCode auto-loads from project config.

**Architecture:** Add a stdio MCP server entrypoint that wraps the existing `Task` service through a shared taskdb runner. Configure `.opencode/opencode.jsonc` to launch the server as local MCP named `august-taskdb`. Keep OpenCode MCP internals unchanged.

**Tech Stack:** Bun, TypeScript, Effect, `@modelcontextprotocol/sdk`, OpenCode local MCP config, existing August Task service.

---

## Files

- Modify `packages/opencode/src/tool/taskdb.ts`: export a reusable `runAction` helper and plain parameter type for MCP reuse.
- Create `packages/opencode/src/mcp-server/taskdb.ts`: stdio MCP server exposing `taskdb`.
- Create `scripts/august-taskdb-mcp`: portable wrapper used by OpenCode MCP config.
- Modify `.opencode/opencode.jsonc`: add local MCP server `august-taskdb`.
- Modify `features/task-db/README.md`: document MCP tool name and restart requirement.
- Create `packages/opencode/test/mcp-server/taskdb.test.ts`: deterministic MCP server tests.

## Tasks

- [ ] Add a failing test for the taskdb MCP server tool list and create/show calls.
- [ ] Export taskdb runner utilities from `packages/opencode/src/tool/taskdb.ts` without changing built-in tool behavior.
- [ ] Implement `packages/opencode/src/mcp-server/taskdb.ts` using stdio transport and shared runner.
- [ ] Add `scripts/august-taskdb-mcp` and wire `.opencode/opencode.jsonc` local MCP config.
- [ ] Update `features/task-db/README.md` with MCP usage and restart note.
- [ ] Run targeted MCP/tool tests from `packages/opencode`.
- [ ] Run `bun typecheck` from `packages/opencode`.
- [ ] Run `./scripts/doctor.sh` from the feature worktree.
- [ ] Run an MCP smoke check that starts OpenCode with the configured MCP and confirms `august-taskdb` is connected or the `august_taskdb_taskdb` tool is visible.
- [ ] Commit, push feature branch, then fast-forward `origin/next` if validation passes.

## Self-review

- Spec coverage: local stdio MCP, config wiring, action parity, docs, tests, and validation are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: use `TaskDBTool` parameter naming and existing task service names.
