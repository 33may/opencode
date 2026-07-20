import { beforeEach, describe, expect, test } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { IssueID } from "@/augusttask/domain/issue"
import { ProjectKey } from "@/augusttask/domain/project"
import { AugustTaskRepository } from "@/augusttask/repository/augusttask-repository"
import { AugustTask } from "@/augusttask/service/augusttask-service"
import { Database } from "@/storage/db"
import { TaskID } from "@/task/schema"
import { TaskIssueTable } from "@/task/task.sql"
import { testEffect } from "../lib/effect"

const it = testEffect(AugustTask.defaultLayer)

beforeEach(() => {
  Database.close()
})

describe("AugustTask service", () => {
  it.instance("creates project-scoped issues", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service

      yield* augusttask.createProject({ key: "voice", name: "Voice Companion" })
      const issue = yield* augusttask.createIssue({ projectKey: "voice", title: "Build talker" })

      expect(issue).toMatchObject({
        id: "VOICE-1",
        projectKey: "VOICE",
        sequence: 1,
        title: "Build talker",
      })
    }),
  )

  it.instance("lists projects and keeps issue sequences project-local", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service

      yield* augusttask.createProject({ key: "VOICE", name: "Voice" })

      expect((yield* augusttask.listProjects({})).map((project) => String(project.key))).toEqual(["AUG", "VOICE"])
      expect((yield* augusttask.getProject("VOICE")).name).toBe("Voice")
      expect(String((yield* augusttask.createIssue({ projectKey: "AUG", title: "First" })).id)).toBe("AUG-1")
      expect(String((yield* augusttask.createIssue({ projectKey: "VOICE", title: "First" })).id)).toBe("VOICE-1")
      expect(String((yield* augusttask.createIssue({ projectKey: "VOICE", title: "Second" })).id)).toBe("VOICE-2")
    }),
  )

  it.instance("requires projects and parents before creating issues", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      const missingProject = yield* augusttask
        .createIssue({ projectKey: "MISSING", title: "No project" })
        .pipe(Effect.exit)
      expect(Exit.isFailure(missingProject)).toBe(true)

      const missingParent = yield* augusttask
        .createIssue({ projectKey: "AUG", title: "No parent", parentID: "AUG-404" })
        .pipe(Effect.exit)
      expect(Exit.isFailure(missingParent)).toBe(true)
    }),
  )

  it.instance("updates lifecycle fields, comments, relations, and audit events", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      const parent = yield* augusttask.createIssue({ projectKey: "AUG", title: "Replace Linear" })
      const child = yield* augusttask.createIssue({
        projectKey: "AUG",
        title: "Build local task DB",
        parentID: parent.id,
      })

      const started = yield* augusttask.setIssueStatus({ id: child.id, status: "in_progress" })
      const comment = yield* augusttask.addIssueComment({
        id: child.id,
        body: "Started implementation.",
        author: "august",
      })
      const relation = yield* augusttask.relateIssues({ id: child.id, targetID: parent.id, type: "blocks" })
      const shown = yield* augusttask.getIssue(child.id)
      const events = yield* augusttask.listIssueEvents(child.id)

      expect(started.status).toBe("in_progress")
      expect(started.time.started).toBeDefined()
      expect(comment.body).toBe("Started implementation.")
      expect(relation.type).toBe("blocks")
      expect(shown.comments.map((item) => item.body)).toEqual(["Started implementation."])
      expect(shown.relations.map((item) => `${item.type}:${item.targetID}`)).toEqual([`blocks:${parent.id}`])
      expect(events.map((item) => item.action)).toEqual(["created", "updated", "commented", "related"])
    }),
  )

  it.instance("seeds project-scoped counters from preexisting issue IDs", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      yield* Effect.sync(() =>
        Database.use((db) =>
          db
            .insert(TaskIssueTable)
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
              time_created: Date.now(),
              time_updated: Date.now(),
            })
            .run(),
        ),
      )

      expect(String((yield* augusttask.createIssue({ projectKey: "AUG", title: "Next task" })).id)).toBe("AUG-2")
    }),
  )

  it.instance("moves issues between projects by re-keying dependent references", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      yield* augusttask.createProject({ key: "VOICE", name: "Voice" })
      const parent = yield* augusttask.createIssue({ projectKey: "AUG", title: "Parent issue" })
      const issue = yield* augusttask.createIssue({ projectKey: "AUG", title: "Pinned issue" })
      const child = yield* augusttask.createIssue({ projectKey: "AUG", title: "Child issue", parentID: issue.id })
      yield* augusttask.addIssueComment({ id: issue.id, body: "Keep this comment" })
      yield* augusttask.relateIssues({ id: issue.id, targetID: parent.id, type: "blocks" })
      yield* augusttask.relateIssues({ id: parent.id, targetID: issue.id, type: "related" })

      const moved = yield* augusttask.editIssue({ id: issue.id, projectKey: "VOICE" })
      const shown = yield* augusttask.getIssue(moved.id)
      const parentShown = yield* augusttask.getIssue(parent.id)
      const childShown = yield* augusttask.getIssue(child.id)
      const events = yield* augusttask.listIssueEvents(moved.id)
      const old = yield* augusttask.getIssue(issue.id).pipe(Effect.exit)

      expect(moved).toMatchObject({ id: "VOICE-1", projectKey: "VOICE", sequence: 1 })
      expect(shown.comments.map((item) => item.body)).toEqual(["Keep this comment"])
      expect(shown.relations.map((item) => `${item.type}:${item.targetID}`)).toEqual([`blocks:${parent.id}`])
      expect(parentShown.relations.map((item) => `${item.type}:${item.targetID}`)).toContain("related:VOICE-1")
      expect(String(childShown.parentID)).toBe("VOICE-1")
      expect(events.map((item) => item.action)).toEqual(["created", "commented", "related", "moved"])
      expect(events.at(-1)?.data).toMatchObject({ moved_from: "AUG-2", moved_to: "VOICE-1" })
      expect(Exit.isFailure(old)).toBe(true)
    }),
  )

  it.instance("fails before moving issues to missing projects", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service
      const issue = yield* augusttask.createIssue({ projectKey: "AUG", title: "Pinned issue" })

      const moved = yield* augusttask.editIssue({ id: issue.id, projectKey: "MISSING" }).pipe(Effect.exit)
      const original = yield* augusttask.getIssue(issue.id)

      expect(Exit.isFailure(moved)).toBe(true)
      expect(original).toMatchObject({ id: "AUG-1", projectKey: "AUG" })
    }),
  )

  test("checks the target project before moving issues", async () => {
    let moveCalled = false
    const issue = {
      id: IssueID.make("AUG-1"),
      projectKey: ProjectKey.make("AUG"),
      sequence: 1,
      title: "Pinned issue",
      description: "",
      status: "todo" as const,
      priority: "medium" as const,
      labels: [],
      source: "august",
      time: { created: 1, updated: 1 },
      comments: [],
      relations: [],
    }

    const moved = await Effect.runPromise(
      Effect.gen(function* () {
        const augusttask = yield* AugustTask.Service
        return yield* augusttask.editIssue({ id: "AUG-1", projectKey: "MISSING" }).pipe(Effect.exit)
      }).pipe(
        Effect.provide(
          AugustTask.layer.pipe(
            Layer.provide(
              Layer.mock(AugustTaskRepository.Service, {
                getIssue: () => Effect.succeed(issue),
                getProject: () =>
                  Effect.fail(new AugustTaskRepository.ProjectNotFoundError({ key: "MISSING" })),
                nextIssueSequence: () => Effect.succeed(1),
                moveIssue: () =>
                  Effect.sync(() => {
                    moveCalled = true
                    return { ...issue, id: IssueID.make("MISSING-1"), projectKey: ProjectKey.make("MISSING") }
                  }),
              }),
            ),
          ),
        ),
      ),
    )

    expect(Exit.isFailure(moved)).toBe(true)
    expect(moveCalled).toBe(false)
  })

  it.instance("maps invalid legacy project strings to a valid project key", () =>
    Effect.gen(function* () {
      const augusttask = yield* AugustTask.Service

      yield* Effect.sync(() =>
        Database.use((db) =>
          db
            .insert(TaskIssueTable)
            .values({
              id: TaskID.make("AUG-77"),
              sequence: 77,
              title: "Legacy invalid project",
              description: "",
              status: "todo",
              priority: "medium",
              project: "august-talk/old.value.with.too.long.name",
              labels: [],
              source: "august",
              time_created: Date.now(),
              time_updated: Date.now(),
            })
            .run(),
        ),
      )

      const listed = yield* augusttask.listIssues({ includeArchived: true })
      const shown = yield* augusttask.getIssue("AUG-77")

      expect(listed.map((issue) => String(issue.id))).toContain("AUG-77")
      expect(String(shown.projectKey)).toBe("AUG")
      expect((yield* augusttask.getProject(shown.projectKey)).key).toBe(shown.projectKey)
    }),
  )
})
