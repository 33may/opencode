## Context

August is a downstream OpenCode harness. It already has a native `augusttrainer` agent for ML experiment loops, a portable `scripts/august` wrapper that preserves the caller working directory, `scripts/august init` for project-local setup, and an API-first validation harness. This change adds a separate general research stack for difficult implementation tasks: the user starts it in any project folder, gives it a task, and expects it to research broadly, critique heavily, optionally prototype edits, and leave behind a structured bootstrap package.

```text
target data flow diagram

user task in target project
  -> scripts/augustresearch or august run --agent augustresearch
  -> native augustresearch primary agent
  -> project-local augustresearch/ workspace
       brief.md
       source-map.md
       approach-map.md
       knowledge-map.md
       critique-log.md
       decisions.md
       final-bootstrap.md
       runs/<run-id>/
  -> research lanes
       local codebase lane
       internet/framework docs lane
       GitHub working-solutions lane
       architecture/options lane
       adversarial critique lane
       prototype/edit lane
  -> council synthesis rounds
  -> final bootstrap package for the human or later implementation agent
```

The boundary exists so AugustResearch can be an editable research workflow without becoming AugustTrainer, a daemon, or a replacement for implementation agents. The output is a project-local research notebook that can be committed, reviewed, resumed, or discarded like any other project artifact.

## Goals / Non-Goals

**Goals:**

- Introduce a native `augustresearch` primary agent separate from `augusttrainer`.
- Make the workflow work from any folder launched through the August wrapper.
- Create and maintain a project-local `augustresearch/` workspace with inspectable artifacts.
- Explore wide source classes: local code, internet/docs, GitHub implementations, competing architectures, and known failure modes.
- Use council-style critique with explicit disagreement, approach comparison, and stress tests.
- Allow target-project edits and prototypes when each edit is tied to a logged hypothesis, diff, and decision.
- Support long-running sessions by checkpointing after each research round and resuming from existing artifacts.
- Validate the native agent contract and generated research artifacts through package tests and an API-first scenario.

**Non-Goals:**

- Do not modify or replace AugustTrainer.
- Do not create a background daemon, scheduler, queue service, or always-on runtime in the MVP.
- Do not guarantee every internet/GitHub source is correct; the system must record evidence and critique confidence instead.
- Do not silently perform destructive edits, reset user work, edit secrets, or hide failed prototype attempts.
- Do not change upstream OpenCode default agents or behavior outside the new AugustResearch feature.

## Decisions

### Decision 1: Native primary agent, not project-local skill only

AugustResearch will be registered as a native primary agent with its own prompt file and permissions. A skill-only workflow would be easier to add, but native registration makes the agent available in any folder through the August wrapper and allows package tests to assert the contract. An external Python/LangGraph/CrewAI runtime would add power but would be less portable, harder to merge with upstream, and unnecessary for the MVP.

### Decision 2: Markdown workspace as the control and audit surface

The agent will create `augustresearch/` in the target project and keep the canonical state in Markdown plus lightweight machine-readable files when useful. This mirrors the successful AugustTrainer lab-notebook pattern but uses a separate folder and research-specific artifacts. Markdown keeps the system transparent to the user and portable across projects without a database.

### Decision 3: Council-style lanes through existing OpenCode subagent/tooling

The primary agent prompt will require multiple lanes: local codebase, internet/docs, GitHub solutions, architecture/options, adversarial critique, and prototype/edit. The implementation can use existing `task` subagents such as `explore` and `general` for independent work instead of hard-coding a new orchestration service. The key product contract is the lane output and critique structure, not the exact runtime topology.

### Decision 4: Editable research with hypothesis-bound guardrails

AugustResearch is not read-only. It may edit the target project while researching, but every edit must be attached to a logged hypothesis or prototype, saved as a diff/patch, and summarized in `decisions.md`. It must inspect git state first, avoid overwriting pre-existing dirty work, protect secrets and evaluation-critical files unless the user explicitly asks otherwise, and avoid destructive commands such as blind `git reset --hard`.

### Decision 5: Long-running without a daemon

The MVP will run as a normal OpenCode/August session and continue until the user stops it, a prompt-specified budget is reached, or a real blocker appears. The resumability story is artifact-first: every round checkpoints into `augustresearch/`, and a later invocation must read the existing folder before continuing. A dedicated queue/daemon can be a later feature if this proves useful.

### Decision 6: Modular August extension point first

The implementation should prefer a prompt file, agent registry entry, script launcher, docs, tests, and validation scenario. Core OpenCode behavior should remain unchanged. If permissions require a native agent entry to allow GitHub repository exploration tools, keep that change localized to the new `augustresearch` agent.

## Risks / Trade-offs

- Runaway edits or damaged user work → Mitigate with git-state inspection, hypothesis logs, patch artifacts, dirty-work protection, and no destructive reset policy.
- Token/cost growth from wide research → Mitigate with round budgets, checkpoint summaries, source maps, and final synthesis compression.
- Hallucinated or low-quality sources → Mitigate with source classification, citations/URLs, cross-source comparison, and explicit confidence/uncertainty fields.
- Council theater without real critique → Mitigate with required adversarial critique entries, unresolved questions, rejected approaches, and final risk register.
- Upstream merge risk → Mitigate by keeping changes August-scoped and avoiding shared OpenCode default-agent behavior changes.
- Portability gaps → Mitigate by using the existing `scripts/august` cwd-preserving wrapper and avoiding OS-specific assumptions beyond existing August shell-script conventions.

## Migration Plan

1. Add native agent prompt and registry entry for `augustresearch`.
2. Add a launcher script that targets any project directory through `scripts/august run --dir ... --agent augustresearch`.
3. Add feature docs under `features/augustresearch/`.
4. Add package tests for native-agent availability, separation from AugustTrainer, permissions, and prompt guardrails.
5. Add a validation scenario with a tiny project where AugustResearch writes the expected artifacts and performs a bounded prototype/edit round.
6. If rollback is needed, remove the agent registration, prompt, launcher, docs, tests, and validation scenario; no existing August/OpenCode behavior should depend on the feature.

## Open Questions

- Whether to add dedicated native subagents for research lanes after the MVP, or keep using the existing `general` and `explore` subagents.
- Whether future long-running support should become a resumable background job service once the artifact-first workflow is proven.
