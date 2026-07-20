# Design

```text
target project data / simulator / trainer commands
  -> AugustTrainer flow.md profile contract
  -> baseline run + immutable provenance snapshot
  -> hypothesis run(s) with logs/checkpoints/plots
  -> verifier pass over metrics, split safety, diff scope, artifacts, and suspicious scores
  -> promotion gate: offline metric -> replay/sim P&L -> stress/live-paper -> capped real market
  -> results.tsv/jsonl + dashboard.md + verifier.md + run verification.md
```

## What we are building

This change upgrades AugustTrainer from a generic scalar-metric optimizer into an autonomous ML/RL training operator. It still works for small supervised projects, but it must now explicitly model how model quality is proven: data provenance, split safety, baseline comparisons, verifier critique, richer plots, and profile-specific promotion gates.

For the PMKK-style use case, the trainer must support this staged interpretation:

```text
deterministic arb bot labels
  -> behavior cloning baseline
  -> simulator/domain-randomized fill model RL adaptation
  -> replay P&L evaluation
  -> live-paper shadow run
  -> capped real-market validation
```

## Why the boundary exists

AugustTrainer remains a native agent prompt and documentation feature, not a new Python scheduler. The first safe step is to make the operating contract strong enough that the agent can run overnight without trusting a misleading scalar. A future change can add a structured runtime or scheduler, but the prompt/test/docs contract is the smallest August-native boundary that works across arbitrary ML projects.

The verifier is an artifact-level role, not a separate always-running service in this change. That keeps the implementation portable while still forcing every kept result to be attacked before promotion.

## Module/file responsibilities

- `packages/opencode/src/agent/prompt/augusttrainer.txt`: canonical autonomous trainer contract. It defines artifacts, discovery, baseline, hypothesis loop, verifier protocol, RL/IL profile expectations, promotion gates, and validation-mode bounds.
- `packages/opencode/test/agent/agent.test.ts`: deterministic contract test that fails if the prompt drops verifier, leakage, dashboard, profile, or promotion language.
- `features/augusttrainer/README.md`: user-facing description of the upgraded workflow and the new artifacts.
- `features/augusttrainer/profiles/prediction-market-rl.md`: concrete profile blueprint for PMKK-like arbitrage training.
- `features/validation/scenarios/augusttrainer-fake-ml.yaml`: bounded validation scenario now expects verifier/dashboard artifacts in addition to the original lab notebook.

## How data moves through the system

The target project still owns data loading and model training. AugustTrainer discovers commands, then records the command, commit, dirty status, dataset identifiers, split details, seeds, and artifacts before and after each run. Metrics are parsed only according to `flow.md`, but a verifier pass must re-read the source metric artifacts and confirm that the decision did not depend on protected files, test leakage, or a suspicious headline metric.

For trading/RL projects, scalar training loss is not the final objective. Offline BC metrics decide whether the policy is worth replay. Replay and simulator runs emit decisions/fills/portfolio traces, which feed P&L plots and dashboard summaries. Live-paper/real-market results are promotion evidence, never hyperparameter-tuning targets.

## What gets kept, retired, or rebuilt

Kept:
- `flow.md`, `hypothesis-map.md`, `results.tsv`, `results.jsonl`, and per-run artifacts.
- Single-command project discovery and bounded hypothesis edits.
- Validation-mode semantics.

Added:
- `verifier.md`, `dashboard.md`, per-run `verification.md`, and optional `plots/`.
- Profile and promotion-gate requirements.
- Strict suspicion handling for 100% metrics, missing validation splits, and raw-accuracy-only results.

Retired as a success criterion:
- Any single raw scalar such as accuracy without verifier review and profile-specific safety metrics.
- Tuning decisions based on test, paper, live, or real-market results.

## Tests and validation

- Package test: agent prompt contract includes the new required guardrail terms.
- Scenario validation: fake ML run still does one baseline and one hypothesis, but must create verifier/dashboard artifacts and stop after the bounded iteration.
- Manual artifact review: inspect OpenSpec files and generated docs to confirm PMKK-specific objective and verifier guidance are represented.

## Final command or usage shape

```bash
scripts/augusttrainer --project /path/to/pmkk \
  "Use the prediction-market RL profile. Start from BC labels, verify split safety, then optimize replay/live-paper P&L gates before any real-market promotion."
```

The profile is prompt-driven in this change; no new launcher flag is required yet.
