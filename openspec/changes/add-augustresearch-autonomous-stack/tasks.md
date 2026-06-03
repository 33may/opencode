## 1. Native agent contract

- [x] 1.1 Modify `packages/opencode/test/agent/agent.test.ts` to add failing assertions that the default native agent list contains `augustresearch`.
- [x] 1.2 Add an `augustresearch` agent contract test in `packages/opencode/test/agent/agent.test.ts` that verifies it is native, primary, distinct from `augusttrainer`, and its prompt contains the `augustresearch/` workspace, broad source exploration, GitHub solution mining, council critique, editable prototype logging, resume behavior, and final bootstrap guardrails.
- [x] 1.3 Add permission assertions in the same test for the expected autonomous research posture: edit/bash/web tools available through the normal merged ruleset, `question` denied by default, and repository exploration permissions allowed if the implementation uses OpenCode repo tools for GitHub solution mining.
- [x] 1.4 From `packages/opencode`, run `bun test test/agent/agent.test.ts --timeout 30000` and confirm the new tests fail before implementation.

## 2. Native AugustResearch implementation

- [x] 2.1 Create `packages/opencode/src/agent/prompt/augustresearch.txt` with the full AugustResearch operating contract: autonomous mode, required `augustresearch/` artifacts, research lanes, council critique protocol, source quality rules, editable prototype rules, dirty-work protection, checkpoint/resume behavior, validation mode, and final bootstrap output.
- [x] 2.2 Modify `packages/opencode/src/agent/agent.ts` to import the new prompt and register a native primary `augustresearch` agent without changing `augusttrainer` or upstream default agent behavior.
- [x] 2.3 Configure the `augustresearch` native agent permissions narrowly for the feature: preserve normal edit/bash/web access, deny unsolicited `question`, and allow repo exploration tools only when needed for working GitHub solution discovery.
- [x] 2.4 From `packages/opencode`, rerun `bun test test/agent/agent.test.ts --timeout 30000` and confirm the native agent tests pass.

## 3. Launcher and user documentation

- [x] 3.1 Create `scripts/augustresearch` as a portable launcher that accepts `--project DIR`, optional `--model provider/model`, and remaining prompt text, then invokes `scripts/august run --dir <project> --agent augustresearch --title "augustresearch: <project>" ...`.
- [x] 3.2 Document the feature in `features/augustresearch/README.md`, including how it differs from AugustTrainer, how to start it from any folder, what artifacts it creates, how prototype edits are logged, how to stop/resume long runs, and how to review `final-bootstrap.md`.
- [x] 3.3 Update `AUGUST.md` or another existing August feature index only if needed to make the new launcher discoverable without duplicating the full feature docs.
- [x] 3.4 If `scripts/doctor.sh` currently filters the agent list too narrowly for August-native agents, update that filter so `augustresearch` can appear in first-run checks without hiding existing expected agents.

## 4. Validation fixture and scenario

- [x] 4.1 Create a tiny fixture project under `features/validation/fixtures/augustresearch-bootstrap/` with a README and one editable source/config file that can support a bounded research/prototype task.
- [x] 4.2 Create `features/validation/scenarios/augustresearch-bootstrap.yaml` that runs AugustResearch in validation mode with a bounded prompt requiring source mapping, at least two approaches, critique, one safe prototype edit, and final bootstrap output.
- [x] 4.3 Use scenario hard assertions for `expected.files_exist` covering `augustresearch/brief.md`, `source-map.md`, `approach-map.md`, `critique-log.md`, `decisions.md`, and `final-bootstrap.md`.
- [x] 4.4 Use scenario hard assertions for `expected.files_contain` covering stable artifact tokens such as `GitHub`, `approach`, `critique`, `prototype`, `recommended`, and the validation prompt's final sentinel if one is used.
- [x] 4.5 Add or update package-level deterministic tests only if the validation harness needs new assertion support for the AugustResearch scenario.

## 5. Feature verification

- [x] 5.1 From repo root, run `./scripts/doctor.sh` and record the output relevant to agent availability.
- [ ] 5.2 From `packages/opencode`, run `bun typecheck` and confirm it passes. Blocked: current working tree has unrelated untracked `packages/opencode/test/august/dictation.test.ts` type errors.
- [x] 5.3 From `packages/opencode`, run `bun test test/agent/agent.test.ts --timeout 30000` and confirm it passes.
- [x] 5.4 From repo root, run `./scripts/validate-scenario features/validation/scenarios/augustresearch-bootstrap.yaml` when real-model validation is available; if the environment blocks long model scenarios, record the blocker and inspect deterministic artifact/test evidence instead.
- [x] 5.5 Manually inspect the generated `augustresearch/` artifacts from the validation run and verify they satisfy every requirement in `openspec/changes/add-augustresearch-autonomous-stack/specs/augustresearch-autonomous-stack/spec.md`.

## 6. Shipping notes and memory

- [x] 6.1 Update `.august/memory/MEMORY.md` after implementation validation with a concise shipped-feature note for AugustResearch, including launcher name, artifact folder, and validation scenario name.
- [x] 6.2 Re-read `openspec/changes/add-augustresearch-autonomous-stack/proposal.md`, `design.md`, `specs/augustresearch-autonomous-stack/spec.md`, and this `tasks.md`; verify each requirement has matching implementation and evidence.
- [x] 6.3 Prepare the final summary with files changed, validation commands/evidence, how to use `scripts/augustresearch`, upstream compatibility risks, and known limitations.
