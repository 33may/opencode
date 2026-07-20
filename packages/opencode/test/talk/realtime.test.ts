import { expect, test } from "bun:test"
import { buildRealtimeUrl, buildSessionUpdate, parseRealtimeEvent } from "@/talk/realtime"
import { delegateToolDefinition } from "@/talk/prompt"

test("builds encoded OpenAI realtime URL", () => {
  expect(buildRealtimeUrl("gpt realtime/2")).toBe("wss://api.openai.com/v1/realtime?model=gpt%20realtime%2F2")
})

test("builds GA session update with audio, text, vad, input transcription, low reasoning, and delegate tool", () => {
  expect(buildSessionUpdate({ instructions: "Help May", voice: "marin", inputRate: 24000 })).toEqual({
    type: "session.update",
    session: {
      type: "realtime",
      model: "gpt-realtime-2",
      instructions: "Help May",
      output_modalities: ["audio", "text"],
      audio: {
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          turn_detection: { type: "semantic_vad" },
          transcription: { model: "gpt-realtime-whisper" },
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: "marin",
        },
      },
      reasoning: { effort: "low" },
      tools: [delegateToolDefinition],
    },
  })
})

test("parses realtime events and returns typed parse errors", () => {
  expect(parseRealtimeEvent('{"type":"response.text.delta","delta":"hi"}')).toEqual({
    ok: true,
    event: { type: "response.text.delta", delta: "hi" },
  })
  expect(parseRealtimeEvent("not json")).toEqual({
    ok: false,
    message: expect.stringContaining("Invalid realtime event JSON"),
  })
})
