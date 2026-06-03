## Why

August needs a general-purpose autonomous research stack that can bootstrap difficult implementation work before the user starts solving it. The existing AugustTrainer feature is ML-experiment specific; this change introduces a separate AugustResearch workflow for broad technical research, working GitHub-solution discovery, knowledge structuring, critique, and optional prototype edits in any project folder.

## What Changes

- Add an AugustResearch agent/workflow that runs independently from AugustTrainer.
- Create a project-local `augustresearch/` research workspace where every run records its brief, source map, approach map, knowledge map, critique log, decisions, prototypes, and final bootstrap report.
- Allow AugustResearch to inspect and edit the target project when edits are part of a logged research hypothesis or prototype, rather than making the workflow read-only.
- Require wide exploration across internet sources, existing GitHub implementations, project-local code, framework docs, and alternate architectural approaches.
- Require council-style critique cycles so candidate approaches are stress-tested before the final recommendation.
- Add a portable launcher and documentation so the stack works from any folder started through the August wrapper.
- Add validation coverage that checks the agent contract and the generated research workspace artifacts.

## Capabilities

### New Capabilities

- `augustresearch-autonomous-stack`: Autonomous, editable, council-style research workflow that explores broad sources, critiques approaches, structures knowledge, and produces a final bootstrap package for implementation tasks.

### Modified Capabilities

None.

## Impact

- Native agent registry and prompt files under `packages/opencode/src/agent/`.
- August wrapper scripts under `scripts/` for launching the research stack from arbitrary project directories.
- Project initialization and feature documentation where needed so initialized projects know how to invoke AugustResearch.
- Validation scenarios and tests for native-agent availability, prompt guardrails, and generated `augustresearch/` artifacts.
- No intended changes to upstream OpenCode default behavior, AugustTrainer behavior, or the normal build/plan/general/explore agents.
