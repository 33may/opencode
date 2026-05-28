import { beforeEach, describe, expect } from "bun:test"
import { Effect, Exit } from "effect"
import { Database } from "@/storage/db"
import { Task } from "@/task/task"
import { TaskID } from "@/task/schema"
import { testEffect } from "../lib/effect"

const it = testEffect(Task.defaultLayer)

beforeEach(() => {
  Database.close()
})

describe("Task", () => {
  it.instance("creates durable AUG tasks and filters them for agent queues", () =>
    Effect.gen(function* () {
      const task = yield* Task.Service

      const created = yield* task.create({
        title: "Ship August talk companion",
        description: "Realtime voice companion that delegates implementation to August.",
        project: "august-talk",
        labels: ["voice", "dream"],
        priority: "high",
        delegate: "august",
        branch: "feat/august-talk",
      })

      expect(String(created.id)).toBe("AUG-1")
      expect(created.status).toBe("todo")
      expect(created.priority).toBe("high")
      expect(created.labels).toEqual(["voice", "dream"])

      const listed = yield* task.list({ project: "august-talk", label: "voice" })
      expect(listed.map((item) => String(item.id))).toEqual(["AUG-1"])
      expect(listed[0].title).toBe("Ship August talk companion")
    }),
  )

  it.instance("updates lifecycle fields, comments, relations, and audit events", () =>
    Effect.gen(function* () {
      const task = yield* Task.Service
      const parent = yield* task.create({ title: "Replace Linear" })
      const child = yield* task.create({ title: "Build local task DB", parentID: parent.id })

      const updated = yield* task.update({ id: child.id, status: "in_progress", labels: ["task-db"], assignee: "agent" })
      const comment = yield* task.comment({ id: child.id, body: "Started implementation.", author: "august" })
      yield* task.comment({ id: child.id, body: "Still working.", author: "august" })
      const relation = yield* task.relate({ id: child.id, targetID: parent.id, type: "blocks" })
      const shown = yield* task.get(child.id)
      const events = yield* task.events(child.id)

      expect(updated.status).toBe("in_progress")
      expect(updated.assignee).toBe("agent")
      expect(comment.body).toBe("Started implementation.")
      expect(relation.type).toBe("blocks")
      expect(shown.parentID).toBe(parent.id)
      expect(shown.comments.map((item) => item.body)).toEqual(["Started implementation.", "Still working."])
      expect(shown.relations.map((item) => `${item.type}:${item.targetID}`)).toEqual([`blocks:${parent.id}`])
      expect(events.map((item) => item.action)).toEqual(["created", "updated", "commented", "commented", "related"])
    }),
  )

  it.instance("rejects dangling parents and clears stale lifecycle timestamps", () =>
    Effect.gen(function* () {
      const task = yield* Task.Service

      const missingCreate = yield* task
        .create({ title: "Dangling child", parentID: TaskID.make("AUG-404") })
        .pipe(Effect.exit)
      expect(Exit.isFailure(missingCreate)).toBe(true)

      const created = yield* task.create({ title: "Lifecycle task", status: "in_progress" })
      expect(created.time.started).toBeDefined()

      const done = yield* task.update({ id: created.id, status: "done" })
      expect(done.time.completed).toBeDefined()

      const reopened = yield* task.update({ id: created.id, status: "todo" })
      expect(reopened.time.started).toBeUndefined()
      expect(reopened.time.completed).toBeUndefined()

      const missingUpdate = yield* task
        .update({ id: created.id, parentID: TaskID.make("AUG-404") })
        .pipe(Effect.exit)
      expect(Exit.isFailure(missingUpdate)).toBe(true)
    }),
  )
})
