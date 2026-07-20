import path from "path"
import { appendFile, mkdir } from "fs/promises"

export type TalkRole = "user" | "assistant" | "system" | "tool"
export type TalkSource = "voice" | "august" | "runtime"

export interface TalkEvent {
  role: TalkRole
  source: TalkSource
  text: string
  time: string
  sessionID?: string
}

export type TalkMessage = TalkEvent

export interface TalkArtifactRun {
  root: string
  directory: string
  sessionID: string
  timestamp: string
  dir: string
  events: string
  messages: string
  manifest: string
}

export function createTalkArtifactRun(input: { root: string; now: Date; sessionID: string; directory: string }) {
  const timestamp = input.now.toISOString().replaceAll(":", "-")
  const dir = path.join(input.root, ".august", "talk", timestamp)
  return {
    root: input.root,
    directory: input.directory,
    sessionID: input.sessionID,
    timestamp,
    dir,
    events: path.join(dir, "events.jsonl"),
    messages: path.join(dir, "messages.jsonl"),
    manifest: path.join(dir, "manifest.json"),
  }
}

export async function appendJsonl(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, JSON.stringify(value) + "\n")
}

export async function writeManifest(run: TalkArtifactRun, data: Record<string, unknown>) {
  await Bun.write(
    run.manifest,
    JSON.stringify({ sessionID: run.sessionID, directory: run.directory, timestamp: run.timestamp, ...data }, undefined, 2) + "\n",
    { createPath: true },
  )
}

export * as TalkArtifact from "./artifact"
