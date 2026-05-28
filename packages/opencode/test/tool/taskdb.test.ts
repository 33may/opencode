import { beforeEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ProviderID, ModelID } from "@/provider/schema"
import { Agent } from "@/agent/agent"
import { ToolRegistry } from "@/tool/registry"
import { Database } from "@/storage/db"
import { MessageID, SessionID } from "@/session/schema"
import { testEffect } from "../lib/effect"
import { registryLayer } from "./taskdb.fixture"

const it = testEffect(Layer.mergeAll(registryLayer(), Agent.defaultLayer))

beforeEach(() => {
  Database.close()
})

describe("taskdb tool", () => {
  it.instance("is available to agents and can create a durable task", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const agents = yield* Agent.Service
      const agent = yield* agents.get("build")
      const tools = yield* registry.tools({ providerID: ProviderID.openai, modelID: ModelID.make("gpt-5.5"), agent })
      const taskdb = tools.find((tool) => tool.id === "taskdb")

      if (!taskdb) throw new Error("taskdb tool was not registered")
      const result = yield* taskdb.execute(
        { action: "create", title: "Track autonomous work", project: "august", labels: ["automation"] },
        {
          sessionID: SessionID.make("ses_test"),
          messageID: MessageID.make("msg_test"),
          agent: "build",
          abort: new AbortController().signal,
          messages: [],
          metadata: () => Effect.void,
          ask: () => Effect.void,
        },
      )

      expect(result.title).toBe("AUG-1")
      expect(JSON.parse(result.output)).toMatchObject({ id: "AUG-1", title: "Track autonomous work" })
    }),
  )

  it.instance("returns structured JSON errors for expected bad tool input", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const agents = yield* Agent.Service
      const agent = yield* agents.get("build")
      const tools = yield* registry.tools({ providerID: ProviderID.openai, modelID: ModelID.make("gpt-5.5"), agent })
      const taskdb = tools.find((tool) => tool.id === "taskdb")
      if (!taskdb) throw new Error("taskdb tool was not registered")

      const result = yield* taskdb.execute(
        { action: "show" },
        {
          sessionID: SessionID.make("ses_test"),
          messageID: MessageID.make("msg_test"),
          agent: "build",
          abort: new AbortController().signal,
          messages: [],
          metadata: () => Effect.void,
          ask: () => Effect.void,
        },
      )

      expect(result.title).toBe("taskdb error")
      expect(JSON.parse(result.output)).toMatchObject({ error: { message: "taskdb action requires id" } })
    }),
  )
})
