#!/usr/bin/env bun
import path from "node:path"

export type Scenario = {
  id: string
  feature?: string
  agent?: string
  story: string
  prompt: string
  workspace?: { copy?: string[] }
  expected?: {
    final_contains_any?: string[]
    messages_contain_any?: string[]
    tool_calls?: string[]
    files_exist?: string[]
    files_contain?: string[]
    files_unchanged?: string[]
  }
  judge?: { question?: string }
}

const root = path.resolve(import.meta.dir, "..")

if (import.meta.main) await main()

async function main() {
  const scenarioPath = process.argv[2]

  if (!scenarioPath) {
    console.error("Usage: scripts/validate-scenario <scenario.yaml>")
    process.exit(1)
  }

  const scenario = parseScenario(await Bun.file(path.resolve(scenarioPath)).text())
  const runDir = path.join(
    root,
    process.env.AUGUST_RUN_ROOT ?? ".august/runs",
    `${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "Z")}-${scenario.id}`,
  )
  const workspace = path.join(runDir, "workspace")
  const events: unknown[] = []

  await prepareRunDirectory(runDir, workspace, scenario, scenarioPath)

  const server = Bun.spawn([path.join(root, "scripts/august"), "serve", "--hostname", "127.0.0.1", "--port", "0"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })

  try {
    const baseUrl = await waitForServerUrl(server)
    const eventAbort = new AbortController()
    const eventStream = captureEvents(baseUrl, workspace, events, eventAbort.signal)
    const model = parseModel(process.env.AUGUST_VALIDATE_MODEL)
    const session = await api(baseUrl, workspace, "/session", {
      method: "POST",
      body: {
        title: scenario.id,
        permission: [{ permission: "*", pattern: "*", action: "allow" }],
      },
    })
    const sessionID = String(asRecord(session).id)
    const prompt = await api(baseUrl, workspace, `/session/${sessionID}/message`, {
      method: "POST",
      body: {
        agent: scenarioAgent(scenario),
        ...(model ? { model } : {}),
        parts: [{ type: "text", text: scenario.prompt }],
      },
    })
    const messages = await api(baseUrl, workspace, `/session/${sessionID}/message`)
    eventAbort.abort()
    await eventStream.catch(() => undefined)

    const finalText = collectText(prompt) || lastAssistantText(messages)
    const toolCalls = collectToolCalls(messages)
    const hard = await hardAssertions({ scenario, finalText, messages, toolCalls, workspace })
    const judge = scenario.judge?.question
      ? await runJudge({ baseUrl, workspace, scenario, finalText, messages, toolCalls, model })
      : undefined
    const result = {
      id: scenario.id,
      feature: scenario.feature,
      ok: hard.ok && judge?.verdict !== "fail",
      hard,
      judge: judge ? { verdict: judge.verdict } : undefined,
      sessionID,
      runDir,
    }

    await writeJson(path.join(runDir, "messages.json"), messages)
    await writeJson(path.join(runDir, "tool-calls.json"), toolCalls)
    await Bun.write(path.join(runDir, "events.jsonl"), events.map((event) => JSON.stringify(event)).join("\n"))
    await Bun.write(path.join(runDir, "transcript.jsonl"), messagesToJsonl(messages))
    await Bun.write(path.join(runDir, "final.md"), finalText || "")
    await Bun.write(path.join(runDir, "judge.md"), judge?.text ?? "")
    await writeJson(path.join(runDir, "result.json"), result)

    console.log(`${result.ok ? "PASS" : "FAIL"} ${scenario.id}`)
    console.log(runDir)
    if (!result.ok) process.exit(1)
  } finally {
    server.kill()
  }
}

export function parseScenario(input: string): Scenario {
  const lines = input.replaceAll("\r\n", "\n").split("\n")
  const data: Record<string, unknown> = {}
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const top = line.match(/^([a-zA-Z0-9_]+):(?:\s*(.*))?$/)
    if (!top) continue
    if (top[2] === "|") {
      const block: string[] = []
      for (i++; i < lines.length && /^\s+/.test(lines[i]); i++) block.push(lines[i].replace(/^\s{2}/, ""))
      i--
      data[top[1]] = block.join("\n").trim()
      continue
    }
    if (top[2]) {
      data[top[1]] = top[2]
      continue
    }
    const nested: Record<string, unknown> = {}
    for (i++; i < lines.length && /^\s+/.test(lines[i]); i++) {
      const nestedLine = lines[i]
      const key = nestedLine.match(/^\s{2}([a-zA-Z0-9_]+):(?:\s*(.*))?$/)
      if (!key) continue
      if (key[2]) {
        nested[key[1]] = key[2]
        continue
      }
      const list: string[] = []
      for (i++; i < lines.length && /^\s{4}-\s+/.test(lines[i]); i++) list.push(lines[i].replace(/^\s{4}-\s+/, ""))
      i--
      nested[key[1]] = list
    }
    i--
    data[top[1]] = nested
  }
  if (typeof data.id !== "string" || typeof data.story !== "string" || typeof data.prompt !== "string") {
    throw new Error("scenario requires id, story, and prompt")
  }
  return data as Scenario
}

export function scenarioAgent(scenario: Scenario, env?: { AUGUST_VALIDATE_AGENT?: string }) {
  return (env ? env.AUGUST_VALIDATE_AGENT : process.env.AUGUST_VALIDATE_AGENT) ?? scenario.agent ?? "build"
}

async function prepareRunDirectory(runDir: string, workspace: string, scenario: Scenario, scenarioPath: string) {
  await Bun.write(path.join(runDir, ".keep"), "")
  await Bun.write(path.join(workspace, ".keep"), "")
  await Bun.write(path.join(runDir, "scenario.yaml"), await Bun.file(path.resolve(scenarioPath)).text())
  for (const file of scenario.workspace?.copy ?? []) {
    const from = path.join(root, file)
    const to = path.join(workspace, file)
    await Bun.write(to, await Bun.file(from).arrayBuffer())
  }
}

async function waitForServerUrl(server: Bun.Subprocess<"ignore", "pipe", "pipe">) {
  const reader = server.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const timeout = Date.now() + 30_000
  while (Date.now() < timeout) {
    const next = await reader.read()
    if (next.done) break
    buffer += decoder.decode(next.value)
    const match = buffer.match(/opencode server listening on (http:\/\/[^\s]+)/)
    if (match) return match[1]
  }
  throw new Error("timed out waiting for opencode server")
}

async function api(baseUrl: string, directory: string, endpoint: string, init?: { method?: string; body?: unknown }) {
  const url = new URL(endpoint, baseUrl)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${endpoint} failed: ${response.status} ${await response.text()}`)
  if (response.status === 204) return undefined
  return await response.json()
}

async function captureEvents(baseUrl: string, directory: string, events: unknown[], signal: AbortSignal) {
  const url = new URL("/event", baseUrl)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, { signal })
  if (!response.body) return
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""
  while (!signal.aborted) {
    const next = await reader.read()
    if (next.done) break
    buffer += next.value
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const data = chunk
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n")
      if (data) events.push(JSON.parse(data))
    }
  }
}

async function runJudge(input: {
  baseUrl: string
  workspace: string
  scenario: Scenario
  finalText: string
  messages: unknown
  toolCalls: unknown[]
  model?: { providerID: string; modelID: string }
}) {
  const session = await api(input.baseUrl, input.workspace, "/session", {
    method: "POST",
    body: { title: `${input.scenario.id}-judge`, permission: [{ permission: "*", pattern: "*", action: "allow" }] },
  })
  const response = await api(input.baseUrl, input.workspace, `/session/${String(asRecord(session).id)}/message`, {
    method: "POST",
    body: {
      agent: process.env.AUGUST_VALIDATE_AGENT ?? "build",
      ...(input.model ? { model: input.model } : {}),
      parts: [
        {
          type: "text",
          text: `Judge this validation run. Reply with one line starting with "Verdict: pass", "Verdict: fail", or "Verdict: unclear", then a short explanation.\n\nStory: ${input.scenario.story}\nQuestion: ${input.scenario.judge?.question}\nExpected: ${JSON.stringify(input.scenario.expected ?? {})}\nTool calls: ${JSON.stringify(input.toolCalls)}\nFinal answer:\n${input.finalText}\n\nMessages:\n${JSON.stringify(input.messages).slice(0, 20_000)}`,
        },
      ],
    },
  })
  const text = collectText(response)
  const verdict = /verdict:\s*fail/i.test(text) ? "fail" : /verdict:\s*pass/i.test(text) ? "pass" : "unclear"
  return { text, verdict }
}

function parseModel(input?: string) {
  if (!input) return
  const [providerID, ...rest] = input.split("/")
  const modelID = rest.join("/")
  if (!providerID || !modelID) throw new Error("AUGUST_VALIDATE_MODEL must use provider/model")
  return { providerID, modelID }
}

export async function hardAssertions(input: { scenario: Scenario; finalText: string; messages: unknown; toolCalls: unknown[]; workspace: string }) {
  const failures = [] as string[]
  const allMessages = JSON.stringify(input.messages)
  if (!input.finalText.trim()) failures.push("final answer is empty")
  if (input.scenario.expected?.final_contains_any?.length && !containsAny(input.finalText, input.scenario.expected.final_contains_any)) {
    failures.push(`final answer did not contain any of: ${input.scenario.expected.final_contains_any.join(", ")}`)
  }
  if (
    input.scenario.expected?.messages_contain_any?.length &&
    !containsAny(allMessages, input.scenario.expected.messages_contain_any)
  ) {
    failures.push(`messages did not contain any of: ${input.scenario.expected.messages_contain_any.join(", ")}`)
  }
  for (const tool of input.scenario.expected?.tool_calls ?? []) {
    if (!input.toolCalls.some((call) => JSON.stringify(call).includes(tool))) failures.push(`missing tool call: ${tool}`)
  }
  for (const file of input.scenario.expected?.files_exist ?? []) {
    const resolved = resolveWorkspaceFile(input.workspace, file)
    if (!resolved) {
      failures.push(`expected file path escapes workspace: ${file}`)
      continue
    }
    if (!(await Bun.file(resolved).exists())) failures.push(`missing expected file: ${file}`)
  }
  for (const entry of input.scenario.expected?.files_contain ?? []) {
    const split = entry.indexOf("::")
    if (split === -1) {
      failures.push(`invalid files_contain assertion: ${entry}`)
      continue
    }
    const file = entry.slice(0, split)
    const needle = entry.slice(split + 2)
    const resolved = resolveWorkspaceFile(input.workspace, file)
    if (!resolved) {
      failures.push(`expected file path escapes workspace: ${file}`)
      continue
    }
    if (!(await Bun.file(resolved).exists())) {
      failures.push(`missing expected file: ${file}`)
      continue
    }
    if (!containsAny(await Bun.file(resolved).text(), [needle])) {
      failures.push(`expected ${file} to contain: ${needle}`)
    }
  }
  for (const file of input.scenario.expected?.files_unchanged ?? []) {
    const resolved = resolveWorkspaceFile(input.workspace, file)
    if (!resolved) {
      failures.push(`expected file path escapes workspace: ${file}`)
      continue
    }
    if (!(await Bun.file(resolved).exists())) {
      failures.push(`missing expected file: ${file}`)
      continue
    }
    const source = path.join(root, file)
    if (!(await Bun.file(source).exists())) {
      failures.push(`missing source file for unchanged assertion: ${file}`)
      continue
    }
    if ((await Bun.file(resolved).text()) !== (await Bun.file(source).text())) {
      failures.push(`expected file to remain unchanged: ${file}`)
    }
  }
  return { ok: failures.length === 0, failures }
}

function resolveWorkspaceFile(workspace: string, file: string) {
  const workspaceRoot = path.resolve(workspace)
  const resolved = path.resolve(workspaceRoot, file)
  if (resolved === workspaceRoot || resolved.startsWith(`${workspaceRoot}${path.sep}`)) return resolved
}

function containsAny(value: string, needles: string[]) {
  const lower = value.toLowerCase()
  return needles.some((needle) => lower.includes(needle.toLowerCase()))
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function collectText(value: unknown): string {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return ""
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join("\n")
  const record = value as Record<string, unknown>
  return [record.text, record.content, record.parts, record.message, record.data].map(collectText).filter(Boolean).join("\n")
}

function lastAssistantText(messages: unknown) {
  const list = Array.isArray(messages) ? messages : []
  return [...list].reverse().map(collectText).find(Boolean) ?? ""
}

function collectToolCalls(value: unknown): unknown[] {
  const calls: unknown[] = []
  const visit = (next: unknown) => {
    if (!next || typeof next !== "object") return
    if (Array.isArray(next)) return next.forEach(visit)
    const record = next as Record<string, unknown>
    if (record.type === "tool" || record.type === "tool_call" || record.tool || record.callID) calls.push(record)
    Object.values(record).forEach(visit)
  }
  visit(value)
  return calls
}

function messagesToJsonl(messages: unknown) {
  return (Array.isArray(messages) ? messages : [messages]).map((message) => JSON.stringify(message)).join("\n")
}

async function writeJson(file: string, value: unknown) {
  await Bun.write(file, `${JSON.stringify(value, null, 2)}\n`)
}
