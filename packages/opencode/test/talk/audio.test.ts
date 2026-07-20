import { expect, test } from "bun:test"
import { checkSoxAvailable, resolveAudioCommands } from "@/talk/audio"

test("resolves macOS sox raw PCM commands", () => {
  expect(resolveAudioCommands("darwin", {})).toEqual({
    input: {
      command: "rec",
      args: ["-q", "-b", "16", "-e", "signed-integer", "-c", "1", "-r", "24000", "-t", "raw", "-"],
    },
    output: {
      command: "play",
      args: ["-q", "-b", "16", "-e", "signed-integer", "-c", "1", "-r", "24000", "-t", "raw", "-"],
    },
  })
})

test("rejects non-darwin platforms unless explicitly allowed", () => {
  expect(() => resolveAudioCommands("linux", {})).toThrow("august talk audio is macOS-first")
  expect(resolveAudioCommands("linux", { AUGUST_TALK_ALLOW_NON_DARWIN: "1" }).input.command).toBe("rec")
})

test("checks sox availability through injected command runner", async () => {
  expect(await checkSoxAvailable(async (command) => command === "rec" || command === "play")).toEqual({ ok: true })
  expect(await checkSoxAvailable(async (command) => command === "rec")).toEqual({
    ok: false,
    missing: ["play"],
    message: "Missing sox commands: play",
  })
})
