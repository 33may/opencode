# August Talk Design

## Goal

Add `august talk`, a macOS-first CLI voice call that lets the user talk naturally with a facilitator agent while heavy development work is delegated to a normal August/OpenCode technician session.

## User-facing behavior

- `august talk` starts in the current folder.
- It requires `OPENAI_API_KEY` and connects to OpenAI Realtime with `gpt-realtime-2` by default.
- It uses local macOS command-line audio (`sox` `rec`/`play`) for microphone and speaker streaming.
- It creates an August session titled `August Talk - <timestamp>` and gives that session full autonomous permissions.
- The voice companion can call a `delegate_to_august` tool. That tool sends the requested work to the August session and returns the technician result.
- The call writes inspectable artifacts under `.august/talk/<timestamp>/`.

## Architecture

`src/cli/cmd/talk.ts` owns CLI wiring. `src/talk/` contains focused modules:

- `artifact.ts`: frontend-ready transcript/event JSONL formats and manifest writing.
- `prompt.ts`: talker system prompt and tool schema.
- `audio.ts`: swappable local audio process interface, macOS/sox implementation first.
- `realtime.ts`: OpenAI Realtime WebSocket client and event parsing.
- `session.ts`: August technician session creation and prompt delegation.
- `index.ts`: orchestration loop.

The first version does not build a new frontend. The existing OpenCode/August session remains the inspectable developer frontend. Saved artifacts prepare the later frontend data contract.

## Upstream compatibility

The feature is isolated behind a new command and new `src/talk/` modules. It avoids modifying existing TUI internals and only adds one import/command registration in `src/index.ts`.

## Extension-point preference

Use OpenCode's command system, session services, permission rules, and existing prompt pipeline. Do not introduce a parallel coding agent runtime.

## Validation strategy

- Unit-test artifact formats, prompt/tool schema, command dependency checks, and session delegation seams.
- Typecheck `packages/opencode`.
- Run August doctor.
- Add an API-first validation scenario proving `august talk --dry-run` creates frontend-ready artifacts without opening a real microphone.
- Final manual validation is voice-only: user runs `august talk`, speaks a task, confirms the voice companion delegates to August, and checks artifacts/session output.

## Scope limits

- macOS-first local CLI audio is acceptable for v1.
- No browser/WebRTC UI and no custom TUI panel in v1.
- No global memory learning engine in v1 beyond persistent transcript/style artifacts; later work can summarize them into durable memory.
