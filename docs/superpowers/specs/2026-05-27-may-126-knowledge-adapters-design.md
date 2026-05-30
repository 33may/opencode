# MAY-126 Knowledge Backend Adapters Design

## Goal

Design August's project knowledge adapter boundary so the first knowledge cache can use August-native memory notes by default and optionally enrich them with Graphify for document/media graphs. CodeGraph is intentionally out of scope for this issue and should be handled as a separate future code-intelligence feature.

## Decision

August should treat project knowledge as a small, stable contract rather than a hard dependency on any one external graph runtime.

The first adapter set is:

1. `plain` — the default adapter. It reads repo-local and user-approved text sources: `AGENTS.md`, `AUGUST.md`, `docs/`, `features/`, `.august/knowledge/`, and reviewed memory notes. It produces simple cited markdown sections.
2. `graphify` — an optional adapter for richer document/media knowledge. It may index or query docs, PDFs, screenshots, diagrams, and raw notes when Graphify is installed/configured.

`codegraph` is a non-goal here. Symbol search, callers/callees, impact analysis, and code graph queries should stay in a separate CodeGraph feature so the document-memory layer does not become coupled to code-intelligence tooling.

## Adapter contract

Each adapter should eventually expose the same conceptual operations:

```ts
type KnowledgeAdapter = {
  id: "plain" | "graphify"
  status(): Promise<KnowledgeAdapterStatus>
  refresh(input: KnowledgeRefreshInput): Promise<KnowledgeRefreshResult>
  summarize(input: KnowledgeSummarizeInput): Promise<KnowledgeSummary>
}
```

The contract is descriptive for this issue; implementation can refine exact TypeScript types later. The important boundary is that August asks adapters for project knowledge and receives cited summaries, not raw hidden memory.

## Data flow

`august knowledge refresh` should eventually run like this:

```text
project files + reviewed notes
        |
        v
plain adapter -----------+
                         |
optional Graphify adapter+--> .august/knowledge/map.md
                         |    .august/knowledge/sources.json
                         |    .august/knowledge/adapters.json
```

The generated cache must stay inspectable. Markdown is the human-readable output; JSON records source paths, adapter status, timestamps, and warnings.

## Config shape proposal

The future config surface should be small and optional:

```jsonc
{
  "august": {
    "knowledge": {
      "adapters": ["plain", "graphify"],
      "plain": {
        "paths": ["AGENTS.md", "AUGUST.md", "docs", "features", ".august/knowledge"]
      },
      "graphify": {
        "enabled": false,
        "command": ["graphify"],
        "paths": ["docs", "features", ".august/knowledge"]
      }
    }
  }
}
```

This is not an instruction to add `august` to `opencode.json` yet. Because OpenCode validates config strictly, implementation should either keep August-specific config in an August-owned file or add schema support deliberately.

## Error handling

- If `plain` finds no sources, refresh should still succeed with a warning and an empty cache.
- If `graphify` is configured but unavailable, refresh should degrade to `plain` and record the Graphify failure in `adapters.json`.
- No adapter may silently inject generated knowledge into agent prompts forever. Generated knowledge is cache data; promotion into durable memory belongs to reviewed proposal workflows.

## User stories

### Story 1: Plain notes are enough to start

As an August user, I want August to build project knowledge from existing repo docs and approved memory notes without installing any extra graph tool, so a fresh Mac/Linux/PC setup still has useful project context.

Acceptance:

- The default adapter is `plain`.
- The design names the default source set: `AGENTS.md`, `AUGUST.md`, `docs/`, `features/`, `.august/knowledge/`, and reviewed memory notes.
- Missing optional graph tooling does not block the plain path.

### Story 2: Graphify enriches document/media knowledge when available

As an August user with Graphify installed, I want August to optionally enrich project memory with docs, PDFs, screenshots, diagrams, and raw notes, so research-heavy projects can have richer context than plain markdown summaries.

Acceptance:

- Graphify is optional and disabled by default in the config proposal.
- Graphify failure degrades to `plain` instead of failing the full refresh.
- Graphify is scoped to docs/media/notes, not code symbol intelligence.

### Story 3: CodeGraph remains a separate feature

As the August maintainer, I want CodeGraph kept out of this adapter design, so the document-memory feature does not accidentally become a code-intelligence project.

Acceptance:

- CodeGraph is listed as a non-goal.
- Symbol search, callers/callees, impact analysis, and code graph queries are explicitly assigned to a future feature.
- The adapter contract only promises cited project knowledge summaries for this issue.

### Story 4: Generated knowledge stays inspectable

As an August user, I want generated knowledge caches to be readable and source-linked, so I can audit what August learned before trusting or promoting it.

Acceptance:

- Markdown is the human-readable output format.
- JSON metadata records sources, adapter status, timestamps, and warnings.
- Generated cache output is not silently promoted into durable memory or agent prompts.

## Validation strategy

This issue is design-only. Acceptance is met when this document exists and clearly separates:

- August-native plain project memory notes as the default path.
- Graphify as an optional docs/media graph enrichment path.
- CodeGraph as a separate future code-intelligence feature.
- A future config direction that avoids invalid OpenCode config.

Future implementation for MAY-125 should add an API-first validation scenario proving that an agent can answer a project-structure question from `.august/knowledge` before falling back to broad raw searches.

## Validation plan

### MAY-126 design validation

MAY-126 is complete when these checks pass:

1. The design document exists at `docs/superpowers/specs/2026-05-27-may-126-knowledge-adapters-design.md`.
2. The document has explicit user stories for `plain`, `graphify`, CodeGraph separation, and inspectable output.
3. The document contains no placeholder text such as `TBD`, `TODO`, or `implement later`.
4. `./scripts/doctor.sh` passes from the repo root.
5. Linear issue `MAY-126` is updated with the spec link/path and marked done only after the checks above pass.

### MAY-125 implementation validation handoff

The follow-up implementation issue should validate behavior with at least these scenarios:

1. **Plain-only refresh**
   - Given no Graphify installation/configuration, `august knowledge refresh` produces `.august/knowledge/map.md`, `sources.json`, and `adapters.json` from plain sources.
   - Expected result: refresh succeeds, adapter status shows `plain: ok`, and no Graphify error blocks output.

2. **Graphify unavailable fallback**
   - Given Graphify is enabled in August-owned config but the command is missing, refresh still produces plain output.
   - Expected result: refresh succeeds, adapter status records `graphify: unavailable`, and warnings explain the fallback.

3. **Architecture question uses cache first**
   - Given a generated `.august/knowledge/map.md`, an API-first validation scenario asks an agent to explain August's validation harness or feature layout.
   - Expected result: transcript/tool evidence shows the agent reads `.august/knowledge` before broad raw search loops.

4. **No silent memory promotion**
   - Given generated knowledge output, no approved memory file, `AGENTS.md`, `AUGUST.md`, skill, or config file is changed automatically.
   - Expected result: only `.august/knowledge/*` artifacts are written unless the user explicitly approves a proposal workflow.

## Upstream compatibility

This design avoids core OpenCode changes. It favors August-owned files, generated cache artifacts under `.august/`, and optional external adapters. That keeps upstream merge risk low and preserves portability across Linux, PC, and Mac.
