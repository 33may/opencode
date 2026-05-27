# August downstream notes

This fork is the OpenCode engine for August.

Branches:
- `next`: integration branch for latest upstream OpenCode plus August changes.
- `main`: stable fork branch inherited from GitHub fork until promoted.
- `upstream/main`: source of truth from `sst/opencode`.

Policy:
- Keep August-specific core changes small and documented.
- Prefer upstream behavior during conflict resolution unless an August feature explicitly overrides it.
- Upstream generic extension points when possible.
