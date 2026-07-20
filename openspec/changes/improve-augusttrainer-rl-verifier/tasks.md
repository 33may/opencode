## 1. OpenSpec and source synthesis

- [x] 1.1 Create an isolated August worktree from `next` for this change.
- [x] 1.2 Create an isolated PMKK worktree for source inspection without touching the dirty shared checkout.
- [x] 1.3 Inspect current AugustTrainer prompt, launcher, tests, docs, and validation fixture.
- [x] 1.4 Inspect PMKK BC/RL trainer, replay/player/model-run artifacts, and existing `augusttrainer` run evidence.
- [x] 1.5 Record source-backed design risks: suspicious 100% accuracy, train/test leakage, missing validation split, raw accuracy collapse, and replay/live-paper gap.

## 2. OpenSpec artifacts

- [x] 2.1 Add `proposal.md` for `improve-augusttrainer-rl-verifier`.
- [x] 2.2 Add `design.md` with staged BC/RL/verifier architecture and artifact boundaries.
- [x] 2.3 Add delta spec requirements for the upgraded autonomous trainer contract.
- [x] 2.4 Add this task list with implementation and validation steps.

## 3. AugustTrainer contract implementation

- [x] 3.1 Extend `packages/opencode/src/agent/prompt/augusttrainer.txt` with verifier, dashboard, profile, leakage, and promotion-gate requirements.
- [x] 3.2 Update `packages/opencode/test/agent/agent.test.ts` so the native-agent contract asserts the new guardrails.
- [x] 3.3 Update `features/augusttrainer/README.md` with the upgraded artifact contract and verifier workflow.
- [x] 3.4 Add `features/augusttrainer/profiles/prediction-market-rl.md` as a PMKK-style BC-to-RL training blueprint.
- [x] 3.5 Update `features/validation/scenarios/augusttrainer-fake-ml.yaml` to require verifier/dashboard artifacts in bounded validation mode.

## 4. Validation

- [x] 4.1 From `packages/opencode`, run `bun test test/agent/agent.test.ts --timeout 30000`.
- [x] 4.2 From `packages/opencode`, run `bun typecheck` if local time/dependency state permits.
- [x] 4.3 From repo root, run `./scripts/validate-scenario features/validation/scenarios/augusttrainer-fake-ml.yaml` when real-model validation is available.
- [x] 4.4 Inspect final `git diff --stat` in the isolated August worktree.

## 5. Handoff

- [x] 5.1 Write AugustResearch artifacts in the PMKK project with source map, approach map, critique, decisions, and final bootstrap.
- [x] 5.2 Summarize exact worktree paths, changed files, validation results, and remaining validation.
