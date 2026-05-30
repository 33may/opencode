import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { hardAssertions } from "../../../../scripts/validate-scenario.ts"

describe("validate-scenario hard assertions", () => {
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
})
