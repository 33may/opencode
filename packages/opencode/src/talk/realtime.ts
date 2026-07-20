import { delegateToolDefinition } from "./prompt"

export function buildRealtimeUrl(model: string) {
  return `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`
}

export function buildSessionUpdate(input: { instructions: string; voice: string; inputRate: number; model?: string }) {
  return {
    type: "session.update",
    session: {
      type: "realtime",
      model: input.model ?? "gpt-realtime-2",
      instructions: input.instructions,
      output_modalities: ["audio", "text"],
      audio: {
        input: {
          format: { type: "audio/pcm", rate: input.inputRate },
          turn_detection: { type: "semantic_vad" },
          transcription: { model: "gpt-realtime-whisper" },
        },
        output: {
          format: { type: "audio/pcm", rate: input.inputRate },
          voice: input.voice,
        },
      },
      reasoning: { effort: "low" },
      tools: [delegateToolDefinition],
    },
  }
}

export function parseRealtimeEvent(json: string): { ok: true; event: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, event: JSON.parse(json) }
  } catch (error) {
    return { ok: false, message: `Invalid realtime event JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
}

export * as TalkRealtime from "./realtime"
