# AugustResearch

AugustResearch is an autonomous research and bootstrap agent for hard implementation work. It runs inside any target project, researches local code, web/framework docs, and working GitHub solutions, critiques competing approaches, may make safe hypothesis-bound prototype edits, and leaves a project-local `augustresearch/` handoff notebook.

## How it differs from AugustTrainer

AugustTrainer is for ML experiment loops: discover train/eval flow, run hypotheses, track metrics, and improve a model.

AugustResearch is for general software research and implementation bootstrapping: map the problem, compare approaches, mine external examples, stress-test the recommendation, and prepare a later implementation agent or human to ship the work.

They are separate native agents with separate launchers and separate artifact folders:

```text
augusttrainer/    ML lab notebook and metric loop
augustresearch/   research notebook, critique log, prototype log, final bootstrap
```

## Start from an August checkout

```bash
scripts/augustresearch --project /path/to/project "Research the best way to add feature X and prepare an implementation bootstrap."
```

Optional model override:

```bash
scripts/augustresearch --project /path/to/project --model anthropic/claude-sonnet-4-6
```

If no prompt is provided, the launcher starts a general autonomous research run for the target project.

## Start with the regular August CLI

```bash
august run --dir /path/to/project --agent augustresearch "Research feature X and write augustresearch/final-bootstrap.md."
```

For unattended runs where you want permission prompts auto-approved, pass `--dangerously-skip-permissions` to `scripts/augustresearch` or the regular August CLI. Review the target worktree before and after such runs. The agent prompt still requires dirty-work inspection, no destructive reset, no secret edits, and hypothesis-bound prototype logging.

## What it creates

```text
augustresearch/
  brief.md
  source-map.md
  approach-map.md
  knowledge-map.md
  critique-log.md
  decisions.md
  final-bootstrap.md
  runs/<run-id>/
```

The top-level files are cumulative and readable. `runs/<run-id>/` stores per-run checkpoints, scratch notes, copied summaries, and prototype logs.

## Prototype edits

AugustResearch is not read-only. It may edit the target project when an edit directly tests a hypothesis or provides useful bootstrap evidence.

Every prototype edit should be recorded under `augustresearch/` with:

- the hypothesis being tested
- intended files and risk level
- changed files and diff or patch summary
- validation command and result
- keep/discard decision

It must not overwrite existing dirty work, reset the repo, mass-delete files, or edit secrets/evaluation-critical files unless the user explicitly asked for that scope.

## Stop and resume

Stop the running August process externally when you want the research loop to end. The latest state is in `augustresearch/`.

To resume, run `scripts/augustresearch --project /path/to/project "Resume the previous AugustResearch run and continue from the artifacts."` The agent is required to read existing `augustresearch/` artifacts before deciding whether to continue, revise, or finalize.

## Review the final bootstrap

Review `augustresearch/final-bootstrap.md` before handing work to an implementation agent. It should include:

- problem framing and success criteria
- strongest source-backed findings
- approach comparison and rejected alternatives
- council critique results and mitigations
- prototype edits and validation outcomes
- risks, upstream compatibility notes, open questions, and next implementation steps
