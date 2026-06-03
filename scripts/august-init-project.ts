#!/usr/bin/env bun
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

const schemaURL = "https://opencode.ai/config.json"
const managedMarker = "Managed by August project init. Safe to regenerate."

type Options = {
  project: string
  profile: string
  tools: string
  openspec: boolean
  force: boolean
}

const usage = `Usage: scripts/august init [--project DIR] [--tools LIST] [--profile NAME] [--no-openspec]

Initialize any project for AugustCode-on-OpenCode.

Options:
  -C, --project, --dir DIR  Project directory to initialize (default: current directory)
  --tools LIST              OpenSpec tool ids to generate (default: opencode)
  --profile NAME            OpenSpec workflow profile (default: core)
  --no-openspec             Skip OpenSpec CLI init/update
  --force                   Pass --force to OpenSpec init (default: true)
  --no-force                Do not pass --force to OpenSpec init
  -h, --help                Show this help

Examples:
  scripts/august init
  scripts/august init --project /path/to/project
  scripts/august init --tools opencode --profile core
`

const options = parseArgs(process.argv.slice(2))
const project = path.resolve(options.project)

if (!existsSync(project)) {
  console.error(`scripts/august init: project directory not found: ${project}`)
  process.exit(1)
}

await fs.mkdir(path.join(project, ".opencode", "agent"), { recursive: true })
await updateOpenCodeConfig(project)
await installAugustAgent(project)
await installProjectInstructions(project)

if (options.openspec) await installOpenSpec(project, options)

console.log(`August project initialized: ${project}`)
console.log(`- OpenCode config: ${path.join(project, ".opencode", "opencode.jsonc")}`)
console.log(`- August agent: ${path.join(project, ".opencode", "agent", "august.md")}`)
console.log(`- Project instructions: ${path.join(project, "AGENTS.md")}`)
console.log(options.openspec ? "- OpenSpec: installed for OpenCode" : "- OpenSpec: skipped (--no-openspec)")

function parseArgs(args: string[]): Options {
  const options: Options = {
    project: process.cwd(),
    profile: "core",
    tools: "opencode",
    openspec: true,
    force: true,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "-h" || arg === "--help") {
      console.log(usage)
      process.exit(0)
    }
    if (arg === "--no-openspec") {
      options.openspec = false
      continue
    }
    if (arg === "--force") {
      options.force = true
      continue
    }
    if (arg === "--no-force") {
      options.force = false
      continue
    }
    if (arg === "-C" || arg === "--project" || arg === "--dir") {
      options.project = requireValue(args, ++i, arg)
      continue
    }
    if (arg === "--tools") {
      options.tools = requireValue(args, ++i, arg)
      continue
    }
    if (arg === "--profile") {
      options.profile = requireValue(args, ++i, arg)
      continue
    }
    if (arg.startsWith("-")) {
      console.error(`scripts/august init: unknown option ${arg}`)
      process.exit(1)
    }
    options.project = arg
  }

  return options
}

function requireValue(args: string[], index: number, option: string) {
  const value = args[index]
  if (!value) {
    console.error(`scripts/august init: ${option} requires a value`)
    process.exit(1)
  }
  return value
}

async function updateOpenCodeConfig(project: string) {
  const configPath = path.join(project, ".opencode", "opencode.jsonc")
  const initial = existsSync(configPath) ? await fs.readFile(configPath, "utf8") : "{}\n"
  const config = parseConfig(initial, configPath)
  const instructions = Array.from(
    new Set([...(Array.isArray(config.instructions) ? config.instructions.filter(isString) : []), "AGENTS.md"]),
  )

  await fs.writeFile(configPath, `${JSON.stringify(
    {
      ...config,
      $schema: isString(config.$schema) ? config.$schema : schemaURL,
      default_agent: "august",
      instructions,
    },
    null,
    2,
  )}\n`)
}

async function installAugustAgent(project: string) {
  const agentPath = path.join(project, ".opencode", "agent", "august.md")
  if (existsSync(agentPath) && !(await fs.readFile(agentPath, "utf8")).includes(managedMarker)) return
  await fs.writeFile(agentPath, augustAgent())
}

async function installProjectInstructions(project: string) {
  const instructionsPath = path.join(project, "AGENTS.md")
  if (existsSync(instructionsPath)) return
  await fs.writeFile(
    instructionsPath,
    `# Project Instructions\n\nThis project is initialized for August. AugustCode is an intelligent system wrapper around OpenCode.\n\n- Use \`./scripts/august init --project <path>\` from the August checkout to refresh the local OpenCode/OpenSpec setup.\n- Use OpenSpec changes under \`openspec/changes/\` for non-trivial feature planning.\n- Keep project-specific conventions in this file so August sees them in every session.\n`,
  )
}

async function installOpenSpec(project: string, options: Options) {
  const openspecArgs = ["init", project, "--tools", options.tools, "--profile", options.profile]
  if (options.force) openspecArgs.push("--force")

  const command = process.env.AUGUST_OPENSPEC_BIN ?? "npm"
  const args = process.env.AUGUST_OPENSPEC_BIN
    ? openspecArgs
    : ["exec", "--yes", "@fission-ai/openspec@latest", "--", ...openspecArgs]

  await run(command, args, {
    ...process.env,
    OPENSPEC_TELEMETRY: process.env.OPENSPEC_TELEMETRY ?? "0",
  })
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { stdio: "inherit", env })
  const code = await new Promise<number | null>((resolve) => child.on("exit", resolve))
  if (code === 0) return
  console.error(`scripts/august init: command failed: ${[command, ...args].join(" ")}`)
  process.exit(code ?? 1)
}

function parseConfig(text: string, file: string) {
  try {
    const config = JSON.parse(stripJsonc(text))
    return isRecord(config) ? config : {}
  } catch (err) {
    console.error(`scripts/august init: invalid JSONC in ${file}: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function stripJsonc(text: string) {
  let result = ""
  let inString = false
  let quote = ""
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const current = text[i]
    const next = text[i + 1]
    if (inString) {
      result += current
      if (escaped) {
        escaped = false
        continue
      }
      if (current === "\\") {
        escaped = true
        continue
      }
      if (current === quote && !escaped) inString = false
      continue
    }
    if (current === '"' || current === "'") {
      inString = true
      quote = current
      result += current
      continue
    }
    if (current === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++
      result += "\n"
      continue
    }
    if (current === "/" && next === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++
      i++
      continue
    }
    result += current
  }

  return result.replace(/,\s*([}\]])/g, "$1")
}

function augustAgent() {
  return `---
description: Primary AugustCode agent for working in any initialized project.
mode: primary
---

<!-- ${managedMarker} -->

You are AugustCode, an intelligent system wrapper around OpenCode.

Priorities:
1. Help the user build, debug, and understand this project with the least invasive change that works.
2. Prefer project-local config, plugins, hooks, and documented extension points before editing framework internals.
3. Keep changes modular, documented, testable, and portable across Linux, macOS, and Windows.
4. Use OpenSpec for non-trivial features so intent, design, tasks, and validation survive beyond chat history.
5. Preserve existing project behavior unless the user intentionally asks to change it.

Before completing work, report:
- Files changed
- Validation run
- Any compatibility or portability risks
`
}
