#!/usr/bin/env bun
import { spawn } from "node:child_process"
import { accessSync, constants, existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const appName = "August Dictation"
const defaultModel = "gpt-4o-transcribe"
const karabinerRuleDescription = "August dictation: Ctrl-O toggles speech-to-text"
const legacyKarabinerRuleDescriptions = ["August dictation: Ctrl-Hyphen toggles speech-to-text"]
const ffmpegFallbacks = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]
const defaultLocale = "en_US.UTF-8"
const defaultSecretsPath = path.join(os.homedir(), ".config", "secrets.env")
const stateDir = process.env.AUGUST_DICTATION_STATE_DIR ?? path.join(os.homedir(), ".local", "state", "august", "dictation")
const statePath = path.join(stateDir, "state.json")

export type RecorderOptions = {
  output: string
  input?: string
  executable?: string
}

export type ResolveExecutableOptions = {
  name: string
  env?: string
  path?: string
  fallbacks?: string[]
}

export type ReadOpenAIKeyOptions = {
  env?: Record<string, string | undefined>
  secretsPath?: string
}

export type KarabinerRule = {
  description: string
  manipulators: Array<{
    type: "basic"
    from: {
      key_code: string
      modifiers: {
        mandatory: string[]
        optional: string[]
      }
    }
    to: Array<{
      shell_command: string
      repeat: false
    }>
  }>
}

export type KarabinerConfig = Record<string, unknown> & {
  profiles: Array<
    Record<string, unknown> & {
      selected?: boolean
      complex_modifications?: Record<string, unknown> & {
        rules?: KarabinerRule[]
      }
    }
  >
}

type RecordingState = {
  pid: number
  file: string
  started_at: string
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    await notify("Dictation failed", formatDictationError(error))
    console.error(`scripts/august-dictation: ${formatDictationError(error)}`)
    process.exit(1)
  }
}

export function buildRecorderCommand(options: RecorderOptions) {
  return [
    options.executable ?? "ffmpeg",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "avfoundation",
    "-i",
    options.input ?? process.env.AUGUST_DICTATION_INPUT ?? ":0",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-y",
    options.output,
  ]
}

export function resolveExecutable(options: ResolveExecutableOptions) {
  return [
    options.env,
    ...(options.path ?? process.env.PATH ?? "").split(path.delimiter).map((directory) => path.join(directory, options.name)),
    ...(options.fallbacks ?? []),
  ]
    .filter(isString)
    .find(canExecute)
}

export function buildRecordingState(input: { pid: number | undefined; file: string; startedAt: Date }): RecordingState {
  if (typeof input.pid !== "number") throw new Error("Recorder process did not start")
  return { pid: input.pid, file: input.file, started_at: input.startedAt.toISOString() }
}

export function buildTranscriptNotification(transcript: string) {
  return {
    title: "Transcript copied",
    subtitle: "Copied to clipboard",
    body: transcript.trim() ? previewText(transcript) : "No transcript text returned.",
  }
}

export function formatDictationError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function readOpenAIKey(options: ReadOpenAIKeyOptions = {}) {
  const env = options.env ?? process.env
  if (env.OPENAI_API_KEY?.trim()) return env.OPENAI_API_KEY.trim()

  const key = parseEnvValue(await readOptionalText(options.secretsPath ?? env.AUGUST_SECRETS_ENV ?? defaultSecretsPath), "OPENAI_API_KEY")
  if (key) return key

  throw new Error(`OPENAI_API_KEY is required for August dictation transcription. Add it to ${options.secretsPath ?? env.AUGUST_SECRETS_ENV ?? defaultSecretsPath} or export it for Karabiner.`)
}

export function utf8ChildEnv(env: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const locale = [env.LC_ALL, env.LC_CTYPE, env.LANG].find(isUTF8Locale) ?? defaultLocale
  return {
    ...env,
    LANG: isUTF8Locale(env.LANG) ? env.LANG : locale,
    LC_ALL: locale,
    LC_CTYPE: locale,
  }
}

export function buildKarabinerRule(scriptPath: string): KarabinerRule {
  return {
    description: karabinerRuleDescription,
    manipulators: [
      {
        type: "basic",
        from: {
          key_code: "o",
          modifiers: {
            mandatory: ["control"],
            optional: ["any"],
          },
        },
        to: [
          {
            shell_command: `${shellQuote(scriptPath)} toggle`,
            repeat: false,
          },
        ],
      },
    ],
  }
}

export function updateKarabinerConfig(config: KarabinerConfig, rule: KarabinerRule): KarabinerConfig {
  const profiles = config.profiles.length
    ? config.profiles
    : [{ name: "Default profile", selected: true, complex_modifications: { rules: [] } }]
  const selectedIndex = Math.max(
    0,
    profiles.findIndex((profile) => profile.selected),
  )

  return {
    ...config,
    profiles: profiles.map((profile, index) => {
      if (index !== selectedIndex) return profile
      const complex = isRecord(profile.complex_modifications) ? profile.complex_modifications : {}
      const rules = Array.isArray(complex.rules) ? complex.rules.filter(isKarabinerRuleLike) : []

      return {
        ...profile,
        complex_modifications: {
          ...complex,
          rules: [
            ...rules.filter(
              (item) => item.description !== rule.description && !legacyKarabinerRuleDescriptions.includes(item.description),
            ),
            rule,
          ],
        },
      }
    }),
  }
}

export async function parseTranscriptionResponse(response: Response) {
  const body = await response.text()
  if (!response.ok) throw new Error(`OpenAI transcription failed (${response.status}): ${body}`)

  try {
    const json = JSON.parse(body) as unknown
    if (isRecord(json) && typeof json.text === "string") return json.text.trim()
  } catch {
    return body.trim()
  }

  return body.trim()
}

async function main() {
  const command = process.argv[2] ?? "toggle"

  if (command === "toggle") return await toggle()
  if (command === "start") return await startRecording()
  if (command === "stop") return await stopRecording()
  if (command === "status") return await printStatus()
  if (command === "install-karabiner") return await installKarabiner()
  if (command === "--help" || command === "-h" || command === "help") return printUsage()

  console.error(`scripts/august-dictation: unknown command ${command}`)
  printUsage()
  process.exit(1)
}

async function toggle() {
  const state = await activeState()
  if (state) return await stopRecording(state)
  return await startRecording()
}

async function startRecording() {
  if (process.platform !== "darwin") {
    console.error("scripts/august-dictation: recording is only implemented for macOS avfoundation")
    process.exit(1)
  }

  const current = await activeState()
  if (current) {
    await notify("Already recording", "Press Ctrl-O again to stop and transcribe.")
    return
  }

  await fs.mkdir(stateDir, { recursive: true })
  const file = path.join(stateDir, `recording-${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}.wav`)
  const ffmpeg = resolveExecutable({ name: "ffmpeg", env: process.env.AUGUST_DICTATION_FFMPEG, fallbacks: ffmpegFallbacks })
  if (!ffmpeg) {
    await fs.rm(statePath, { force: true })
    await notify("Recording failed", "ffmpeg was not found. Install ffmpeg or set AUGUST_DICTATION_FFMPEG.")
    console.error("scripts/august-dictation: ffmpeg not found. Install ffmpeg or set AUGUST_DICTATION_FFMPEG.")
    process.exit(1)
  }

  const command = buildRecorderCommand({ output: file, executable: ffmpeg })
  const child = spawn(command[0] ?? "ffmpeg", command.slice(1), {
    detached: true,
    stdio: "ignore",
  })
  const state = buildRecordingState({ pid: child.pid, file, startedAt: new Date() })
  await Bun.sleep(500)
  if (!processExists(state.pid)) {
    await fs.rm(statePath, { force: true })
    await notify("Recording failed", "ffmpeg exited immediately. Check microphone permission or input device.")
    console.error("scripts/august-dictation: ffmpeg exited immediately. Check microphone permission or AUGUST_DICTATION_INPUT.")
    process.exit(1)
  }

  child.unref()
  await fs.writeFile(statePath, `${JSON.stringify(state)}\n`)
  await notify("Recording started", "Press Ctrl-O again to stop and transcribe.")
  console.log(`August dictation recording started: ${file}`)
}

async function stopRecording(state?: RecordingState) {
  const active = state ?? (await activeState())
  if (!active) {
    await notify("No recording in progress", "Press Ctrl-O to start recording.")
    return
  }

  await stopProcess(active.pid)
  await fs.rm(statePath, { force: true })
  await notify("Recording stopped", "Transcribing with OpenAI…")

  const transcript = await transcribe(active.file)
  await copyToClipboard(transcript)
  const notification = buildTranscriptNotification(transcript)
  await notify(notification.title, notification.body, notification.subtitle)
  console.log(transcript)
}

async function transcribe(file: string) {
  const key = await readOpenAIKey()

  const form = new FormData()
  form.append("model", process.env.AUGUST_DICTATION_MODEL ?? defaultModel)
  form.append("response_format", "json")
  form.append("file", Bun.file(file), path.basename(file))

  return await parseTranscriptionResponse(
    await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(Number(process.env.AUGUST_DICTATION_TIMEOUT_MS ?? 60000)),
    }),
  )
}

async function installKarabiner() {
  const configPath = path.join(os.homedir(), ".config", "karabiner", "karabiner.json")
  const initial = existsSync(configPath)
    ? parseKarabinerConfig(await Bun.file(configPath).text(), configPath)
    : { profiles: [{ name: "Default profile", selected: true, complex_modifications: { rules: [] } }] }

  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await Bun.write(configPath, `${JSON.stringify(updateKarabinerConfig(initial, buildKarabinerRule(path.join(root, "scripts", "august-dictation"))), null, 2)}\n`)
  await notify("Karabiner hotkey installed", "Ctrl-O toggles August dictation.")
  console.log(`Updated Karabiner config: ${configPath}`)
  console.log("Restart or reload Karabiner-Elements if the rule does not appear immediately.")
}

async function printStatus() {
  const state = await activeState()
  if (!state) return console.log("August dictation is idle")
  console.log(`August dictation is recording: pid ${state.pid}, file ${state.file}`)
}

function printUsage() {
  console.log(`Usage: scripts/august-dictation [toggle|start|stop|status|install-karabiner]

Ctrl-O integration:
  scripts/august-dictation install-karabiner

Requirements:
  - macOS microphone permission for the shell that runs ffmpeg
  - ffmpeg available on PATH
  - OPENAI_API_KEY exported in the environment visible to Karabiner shell_command

Environment:
  AUGUST_DICTATION_MODEL       OpenAI audio transcription model (default: ${defaultModel})
  AUGUST_DICTATION_INPUT       ffmpeg avfoundation input (default: :0)
  AUGUST_DICTATION_STATE_DIR   recording/state directory (default: ${stateDir})`)
}

async function activeState() {
  const state = await readState()
  if (!state) {
    await fs.rm(statePath, { force: true })
    return undefined
  }
  if (processExists(state.pid)) return state
  await fs.rm(statePath, { force: true })
  return undefined
}

async function readState(): Promise<RecordingState | undefined> {
  try {
    const value = JSON.parse(await Bun.file(statePath).text()) as unknown
    if (!isRecord(value)) return undefined
    if (typeof value.pid !== "number") return undefined
    if (typeof value.file !== "string") return undefined
    if (typeof value.started_at !== "string") return undefined
    return { pid: value.pid, file: value.file, started_at: value.started_at }
  } catch {
    return undefined
  }
}

async function stopProcess(pid: number) {
  if (!processExists(pid)) return
  process.kill(pid, "SIGINT")
  if (!(await waitForExit(pid, 1200))) process.kill(pid, "SIGTERM")
  await waitForExit(pid, 1200)
}

async function waitForExit(pid: number, timeout: number) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (!processExists(pid)) return true
    await Bun.sleep(100)
  }
  return !processExists(pid)
}

function processExists(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function copyToClipboard(text: string) {
  const child = spawn("pbcopy", { stdio: ["pipe", "ignore", "ignore"], env: utf8ChildEnv() })
  child.stdin.end(text)
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited with ${code ?? "unknown"}`))))
  })
}

async function notify(title: string, body: string, detail?: string) {
  if (process.platform !== "darwin") return
  const script = `display notification ${appleScriptString(body)} with title ${appleScriptString(appName)} subtitle ${appleScriptString(detail ? `${title} · ${detail}` : title)}`
  const child = spawn("osascript", ["-e", script], { stdio: "ignore", env: utf8ChildEnv() })
  await new Promise<void>((resolve) => child.on("exit", () => resolve()))
}

function previewText(value: string) {
  const text = value.trim().replace(/\s+/g, " ")
  if (text.length <= 180) return text
  return `${text.slice(0, 179)}…`
}

async function readOptionalText(file: string) {
  try {
    return await Bun.file(file).text()
  } catch {
    return ""
  }
}

function parseEnvValue(text: string, name: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => (line.startsWith("export ") ? line.slice("export ".length).trim() : line))
    .map((line) => {
      const index = line.indexOf("=")
      if (index === -1) return undefined
      if (line.slice(0, index).trim() !== name) return undefined
      return unquoteEnvValue(line.slice(index + 1).trim())
    })
    .find((value) => value !== undefined)
}

function unquoteEnvValue(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replaceAll('\\"', '"')
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1)
  const index = value.indexOf(" #")
  return (index === -1 ? value : value.slice(0, index)).trim()
}

function parseKarabinerConfig(text: string, file: string): KarabinerConfig {
  try {
    const config = JSON.parse(text) as unknown
    if (isRecord(config) && Array.isArray(config.profiles)) return config as KarabinerConfig
  } catch (error) {
    throw new Error(`Invalid Karabiner JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { profiles: [{ name: "Default profile", selected: true, complex_modifications: { rules: [] } }] }
}

function isKarabinerRuleLike(value: unknown): value is KarabinerRule {
  return isRecord(value) && typeof value.description === "string" && Array.isArray(value.manipulators)
}

function canExecute(value: string) {
  try {
    accessSync(value, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isUTF8Locale(value: unknown) {
  return typeof value === "string" && /utf-?8/i.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function shellQuote(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

function appleScriptString(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}
