export interface AudioCommandSpec {
  command: string
  args: string[]
}

export interface AudioCommandSet {
  input: AudioCommandSpec
  output: AudioCommandSpec
}

const rawPcmArgs = ["-q", "-b", "16", "-e", "signed-integer", "-c", "1", "-r", "24000", "-t", "raw", "-"]

export function resolveAudioCommands(platform: NodeJS.Platform | string, env: Record<string, string | undefined>) {
  if (platform !== "darwin" && env.AUGUST_TALK_ALLOW_NON_DARWIN !== "1") {
    throw new Error("august talk audio is macOS-first; set AUGUST_TALK_ALLOW_NON_DARWIN=1 to bypass")
  }
  return {
    input: { command: "rec", args: rawPcmArgs },
    output: { command: "play", args: rawPcmArgs },
  }
}

export async function checkSoxAvailable(exists: (command: "rec" | "play") => boolean | Promise<boolean>) {
  const missing = (await Promise.all(["rec", "play"].map(async (command) => ((await exists(command as "rec" | "play")) ? undefined : command)))).filter(
    (command): command is "rec" | "play" => command !== undefined,
  )
  if (missing.length === 0) return { ok: true as const }
  return { ok: false as const, missing, message: `Missing sox commands: ${missing.join(", ")}` }
}

export * as TalkAudio from "./audio"
