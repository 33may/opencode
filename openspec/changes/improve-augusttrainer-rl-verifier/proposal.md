## Why

AugustTrainer currently provides a generic autonomous metric loop: discover one train/eval command, run a baseline, try one bounded hypothesis at a time, and keep metric improvements. That is useful for toy supervised projects, but it is not yet enough for week-long autonomous ML/RL training where the user expects trustworthy models, realistic replay/P&L evaluation, and critical verification of suspicious results.

The PMKK arbitrage project exposed the gap. A previous BC run reported `exact_vector_accuracy=1.0` and `ready_for_rl_warmstart=true`, but the result needs stronger verification: split provenance, non-HOLD/action-rate checks, replay P&L, live-paper shadow metrics, and a critical verifier that can reject leakage or metric gaming. The target training workflow is BC from deterministic bot labels, then RL fine-tuning in a market simulator with domain-randomized fill probability, and final validation through replay/live-paper/real-market performance.

## What Changes

- Extend AugustTrainer's prompt contract from a single scalar metric loop into a staged autonomous trainer with explicit profiles, verifier review, richer artifacts, and promotion gates.
- Require a project-local verifier artifact that independently audits metric parsing, protected-file scope, data provenance, split leakage, suspiciously perfect scores, and keep/revert decisions.
- Require experiment dashboards/plots and multi-axis results, especially P&L/equity/drawdown/fill/action logs for RL or trading projects.
- Add a prediction-market RL profile documenting the BC -> simulator RL -> replay -> live-paper -> capped live promotion ladder.
- Update tests and validation scenario expectations so the native agent contract includes verifier, leakage, profile, dashboard, and promotion-gate guardrails.

## Capabilities

### New Capabilities

- `augusttrainer-autonomous-ml-verifier`: AugustTrainer runs an auditable multi-stage ML/RL loop with verifier critique, leakage checks, dashboards, and promotion gates.

### Modified Capabilities

- `augusttrainer-autoresearch`: The existing AugustTrainer lab notebook remains compatible, but the required artifact contract expands with verifier and dashboard outputs.

## Impact

- Native agent prompt: `packages/opencode/src/agent/prompt/augusttrainer.txt`.
- Agent contract tests: `packages/opencode/test/agent/agent.test.ts`.
- Feature documentation and profile docs under `features/augusttrainer/`.
- Existing validation scenario expectations for `augusttrainer-fake-ml`.
- No changes to upstream OpenCode default agents, no PMKK production code changes, and no real-market execution changes in this OpenSpec change.
