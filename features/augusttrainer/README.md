# AugustTrainer

AugustTrainer is an autonomous ML autoresearch agent. It runs inside any training project, discovers the train/eval flow, writes an `augusttrainer/` lab notebook, and keeps trying model improvements until stopped. It is designed for overnight work, so every improvement must be auditable: metrics, plots, verifier critique, and promotion gates are written to disk rather than trusted from the conversation.

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
  verifier.md
  dashboard.md
  results.tsv
  results.jsonl
  plots/
  runs/<run-id>/
    verification.md
```

`flow.md` is the contract. Review or edit it to steer later runs: profile, train command, metric, data provenance, split policy, editable files, protected files, dependency policy, timeout, verifier protocol, dashboard artifacts, promotion gates, and keep/revert rules.

## Verifier and suspicious results

AugustTrainer must attack its own result before keeping it. Each run writes a per-run `verification.md` and updates `verifier.md` with checks for:

- metric parser/source consistency
- changed files and protected-file safety
- dataset provenance, hashes, and split leakage risk
- baseline comparisons such as no-op, majority class, heuristic, or production policy
- suspiciously perfect metrics such as 100% accuracy or 100% success rate
- artifact completeness and whether the model is only kept, or also eligible for promotion

Do not treat raw accuracy, train reward, test results, paper/live-paper results, or real-market P&L as a hyperparameter-tuning target. Later-stage metrics are promotion and monitoring evidence.

## Profiles and trading/RL workflows

`flow.md` should name a profile. The default is `generic-supervised`; specialized projects can use a profile section to define metrics and gates. See:

```text
features/augusttrainer/profiles/prediction-market-rl.md
```

The prediction-market RL profile frames the ladder as behavior cloning from deterministic bot labels, simulator/domain-randomized RL adaptation, replay P&L, live-paper shadow validation, and capped real-market validation only after explicit approval.

## Dashboards and plots

`dashboard.md` is the current-state page for humans and future agents. It should link to loss curves, validation metrics, confusion/failure summaries, reward curves, P&L/equity/drawdown plots, order/fill traces, checkpoints, and the verifier verdict.

## Dependency experiments

AugustTrainer may install dependencies when a logged hypothesis needs a new model, optimizer, kernel, metric, or training utility. It records the exact install command and keeps dependency changes only when the metric improves.

## Stopping

Stop the running August process externally when you want the overnight loop to end. The latest state is in `augusttrainer/results.tsv`, `augusttrainer/results.jsonl`, and `augusttrainer/decisions.md`.
