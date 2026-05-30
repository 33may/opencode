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
