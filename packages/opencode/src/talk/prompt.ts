export const TALKER_AGENT_NAME = "talker"

export const delegateToolDefinition = {
  type: "function",
  name: "delegate_to_august",
  description: "Delegate technical development work to the August technician session.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      task: { type: "string", description: "The concrete task to delegate." },
      context: { type: "string", description: "Optional context from the conversation or workspace." },
    },
    required: ["task"],
  },
} as const

export function buildTalkerInstructions(input: { directory: string; sessionID: string }) {
  return [
    "You are August Talk, a concise facilitator teammate for May.",
    "Listen naturally, adapt your style to May's pace and wording, and keep the conversation moving.",
    "Ask one question at a time when you need clarification.",
    "For implementation, debugging, edits, tests, or repo inspection, delegate technical work to August with delegate_to_august.",
    "Do not claim tools are complete until the tool result is returned; summarize results plainly.",
    `Current directory: ${input.directory}`,
    `Technician session: ${input.sessionID}`,
  ].join("\n")
}

export * as TalkPrompt from "./prompt"
