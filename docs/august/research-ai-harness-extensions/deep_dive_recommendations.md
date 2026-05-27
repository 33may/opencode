# AI harness repo deep dive recommendations

Date: 2026-05-27

## Add now

### Antigravity-style project knowledge cache
- Source: https://github.com/study8677/antigravity-workspace-template
- What: `refresh` generates module/context docs; `ask` routes questions through those docs.
- Why August needs it: reduces repeated repo rediscovery and gives agents grounded context before grep/file reads.
- Evidence: MIT, active, 1.2k+ stars, concrete CLI/engine layout and eval report. Weakness: stale/generated docs can mislead.
- Plan: add `.august/knowledge/{map.md,conventions.md,modules/*.md}` plus `august knowledge refresh/ask`; expose as MCP/tool and validation scenario.
- Decision: Add now, August-native.

### Run profiles
- Source: https://github.com/bytedance/deer-flow
- What: user-facing modes like fast/standard/deep that change planning, subagents, turn budget, tools.
- Why August needs it: makes behavior predictable without editing config every run.
- Evidence: DeerFlow is huge and active (69k+ stars), but too LangGraph/opinionated to adopt directly.
- Plan: add profile config mapping to existing session flags: planning, subagent use, reasoning effort, max turns, permission defaults.
- Decision: Add now as small config/API/TUI layer.

### Mentor/executor pair workflow
- Source: https://github.com/timwuhaotian/the-pair
- What: read-only mentor reviews/plans; write-enabled executor implements; mentor verifies.
- Why August needs it: cheap reliability gain versus full agent factory; enforces review discipline.
- Evidence: small but concrete project, Apache-2.0, active; desktop code not reusable.
- Plan: add `pair` run profile: spawn read-only mentor subagent, require plan, execute, then mentor verdict with evidence.
- Decision: Add now as minimal workflow.

### Lifecycle memory hooks
- Source: https://github.com/mnemon-dev/mnemon
- What: memory phases around session start, prompt, stop, compact.
- Why August needs it: safer than always-on memory; recall/writeback happens at explicit lifecycle points.
- Evidence: Apache-2.0 Go binary, active, clean design docs; still young.
- Plan: add hook points: `prime`, `remind`, `nudge`, `compact`; first implementation just invokes existing memory/context providers.
- Decision: Add now for hook pattern, not full graph store.

### Security scanner for skills/MCP/plugins
- Source: https://github.com/hashgraph-online/hol-guard
- What: scans agent harness artifacts before enabling.
- Why August needs it: plugin/MCP/skill expansion is risky without trust receipts.
- Evidence: active, tests/fuzzers/schema/security files; license metadata needs verification.
- Plan: add `august doctor/security`: inspect `.opencode/skills`, MCP configs, plugins, hooks, env/command/network risk; emit receipts.
- Decision: Add now as static scanner; runtime guard later.

## Prototype

### Memtrace-like code-intel contract
- Source: https://github.com/syncable-dev/memtrace-public
- What: structural code graph MCP: symbol search, callers/callees, impact, temporal changes.
- Why August needs it: code agents need deterministic code structure, not only text search.
- Evidence: strong docs/benchmarks; proprietary/private-beta core is a blocker.
- Plan: define August tool contract `find_symbol`, `symbol_context`, `impact`, `changed_symbols`; support external MCP if installed, with simple local backend later.
- Decision: Prototype interface; no dependency.

### Nocturne-style reviewed memory
- Source: https://github.com/Dataojitori/nocturne_memory
- What: URI graph memory with aliases, boot URIs, snapshots, diff/review/rollback.
- Why August needs it: long-term memory without review is dangerous; URI namespaces fit project/product memories.
- Evidence: MIT, active, detailed data model; README persona framing not ideal for coding ops.
- Plan: memory entries under `system://`, `project://`, `user://`; writes go to pending review; TUI/CLI approve/reject later.
- Decision: Prototype.

### SWE-AF adaptive engineering factory
- Source: https://github.com/Agent-Field/SWE-AF
- What: PM/architect/coder/QA/reviewer/merger/verifier DAG with worktrees, retries, replanning, CI fix gate.
- Why August needs it: useful for long-horizon feature work and validation-driven coding.
- Evidence: Apache-2.0, active, concrete examples/costs; very expensive/complex.
- Plan: start with validation/orchestration feature: task DAG artifact, worktree per issue, role prompts, bounded retries, debt records.
- Decision: Prototype only, not default.

### Dexto-style portable agent configs
- Source: https://github.com/truffle-ai/dexto
- What: YAML-defined agents, tools, MCP, model/session/memory policy, agent-as-MCP.
- Why August needs it: shareable agent definitions without hardcoding runtime behavior.
- Evidence: active SDK/CLI/API docs; Elastic license prevents reuse.
- Plan: extend August config schema for agent profiles: model, tools, MCP servers, permissions, memory policy.
- Decision: Prototype config subset.

### RPG-style persistent work graph
- Source: https://github.com/microsoft/RPG-ZeroRepo
- What: graph of requirements, files, tasks, dependencies, verification.
- Why August needs it: long tasks need state richer than markdown plan/todo.
- Evidence: Microsoft research repo, active; academic/product layer is heavy.
- Plan: `.august/workgraph.json` with nodes `{requirement, decision, task, file, test}` and edges `{depends_on, implements, verifies, touches}`.
- Decision: Prototype for long-horizon work.

### Credential broker
- Source: https://github.com/Infisical/agent-vault
- What: agents get dummy credentials; proxy injects real secrets and logs destinations.
- Why August needs it: remote/sandbox agents should not directly possess secrets.
- Evidence: strong maintainer, active Go project; operationally invasive.
- Plan: optional broker mode for remote agents and high-risk tool runs; start with provider/GitHub tokens only.
- Decision: Prototype for remote/sandbox mode.

### Context packs / task ledger
- Source: https://github.com/swarmclawai/swarmvault
- What: local-first wiki/knowledge graph with generated context packs and ledger artifacts.
- Why August needs it: handoffs and validation runs need bounded, cited context packages.
- Evidence: MIT, active, concrete layout; more PKM than coding harness.
- Plan: `august context build <goal>` writes bounded markdown bundle from AGENTS/AUGUST/git diff/session notes/knowledge cache.
- Decision: Prototype.

## Watch / selective borrow

### SoulForge symbol editing + checkpoints
- Source: https://github.com/proxysoul/soulforge
- What: AST/LSP symbol-first edits, live graph, checkpoints/time-machine.
- Why interesting: safer editing and inspectable/revertible sessions.
- Evidence: active, real TS repo; BSL/commercial license and large surface area.
- Plan if later: one TS symbol-edit tool and session checkpoint metadata.
- Decision: Watch/prototype selectively.

### Harnss multi-agent desktop/tool cards
- Source: https://github.com/OpenSource03/harnss
- What: desktop client for running ACP/CLI agents side-by-side with rich tool visualization.
- Why interesting: good event-card taxonomy and MCP manager UX.
- Evidence: MIT but early UI-heavy project.
- Plan if later: normalize August event categories for future UI cards.
- Decision: Watch.

### HarnessKit inventory/kits
- Source: https://github.com/RealZST/HarnessKit
- What: manage skills, MCP, plugins, hooks, configs, memory across agents.
- Why interesting: inventory and exportable bundles.
- Evidence: Apache-2.0, active; overlaps with August config domain.
- Plan if later: `august inventory` over `.opencode`, MCP, skills, plugins; export/import kits.
- Decision: Watch/prototype inventory only.

### Agentmemory replay/profile ideas
- Source: https://github.com/rohitg00/agentmemory
- What: huge persistent memory/replay server for coding agents.
- Why interesting: session replay, profile injection, top-K context budgets.
- Evidence: huge stars and active, Apache-2.0; unusually marketing-heavy and large dependency surface.
- Plan if later: August-native event replay/profile injector, not external server.
- Decision: Prototype tiny pieces; skip full stack.

## Skip for now

### Whole-runtime imports
- Applies to DeerFlow, SWE-AF, Dexto, Harnss, SoulForge.
- Reason: August must stay close to OpenCode upstream; importing another runtime creates merge, license, and architecture risk.
- Decision: borrow patterns only.
