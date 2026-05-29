# August Task DB MCP Design

## Intent

Expose the August local task database through a local MCP server so `aug` / AugustCode, which is the user's OpenCode wrapper, can discover task tracking as an MCP tool. This complements the built-in `taskdb` tool and makes the same SQLite-backed task workflow visible through OpenCode's MCP subsystem.

## Approved approach

Use a local stdio MCP server. OpenCode already supports local MCP entries in `.opencode/opencode.jsonc`, launches them from the project directory, and imports their tools as model tools. A remote HTTP MCP endpoint is unnecessary for this first ship, and keeping only the built-in tool would not satisfy the MCP requirement.

## User-facing behavior

- `.opencode/opencode.jsonc` defines an enabled local MCP server named `august-taskdb`.
- When the user starts `aug`, OpenCode starts the local MCP server and exposes the task DB tool as an MCP tool, likely named `august_taskdb_taskdb` after OpenCode's MCP tool prefixing.
- The MCP tool supports the same actions as the built-in `taskdb`: `create`, `list`, `show`, `update`, `comment`, `relate`, and `events`.
- The source of truth remains the existing OpenCode SQLite database and the existing task service/schema.

## Architecture

- Add a small executable TypeScript MCP server under `packages/opencode/src/mcp-server/taskdb.ts`.
- Add a wrapper script under `scripts/` so project config can launch it portably with Bun.
- Reuse the existing task service semantics where practical, but expose a plain MCP JSON schema for the tool input.
- Keep all task mutations in the existing SQLite database; no separate task store, no Linear dependency, and no network service.
- Configure `.opencode/opencode.jsonc` with a local MCP entry that runs the wrapper script from the August repo.

## Upstream compatibility

This is an August-only product extension. Core OpenCode MCP behavior is not changed. The implementation adds a local MCP server and project config entry, which should be easy to carry across upstream merges.

## Extension-point preference

This feature uses OpenCode's existing MCP local-server extension point instead of modifying the model tool registry or session behavior. The only OpenCode-adjacent code is the local server implementation, docs, and config wiring.

## Validation strategy

- Add deterministic tests that launch/connect to the local MCP server or exercise its request handler and verify `tools/list` and `tools/call` behavior against an isolated SQLite database.
- Run package-level tests from `packages/opencode`.
- Run `bun typecheck` from `packages/opencode`.
- Run `./scripts/doctor.sh` from the feature worktree to confirm OpenCode can load the configured MCP list.
- Add/update a validation scenario only if it can assert that the MCP-prefixed task tool is visible or called through a real OpenCode session.

## Error handling

The MCP tool returns structured JSON errors instead of crashing for expected task failures such as missing IDs, invalid enum values, or nonexistent tasks. Server startup failures should be visible in OpenCode MCP status/logs.

## Scope boundaries

In scope: local stdio MCP server, config wiring, taskdb action parity, docs, tests. Out of scope: remote MCP hosting, OAuth, multi-user permissions, Linear import, and UI.
