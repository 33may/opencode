import { Buffer } from "buffer"
import { appendJsonl, type TalkArtifactRun, type TalkEvent } from "./artifact"
import { resolveAudioCommands, type AudioCommandSpec } from "./audio"
import { buildTalkerInstructions } from "./prompt"
import { buildRealtimeUrl, buildSessionUpdate, parseRealtimeEvent } from "./realtime"

export interface TalkRunnerSocket {
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void
  send(data: string): void
  close(): void
}

export interface TalkRunnerAudioProcess {
  stdout?: ReadableStream<Uint8Array> | null
  stdin?: {
    write(chunk: Uint8Array): void | number | Promise<void | number>
    end?(): void | number | Promise<void | number>
  } | null
  kill(): void
}

export interface TalkDelegateInput {
  task: string
  context?: string
}

export interface TalkRunnerInput {
  directory: string
  sessionID: string
  model: string
  voice: string
  inputRate: number
  artifactRoot: string
  now: Date
  apiKey: string
  allowNonDarwin?: boolean
  artifact: TalkArtifactRun
  createSocket?: (input: { url: string; apiKey: string }) => TalkRunnerSocket
  spawnAudio?: (spec: AudioCommandSpec) => TalkRunnerAudioProcess
  appendEvent?: (event: TalkEvent) => Promise<void>
  appendMessage?: (event: TalkEvent) => Promise<void>
  delegate?: (input: TalkDelegateInput) => Promise<string>
  nowIso?: () => string
}

export async function runTalkRealtime(input: TalkRunnerInput) {
  const audio = resolveAudioCommands(process.platform, {
    ...process.env,
    ...(input.allowNonDarwin ? { AUGUST_TALK_ALLOW_NON_DARWIN: "1" } : {}),
  })
  const socket = (input.createSocket ?? createOpenAIRealtimeSocket)({
    url: buildRealtimeUrl(input.model),
    apiKey: input.apiKey,
  })
  const inputAudio = (input.spawnAudio ?? spawnTalkAudio)(audio.input)
  const outputAudio = (input.spawnAudio ?? spawnTalkAudio)(audio.output)
  const appendEvent = input.appendEvent ?? ((event: TalkEvent) => appendJsonl(input.artifact.events, event))
  const appendMessage = input.appendMessage ?? ((event: TalkEvent) => appendJsonl(input.artifact.messages, event))
  const nowIso = input.nowIso ?? (() => new Date().toISOString())
  const pending = new Set<Promise<void>>()
  const track = (work: Promise<void>) => {
    const tracked = work.catch((error) =>
      appendEvent({
        role: "system",
        source: "runtime",
        text: `Runtime handler error: ${error instanceof Error ? error.message : String(error)}`,
        time: nowIso(),
        sessionID: input.sessionID,
      }).catch(() => {}),
    )
    pending.add(tracked)
    tracked.finally(() => pending.delete(tracked)).catch(() => {})
  }
  const transcript = { assistant: "" }

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify(
        buildSessionUpdate({
          instructions: buildTalkerInstructions({ directory: input.directory, sessionID: input.sessionID }),
          voice: input.voice,
          inputRate: input.inputRate,
          model: input.model,
        }),
      ),
    )
    track(pumpInputAudio(inputAudio, socket))
  })
  socket.addEventListener("message", (event) => {
    track(
      handleRealtimeMessage({
        data: readMessageData(event),
        socket,
        outputAudio,
        delegate: input.delegate,
        appendEvent,
        appendMessage,
        nowIso,
        sessionID: input.sessionID,
        transcript,
      }),
    )
  })

  const onSigint = () => {
    inputAudio.kill()
    outputAudio.kill()
    socket.close()
  }

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("close", () => resolve())
    socket.addEventListener("error", (event) => reject(event instanceof Error ? event : new Error("Realtime socket error")))
    process.once("SIGINT", onSigint)
  }).finally(async () => {
    process.off("SIGINT", onSigint)
    inputAudio.kill()
    outputAudio.kill()
    await Promise.all([...pending])
    await outputAudio.stdin?.end?.()
  })
}

function createOpenAIRealtimeSocket(input: { url: string; apiKey: string }) {
  const WebSocketWithHeaders = WebSocket as unknown as new (
    url: string,
    options: { headers: Record<string, string> },
  ) => TalkRunnerSocket
  return new WebSocketWithHeaders(input.url, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "OpenAI-Safety-Identifier": "august-talk-local",
    },
  })
}

function spawnTalkAudio(spec: AudioCommandSpec): TalkRunnerAudioProcess {
  const proc = Bun.spawn([spec.command, ...spec.args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  })
  return {
    stdout: proc.stdout,
    stdin: proc.stdin,
    kill: () => proc.kill(),
  }
}

async function pumpInputAudio(proc: TalkRunnerAudioProcess, socket: TalkRunnerSocket) {
  const reader = proc.stdout?.getReader()
  if (!reader) return
  const read = await reader.read()
  if (read.done) return
  socket.send(
    JSON.stringify({
      type: "input_audio_buffer.append",
      audio: Buffer.from(read.value).toString("base64"),
    }),
  )
  await pumpInputAudio(proc, socket)
}

async function handleRealtimeMessage(input: {
  data: string
  socket: TalkRunnerSocket
  outputAudio: TalkRunnerAudioProcess
  delegate?: (input: TalkDelegateInput) => Promise<string>
  appendEvent: (event: TalkEvent) => Promise<void>
  appendMessage: (event: TalkEvent) => Promise<void>
  nowIso: () => string
  sessionID: string
  transcript: { assistant: string }
}) {
  const parsed = parseRealtimeEvent(input.data)
  if (!parsed.ok) {
    await input.appendEvent({ role: "system", source: "runtime", text: parsed.message, time: input.nowIso(), sessionID: input.sessionID })
    return
  }
  if (!isRecord(parsed.event) || typeof parsed.event.type !== "string") return
  if (parsed.event.type === "error") {
    await input.appendEvent({
      role: "system",
      source: "runtime",
      text: `Realtime error: ${realtimeErrorMessage(parsed.event.error)}`,
      time: input.nowIso(),
      sessionID: input.sessionID,
    })
    input.socket.close()
    return
  }
  if (parsed.event.type === "response.output_audio.delta" && typeof parsed.event.delta === "string") {
    await input.outputAudio.stdin?.write(Buffer.from(parsed.event.delta, "base64"))
    return
  }
  if (parsed.event.type === "response.output_audio_transcript.delta" && typeof parsed.event.delta === "string") {
    input.transcript.assistant += parsed.event.delta
    return
  }
  if (parsed.event.type === "response.output_audio_transcript.done") {
    await appendTranscript({
      role: "assistant",
      source: "voice",
      text: typeof parsed.event.transcript === "string" ? parsed.event.transcript : input.transcript.assistant,
      appendEvent: input.appendEvent,
      appendMessage: input.appendMessage,
      nowIso: input.nowIso,
      sessionID: input.sessionID,
    })
    input.transcript.assistant = ""
    return
  }
  if (parsed.event.type === "conversation.item.input_audio_transcription.completed" && typeof parsed.event.transcript === "string") {
    await appendTranscript({
      role: "user",
      source: "voice",
      text: parsed.event.transcript,
      appendEvent: input.appendEvent,
      appendMessage: input.appendMessage,
      nowIso: input.nowIso,
      sessionID: input.sessionID,
    })
    return
  }
  if (parsed.event.type === "response.output_item.done" && isRecord(parsed.event.item)) {
    await handleFunctionCall({
      item: parsed.event.item,
      socket: input.socket,
      delegate: input.delegate,
      appendEvent: input.appendEvent,
      appendMessage: input.appendMessage,
      nowIso: input.nowIso,
      sessionID: input.sessionID,
    })
  }
}

function realtimeErrorMessage(error: unknown) {
  if (!isRecord(error)) return String(error)
  return typeof error.message === "string" ? error.message : JSON.stringify(error)
}

async function appendTranscript(input: {
  role: TalkEvent["role"]
  source: TalkEvent["source"]
  text: string
  appendEvent: (event: TalkEvent) => Promise<void>
  appendMessage: (event: TalkEvent) => Promise<void>
  nowIso: () => string
  sessionID: string
}) {
  const event = {
    role: input.role,
    source: input.source,
    text: input.text,
    time: input.nowIso(),
    sessionID: input.sessionID,
  }
  await input.appendEvent(event)
  await input.appendMessage(event)
}

async function handleFunctionCall(input: {
  item: Record<string, unknown>
  socket: TalkRunnerSocket
  delegate?: (input: TalkDelegateInput) => Promise<string>
  appendEvent: (event: TalkEvent) => Promise<void>
  appendMessage: (event: TalkEvent) => Promise<void>
  nowIso: () => string
  sessionID: string
}) {
  if (!input.delegate) return
  if (input.item.type !== "function_call") return
  if (input.item.name !== "delegate_to_august") return
  if (typeof input.item.call_id !== "string") return
  if (typeof input.item.arguments !== "string") return
  const request = parseDelegateArguments(input.item.arguments)
  if (!request) return
  await input.appendEvent({
    role: "tool",
    source: "august",
    text: `Delegating to August: ${request.task}${request.context ? `\nContext: ${request.context}` : ""}`,
    time: input.nowIso(),
    sessionID: input.sessionID,
  })
  const result = await input.delegate(request)
    .then((text) => ({ output: text, artifact: `August delegate completed: ${text}` }))
    .catch((error) => ({
      output: `August delegate failed: ${error instanceof Error ? error.message : String(error)}`,
      artifact: `August delegate failed: ${error instanceof Error ? error.message : String(error)}`,
    }))
  input.socket.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: input.item.call_id,
        output: result.output,
      },
    }),
  )
  await input.appendEvent({ role: "tool", source: "august", text: result.artifact, time: input.nowIso(), sessionID: input.sessionID })
  await input.appendMessage({ role: "tool", source: "august", text: result.artifact, time: input.nowIso(), sessionID: input.sessionID })
  input.socket.send(JSON.stringify({ type: "response.create" }))
}

function parseDelegateArguments(text: string): TalkDelegateInput | undefined {
  const parsed = parseRealtimeEvent(text)
  if (!parsed.ok || !isRecord(parsed.event) || typeof parsed.event.task !== "string") return undefined
  return {
    task: parsed.event.task,
    context: typeof parsed.event.context === "string" ? parsed.event.context : undefined,
  }
}

function readMessageData(event: unknown) {
  if (!isRecord(event)) return ""
  if (typeof event.data === "string") return event.data
  if (event.data instanceof Uint8Array) return Buffer.from(event.data).toString("utf8")
  return String(event.data ?? "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export * as TalkRunner from "./runner"
