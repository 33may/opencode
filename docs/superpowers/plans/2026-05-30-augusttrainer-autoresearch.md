# AugustTrainer Autoresearch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native AugustTrainer agent that can be spawned in any ML project to discover the training flow, create an `augusttrainer/` lab notebook, and run autonomous metric-driven improvement loops overnight.

**Architecture:** Ship the trainer as a native OpenCode/August agent so it is available in every project without requiring project-local `.opencode` files. Add a thin repo script for local August development convenience. Validate with unit tests for the native agent contract and an API-first scenario over a tiny fake ML project.

**Tech Stack:** TypeScript/Bun, OpenCode native agent registry, Markdown prompt file, shell helper script, August validation harness YAML.

---

## File structure

- Create `packages/opencode/src/agent/prompt/augusttrainer.txt` — native agent system prompt and operating contract.
- Modify `packages/opencode/src/agent/agent.ts` — import the prompt and register native `augusttrainer` agent.
- Modify `packages/opencode/test/agent/agent.test.ts` — assert the agent exists, is primary/native, has key guardrails, and keeps autonomous permissions.
- Create `scripts/augusttrainer` — convenience launcher for local August checkout: targets any project directory through `scripts/august run --dir ... --agent augusttrainer`.
- Create `features/augusttrainer/README.md` — user-facing docs for starting overnight training and editing `flow.md`.
- Create `features/validation/fixtures/augusttrainer-fake-ml/README.md` — fake ML project instructions.
- Create `features/validation/fixtures/augusttrainer-fake-ml/model_config.json` — editable fake model config.
- Create `features/validation/fixtures/augusttrainer-fake-ml/train.py` — deterministic metric-producing training script.
- Create `features/validation/scenarios/augusttrainer-fake-ml.yaml` — API-first scenario for one bounded validation iteration.
- Modify `.august/memory/MEMORY.md` — add a concise shipped-feature memory after implementation validation.

---

### Task 1: Register the native AugustTrainer agent

**Files:**
- Create: `packages/opencode/src/agent/prompt/augusttrainer.txt`
- Modify: `packages/opencode/src/agent/agent.ts`
- Test: `packages/opencode/test/agent/agent.test.ts`

- [ ] **Step 1: Write the failing native-agent tests**

Modify `packages/opencode/test/agent/agent.test.ts`.

In the existing `returns default native agents when no config` test, add:

```ts
    expect(names).toContain("augusttrainer")
```

After the `build agent has correct default properties` test, add:

```ts
it.instance("augusttrainer agent has ML autoresearch guardrails", () =>
  Effect.gen(function* () {
    const trainer = yield* load((svc) => svc.get("augusttrainer"))
    expect(trainer).toBeDefined()
    expect(trainer?.mode).toBe("primary")
    expect(trainer?.native).toBe(true)
    expect(trainer?.description).toContain("ML")
    expect(trainer?.prompt).toContain("augusttrainer/flow.md")
    expect(trainer?.prompt).toContain("Dependency experimentation")
    expect(trainer?.prompt).toContain("Validation mode")
    expect(trainer?.prompt).toContain("Do not ask whether to continue")
    expect(evalPerm(trainer, "bash")).toBe("allow")
    expect(evalPerm(trainer, "edit")).toBe("allow")
    expect(evalPerm(trainer, "question")).toBe("deny")
  }),
)
```

- [ ] **Step 2: Run the agent test to verify it fails**

Run from `packages/opencode`:

```bash
bun test test/agent/agent.test.ts --timeout 30000
```

Expected: FAIL because `augusttrainer` is not registered and the prompt file does not exist.

- [ ] **Step 3: Create the AugustTrainer prompt file**

Create `packages/opencode/src/agent/prompt/augusttrainer.txt` with this content:

```text
You are AugustTrainer, an autonomous ML training researcher for August.

Your job is to improve the model in the current project by running a Karpathy-style autoresearch loop:
inspect the project, define one reproducible experiment protocol, establish a baseline, propose hypotheses,
change bounded artifacts, run training/evaluation, keep objective improvements, revert regressions, and repeat
until the user stops you.

## Default mode

Run autonomously. Do not ask whether to continue. Do not pause for approval after writing flow.md. The user may be asleep and expects you to keep improving the model overnight.

Only stop when:
- the user explicitly asks you to stop,
- Validation mode gives a fixed iteration count and you complete it,
- no runnable experiment can be discovered after structured project inspection, or
- continuing would require modifying protected data/evaluation files or using unavailable credentials.

If blocked, write the reason to augusttrainer/decisions.md and final-answer with the exact blocker.

## Required project-local lab notebook

Create and maintain this folder inside the target ML project:

```text
augusttrainer/
  flow.md
  hypothesis-map.md
  decisions.md
  results.tsv
  results.jsonl
  runs/<run-id>/
    prompt.md
    diff.patch
    run.log
    metrics.json
    verdict.md
```

`augusttrainer/flow.md` is the reproducible contract. It must include:
- train command for one experiment
- metric extraction rule
- optimization direction, for example lower validation loss is better or higher accuracy is better
- baseline metric
- timeout policy
- editable files
- protected files
- Dependency experimentation policy
- keep/revert rules
- logging format
- how to resume from current best

## Discovery protocol

Before the first run:
1. Inspect README files, training docs, configs, scripts, notebooks only when needed, package manifests, and recent git state.
2. Find the command that runs one training/evaluation attempt. Prefer documented commands. Common examples: `python3 train.py`, `uv run train.py`, `python3 -m train`, `make train`, `python3 scripts/train.py --config ...`.
3. Find the objective metric and direction. Prefer validation/test metrics over training metrics. Prefer scalar metrics printed to stdout, JSON, CSV, TensorBoard logs, or a known results file.
4. Define editable files narrowly: model config, training config, optimizer schedule, model architecture code, prompt/style files, and dependency manifests when needed.
5. Define protected files explicitly: datasets, validation/test data, evaluation harnesses, metric parsers, secrets, `.env*`, downloaded checkpoints unless the project docs say to edit them, and anything the user marked protected.
6. Write augusttrainer/flow.md before changing model behavior.

If several plausible commands exist, choose the fastest command that still evaluates the target metric. Record alternatives in flow.md.

## Baseline

Always run a baseline before the first hypothesis unless results.tsv already contains a valid current best.
Redirect long output to `augusttrainer/runs/<run-id>/run.log`; do not flood the conversation.
Parse the metric and write:
- `augusttrainer/results.tsv`
- `augusttrainer/results.jsonl`
- `augusttrainer/runs/<run-id>/metrics.json`
- `augusttrainer/runs/<run-id>/verdict.md`

Use this TSV header exactly:

```text
run_id	commit	metric	direction	status	description
```

Use JSON Lines entries with at least:

```json
{"run_id":"...","commit":"...","metric":0.0,"direction":"lower","status":"keep","description":"baseline","files_changed":[],"dependency_commands":[]}
```

## Hypothesis loop

For each experiment:
1. Record one hypothesis in augusttrainer/hypothesis-map.md before editing.
2. Snapshot current git state and current best.
3. Modify only files allowed by flow.md.
4. If the hypothesis needs a new model/library, follow the dependency policy below.
5. Save the prompt/hypothesis to `augusttrainer/runs/<run-id>/prompt.md`.
6. Run the train command with the flow.md timeout policy and redirect logs to `run.log`.
7. Parse the metric exactly as flow.md defines it.
8. Save `diff.patch`, `metrics.json`, and `verdict.md`.
9. If the result improves, keep it and record status `keep`.
10. If the result is worse, equal when no simplicity win exists, crashed, timed out, or cannot be scored, revert code and dependency changes and record status `discard` or `crash`.
11. Append the decision to augusttrainer/decisions.md.
12. Continue with the next hypothesis without asking whether to continue.

Prefer simple changes. A tiny improvement with large ugly complexity is usually not worth keeping. A neutral metric with simpler code can be kept only if flow.md says simplicity is an accepted secondary objective.

## Git and revert safety

Never destroy pre-existing user work.

At startup, run git status if the project is a git repo.
- If clean, create or use a branch named `augusttrainer/<date-or-run-tag>` and commit kept improvements.
- If dirty, record the dirty files in flow.md and avoid git reset over them. Use patch snapshots or copy snapshots for your own editable files.
- If not a git repo, create file snapshots under `augusttrainer/runs/<run-id>/before/` for all editable files before each experiment and restore from those snapshots on discard.

Never use `git reset --hard` unless you have verified the project was clean at your startup point and the reset only removes your own failed experiment.

## Dependency experimentation

You may install dependencies to try new model families, optimizers, kernels, metrics, or training utilities when that is part of a recorded hypothesis.

Rules:
- Prefer the project's existing package manager: `uv`, `pip`, `poetry`, `conda`, `npm`, `bun`, or the documented tool.
- Record the exact install command in `prompt.md`, `results.jsonl`, and `decisions.md`.
- Pin versions or update lockfiles when the package manager supports it.
- Treat manifest and lockfile changes as part of the experiment diff.
- Keep dependency changes only when the metric improves.
- Revert dependency changes when the run regresses, crashes, times out, or cannot be scored.
- Do not install packages that require secrets, paid services, or system-level sudo unless the user explicitly provided that instruction in the project.

## Protected behavior

Do not weaken evaluation. Do not change the metric extraction rule to make a bad result look good. Do not modify validation/test data to improve the score. Do not edit secrets. Do not hide failed runs. Do not delete the lab notebook.

## Validation mode

If the user prompt says `Validation mode`, obey the bounded iteration count in that prompt. Example: "run exactly one baseline and one hypothesis iteration, then stop" means stop after those runs and summarize artifacts.

Validation mode is the only normal exception to the overnight infinite loop.
```

- [ ] **Step 4: Register the native agent in `agent.ts`**

Modify `packages/opencode/src/agent/agent.ts`.

Add the import near the other prompt imports:

```ts
import PROMPT_AUGUSTTRAINER from "./prompt/augusttrainer.txt"
```

Add this entry in the `agents` object after `build` and before `plan`:

```ts
          augusttrainer: {
            name: "augusttrainer",
            description:
              "Autonomous ML training researcher that discovers a project train/eval flow and improves the model through an auditable AugustTrainer loop.",
            prompt: PROMPT_AUGUSTTRAINER,
            options: {},
            permission: Permission.merge(defaults, user),
            mode: "primary",
            native: true,
            color: "#4FB477",
          },
```

- [ ] **Step 5: Run the agent test to verify it passes**

Run from `packages/opencode`:

```bash
bun test test/agent/agent.test.ts --timeout 30000
```

Expected: PASS.

---

### Task 2: Add the local launcher and feature docs

**Files:**
- Create: `scripts/augusttrainer`
- Create: `features/augusttrainer/README.md`

- [ ] **Step 1: Create the launcher script**

Create `scripts/augusttrainer` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage: scripts/augusttrainer [--project DIR] [--model provider/model] [prompt...]

Launch the native AugustTrainer agent against any ML project directory.

Examples:
  scripts/augusttrainer --project /path/to/ml-project
  scripts/augusttrainer --project . --model anthropic/claude-sonnet-4-6
  scripts/augusttrainer --project . "Validation mode: run exactly one baseline and one hypothesis iteration, then stop."
USAGE
}

PROJECT="$(pwd)"
MODEL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -C|--project|--dir)
      if [[ $# -lt 2 ]]; then
        printf 'scripts/augusttrainer: %s requires a directory\n' "$1" >&2
        exit 1
      fi
      PROJECT="$2"
      shift 2
      ;;
    --model)
      if [[ $# -lt 2 ]]; then
        printf 'scripts/augusttrainer: --model requires provider/model\n' >&2
        exit 1
      fi
      MODEL_ARGS=(--model "$2")
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [[ ! -d "$PROJECT" ]]; then
  printf 'scripts/augusttrainer: project directory not found: %s\n' "$PROJECT" >&2
  exit 1
fi

PROMPT="$*"
if [[ -z "$PROMPT" ]]; then
  PROMPT="Start AugustTrainer in autonomous overnight mode. Inspect this ML project, write augusttrainer/flow.md, establish a baseline, then keep improving the model until I stop you."
fi

exec "$ROOT/scripts/august" run \
  --dir "$PROJECT" \
  --agent augusttrainer \
  --dangerously-skip-permissions \
  --title "augusttrainer: $(basename "$PROJECT")" \
  "${MODEL_ARGS[@]}" \
  "$PROMPT"
```

- [ ] **Step 2: Mark the launcher executable**

Run from repo root:

```bash
chmod +x scripts/augusttrainer
```

Expected: no output and `git diff --summary scripts/augusttrainer` shows executable mode if supported by git.

- [ ] **Step 3: Verify launcher help**

Run from repo root:

```bash
scripts/augusttrainer --help
```

Expected output contains:

```text
Launch the native AugustTrainer agent against any ML project directory.
```

- [ ] **Step 4: Add feature documentation**

Create `features/augusttrainer/README.md` with this content:

```markdown
# AugustTrainer

AugustTrainer is an autonomous ML autoresearch agent. It runs inside any training project, discovers the train/eval flow, writes an `augusttrainer/` lab notebook, and keeps trying model improvements until stopped.

## Start from an August checkout

```bash
scripts/augusttrainer --project /path/to/ml-project
```

Optional model override:

```bash
scripts/augusttrainer --project /path/to/ml-project --model anthropic/claude-sonnet-4-6
```

## Start with the regular August CLI

```bash
august run --agent augusttrainer --dangerously-skip-permissions "Start AugustTrainer in autonomous overnight mode."
```

Use `--dir /path/to/ml-project` when launching from outside the target project.

## What it creates

```text
augusttrainer/
  flow.md
  hypothesis-map.md
  decisions.md
  results.tsv
  results.jsonl
  runs/<run-id>/
```

`flow.md` is the contract. Review or edit it to steer later runs: train command, metric, editable files, protected files, dependency policy, timeout, and keep/revert rules.

## Dependency experiments

AugustTrainer may install dependencies when a logged hypothesis needs a new model, optimizer, kernel, metric, or training utility. It records the exact install command and keeps dependency changes only when the metric improves.

## Stopping

Stop the running August process externally when you want the overnight loop to end. The latest state is in `augusttrainer/results.tsv`, `augusttrainer/results.jsonl`, and `augusttrainer/decisions.md`.
```

---

### Task 3: Add API-first validation scenario fixtures

**Files:**
- Create: `features/validation/fixtures/augusttrainer-fake-ml/README.md`
- Create: `features/validation/fixtures/augusttrainer-fake-ml/model_config.json`
- Create: `features/validation/fixtures/augusttrainer-fake-ml/train.py`
- Create: `features/validation/scenarios/augusttrainer-fake-ml.yaml`

- [ ] **Step 1: Create the fake ML project README**

Create `features/validation/fixtures/augusttrainer-fake-ml/README.md` with this content:

```markdown
# Fake ML Project

This fixture is a tiny deterministic ML-like project for AugustTrainer validation.

Run one experiment:

```bash
python3 train.py
```

Metric:

- `val_loss`, lower is better.

Editable files:

- `model_config.json`

Protected files:

- `train.py`
- `README.md`

The model improves when `quality_bonus` in `model_config.json` is increased up to `0.4`.
```

- [ ] **Step 2: Create the editable fake model config**

Create `features/validation/fixtures/augusttrainer-fake-ml/model_config.json` with this content:

```json
{
  "quality_bonus": 0.0
}
```

- [ ] **Step 3: Create the deterministic fake training script**

Create `features/validation/fixtures/augusttrainer-fake-ml/train.py` with this content:

```python
import json
from pathlib import Path

config = json.loads(Path("model_config.json").read_text())
quality_bonus = max(0.0, min(float(config.get("quality_bonus", 0.0)), 0.4))
val_loss = 1.0 - quality_bonus

print("training_seconds: 0.1")
print(f"val_loss: {val_loss:.6f}")
```

- [ ] **Step 4: Create the validation scenario**

Create `features/validation/scenarios/augusttrainer-fake-ml.yaml` with this content:

```yaml
id: augusttrainer-fake-ml
feature: augusttrainer
story: AugustTrainer runs a bounded validation pass on a fake ML project and records the lab notebook artifacts.
workspace:
  copy:
    - features/validation/fixtures/augusttrainer-fake-ml/README.md
    - features/validation/fixtures/augusttrainer-fake-ml/model_config.json
    - features/validation/fixtures/augusttrainer-fake-ml/train.py
prompt: |
  Validation mode for AugustTrainer.

  Work inside features/validation/fixtures/augusttrainer-fake-ml as the target ML project.
  Run exactly one baseline and one hypothesis iteration, then stop.

  Requirements:
  - create the project-local augusttrainer/ folder inside that fake ML project
  - write augusttrainer/flow.md with train command, metric, direction, editable files, protected files, dependency policy, timeout, and keep/revert rules
  - use python3 train.py as the train command
  - use val_loss as the metric, lower is better
  - keep train.py and README.md protected
  - record results in results.tsv and results.jsonl
  - change only model_config.json for the one hypothesis iteration
  - summarize the artifact paths when done
expected:
  final_contains_any:
    - augusttrainer
    - flow.md
    - results.tsv
  messages_contain_any:
    - val_loss
    - model_config.json
  tool_calls:
    - bash
    - write
judge:
  question: Did AugustTrainer create the lab notebook contract, run the fake metric flow, and stop after the requested bounded validation iteration?
```

---

### Task 4: Run package and scenario validation

**Files:**
- Verify: `packages/opencode/src/agent/agent.ts`
- Verify: `packages/opencode/src/agent/prompt/augusttrainer.txt`
- Verify: `scripts/augusttrainer`
- Verify: `features/validation/scenarios/augusttrainer-fake-ml.yaml`

- [ ] **Step 1: Run the focused agent test**

Run from `packages/opencode`:

```bash
bun test test/agent/agent.test.ts --timeout 30000
```

Expected: PASS.

- [ ] **Step 2: Run package typecheck**

Run from `packages/opencode`:

```bash
bun typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run doctor from repo root**

Run from repo root:

```bash
./scripts/doctor.sh
```

Expected: PASS. If doctor reports unrelated pre-existing failures, record the exact output and do not claim full validation passed.

- [ ] **Step 4: Run the AugustTrainer validation scenario**

Run from repo root:

```bash
AUGUST_VALIDATE_AGENT=augusttrainer ./scripts/validate-scenario features/validation/scenarios/augusttrainer-fake-ml.yaml
```

Expected: PASS and a run directory under `.august/runs/<timestamp>-augusttrainer-fake-ml/`.

- [ ] **Step 5: Inspect the validation artifacts**

Open the printed run directory and verify these files exist under its workspace copy:

```text
workspace/features/validation/fixtures/augusttrainer-fake-ml/augusttrainer/flow.md
workspace/features/validation/fixtures/augusttrainer-fake-ml/augusttrainer/results.tsv
workspace/features/validation/fixtures/augusttrainer-fake-ml/augusttrainer/results.jsonl
workspace/features/validation/fixtures/augusttrainer-fake-ml/augusttrainer/decisions.md
```

Expected: files exist and mention `python3 train.py`, `val_loss`, `lower`, and `model_config.json`.

---

### Task 5: Update August memory and final docs check

**Files:**
- Modify: `.august/memory/MEMORY.md`
- Verify: `docs/superpowers/specs/2026-05-30-augusttrainer-autoresearch-design.md`
- Verify: `docs/superpowers/plans/2026-05-30-augusttrainer-autoresearch.md`

- [ ] **Step 1: Add a memory index entry**

Add this line to `.august/memory/MEMORY.md`:

```markdown
- 2026-05-30: AugustTrainer design targets generic ML projects, not only Karpathy/autoresearch: native `augusttrainer` agent creates project-local `augusttrainer/` lab notebook, discovers train command/metric/editable/protected files, runs autonomously overnight, and may install dependencies when tied to logged hypotheses and reverted on failed runs.
```

- [ ] **Step 2: Re-read spec requirements against implementation**

Check `docs/superpowers/specs/2026-05-30-augusttrainer-autoresearch-design.md` and verify each requirement is represented:

```text
native/generic ML trainer: packages/opencode/src/agent/agent.ts + prompt
project-local augusttrainer folder: prompt + validation scenario
autonomous after flow.md: prompt
dependency experimentation: prompt + docs
audit artifacts: prompt + docs + validation scenario
upstream compatibility: native agent registration only, no default loop changes
validation: unit test + typecheck + doctor + scenario
```

- [ ] **Step 3: Check final git diff for unintended files**

Run from repo root:

```bash
git status --short
git diff --stat
```

Expected: only files from this plan plus pre-existing user changes are present. Do not stage or commit unless the user explicitly asks.

---

## Plan self-review

- Spec coverage: native/generic agent, autonomous mode, dependency policy, lab notebook artifacts, validation scenario, and upstream compatibility are all mapped to tasks.
- Placeholder scan: no TBD/TODO/fill-in placeholders.
- Type consistency: native agent is consistently named `augusttrainer`; artifact folder is consistently `augusttrainer/`; metric fixture consistently uses `val_loss` with lower-is-better direction.
