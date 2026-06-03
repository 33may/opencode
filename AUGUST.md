# August

August is my downstream OpenCode-based harness. OpenCode is the base, but this repository is the August product/codebase.

Development model:

```text
sst/opencode upstream/main  ->  merge periodically  ->  August next  ->  push to 33may/opencode
```

August can directly modify OpenCode internals, backend, agents, session systems, providers, UI, and workflows. Upstream OpenCode is a source of new features and fixes, not the product owner of this codebase.

## Core workflow

```bash
# develop August
./scripts/august

git add .
git commit -m "feat: add august feature"
git push origin next

# periodically absorb upstream OpenCode
git fetch upstream
git checkout next
git merge upstream/main
# resolve conflicts, test
git push origin next
```

## First-run checks

```bash
./scripts/doctor.sh
./scripts/august agent list --pure
```

## Initialize another project

Use the local August checkout as an OpenCode wrapper in any project:

```bash
cd /path/to/other-project
/path/to/august/scripts/august init
/path/to/august/scripts/august
```

This installs project-local August/OpenCode defaults plus OpenSpec OPSX commands and skills. See `features/august-init/README.md`.

## Autonomous research

Use AugustResearch for broad implementation research, GitHub/web/local source mapping, council critique, bounded prototype edits, and final handoff packages:

```bash
/path/to/august/scripts/augustresearch --project /path/to/project "Research feature X and write a bootstrap plan."
```

It creates a project-local `augustresearch/` notebook. See `features/augustresearch/README.md`.

## Validation

August uses an API-first validation harness for feature-independent real-model scenarios. See `features/validation/README.md`.

```bash
./scripts/validate-scenario features/validation/scenarios/baseline-readme.yaml
```
