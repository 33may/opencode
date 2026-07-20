import { expect, test } from "bun:test"
import { buildTalkerInstructions, delegateToolDefinition, TALKER_AGENT_NAME } from "@/talk/prompt"

test("defines the talker agent name", () => {
  expect(TALKER_AGENT_NAME).toBe("talker")
})

test("builds concise facilitator instructions", () => {
  const instructions = buildTalkerInstructions({ directory: "/workspace/project", sessionID: "ses_123" })

  expect(instructions).toContain("facilitator teammate")
  expect(instructions).toContain("adapt your style")
  expect(instructions).toContain("delegate technical work")
  expect(instructions).toContain("Do not claim tools are complete")
  expect(instructions).toContain("Ask one question at a time")
  expect(instructions).toContain("/workspace/project")
  expect(instructions).toContain("ses_123")
})

test("defines delegate_to_august tool schema", () => {
  expect(delegateToolDefinition).toEqual({
    type: "function",
    name: "delegate_to_august",
    description: expect.stringContaining("Delegate"),
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        task: { type: "string", description: expect.stringContaining("task") },
        context: { type: "string", description: expect.stringContaining("context") },
      },
      required: ["task"],
    },
  })
})
