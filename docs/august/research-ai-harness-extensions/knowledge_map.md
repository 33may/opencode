# AI harness extension scan — 2026-05-27

Scope: GitHub repo scan for current OpenCode-like harness ideas: memory, code graph, agent teams, auto-improvement, security, and workflow extensions.

## Strongest patterns

1. **Structural/code memory is splitting from generic chat memory**
   - `syncable-dev/memtrace-public`: bi-temporal Tree-sitter code graph, MCP tools, temporal queries, impact analysis, local-first indexing.
   - `proxysoul/soulforge`: symbol/LSP-first editing plus code graph + co-change/semantic memory.
   - `study8677/antigravity-workspace-template`: generated module docs + router Q&A + optional GitNexus graph enrichment.
   - August fit: a project-local MCP/plugin that indexes symbols, calls, git history, and exposes query tools is more useful than plain vector RAG.

2. **Long-term memory is moving toward explicit, auditable stores**
   - `Dataojitori/nocturne_memory`: URI-routed graph memory, boot memories, aliases, triggers, dashboard review/rollback.
   - `mnemon-dev/mnemon`, `rohitg00/agentmemory`, `swarmclawai/swarmvault`: persistent cross-agent memory for Claude Code/Codex/OpenCode-style clients.
   - August fit: memory should be namespaced, reviewable, versioned, and opt-in per project/session. Avoid invisible auto-summary memory.

3. **Agent teams are becoming factory/control-loop systems**
   - `Agent-Field/SWE-AF`: PM/architect/coder/QA/reviewer/merger/verifier roles, worktrees, dependency DAG, advisor/replanner loops, CI fix gate.
   - `bytedance/deer-flow`: lead agent + subagents + skills + sandboxes + channels + long-horizon context compression.
   - `timwuhaotian/the-pair`: two-agent cross-checking pair-programming.
   - August fit: start with role presets and isolated worktrees before full autonomous factory mode.

4. **Harness engineering is treated as product infrastructure**
   - `bytedance/deer-flow`: setup wizard, doctor, Gateway API, skills, MCP, sandbox modes, IM channels, tracing.
   - `ModelEngine-Group/nexent`: zero-code agent generation with tools/skills/memory/control planes.
   - `OpenSource03/harnss`: desktop UI for multiple ACP-style agents side-by-side.
   - August fit: keep API-first validation and add observability/control surfaces around runs rather than only TUI affordances.

5. **Security is emerging as a separate harness layer**
   - `hashgraph-online/hol-guard`: pre-tool AI antivirus for plugins, skills, MCP servers, AI harnesses.
   - `Infisical/agent-vault`: HTTP credential proxy/vault for AI agents.
   - `Agent-Field/sec-af` referenced by SWE-AF: multi-agent security audit with proof-oriented findings.
   - August fit: tool/MCP/plugin install scanning, permission previews, and credential proxying are high-value low-core-invasive extensions.

## Repos worth deeper inspection

| Repo | Stars at scan | Why it matters |
|---|---:|---|
| https://github.com/bytedance/deer-flow | 69,756 | Full super-agent harness: skills, subagents, sandbox, channels, tracing, memory. |
| https://github.com/Agent-Field/SWE-AF | 810 | Engineering factory: role DAGs, worktrees, QA/review/CI loops, replanning. |
| https://github.com/syncable-dev/memtrace-public | 173 | Structural code memory via MCP; bi-temporal graph; strong benchmark framing. |
| https://github.com/Dataojitori/nocturne_memory | 1,150 | Auditable graph-like long-term memory with dashboard, rollback, boot URIs. |
| https://github.com/study8677/antigravity-workspace-template | 1,244 | Cross-IDE repo knowledge engine and routed Q&A workflow. |
| https://github.com/proxysoul/soulforge | 714 | AST/LSP symbol editing + live graph memory. |
| https://github.com/hashgraph-online/hol-guard | 344 | Security layer for agent plugins/skills/MCP before tool execution. |
| https://github.com/Infisical/agent-vault | 1,443 | Agent credential boundary instead of env-var sprawl. |
| https://github.com/OpenSource03/harnss | 270 | Multi-agent desktop/control surface for ACP-style agents. |
| https://github.com/RealZST/HarnessKit | 283 | Cross-agent skill/MCP/plugin/hook/config/memory manager. |

## August-shaped extension ideas

1. **Project structural memory plugin**
   - Index with Tree-sitter/LSP/git metadata; expose MCP-style tools: `find_symbol`, `callers`, `impact`, `cochange`, `recent_changes`.
   - Keep outside core if possible; cache under project `.august/graph` or XDG cache.

2. **Auditable memory layer**
   - Memory entries are URI/path-addressed, namespaced, source-linked, diffable, and human-approved before promotion to durable memory.
   - Add `august memory review` and session-end reflection hooks.

3. **Agent team run mode**
   - Start small: `planner -> implementer -> reviewer -> verifier` with explicit checkpoints and isolated git worktrees.
   - Add model-per-role routing and cost/trace reporting.

4. **Tool/plugin security gate**
   - Scan MCP/plugin/skill installs before enabling.
   - Show requested commands, env vars, network endpoints, filesystem paths, and secret access.

5. **Run observability + replay**
   - Persist compact run traces, tool-call timelines, token/cost by role, failure categories, and replay links.
   - Useful for auto-improve loops and regression validation.

6. **Auto-improve from validation failures**
   - Feed failed August validation scenarios into a bounded loop: diagnose -> patch prompt/config/skill -> rerun -> record delta.
   - Needs hard guardrails: no silent test weakening, no core edits without explicit feature flag.

## Critic notes

- A lot of 2026 repos are marketing-heavy; README claims need local verification before adoption.
- Proprietary/private-beta tools like Memtrace may inspire architecture but should not be hard dependency.
- Full autonomous factories are expensive and operationally complex; August should probably adopt composable pieces first.
- Persistent memory can become harmful if unreviewed. Human review + namespace boundaries matter.
- Security gates should be prioritized before making plugin/MCP install easier.
