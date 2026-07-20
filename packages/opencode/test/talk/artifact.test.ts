import { expect, test } from "bun:test"
import path from "path"
import { appendJsonl, createTalkArtifactRun, writeManifest, type TalkEvent } from "@/talk/artifact"
import { tmpdir } from "../fixture/fixture"

test("creates an artifact run under an ISO-safe timestamp directory", async () => {
  await using tmp = await tmpdir()
  const run = createTalkArtifactRun({
    root: tmp.path,
    now: new Date("2026-05-28T12:34:56.789Z"),
    sessionID: "ses_123",
    directory: "/workspace/project",
  })

  expect(run).toEqual({
    root: tmp.path,
    directory: "/workspace/project",
    sessionID: "ses_123",
    timestamp: "2026-05-28T12-34-56.789Z",
    dir: path.join(tmp.path, ".august", "talk", "2026-05-28T12-34-56.789Z"),
    events: path.join(tmp.path, ".august", "talk", "2026-05-28T12-34-56.789Z", "events.jsonl"),
    messages: path.join(tmp.path, ".august", "talk", "2026-05-28T12-34-56.789Z", "messages.jsonl"),
    manifest: path.join(tmp.path, ".august", "talk", "2026-05-28T12-34-56.789Z", "manifest.json"),
  })
})

test("appends JSONL records and writes manifest JSON", async () => {
  await using tmp = await tmpdir()
  const run = createTalkArtifactRun({
    root: tmp.path,
    now: new Date("2026-05-28T12:34:56.789Z"),
    sessionID: "ses_123",
    directory: tmp.path,
  })
  const event: TalkEvent = {
    role: "assistant",
    source: "august",
    text: "I can delegate that.",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  }

  await appendJsonl(run.events, event)
  await appendJsonl(run.events, { ...event, role: "tool", source: "runtime", text: "done" })
  await writeManifest(run, { model: "gpt-realtime-2", voice: "marin" })

  expect(await Bun.file(run.events).text()).toBe(
    `${JSON.stringify(event)}\n${JSON.stringify({ ...event, role: "tool", source: "runtime", text: "done" })}\n`,
  )
  expect(await Bun.file(run.manifest).json()).toEqual({
    sessionID: "ses_123",
    directory: tmp.path,
    timestamp: "2026-05-28T12-34-56.789Z",
    model: "gpt-realtime-2",
    voice: "marin",
  })
})

test("appends concurrent JSONL records without losing writes", async () => {
  await using tmp = await tmpdir()
  const run = createTalkArtifactRun({
    root: tmp.path,
    now: new Date("2026-05-28T12:34:56.789Z"),
    sessionID: "ses_123",
    directory: tmp.path,
  })

  await Promise.all(
    Array.from({ length: 50 }, (_, index) =>
      appendJsonl(run.events, {
        role: "system",
        source: "runtime",
        text: `event ${index}`,
        time: "2026-05-28T12:35:00.000Z",
      } satisfies TalkEvent),
    ),
  )

  expect((await Bun.file(run.events).text()).trim().split("\n")).toHaveLength(50)
})
