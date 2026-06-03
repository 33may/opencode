import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  buildRecordingState,
  buildKarabinerRule,
  buildRecorderCommand,
  buildTranscriptNotification,
  formatDictationError,
  parseTranscriptionResponse,
  readOpenAIKey,
  resolveExecutable,
  updateKarabinerConfig,
  utf8ChildEnv,
} from "../../../../scripts/august-dictation.ts"

describe("August dictation hotkey helpers", () => {
  test("builds an ffmpeg command for the default macOS microphone", () => {
    expect(buildRecorderCommand({ output: "/tmp/august clip.wav" })).toEqual([
      "ffmpeg",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "avfoundation",
      "-i",
      ":0",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-y",
      "/tmp/august clip.wav",
    ])
  })

  test("resolves ffmpeg from fallbacks when Karabiner PATH misses Homebrew", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-dictation-"))
    try {
      const ffmpeg = path.join(tmp, "ffmpeg")
      await Bun.write(ffmpeg, "#!/bin/sh\n")
      await fs.chmod(ffmpeg, 0o755)

      expect(resolveExecutable({ name: "ffmpeg", path: "/usr/bin:/bin", fallbacks: [ffmpeg] })).toBe(ffmpeg)
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test("rejects recorder state without a child process pid", () => {
    expect(() =>
      buildRecordingState({
        pid: undefined,
        file: "/tmp/recording.wav",
        startedAt: new Date("2026-06-02T14:08:23.735Z"),
      }),
    ).toThrow("Recorder process did not start")
  })

  test("builds a Karabiner rule that maps control-o to toggle dictation", () => {
    const rule = buildKarabinerRule("/Users/may/projects/august/scripts/august-dictation")

    expect(rule.description).toBe("August dictation: Ctrl-O toggles speech-to-text")
    expect(rule.manipulators).toHaveLength(1)
    expect(rule.manipulators[0]?.from).toEqual({
      key_code: "o",
      modifiers: {
        mandatory: ["control"],
        optional: ["any"],
      },
    })
    expect(rule.manipulators[0]?.to).toEqual([
      {
        shell_command: '"/Users/may/projects/august/scripts/august-dictation" toggle',
        repeat: false,
      },
    ])
  })

  test("activates the Karabiner rule in the selected profile without duplicating it", () => {
    const rule = buildKarabinerRule("/august/scripts/august-dictation")
    const updated = updateKarabinerConfig(
      {
        profiles: [
          {
            name: "Default",
            selected: false,
            complex_modifications: { rules: [{ description: "Keep me", manipulators: [] }] },
          },
          {
            name: "Work",
            selected: true,
            complex_modifications: {
              rules: [{ description: "August dictation: Ctrl-Hyphen toggles speech-to-text", manipulators: [] }],
            },
          },
        ],
      },
      rule,
    )
    const selected = updated.profiles[1]
    const defaultRules = updated.profiles[0]?.complex_modifications?.rules
    const selectedRules = selected?.complex_modifications?.rules
    const repeatedRules = updateKarabinerConfig(updated, rule).profiles[1]?.complex_modifications?.rules
    if (!defaultRules || !selectedRules || !repeatedRules) throw new Error("expected Karabiner rules")

    expect(defaultRules.map((item) => item.description)).toEqual(["Keep me"])
    expect(selectedRules.map((item) => item.description)).toEqual([rule.description])
    expect(repeatedRules).toHaveLength(1)
  })

  test("parses OpenAI transcription JSON and plain text responses", async () => {
    await expect(
      parseTranscriptionResponse(new Response(JSON.stringify({ text: "hello from json" }), { status: 200 })),
    ).resolves.toBe("hello from json")
    await expect(parseTranscriptionResponse(new Response("hello from text\n", { status: 200 }))).resolves.toBe(
      "hello from text",
    )
  })

  test("builds a completion notification that shows transcript text", () => {
    expect(buildTranscriptNotification("hello from the microphone")).toEqual({
      title: "Transcript copied",
      subtitle: "Copied to clipboard",
      body: "hello from the microphone",
    })
    expect(buildTranscriptNotification(`${"word ".repeat(40)}done`).body.endsWith("…")).toBe(true)
  })

  test("formats transcription failures for a visible notification", () => {
    expect(formatDictationError(new Error("OPENAI_API_KEY is required for August dictation transcription"))).toBe(
      "OPENAI_API_KEY is required for August dictation transcription",
    )
    expect(formatDictationError("network failed")).toBe("network failed")
  })

  test("loads OPENAI_API_KEY from global secrets when the environment is missing it", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "august-dictation-secrets-"))
    try {
      const secrets = path.join(tmp, "secrets.env")
      await Bun.write(secrets, 'OTHER=value\nexport OPENAI_API_KEY="secret from file"\n')

      await expect(readOpenAIKey({ env: {}, secretsPath: secrets })).resolves.toBe("secret from file")
    } finally {
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test("forces UTF-8 locale for clipboard and notification child processes", () => {
    expect(utf8ChildEnv({ PATH: "/usr/bin:/bin" })).toEqual({
      PATH: "/usr/bin:/bin",
      LANG: "en_US.UTF-8",
      LC_ALL: "en_US.UTF-8",
      LC_CTYPE: "en_US.UTF-8",
    })
    expect(utf8ChildEnv({ LANG: "ru_RU.UTF-8", LC_CTYPE: "ru_RU.UTF-8" })).toMatchObject({
      LANG: "ru_RU.UTF-8",
      LC_ALL: "ru_RU.UTF-8",
      LC_CTYPE: "ru_RU.UTF-8",
    })
  })
})
