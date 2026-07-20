import { Permission } from "@/permission"
import { Session } from "@/session/session"
import { Effect } from "effect"

const autonomousPermissions = [
  "bash",
  "read",
  "edit",
  "glob",
  "grep",
  "webfetch",
  "task",
  "todowrite",
  "websearch",
  "lsp",
  "skill",
] satisfies string[]

export const fullAutonomyPermission: Permission.Ruleset = autonomousPermissions.map((permission) => ({
  permission,
  pattern: "*",
  action: "allow" as const,
}))

export function buildTechnicianPrompt(input: { task: string; context?: string; transcriptTail?: string }) {
  return [
    "You are the August technician for a live voice call with May.",
    "You must act autonomously: inspect files, edit code, and run tests as needed without waiting for step-by-step permission.",
    "Use the repository context and current tool results rather than guessing.",
    "Return a concise result for the talk facilitator, including what changed and any verification outcome.",
    "",
    `Task: ${input.task}`,
    input.context ? `Context: ${input.context}` : undefined,
    input.transcriptTail ? `Recent transcript: ${input.transcriptTail}` : undefined,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n")
}

export const createTalkSession = Effect.fn("Talk.createSession")(function* (input?: { title?: string; now?: Date }) {
  const session = yield* Session.Service
  return yield* session.create({
    title: input?.title ?? `August Talk - ${(input?.now ?? new Date()).toISOString()}`,
    permission: fullAutonomyPermission,
  })
})

export async function delegateToAugust(
  input: { task: string; context?: string; transcriptTail?: string },
  services: { prompt(taskText: string): Promise<string> },
) {
  return services.prompt(buildTechnicianPrompt(input))
}

export * as TalkSession from "./session"
