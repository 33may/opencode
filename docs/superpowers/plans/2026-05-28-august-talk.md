# August Talk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `august talk`, a macOS-first Realtime voice companion that delegates developer work to an August session and saves frontend-ready artifacts.

**Architecture:** Add an isolated `src/talk/` feature with modules for artifacts, prompts, audio processes, Realtime connection, and August session delegation. Register one new CLI command that orchestrates those modules under the existing project instance.

**Tech Stack:** Bun/TypeScript, Effect command wrapper, OpenAI Realtime WebSocket API, macOS `sox` audio commands, existing August Session/SessionPrompt services.

---

## Files

- Create `packages/opencode/src/talk/artifact.ts`
- Create `packages/opencode/src/talk/prompt.ts`
- Create `packages/opencode/src/talk/audio.ts`
- Create `packages/opencode/src/talk/realtime.ts`
- Create `packages/opencode/src/talk/session.ts`
- Create `packages/opencode/src/talk/index.ts`
- Create `packages/opencode/src/cli/cmd/talk.ts`
- Modify `packages/opencode/src/index.ts`
- Create tests under `packages/opencode/test/talk/`
- Add validation scenario `features/validation/scenarios/august-talk-dry-run.yaml`

## Tasks

- [ ] Artifact writer tests and implementation.
- [ ] Talker prompt/tool schema tests and implementation.
- [ ] Audio command dependency tests and implementation.
- [ ] Realtime client event tests and implementation.
- [ ] August session delegation tests and implementation.
- [ ] CLI command registration and dry-run validation path.
- [ ] Typecheck, unit tests, doctor, validation scenario.
- [ ] Manual voice validation request only after automated validation passes.
