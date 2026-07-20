import { expect, test } from "bun:test"
import { runTalkRealtime, type TalkRunnerAudioProcess, type TalkRunnerSocket } from "@/talk/runner"
import { createTalkArtifactRun, type TalkEvent } from "@/talk/artifact"

class FakeSocket implements TalkRunnerSocket {
  sent: unknown[] = []
  closed = false
  private listeners = new Map<string, ((event: unknown) => void)[]>()

  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.closed = true
    this.emit("close", {})
  }

  emit(type: "open" | "message" | "close" | "error", event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function makeAudio(): { input: TalkRunnerAudioProcess; output: TalkRunnerAudioProcess; writes: Uint8Array[] } {
  const writes: Uint8Array[] = []
  return {
    input: {
      stdout: new ReadableStream<Uint8Array>({ start: (controller) => controller.close() }),
      kill() {},
    },
    output: {
      stdin: { write: (chunk) => void writes.push(chunk) },
      kill() {},
    },
    writes,
  }
}

function input(socket: FakeSocket, audio = makeAudio(), events: TalkEvent[] = [], messages: TalkEvent[] = []) {
  return {
    directory: "/workspace/project",
    sessionID: "ses_123",
    model: "gpt-realtime-2",
    voice: "marin",
    inputRate: 24000,
    artifactRoot: "/tmp/artifacts",
    now: new Date("2026-05-28T12:34:56.789Z"),
    apiKey: "sk-test",
    artifact: createTalkArtifactRun({
      root: "/tmp/artifacts",
      now: new Date("2026-05-28T12:34:56.789Z"),
      sessionID: "ses_123",
      directory: "/workspace/project",
    }),
    createSocket: () => socket,
    spawnAudio: (spec: { command: string }) => (spec.command === "rec" ? audio.input : audio.output),
    appendEvent: async (event: TalkEvent) => void events.push(event),
    appendMessage: async (event: TalkEvent) => void messages.push(event),
    delegate: async (request: { task: string; context?: string }) => `delegated ${request.task} ${request.context}`,
    nowIso: () => "2026-05-28T12:35:00.000Z",
  }
}

test("sends session.update when realtime socket opens", async () => {
  const socket = new FakeSocket()
  const run = runTalkRealtime(input(socket))

  socket.emit("open", {})
  socket.close()
  await run

  expect(socket.sent[0]).toMatchObject({ type: "session.update", session: { model: "gpt-realtime-2" } })
})

test("writes decoded output audio delta bytes to playback stdin", async () => {
  const socket = new FakeSocket()
  const audio = makeAudio()
  const run = runTalkRealtime(input(socket, audio))

  socket.emit("open", {})
  socket.emit("message", { data: JSON.stringify({ type: "response.output_audio.delta", delta: Buffer.from([1, 2, 3]).toString("base64") }) })
  socket.close()
  await run

  expect(audio.writes).toEqual([new Uint8Array([1, 2, 3])])
})

test("delegates done function calls and sends function_call_output plus response.create", async () => {
  const socket = new FakeSocket()
  const calls: { task: string; context?: string }[] = []
  const events: TalkEvent[] = []
  const messages: TalkEvent[] = []
  const run = runTalkRealtime({
    ...input(socket, makeAudio(), events, messages),
    delegate: async (request) => {
      calls.push(request)
      return "implemented"
    },
  })

  socket.emit("open", {})
  socket.emit("message", {
    data: JSON.stringify({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "delegate_to_august",
        call_id: "call_123",
        arguments: JSON.stringify({ task: "fix bug", context: "from voice" }),
      },
    }),
  })
  socket.close()
  await run

  expect(calls).toEqual([{ task: "fix bug", context: "from voice" }])
  expect(socket.sent).toContainEqual({
    type: "conversation.item.create",
    item: { type: "function_call_output", call_id: "call_123", output: "implemented" },
  })
  expect(socket.sent).toContainEqual({ type: "response.create" })
  expect(events).toContainEqual({
    role: "tool",
    source: "august",
    text: "Delegating to August: fix bug\nContext: from voice",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
  expect(events).toContainEqual({
    role: "tool",
    source: "august",
    text: "August delegate completed: implemented",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
  expect(messages).toContainEqual({
    role: "tool",
    source: "august",
    text: "August delegate completed: implemented",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
})

test("records delegate failures and sends failure output so realtime can recover", async () => {
  const socket = new FakeSocket()
  const events: TalkEvent[] = []
  const messages: TalkEvent[] = []
  const run = runTalkRealtime({
    ...input(socket, makeAudio(), events, messages),
    delegate: async () => {
      throw new Error("technician failed")
    },
  })

  socket.emit("open", {})
  socket.emit("message", {
    data: JSON.stringify({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "delegate_to_august",
        call_id: "call_123",
        arguments: JSON.stringify({ task: "fix bug" }),
      },
    }),
  })
  socket.close()
  await run

  expect(socket.sent).toContainEqual({
    type: "conversation.item.create",
    item: { type: "function_call_output", call_id: "call_123", output: "August delegate failed: technician failed" },
  })
  expect(socket.sent).toContainEqual({ type: "response.create" })
  expect(events).toContainEqual({
    role: "tool",
    source: "august",
    text: "August delegate failed: technician failed",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
  expect(messages).toContainEqual({
    role: "tool",
    source: "august",
    text: "August delegate failed: technician failed",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
})

test("appends transcript done events and frontend-ready messages", async () => {
  const socket = new FakeSocket()
  const events: TalkEvent[] = []
  const messages: TalkEvent[] = []
  const run = runTalkRealtime(input(socket, makeAudio(), events, messages))

  socket.emit("open", {})
  socket.emit("message", { data: JSON.stringify({ type: "response.output_audio_transcript.delta", delta: "hello " }) })
  socket.emit("message", { data: JSON.stringify({ type: "response.output_audio_transcript.done", transcript: "hello May" }) })
  socket.close()
  await run

  expect(events).toContainEqual({
    role: "assistant",
    source: "voice",
    text: "hello May",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
  expect(messages).toEqual(events)
})

test("appends realtime server error events", async () => {
  const socket = new FakeSocket()
  const events: TalkEvent[] = []
  const run = runTalkRealtime(input(socket, makeAudio(), events))

  socket.emit("open", {})
  socket.emit("message", {
    data: JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: "bad realtime request" },
    }),
  })
  socket.close()
  await run

  expect(events).toContainEqual({
    role: "system",
    source: "runtime",
    text: "Realtime error: bad realtime request",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
})

test("captures async handler rejections as runtime events", async () => {
  const socket = new FakeSocket()
  const events: TalkEvent[] = []
  const run = runTalkRealtime({
    ...input(socket, makeAudio(), events),
    appendMessage: async () => {
      throw new Error("artifact write failed")
    },
  })

  socket.emit("open", {})
  socket.emit("message", { data: JSON.stringify({ type: "response.output_audio_transcript.done", transcript: "hello" }) })
  socket.close()
  await run

  expect(events).toContainEqual({
    role: "system",
    source: "runtime",
    text: "Runtime handler error: artifact write failed",
    time: "2026-05-28T12:35:00.000Z",
    sessionID: "ses_123",
  })
})

test("removes SIGINT listener when realtime closes normally", async () => {
  const socket = new FakeSocket()
  const before = process.listenerCount("SIGINT")
  const run = runTalkRealtime(input(socket))

  socket.emit("open", {})
  socket.close()
  await run

  expect(process.listenerCount("SIGINT")).toBe(before)
})
