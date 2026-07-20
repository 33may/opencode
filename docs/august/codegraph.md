# August CodeGraph

CodeGraph is a lightweight local structural index for August. It is intentionally separate from knowledge adapters: knowledge adapters summarize project context, while CodeGraph answers direct code navigation questions.

## Commands

```bash
./scripts/august codegraph refresh
./scripts/august codegraph find Button
./scripts/august codegraph context ButtonController
./scripts/august codegraph impact src/button.ts
```

The index is written to `.august/codegraph/index.json` inside the target workspace.

## MVP scope

- Scans common source files: TypeScript, JavaScript, Python, Go, and Rust extensions.
- Extracts lightweight symbols with regexes for classes, functions, consts, interfaces, types, and methods.
- Extracts ES imports and simple symbol references.
- Provides CLI-first access without automatic prompt injection or model-facing tool registration.

## Compatibility notes

This is downstream August-owned functionality. It only adds a top-level CLI command and a new `src/august` module, so the upstream conflict surface should stay small.

The parser is deliberately shallow. Future upgrades can replace the extractor with LSP or tree-sitter while preserving the CLI contract and index shape.
