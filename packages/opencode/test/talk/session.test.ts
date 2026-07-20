import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { ProjectID } from "@/project/schema"
import { SessionID } from "@/session/schema"
import { Session } from "@/session/session"
import {
  buildTechnicianPrompt,
  createTalkSession,
  delegateToAugust,
  fullAutonomyPermission,
} from "@/talk/session"

test("allows the technician to use the full autonomous tool set", () => {
  expect(fullAutonomyPermission).toEqual(
    ["bash", "read", "edit", "glob", "grep", "webfetch", "task", "todowrite", "websearch", "lsp", "skill"].map(
      (permission) => ({ permission, pattern: "*", action: "allow" }),
    ),
  )
})

test("builds an autonomous technician prompt with task, context, and transcript tail", () => {
  const prompt = buildTechnicianPrompt({
    task: "Fix the failing talk tests",
    context: "MAY-132 voice integration",
    transcriptTail: "May asked to keep it concise.",
  })

  expect(prompt).toContain("Fix the failing talk tests")
  expect(prompt).toContain("MAY-132 voice integration")
  expect(prompt).toContain("May asked to keep it concise.")
  expect(prompt).toContain("act autonomously")
  expect(prompt).toContain("inspect files")
  expect(prompt).toContain("edit")
  expect(prompt).toContain("run tests")
  expect(prompt).toContain("concise result")
})

test("delegates to the injected August prompt service", async () => {
  const calls: string[] = []
  const result = await delegateToAugust(
    { task: "Implement the CLI", context: "Dry run only" },
    {
      prompt: async (taskText) => {
        calls.push(taskText)
        return "implemented"
      },
    },
  )

  expect(result).toBe("implemented")
  expect(calls).toHaveLength(1)
  expect(calls[0]).toContain("Implement the CLI")
  expect(calls[0]).toContain("Dry run only")
})

test("creates a technician session with full-autonomy permission", async () => {
  const created = {
    id: SessionID.make("ses_talk"),
    slug: "talk",
    projectID: ProjectID.global,
    directory: "/tmp/project",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    title: "Talk task",
    version: "test",
    time: { created: 1, updated: 1 },
    permission: [...fullAutonomyPermission],
  } satisfies Session.Info
  const inputs: NonNullable<Parameters<Session.Interface["create"]>[0]>[] = []

  const result = await Effect.runPromise(
    createTalkSession({ title: "Talk task" }).pipe(
      Effect.provide(
        Layer.mock(Session.Service)({
          create: (input) =>
            Effect.sync(() => {
              inputs.push(input ?? {})
              return created
            }),
        }),
      ),
    ),
  )

  expect(result).toBe(created)
  expect(inputs).toEqual([{ title: "Talk task", permission: fullAutonomyPermission }])
})

test("creates a default talk session title with a timestamp", async () => {
  const inputs: NonNullable<Parameters<Session.Interface["create"]>[0]>[] = []

  await Effect.runPromise(
    createTalkSession({ now: new Date("2026-05-28T12:34:56.789Z") }).pipe(
      Effect.provide(
        Layer.mock(Session.Service)({
          create: (input) =>
            Effect.sync(() => {
              inputs.push(input ?? {})
              return {
                id: SessionID.make("ses_talk"),
                slug: "talk",
                projectID: ProjectID.global,
                directory: "/tmp/project",
                cost: 0,
                tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                title: input?.title ?? "",
                version: "test",
                time: { created: 1, updated: 1 },
                permission: [...fullAutonomyPermission],
              } satisfies Session.Info
            }),
        }),
      ),
    ),
  )

  expect(inputs).toEqual([{ title: "August Talk - 2026-05-28T12:34:56.789Z", permission: fullAutonomyPermission }])
})
