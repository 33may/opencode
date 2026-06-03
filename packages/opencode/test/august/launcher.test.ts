import { expect, test } from "bun:test"
import { spawn } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"

const root = path.resolve(import.meta.dir, "../../../..")

test("scripts/august starts TUI code from another cwd without using React JSX runtime", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-launcher-"))
  try {
    const output = await runAugust(tmp, [], 3000)
    expect(output).not.toContain("react/jsx-dev-runtime")
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test("scripts/august loads config from the caller cwd", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-launcher-"))
  try {
    await Bun.write(path.join(tmp, "opencode.json"), JSON.stringify({ username: "caller-cwd-marker" }))
    expect(await runAugust(tmp, ["debug", "config"], 10000)).toContain("caller-cwd-marker")
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test("scripts/august init installs August project defaults without OpenSpec", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-init-"))
  try {
    const output = await runAugust(tmp, ["init", "--no-openspec"], 10000)
    expect(output).toContain("August project initialized")

    expect(await exists(path.join(tmp, ".opencode", "opencode.jsonc"))).toBe(true)
    expect(await exists(path.join(tmp, ".opencode", "agent", "august.md"))).toBe(true)
    expect(await exists(path.join(tmp, "AGENTS.md"))).toBe(true)

    expect(await fs.readFile(path.join(tmp, ".opencode", "opencode.jsonc"), "utf8")).toContain(
      '"default_agent": "august"',
    )
    expect(await fs.readFile(path.join(tmp, ".opencode", "agent", "august.md"), "utf8")).toContain(
      "intelligent system wrapper around OpenCode",
    )
    expect(await fs.readFile(path.join(tmp, "AGENTS.md"), "utf8")).toContain("initialized for August")
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test("scripts/august init preserves existing project config and custom August agent", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-init-"))
  try {
    await fs.mkdir(path.join(tmp, ".opencode", "agent"), { recursive: true })
    await Bun.write(
      path.join(tmp, ".opencode", "opencode.jsonc"),
      '{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "test/model",\n  "instructions": ["LOCAL.md"]\n}\n',
    )
    await Bun.write(path.join(tmp, ".opencode", "agent", "august.md"), "custom august agent\n")

    await runAugust(tmp, ["init", "--no-openspec"], 10000)

    const config = await fs.readFile(path.join(tmp, ".opencode", "opencode.jsonc"), "utf8")
    expect(config).toContain('"model": "test/model"')
    expect(config).toContain('"default_agent": "august"')
    expect(config).toContain('"LOCAL.md"')
    expect(config).toContain('"AGENTS.md"')
    expect(await fs.readFile(path.join(tmp, ".opencode", "agent", "august.md"), "utf8")).toBe(
      "custom august agent\n",
    )
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test("scripts/august init invokes OpenSpec for OpenCode projects by default", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-init-"))
  try {
    const fakeOpenSpec = path.join(tmp, "fake-openspec")
    const argsFile = path.join(tmp, "openspec-args.txt")
    await Bun.write(fakeOpenSpec, '#!/usr/bin/env bash\nset -euo pipefail\nprintf "%s\\n" "$@" > "$AUGUST_FAKE_OPENSPEC_ARGS"\n')
    await fs.chmod(fakeOpenSpec, 0o755)

    await runAugust(tmp, ["init"], 10000, {
      AUGUST_OPENSPEC_BIN: fakeOpenSpec,
      AUGUST_FAKE_OPENSPEC_ARGS: argsFile,
    })

    expect((await fs.readFile(argsFile, "utf8")).trim().split("\n")).toEqual([
      "init",
      await fs.realpath(tmp),
      "--tools",
      "opencode",
      "--profile",
      "core",
      "--force",
    ])
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function runAugust(cwd: string, args: string[], timeout: number, env: Record<string, string> = {}) {
  const child = spawn(path.join(root, "scripts", "august"), args, {
    cwd,
    env: {
      ...process.env,
      ...env,
      OPENCODE_DISABLE_PROJECT_CONFIG: args.length === 0 ? "1" : process.env.OPENCODE_DISABLE_PROJECT_CONFIG,
      OPENCODE_PURE: "1",
      TERM: "xterm-256color",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  child.stdout.on("data", (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on("data", (chunk) => {
    output += chunk.toString()
  })
  return await new Promise<string>((resolve) => {
    const timer = setTimeout(() => {
      child.kill()
      resolve(output)
    }, timeout)
    child.on("exit", () => {
      clearTimeout(timer)
      resolve(output)
    })
  })
}
