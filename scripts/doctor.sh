#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== August doctor =="
echo "root: $ROOT"

git status --short --branch

echo
printf "bun: "
bun --version
printf "august/opencode: "
./scripts/august --version

echo
./scripts/august agent list --pure | grep -E '^(august|build|plan|general|explore) ' || true
