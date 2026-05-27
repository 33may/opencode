# Validation Harness

Goal: provide a feature-independent validation spine for August changes. The harness should let an agent define user stories for a feature, run those stories through the OpenCode API with real models, and save enough evidence to inspect what actually happened.

This is not a TUI test system yet. The first contract is API-first and artifact-first.

## Principles

- Deterministic tests prove plumbing.
- Real-model scenarios prove agent behavior.
- Every run must be inspectable after the fact.
- Assertions should check hard evidence, not only the model's final claim.
- Scenario specs belong near the validation feature first, then future features can add their own scenarios.

## Tiers

| Tier | Name | Default | Purpose |
| --- | --- | --- | --- |
| 0 | Static checks | yes | Doctor, typecheck, command availability. |
| 1 | Deterministic harness tests | yes | Fake-model or unit-level validation of the runner and API contract. |
| 2 | API behavioral scenarios | opt-in | Real model through server/session APIs with artifact capture. |
| 3 | Feature eval scenarios | opt-in | Feature-owned stories, hard assertions, and judge review. |
| 4 | TUI automation | later | Semantic or PTY-driven UI testing once API validation is stable. |

## Scenario Format

Scenarios are YAML files. The runner currently supports the fields below.

```yaml
id: baseline-readme
feature: validation
story: User asks August to inspect the project README and summarize the system.
workspace:
  copy:
    - README.md
prompt: |
  Read README.md and summarize this project in one concise paragraph.
expected:
  final_contains_any:
    - OpenCode
    - August
  messages_contain_any:
    - README
judge:
  question: Did the assistant inspect README.md and answer the user story?
```

## Artifacts

Each run writes a directory under `.august/runs/`:

```text
.august/runs/<timestamp>-<scenario-id>/
  scenario.yaml
  workspace/
  events.jsonl
  transcript.jsonl
  messages.json
  tool-calls.json
  final.md
  judge.md
  result.json
```

`result.json` is the machine-readable summary. `judge.md` is the real-model behavioral review when the scenario defines a judge question.

## Running

```bash
./scripts/validate-scenario features/validation/scenarios/baseline-readme.yaml
```

Optional controls:

```bash
AUGUST_VALIDATE_MODEL=anthropic/claude-sonnet-4 ./scripts/validate-scenario features/validation/scenarios/baseline-readme.yaml
AUGUST_RUN_ROOT=.august/runs ./scripts/validate-scenario features/validation/scenarios/baseline-readme.yaml
```

The model setting is optional. If omitted, OpenCode uses the configured default model.

## Pass/Fail

The first result layer is hard evidence:

- server started
- session created
- prompt completed
- messages were captured
- expected strings or tool calls were observed

The second layer is behavioral judgment:

- the judge receives the scenario story, expected evidence, transcript, tool calls, and final answer
- the judge writes `judge.md`
- verdict extraction is best-effort: `pass`, `fail`, or `unclear`

Hard assertion failures fail the run. Judge failures are recorded and fail the run when the judge clearly returns `Verdict: fail`.
