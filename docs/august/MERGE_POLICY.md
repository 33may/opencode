# August merge policy for OpenCode fork

When merging `upstream/main` into `next`:

1. Preserve upstream fixes and API changes.
2. Preserve August extension points and documented feature contracts.
3. If a conflict touches an August feature, update the corresponding `features/<feature>/affected-files.md` in the root August repo.
4. Run at minimum:
   - `bun install`
   - `bun --conditions=browser packages/opencode/src/index.ts --version`
   - from the August root: `./scripts/doctor.sh`
