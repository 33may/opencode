## ADDED Requirements

### Requirement: Native AugustResearch agent
The system SHALL provide a native primary agent named `augustresearch` that is separate from `augusttrainer` and available to August sessions launched from any project directory.

#### Scenario: Agent is listed
- **WHEN** an August session lists available agents
- **THEN** `augustresearch` appears as a primary native agent

#### Scenario: AugustTrainer remains separate
- **WHEN** `augustresearch` is registered
- **THEN** the existing `augusttrainer` agent, prompt, launcher, and artifacts are not reused or modified as the AugustResearch workflow

### Requirement: Project-local research workspace
The system SHALL create and maintain an `augustresearch/` folder in the target project for all research artifacts.

#### Scenario: First research run creates notebook
- **WHEN** the user starts AugustResearch for a task in a target project
- **THEN** the target project contains `augustresearch/brief.md`, `augustresearch/source-map.md`, `augustresearch/approach-map.md`, `augustresearch/knowledge-map.md`, `augustresearch/critique-log.md`, `augustresearch/decisions.md`, and `augustresearch/final-bootstrap.md`

### Requirement: Broad source exploration
The system SHALL explore local project context, internet/framework documentation, working GitHub solutions, and multiple architectural approaches before producing its final bootstrap recommendation.

#### Scenario: Source map records evidence
- **WHEN** AugustResearch performs a research round
- **THEN** `augustresearch/source-map.md` records source entries with source type, URL or local path, relevance, extracted evidence, and confidence notes

#### Scenario: GitHub solution mining is represented
- **WHEN** the task has likely existing open-source implementations
- **THEN** AugustResearch records candidate GitHub repositories or code examples and compares their implementation patterns in `augustresearch/approach-map.md`

### Requirement: Council-style critique
The system SHALL run structured critique over candidate approaches before recommending an implementation path.

#### Scenario: Critique log contains disagreement
- **WHEN** AugustResearch compares candidate approaches
- **THEN** `augustresearch/critique-log.md` includes objections, failure modes, counterarguments, unresolved questions, and rejected approaches

#### Scenario: Final recommendation includes alternatives
- **WHEN** AugustResearch writes `augustresearch/final-bootstrap.md`
- **THEN** the report includes the recommended approach, at least two alternatives considered, trade-offs, risks, and reasons for rejection or deferral

### Requirement: Editable prototype workflow
The system SHALL be allowed to edit the target project during research when an edit is part of a logged hypothesis or prototype.

#### Scenario: Prototype edit is logged
- **WHEN** AugustResearch edits a target-project file as part of a prototype
- **THEN** it records the hypothesis, changed files, diff or patch location, result, and keep/discard decision under `augustresearch/`

#### Scenario: User work is protected
- **WHEN** the target project has pre-existing dirty files or secrets-like files
- **THEN** AugustResearch records the dirty state and avoids overwriting, resetting, or editing those files unless the user explicitly instructed it to do so

### Requirement: Autonomous long-running behavior
The system SHALL continue through research and critique rounds without asking whether to continue until the user stops it, a prompt-specified budget is reached, or a real blocker is encountered.

#### Scenario: Round checkpoint is written
- **WHEN** AugustResearch completes a research, critique, or prototype round
- **THEN** it writes enough state under `augustresearch/runs/<run-id>/` and the top-level notebook files for a later invocation to understand what happened

#### Scenario: Resume reads previous state
- **WHEN** AugustResearch starts in a project that already contains `augustresearch/`
- **THEN** it reads the existing artifacts before deciding whether to continue, revise, or finalize the research

### Requirement: Final bootstrap package
The system SHALL produce a final bootstrap package that helps the user or a later implementation agent solve the task.

#### Scenario: Final bootstrap is actionable
- **WHEN** AugustResearch finishes a bounded run
- **THEN** `augustresearch/final-bootstrap.md` contains problem framing, relevant project context, source-backed findings, approach comparison, recommended implementation path, prototype results when any exist, risks, open questions, and next implementation steps

### Requirement: Portable launcher
The system SHALL provide a launcher that can start AugustResearch from the August checkout against any target project directory.

#### Scenario: Launch from outside target project
- **WHEN** the user runs the launcher with `--project /path/to/project`
- **THEN** August starts with the target project as the active directory and uses the `augustresearch` agent

### Requirement: Validation coverage
The implementation SHALL include validation that proves the native agent contract and the artifact contract.

#### Scenario: Package tests cover native agent contract
- **WHEN** package-level tests for agents run
- **THEN** they verify `augustresearch` is native, primary, separate from `augusttrainer`, and contains key prompt guardrails for broad research, critique, edit logging, and resume behavior

#### Scenario: API-first scenario covers artifacts
- **WHEN** the August validation scenario for AugustResearch runs in a fixture project
- **THEN** the scenario asserts that the expected `augustresearch/` files are created and contain evidence of source mapping, approach comparison, critique, and a final bootstrap report
