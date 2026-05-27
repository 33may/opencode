# Claude Code Plugin Port

This document tracks the local Claude Code plugin capabilities that were ported into August/OpenCode extension points.

## Ported as OpenCode skills

The following Claude plugin skill directories were copied into `.opencode/skills/` so August can load them through OpenCode's skill loader:

- `superpowers`: brainstorming, writing plans, executing plans, subagent-driven development, TDD, code review, debugging, worktrees, verification, and skill-writing workflows.
- `frontend-design`: frontend/UI design workflow skill.
- `skill-creator`: skill creation and evaluation workflow skill.
- `huggingface-skills`: Hugging Face CLI, datasets, model training, evaluation, jobs, Trackio, Gradio, Transformers.js, and HF MCP usage skills.
- `chrome-devtools-mcp`: Chrome DevTools, accessibility, LCP, memory leak, CLI, and troubleshooting skills.
- `atomic-agents`: Atomic Agents framework and creation skills.
- `claude-md-management`: CLAUDE.md improvement skill.
- `strict-teacher`: local teacher-mode skill.

Two imported skill folders were renamed to match their frontmatter names, as required by OpenCode:

- `huggingface-gradio` -> `gradio`
- `transformers.js` -> `transformers-js`

## Ported as OpenCode MCP servers

The portable MCP plugin configs were translated into `.opencode/opencode.jsonc`:

- `context7`: local `npx -y @upstash/context7-mcp`
- `chrome-devtools`: local `npx chrome-devtools-mcp@latest`
- `huggingface-skills`: remote `https://huggingface.co/mcp?login`

## Not ported

- `ralph-loop`: intentionally skipped by user request.
- `agent-sdk-dev`: intentionally skipped by user request.
- `telegram`: not ported because its Claude MCP command depends on `${CLAUDE_PLUGIN_ROOT}` and the Claude plugin runtime.
- `learning-output-style` and `explanatory-output-style`: not directly ported because they are Claude session-start hooks/output styles. Their behavior should be recreated as OpenCode agents or project instructions if needed.
- `pyright-lsp`: no portable plugin payload was present in the local Claude plugin cache; OpenCode LSP support should be configured natively if needed.
- `serena`: disabled in Claude settings, so it was not ported.

## Compatibility notes

Some copied skills still reference Claude Code tool names such as `Skill`, `Task`, `TodoWrite`, `EnterPlanMode`, or Claude-specific subagent prompts. August/OpenCode can use the guidance, but exact tool names may need adaptation during use.
