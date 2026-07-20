import { expect, test } from "bun:test"
import { buildTalkStartup, isDryRun } from "@/talk"
import { delegateToolDefinition } from "@/talk/prompt"

test("detects CLI dry-run arguments", () => {
  expect(isDryRun({ dryRun: true })).toBe(true)
  expect(isDryRun({ dryRun: false })).toBe(false)
  expect(isDryRun({})).toBe(false)
})

test("builds startup instructions, realtime session update, and artifact metadata", () => {
  const startup = buildTalkStartup({
    directory: "/workspace/project",
    sessionID: "ses_123",
    model: "gpt-realtime-2",
    voice: "marin",
    inputRate: 24000,
    artifactRoot: "/tmp/artifacts",
    now: new Date("2026-05-28T12:34:56.789Z"),
  })

  expect(startup.instructions).toContain("Current directory: /workspace/project")
  expect(startup.instructions).toContain("Technician session: ses_123")
  expect(startup.sessionUpdate.session.model).toBe("gpt-realtime-2")
  expect(startup.sessionUpdate.session.audio.output.voice).toBe("marin")
  expect(startup.sessionUpdate.session.tools).toEqual([delegateToolDefinition])
  expect(startup.artifact).toMatchObject({
    root: "/tmp/artifacts",
    directory: "/workspace/project",
    sessionID: "ses_123",
    timestamp: "2026-05-28T12-34-56.789Z",
  })
  expect(startup.manifest).toEqual({
    model: "gpt-realtime-2",
    voice: "marin",
    inputRate: 24000,
    mode: "talk",
  })
})
