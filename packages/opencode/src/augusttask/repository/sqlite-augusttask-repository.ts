import { randomUUID } from "node:crypto"
import { Effect, Layer } from "effect"
import { asc, desc, eq } from "@/storage/db"
import { Database } from "@/storage/db"
import { TaskID } from "@/task/schema"
import { TaskCommentTable, TaskCounterTable, TaskEventTable, TaskIssueTable, TaskRelationTable } from "@/task/task.sql"
import type { Comment } from "../domain/comment"
import type { Event } from "../domain/event"
import { completedStatus, IssueID } from "../domain/issue"
import type { Issue } from "../domain/issue"
import { normalizeProjectKeyOrDefault, ProjectKey } from "../domain/project"
import type { Project } from "../domain/project"
import type { Relation } from "../domain/relation"
import { AugustTaskProjectTable } from "../augusttask.sql"
import { AugustTaskRepository } from "./augusttask-repository"

export const layer = Layer.effect(
  AugustTaskRepository.Service,
  Effect.gen(function* () {
    const createProject = Effect.fn("SqliteAugustTaskRepository.createProject")(function* (
      input: AugustTaskRepository.CreateProjectInput,
    ) {
      const exists = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(AugustTaskProjectTable).where(eq(AugustTaskProjectTable.key, input.key)).get(),
        ),
      )
      if (exists) return yield* new AugustTaskRepository.ProjectAlreadyExistsError({ key: input.key })
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            db.insert(AugustTaskProjectTable)
              .values({
                key: input.key,
                name: input.name,
                description: input.description ?? "",
                status: input.status ?? "active",
                default_assignee: input.defaultAssignee,
                labels: input.labels ?? [],
                time_created: now,
                time_updated: now,
              })
              .run()
            return db.select().from(AugustTaskProjectTable).where(eq(AugustTaskProjectTable.key, input.key)).get()
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) throw new Error(`AugustTask project not found after create: ${input.key}`)
      return fromProjectRow(row)
    })

    const listProjects = Effect.fn("SqliteAugustTaskRepository.listProjects")(function* (
      input: AugustTaskRepository.ListProjectsInput = {},
    ) {
      const rows = yield* Effect.sync(() =>
        Database.use((db) => db.select().from(AugustTaskProjectTable).orderBy(asc(AugustTaskProjectTable.key)).all()),
      )
      return rows.map(fromProjectRow).filter((project) => !input.status || project.status === input.status)
    })

    const getProject = Effect.fn("SqliteAugustTaskRepository.getProject")(function* (key: ProjectKey) {
      const row = yield* Effect.sync(() =>
        Database.use((db) => db.select().from(AugustTaskProjectTable).where(eq(AugustTaskProjectTable.key, key)).get()),
      )
      if (!row) return yield* new AugustTaskRepository.ProjectNotFoundError({ key })
      return fromProjectRow(row)
    })

    const updateProject = Effect.fn("SqliteAugustTaskRepository.updateProject")(function* (
      input: AugustTaskRepository.UpdateProjectInput,
    ) {
      yield* getProject(input.key)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const patch: Partial<typeof AugustTaskProjectTable.$inferInsert> = { time_updated: Date.now() }
            if (input.name !== undefined) patch.name = input.name
            if (input.description !== undefined) patch.description = input.description
            if (input.status !== undefined) patch.status = input.status
            if (input.defaultAssignee !== undefined) patch.default_assignee = input.defaultAssignee
            if (input.labels !== undefined) patch.labels = input.labels
            db.update(AugustTaskProjectTable).set(patch).where(eq(AugustTaskProjectTable.key, input.key)).run()
            return db.select().from(AugustTaskProjectTable).where(eq(AugustTaskProjectTable.key, input.key)).get()
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) return yield* new AugustTaskRepository.ProjectNotFoundError({ key: input.key })
      return fromProjectRow(row)
    })

    const nextIssueSequence = Effect.fn("SqliteAugustTaskRepository.nextIssueSequence")(function* (
      projectKey: ProjectKey,
    ) {
      yield* getProject(projectKey)
      return yield* Effect.sync(() =>
        Database.transaction((db) => nextCounter(db, `issue:${projectKey}`, currentIssueSequence(db, projectKey)), {
          behavior: "immediate",
        }),
      )
    })

    const createIssue = Effect.fn("SqliteAugustTaskRepository.createIssue")(function* (
      input: AugustTaskRepository.RepositoryCreateIssueInput,
    ) {
      yield* getProject(input.projectKey)
      if (input.parentID) yield* requireExisting(input.parentID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            db.insert(TaskIssueTable)
              .values({
                id: TaskID.make(input.id),
                sequence: input.sequence,
                title: input.title,
                description: input.description ?? "",
                status: input.status ?? "todo",
                priority: input.priority ?? "medium",
                project: input.projectKey,
                labels: input.labels ?? [],
                assignee: input.assignee,
                delegate: input.delegate,
                parent_id: input.parentID ? TaskID.make(input.parentID) : undefined,
                due_date: input.dueDate,
                branch: input.branch,
                source: input.source ?? "august",
                time_created: now,
                time_updated: now,
                time_started: input.status === "in_progress" ? now : undefined,
                time_completed: completedStatus(input.status) ? now : undefined,
              })
              .run()
            appendEvent(db, input.id, "created", eventData(input))
            return requireIssueRow(db, input.id)
          },
          { behavior: "immediate" },
        ),
      )
      return fromIssueRow(row)
    })

    const listIssues = Effect.fn("SqliteAugustTaskRepository.listIssues")(function* (
      input: AugustTaskRepository.ListIssuesInput = {},
    ) {
      const rows = yield* Effect.sync(() =>
        Database.use((db) => db.select().from(TaskIssueTable).orderBy(desc(TaskIssueTable.time_updated)).all()),
      )
      return rows
        .map(fromIssueRow)
        .filter((issue) => input.includeArchived || !issue.time.archived)
        .filter((issue) => !input.projectKey || issue.projectKey === input.projectKey)
        .filter((issue) => !input.status || issue.status === input.status)
        .filter((issue) => !input.label || issue.labels.includes(input.label))
        .filter((issue) => !input.assignee || issue.assignee === input.assignee)
        .filter((issue) => !input.delegate || issue.delegate === input.delegate)
        .filter((issue) => !input.parentID || issue.parentID === input.parentID)
        .slice(0, input.limit ?? 100)
    })

    const getIssue = Effect.fn("SqliteAugustTaskRepository.getIssue")(function* (id: IssueID) {
      const issue = yield* requireExisting(id)
      const [comments, relations] = yield* Effect.all([commentsFor(id), relationsFor(id)])
      return { ...issue, comments, relations }
    })

    const updateIssue = Effect.fn("SqliteAugustTaskRepository.updateIssue")(function* (
      input: AugustTaskRepository.RepositoryUpdateIssueInput,
    ) {
      yield* requireExisting(input.id)
      if (input.parentID) yield* requireExisting(input.parentID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            const patch: Partial<typeof TaskIssueTable.$inferInsert> = { time_updated: now }
            if (input.title !== undefined) patch.title = input.title
            if (input.description !== undefined) patch.description = input.description
            if (input.status !== undefined) {
              patch.status = input.status
              if (input.status === "in_progress") patch.time_started = now
              if (input.status !== "in_progress") patch.time_started = null
              if (completedStatus(input.status)) patch.time_completed = now
              if (!completedStatus(input.status)) patch.time_completed = null
            }
            if (input.priority !== undefined) patch.priority = input.priority
            if (input.labels !== undefined) patch.labels = input.labels
            if (input.assignee !== undefined) patch.assignee = input.assignee
            if (input.delegate !== undefined) patch.delegate = input.delegate
            if (input.parentID !== undefined) patch.parent_id = TaskID.make(input.parentID)
            if (input.dueDate !== undefined) patch.due_date = input.dueDate
            if (input.branch !== undefined) patch.branch = input.branch
            if (input.archived !== undefined) patch.time_archived = input.archived ? now : null
            db.update(TaskIssueTable)
              .set(patch)
              .where(eq(TaskIssueTable.id, TaskID.make(input.id)))
              .run()
            appendEvent(db, input.id, "updated", eventData(input))
            return requireIssueRow(db, input.id)
          },
          { behavior: "immediate" },
        ),
      )
      return fromIssueRow(row)
    })

    const moveIssue = Effect.fn("SqliteAugustTaskRepository.moveIssue")(function* (
      input: AugustTaskRepository.RepositoryMoveIssueInput,
    ) {
      yield* requireExisting(input.id)
      if (input.parentID) yield* requireExisting(input.parentID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const old = requireIssueRow(db, input.id)
            const now = Date.now()
            db.insert(TaskIssueTable)
              .values({
                ...old,
                id: TaskID.make(input.newID),
                sequence: input.sequence,
                project: input.projectKey,
                title: input.title ?? old.title,
                description: input.description ?? old.description,
                status: input.status ?? old.status,
                priority: input.priority ?? old.priority,
                labels: input.labels ?? old.labels,
                assignee: input.assignee ?? old.assignee,
                delegate: input.delegate ?? old.delegate,
                parent_id: input.parentID ? TaskID.make(input.parentID) : old.parent_id,
                due_date: input.dueDate ?? old.due_date,
                branch: input.branch ?? old.branch,
                time_updated: now,
                time_started: input.status === "in_progress" ? now : old.time_started,
                time_completed: input.status && completedStatus(input.status) ? now : old.time_completed,
                time_archived: input.archived === undefined ? old.time_archived : input.archived ? now : null,
              })
              .run()
            db.update(TaskCommentTable)
              .set({ issue_id: TaskID.make(input.newID) })
              .where(eq(TaskCommentTable.issue_id, TaskID.make(input.id)))
              .run()
            db.update(TaskEventTable)
              .set({ issue_id: TaskID.make(input.newID) })
              .where(eq(TaskEventTable.issue_id, TaskID.make(input.id)))
              .run()
            db.update(TaskRelationTable)
              .set({ source_id: TaskID.make(input.newID) })
              .where(eq(TaskRelationTable.source_id, TaskID.make(input.id)))
              .run()
            db.update(TaskRelationTable)
              .set({ target_id: TaskID.make(input.newID) })
              .where(eq(TaskRelationTable.target_id, TaskID.make(input.id)))
              .run()
            db.update(TaskIssueTable)
              .set({ parent_id: TaskID.make(input.newID), time_updated: now })
              .where(eq(TaskIssueTable.parent_id, TaskID.make(input.id)))
              .run()
            db.delete(TaskIssueTable)
              .where(eq(TaskIssueTable.id, TaskID.make(input.id)))
              .run()
            appendEvent(db, input.newID, "moved", {
              moved_from: input.id,
              moved_to: input.newID,
              project_from: old.project,
              project_to: input.projectKey,
            })
            return requireIssueRow(db, input.newID)
          },
          { behavior: "immediate" },
        ),
      )
      return fromIssueRow(row)
    })

    const addComment = Effect.fn("SqliteAugustTaskRepository.addComment")(function* (
      input: AugustTaskRepository.AddCommentInput,
    ) {
      yield* requireExisting(input.id)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            const id = `tc_${randomUUID()}`
            db.insert(TaskCommentTable)
              .values({
                id,
                sequence: nextCounter(db, "comment", currentCommentSequence(db)),
                issue_id: TaskID.make(input.id),
                body: input.body,
                author: input.author ?? "august",
                time_created: now,
                time_updated: now,
              })
              .run()
            db.update(TaskIssueTable)
              .set({ time_updated: now })
              .where(eq(TaskIssueTable.id, TaskID.make(input.id)))
              .run()
            appendEvent(db, input.id, "commented", eventData({ body: input.body, author: input.author ?? "august" }))
            return db.select().from(TaskCommentTable).where(eq(TaskCommentTable.id, id)).get()
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) return yield* new AugustTaskRepository.IssueNotFoundError({ id: input.id })
      return fromCommentRow(row)
    })

    const relateIssues = Effect.fn("SqliteAugustTaskRepository.relateIssues")(function* (
      input: AugustTaskRepository.RelateIssuesInput,
    ) {
      yield* requireExisting(input.id)
      yield* requireExisting(input.targetID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            db.insert(TaskRelationTable)
              .values({
                source_id: TaskID.make(input.id),
                target_id: TaskID.make(input.targetID),
                type: input.type,
                sequence: nextCounter(db, "relation", currentRelationSequence(db)),
                time_created: now,
                time_updated: now,
              })
              .onConflictDoUpdate({
                target: [TaskRelationTable.source_id, TaskRelationTable.target_id, TaskRelationTable.type],
                set: { time_updated: now },
              })
              .run()
            if (input.type === "duplicate") {
              db.update(TaskIssueTable)
                .set({ status: "duplicate", time_completed: now, time_updated: now })
                .where(eq(TaskIssueTable.id, TaskID.make(input.id)))
                .run()
            }
            db.update(TaskIssueTable)
              .set({ time_updated: now })
              .where(eq(TaskIssueTable.id, TaskID.make(input.targetID)))
              .run()
            appendEvent(db, input.id, "related", eventData(input))
            return db
              .select()
              .from(TaskRelationTable)
              .where(eq(TaskRelationTable.source_id, TaskID.make(input.id)))
              .all()
              .find((item) => item.target_id === TaskID.make(input.targetID) && item.type === input.type)
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) return yield* new AugustTaskRepository.IssueNotFoundError({ id: input.id })
      return fromRelationRow(row)
    })

    const listEvents = Effect.fn("SqliteAugustTaskRepository.listEvents")(function* (id: IssueID) {
      yield* requireExisting(id)
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db
            .select()
            .from(TaskEventTable)
            .where(eq(TaskEventTable.issue_id, TaskID.make(id)))
            .orderBy(asc(TaskEventTable.sequence))
            .all(),
        ),
      )
      return rows.map(fromEventRow)
    })

    return AugustTaskRepository.Service.of({
      createProject,
      listProjects,
      getProject,
      updateProject,
      nextIssueSequence,
      createIssue,
      listIssues,
      getIssue,
      updateIssue,
      moveIssue,
      addComment,
      relateIssues,
      listEvents,
    })
  }),
)

export const defaultLayer = layer

function nextCounter(db: Database.TxOrDb, name: string, minimum = 0) {
  const row = db.select().from(TaskCounterTable).where(eq(TaskCounterTable.name, name)).get()
  const value = Math.max(row?.value ?? 0, minimum) + 1
  if (row) {
    db.update(TaskCounterTable).set({ value }).where(eq(TaskCounterTable.name, name)).run()
    return value
  }
  db.insert(TaskCounterTable).values({ name, value }).run()
  return value
}

function currentIssueSequence(db: Database.TxOrDb, projectKey: ProjectKey) {
  return db
    .select()
    .from(TaskIssueTable)
    .all()
    .map((row) => fromIssueRow(row))
    .filter((issue) => issue.projectKey === projectKey)
    .map((issue) => Math.max(issue.sequence, issueSequenceFromID(issue.id, projectKey)))
    .reduce((max, value) => Math.max(max, value), 0)
}

function currentCommentSequence(db: Database.TxOrDb) {
  return db
    .select()
    .from(TaskCommentTable)
    .all()
    .map((row) => row.sequence ?? 0)
    .reduce((max, value) => Math.max(max, value), 0)
}

function currentRelationSequence(db: Database.TxOrDb) {
  return db
    .select()
    .from(TaskRelationTable)
    .all()
    .map((row) => row.sequence ?? 0)
    .reduce((max, value) => Math.max(max, value), 0)
}

function currentEventSequence(db: Database.TxOrDb) {
  return db
    .select()
    .from(TaskEventTable)
    .all()
    .map((row) => row.sequence ?? 0)
    .reduce((max, value) => Math.max(max, value), 0)
}

function issueSequenceFromID(id: IssueID, projectKey: ProjectKey) {
  const prefix = `${projectKey}-`
  if (!String(id).startsWith(prefix)) return 0
  const sequence = Number(String(id).slice(prefix.length))
  return Number.isInteger(sequence) && sequence > 0 ? sequence : 0
}

function requireIssueRow(db: Database.TxOrDb, id: IssueID) {
  const row = db
    .select()
    .from(TaskIssueTable)
    .where(eq(TaskIssueTable.id, TaskID.make(id)))
    .get()
  if (!row) throw new Error(`AugustTask issue not found: ${id}`)
  return row
}

const requireExisting = Effect.fn("SqliteAugustTaskRepository.requireExisting")(function* (id: IssueID) {
  const row = yield* Effect.sync(() =>
    Database.use((db) =>
      db
        .select()
        .from(TaskIssueTable)
        .where(eq(TaskIssueTable.id, TaskID.make(id)))
        .get(),
    ),
  )
  if (!row) return yield* new AugustTaskRepository.IssueNotFoundError({ id })
  return fromIssueRow(row)
})

const commentsFor = Effect.fn("SqliteAugustTaskRepository.commentsFor")(function* (id: IssueID) {
  const rows = yield* Effect.sync(() =>
    Database.use((db) =>
      db
        .select()
        .from(TaskCommentTable)
        .where(eq(TaskCommentTable.issue_id, TaskID.make(id)))
        .orderBy(asc(TaskCommentTable.sequence))
        .all(),
    ),
  )
  return rows.map(fromCommentRow)
})

const relationsFor = Effect.fn("SqliteAugustTaskRepository.relationsFor")(function* (id: IssueID) {
  const rows = yield* Effect.sync(() =>
    Database.use((db) =>
      db
        .select()
        .from(TaskRelationTable)
        .where(eq(TaskRelationTable.source_id, TaskID.make(id)))
        .orderBy(asc(TaskRelationTable.sequence))
        .all(),
    ),
  )
  return rows.map(fromRelationRow)
})

function appendEvent(db: Database.TxOrDb, issueID: IssueID, action: string, data: Record<string, unknown>) {
  db.insert(TaskEventTable)
    .values({
      id: `te_${randomUUID()}`,
      issue_id: TaskID.make(issueID),
      sequence: nextCounter(db, "event", currentEventSequence(db)),
      action,
      data,
      time_created: Date.now(),
    })
    .run()
}

function eventData(input: object) {
  return Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== undefined))
}

function optional<T>(value: T | null | undefined) {
  return value === null ? undefined : value
}

function fromProjectRow(row: typeof AugustTaskProjectTable.$inferSelect): Project {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    status: row.status,
    defaultAssignee: optional(row.default_assignee),
    labels: row.labels,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

function fromIssueRow(row: typeof TaskIssueTable.$inferSelect): Issue {
  return {
    id: IssueID.make(row.id),
    projectKey: normalizeProjectKeyOrDefault(row.project),
    sequence: row.sequence ?? 0,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    labels: row.labels,
    assignee: optional(row.assignee),
    delegate: optional(row.delegate),
    parentID: row.parent_id ? IssueID.make(row.parent_id) : undefined,
    dueDate: optional(row.due_date),
    branch: optional(row.branch),
    source: row.source,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      started: optional(row.time_started),
      completed: optional(row.time_completed),
      archived: optional(row.time_archived),
    },
  }
}

function fromCommentRow(row: typeof TaskCommentTable.$inferSelect): Comment {
  return {
    id: row.id,
    sequence: row.sequence ?? 0,
    issueID: IssueID.make(row.issue_id),
    body: row.body,
    author: row.author,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

function fromRelationRow(row: typeof TaskRelationTable.$inferSelect): Relation {
  return {
    sequence: row.sequence ?? 0,
    sourceID: IssueID.make(row.source_id),
    targetID: IssueID.make(row.target_id),
    type: row.type,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

function fromEventRow(row: typeof TaskEventTable.$inferSelect): Event {
  return {
    id: row.id,
    sequence: row.sequence ?? 0,
    issueID: IssueID.make(row.issue_id),
    action: row.action,
    data: row.data,
    time: {
      created: row.time_created,
    },
  }
}

export * as SqliteAugustTaskRepository from "./sqlite-augusttask-repository"
