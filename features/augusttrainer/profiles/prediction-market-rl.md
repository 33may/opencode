# AugustTrainer Profile: Prediction-Market RL

Use this profile for projects like PMKK where a deterministic arbitrage bot produces expert-like labels, a behavior-cloning model is used as a safe baseline, and reinforcement learning later adapts execution in a simulator before any real-market validation.

```text
captured market data + deterministic bot decisions
  -> leakage-safe BC train/val/test materialization
  -> BC baseline and verifier audit
  -> simulator RL fine-tune with domain-randomized fills/frictions
  -> historical replay P&L and stress validation
  -> live-paper shadow run
  -> capped real-market validation with explicit approval
```

## Flow requirements

`augusttrainer/flow.md` should record:

- profile: `prediction-market-rl`
- data source, manifest, materializer config hash, split unit, date/episode ranges, and split row/action counts
- protected sources: raw capture DBs/parquet, validation/test shards, real-market order code, secrets, HF tokens, and metric parser semantics
- baseline comparators: no-trade, deterministic bot, all-HOLD/no-action classifier, action-rate-matched random baseline, and current best checkpoint when available
- simulator settings: fees, spread, latency, fill probability model, position/inventory caps, bankroll, lot size, and domain-randomization ranges
- replay/live-paper commands and output directories
- promotion gates from BC to RL, replay, live-paper, and capped live validation

## BC stage metrics

Do not headline raw accuracy. The verifier should require:

- exact non-HOLD precision/recall/F1
- predicted action rate vs true action rate
- invalid or naked-leg rate
- A/B co-fire rates or equivalent basket-safety metrics
- per-leg precision/recall/F1
- failure rows: false positives, missed actions, naked legs, wrong vectors
- leakage audit for train/val/test episode/time/sample disjointness

Perfect BC scores are suspicious by default. They require split-provenance evidence, baseline comparisons, and replay evidence before the run can be treated as more than a memorization/smoke milestone.

## RL simulator stage metrics

The RL objective should be measured as a bundle:

- realized P&L, final equity, max drawdown, and equity curve stability
- fill/rejection/killed order counts and reasons
- action counts, inventory exposure, bankroll/cap violations, and overtrading rate
- reward, eval reward, episode length, policy loss/value loss/KL where available
- deterministic and stochastic policy evaluations on separate evaluation environments
- stress/domain-randomized runs across fill probability, fees, spread, latency, and liquidity

BC-to-RL transfer must include a no-forgetting gate: the initialized policy should not immediately degrade below the BC baseline, deterministic bot baseline, or no-trade baseline on held-out replay.

## Promotion ladder

Use this as the default ladder unless the project has stricter rules:

1. **BC candidate**: passes verifier, non-HOLD/action-rate/safety gates, and row-level failure audit.
2. **RL candidate**: beats BC/deterministic/no-trade baselines in simulator with multiple seeds and stress randomization.
3. **Replay candidate**: produces positive or risk-adjusted useful P&L on held-out replay without unsafe fills or inventory behavior.
4. **Live-paper candidate**: shadows the live market for a bounded duration with full decision/fill/portfolio logs and no real venue orders.
5. **Capped live candidate**: requires explicit user approval, small bankroll/lot/cap limits, rollback criteria, and monitoring artifacts.

Test, paper, live-paper, and capped live metrics are not hyperparameter-tuning targets. They are gates for promotion or rollback.

## Required artifacts

Each run should leave pointers in `dashboard.md` to:

- train/eval command and config
- metrics JSON/history JSONL
- checkpoint(s), including best and final when applicable
- verifier result
- plots: BC curves, confusion/failure summaries, reward curves, P&L/equity/drawdown
- replay/live-paper summaries: decisions, fills, portfolio snapshots, command manifest, and logs
