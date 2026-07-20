import { describe, expect, test } from "bun:test"
import { CodeGraphCommand } from "@/cli/cmd/codegraph"

describe("codegraph command", () => {
  test("exposes the august codegraph command group", () => {
    expect(CodeGraphCommand.command).toBe("codegraph")
    expect(CodeGraphCommand.describe).toContain("code graph")
  })
})
