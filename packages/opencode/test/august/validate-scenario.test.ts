import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { hardAssertions, parseScenario, scenarioAgent } from "../../../../scripts/validate-scenario.ts"

describe("validate-scenario hard assertions", () => {
  test("parses scenario-level agent for the main validation prompt", () => {
    const scenario = parseScenario(`
id: augustresearch-bootstrap
agent: augustresearch
story: runs AugustResearch
prompt: |
  Validation mode.
`)

    expect(scenario.agent).toBe("augustresearch")
    expect(scenarioAgent(scenario, {})).toBe("augustresearch")
    expect(scenarioAgent(scenario, { AUGUST_VALIDATE_AGENT: "build" })).toBe("build")
  })

  test("rejects expected file paths that escape the workspace", async () => {
    const result = await hardAssertions({
      scenario: {
        id: "path-traversal",
        story: "file assertions stay inside the scenario workspace",
        prompt: "check files",
        expected: {
          files_exist: ["../outside.txt"],
          files_contain: ["../outside.txt::secret"],
        },
      },
      finalText: "done",
      messages: [],
      toolCalls: [],
      workspace: await mkdtemp(path.join(os.tmpdir(), "august-validate-scenario-")),
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("expected file path escapes workspace: ../outside.txt")
  })

  test("detects protected workspace files changed from their source copy", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "august-validate-scenario-"))
    await Bun.write(path.join(workspace, "README.md"), "changed during scenario")

    const result = await hardAssertions({
      scenario: {
        id: "protected-file",
        story: "protected files remain unchanged",
        prompt: "check files",
        expected: {
          files_unchanged: ["README.md"],
        },
      },
      finalText: "done",
      messages: [],
      toolCalls: [],
      workspace,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContain("expected file to remain unchanged: README.md")
  })
})
