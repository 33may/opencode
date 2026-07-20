import { beforeEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { ProviderID, ModelID } from "@/provider/schema"
import { Agent } from "@/agent/agent"
import { AugustTask } from "@/augusttask/service/augusttask-service"
import { ToolRegistry } from "@/tool/registry"
import { Database } from "@/storage/db"
import { MessageID, SessionID } from "@/session/schema"
import { TaskID } from "@/task/schema"
import { TaskEventTable, TaskIssueTable } from "@/task/task.sql"
import { TaskDBTool, type TaskDBParams } from "@/tool/taskdb"
import * as Tool from "@/tool/tool"
import * as Truncate from "@/tool/truncate"
import { testEffect } from "../lib/effect"
import { registryLayer } from "./taskdb.fixture"

const it = testEffect(Layer.mergeAll(registryLayer(), Agent.defaultLayer, AugustTask.defaultLayer, Truncate.defaultLayer))

beforeEach(() => {
  Database.close()
})

describe("taskdb tool", () => {
  it.instance("is not visible in the default tool registry", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const agents = yield* Agent.Service
      const agent = yield* agents.get("build")

      expect(yield* registry.ids()).not.toContain("taskdb")
      expect((yield* registry.all()).map((tool) => tool.id)).not.toContain("taskdb")
      expect(
        (yield* registry.tools({ providerID: ProviderID.openai, modelID: ModelID.make("gpt-5.5"), agent })).map(
          (tool) => tool.id,
        ),
      ).not.toContain("taskdb")
    }),
  )

  it.instance("can still create a durable task through the direct compatibility tool", () =>
    Effect.gen(function* () {
      const result = yield* runTaskdb({
        action: "create",
        title: "Track autonomous work",
        project: "august",
        labels: ["automation"],
      })

      expect(result.title).toBe("AUG-1")
      expect(JSON.parse(result.output)).toMatchObject({ id: "AUG-1", title: "Track autonomous work" })
    }),
  )

  it.instance("returns structured JSON errors for expected bad tool input", () =>
    Effect.gen(function* () {
      const result = yield* runTaskdb({ action: "show" })

      expect(result.title).toBe("taskdb error")
      expect(JSON.parse(result.output)).toMatchObject({ error: { message: "taskdb action requires id" } })
    }),
  )

  it.instance("uses AugustTask project counters without colliding with existing AugustTask issues", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      expect(String((yield* augusttask.createIssue({ projectKey: "AUG", title: "Created semantically" })).id)).toBe("AUG-1")

      const result = yield* runTaskdb({ action: "create", title: "Created through compatibility tool" })

      expect(result.title).toBe("AUG-2")
      expect(JSON.parse(result.output)).toMatchObject({ id: "AUG-2", projectKey: "AUG" })
    }),
  )

  it.instance("seeds event counters from existing task events when creating through taskdb", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      yield* Effect.sync(() =>
        Database.use((db) => {
          const now = Date.now()
          db.insert(TaskIssueTable)
            .values({
              id: TaskID.make("AUG-1"),
              sequence: 1,
              title: "Existing task",
              description: "",
              status: "todo",
              priority: "medium",
              project: "AUG",
              labels: [],
              source: "august",
              time_created: now,
              time_updated: now,
            })
            .run()
          db.insert(TaskEventTable)
            .values({
              id: "te_existing",
              issue_id: TaskID.make("AUG-1"),
              sequence: 1,
              action: "created",
              data: {},
              time_created: now,
            })
            .run()
        }),
      )

      const result = yield* runTaskdb({ action: "create", title: "Created after legacy event" })
      const events = yield* augusttask.listIssueEvents("AUG-2")

      expect(result.title).toBe("AUG-2")
      expect(events.map((event) => event.sequence)).toEqual([2])
    }),
  )

  it.instance("normalizes legacy project strings and auto-creates missing compatibility projects", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service

      const result = yield* runTaskdb({ action: "create", title: "Build voice notes", project: "Voice Companion" })
      const listed = yield* runTaskdb({ action: "list", project: "Voice Companion" })
      const project = yield* augusttask.getProject("VOICE_COMPANION")

      expect(JSON.parse(result.output)).toMatchObject({
        id: "VOICE_COMPANION-1",
        project: "Voice Companion",
        projectKey: "VOICE_COMPANION",
      })
      expect(JSON.parse(listed.output)).toEqual([
        expect.objectContaining({ id: "VOICE_COMPANION-1", projectKey: "VOICE_COMPANION" }),
      ])
      expect(project.name).toBe("Voice Companion")
    }),
  )

  it.instance("lists migrated invalid legacy projects by stored project name", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      const legacyProjectName = "august-talk/old.value.with.too.long.name"
      yield* augusttask.createProject({ key: "LEGACY_1", name: legacyProjectName })
      yield* augusttask.createIssue({ projectKey: "LEGACY_1", title: "Migrated legacy task" })

      const listed = yield* runTaskdb({ action: "list", project: legacyProjectName })

      expect(JSON.parse(listed.output)).toEqual([
        expect.objectContaining({ id: "LEGACY_1-1", project: legacyProjectName, projectKey: "LEGACY_1" }),
      ])
    }),
  )
})

function runTaskdb(params: TaskDBParams) {
  return executeTaskdb(params)
}

const executeTaskdb = Effect.fn("taskdb.test.executeTaskdb")(function* (params: TaskDBParams) {
  const taskdbInfo = yield* TaskDBTool
  const taskdb = yield* Tool.init(taskdbInfo)

  return yield* taskdb.execute(params, {
    sessionID: SessionID.make("ses_test"),
    messageID: MessageID.make("msg_test"),
    agent: "build",
    abort: new AbortController().signal,
    messages: [],
    metadata: () => Effect.void,
    ask: () => Effect.void,
  })
})
