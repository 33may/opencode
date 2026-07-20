## ADDED Requirements

### Requirement: Verifier-reviewed training decisions
AugustTrainer SHALL require every kept training result to pass an explicit verifier review before it is treated as an improvement or promotion candidate.

#### Scenario: Verifier artifact is written
- **WHEN** AugustTrainer records a baseline or hypothesis run
- **THEN** it writes a verifier summary covering metric parsing, changed/protected files, data provenance, split safety, artifact completeness, suspicious scores, and the keep/revert decision

#### Scenario: Suspicious perfect metrics are challenged
- **WHEN** a run reports a perfect or near-perfect headline metric such as 100% accuracy
- **THEN** the verifier challenges the result with leakage checks, baseline comparisons, non-headline metrics, and artifact inspection before allowing a keep decision

### Requirement: Multi-axis ML/RL objective tracking
AugustTrainer SHALL support profile-specific objective bundles instead of relying on one raw scalar when the project has richer validation evidence.

#### Scenario: Trading/RL run records P&L evidence
- **WHEN** the project profile is trading or RL
- **THEN** the run dashboard includes P&L/equity, drawdown, action counts, fills/rejections, replay or simulator identifiers, and the primary scalar used for optimization

#### Scenario: Offline metric is not final deployment proof
- **WHEN** a BC or offline RL metric improves
- **THEN** AugustTrainer records the next replay/simulator/paper/live validation stage and does not mark the model deployable solely from the offline metric

### Requirement: Profile-driven autonomous training flow
AugustTrainer SHALL let `flow.md` identify a training profile that defines required metrics, protected files, baselines, artifacts, and promotion gates.

#### Scenario: Profile is recorded
- **WHEN** AugustTrainer writes `flow.md`
- **THEN** it records the selected profile or `generic-supervised`, plus profile-specific editable files, protected files, metrics, and validation commands

#### Scenario: Prediction-market RL profile supports BC-to-RL
- **WHEN** the selected profile is prediction-market RL
- **THEN** AugustTrainer frames the ladder as BC labels, simulator/domain-randomized RL fine-tuning, replay P&L, live-paper shadow validation, and capped real-market validation

### Requirement: Leakage and evaluation integrity gates
AugustTrainer SHALL treat dataset splits, validation/test artifacts, metric parser semantics, secrets, and real-market execution controls as protected unless explicitly allowed by `flow.md`.

#### Scenario: Missing safe validation blocks promotion
- **WHEN** a project lacks explicit validation/test split provenance or uses train metrics for model selection
- **THEN** AugustTrainer records the blocker and does not claim generalization or promotion readiness

#### Scenario: Test/paper/live metrics are not tuning targets
- **WHEN** AugustTrainer observes test, paper, live-paper, or real-market metrics
- **THEN** it uses them only as promotion or monitoring evidence, not as hyperparameter search feedback

### Requirement: Dashboard and plot artifacts
AugustTrainer SHALL maintain human-readable and machine-readable training dashboards for long autonomous runs.

#### Scenario: Dashboard summarizes run history
- **WHEN** AugustTrainer finishes a run
- **THEN** `augusttrainer/dashboard.md` or an equivalent dashboard artifact summarizes current best, trend, blockers, next experiment, plots/log paths, and verifier status

#### Scenario: Plots are required when data exists
- **WHEN** a run emits a metric history, equity curve, portfolio trace, or replay/live-paper trace
- **THEN** AugustTrainer preserves or generates plots/log references sufficient to inspect performance over time
