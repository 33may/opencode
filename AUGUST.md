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

## Validation

August uses an API-first validation harness for feature-independent real-model scenarios. See `features/validation/README.md`.

```bash
./scripts/validate-scenario features/validation/scenarios/baseline-readme.yaml
```
