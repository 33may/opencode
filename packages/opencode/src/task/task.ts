import { randomUUID } from "node:crypto"
import { Context, Effect, Layer, Schema } from "effect"
import { Database, asc, desc, eq } from "@/storage/db"
import { TaskCommentTable, TaskCounterTable, TaskEventTable, TaskIssueTable, TaskRelationTable } from "./task.sql"
import { Priority, RelationType, Status, TaskID } from "./schema"

export type Issue = {
  id: TaskID
  sequence: number
  title: string
  description: string
  status: Status
  priority: Priority
  project?: string
  labels: string[]
  assignee?: string
  delegate?: string
  parentID?: TaskID
  dueDate?: string
  branch?: string
  source: string
  time: {
    created: number
    updated: number
    started?: number
    completed?: number
    archived?: number
  }
}

export type Comment = {
  id: string
  sequence: number
  issueID: TaskID
  body: string
  author: string
  time: {
    created: number
    updated: number
  }
}

export type Relation = {
  sequence: number
  sourceID: TaskID
  targetID: TaskID
  type: RelationType
  time: {
    created: number
    updated: number
  }
}

export type Event = {
  id: string
  sequence: number
  issueID: TaskID
  action: string
  data: Record<string, unknown>
  time: {
    created: number
  }
}

export type Detail = Issue & {
  comments: Comment[]
  relations: Relation[]
}

export type CreateInput = {
  title: string
  description?: string
  status?: Status
  priority?: Priority
  project?: string
  labels?: string[]
  assignee?: string
  delegate?: string
  parentID?: TaskID
  dueDate?: string
  branch?: string
  source?: string
}

export type UpdateInput = Partial<Omit<CreateInput, "source">> & {
  id: TaskID
  archived?: boolean
}

export type ListInput = {
  status?: Status
  project?: string
  label?: string
  assignee?: string
  delegate?: string
  parentID?: TaskID
  includeArchived?: boolean
  limit?: number
}

export type CommentInput = {
  id: TaskID
  body: string
  author?: string
}

export type RelateInput = {
  id: TaskID
  targetID: TaskID
  type: RelationType
}

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("TaskNotFoundError", {
  id: Schema.String,
}) {}

export interface Interface {
  readonly create: (input: CreateInput) => Effect.Effect<Issue, NotFoundError>
  readonly update: (input: UpdateInput) => Effect.Effect<Issue, NotFoundError>
  readonly list: (input?: ListInput) => Effect.Effect<Issue[]>
  readonly get: (id: TaskID) => Effect.Effect<Detail, NotFoundError>
  readonly comment: (input: CommentInput) => Effect.Effect<Comment, NotFoundError>
  readonly relate: (input: RelateInput) => Effect.Effect<Relation, NotFoundError>
  readonly events: (id: TaskID) => Effect.Effect<Event[], NotFoundError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Task") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const create = Effect.fn("Task.create")(function* (input: CreateInput) {
      if (input.parentID) yield* requireExisting(input.parentID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const sequence = nextCounter(db, "issue")
            const id = TaskID.make(`AUG-${sequence}`)
            const now = Date.now()
            db.insert(TaskIssueTable)
              .values({
                id,
                sequence,
                title: input.title,
                description: input.description ?? "",
                status: input.status ?? "todo",
                priority: input.priority ?? "medium",
                project: input.project,
                labels: input.labels ?? [],
                assignee: input.assignee,
                delegate: input.delegate,
                parent_id: input.parentID,
                due_date: input.dueDate,
                branch: input.branch,
                source: input.source ?? "august",
                time_created: now,
                time_updated: now,
                time_started: input.status === "in_progress" ? now : undefined,
                time_completed: completedStatus(input.status) ? now : undefined,
              })
              .run()
            appendEvent(db, id, "created", eventData(input))
            return requireRow(db, id)
          },
          { behavior: "immediate" },
        ),
      )
      return fromIssueRow(row)
    })

    const update = Effect.fn("Task.update")(function* (input: UpdateInput) {
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
            if (input.project !== undefined) patch.project = input.project
            if (input.labels !== undefined) patch.labels = input.labels
            if (input.assignee !== undefined) patch.assignee = input.assignee
            if (input.delegate !== undefined) patch.delegate = input.delegate
            if (input.parentID !== undefined) patch.parent_id = input.parentID
            if (input.dueDate !== undefined) patch.due_date = input.dueDate
            if (input.branch !== undefined) patch.branch = input.branch
            if (input.archived !== undefined) patch.time_archived = input.archived ? now : null
            db.update(TaskIssueTable).set(patch).where(eq(TaskIssueTable.id, input.id)).run()
            appendEvent(db, input.id, "updated", eventData(input))
            return requireRow(db, input.id)
          },
          { behavior: "immediate" },
        ),
      )
      return fromIssueRow(row)
    })

    const list = Effect.fn("Task.list")(function* (input: ListInput = {}) {
      const rows = yield* Effect.sync(() =>
        Database.use((db) => db.select().from(TaskIssueTable).orderBy(desc(TaskIssueTable.time_updated)).all()),
      )
      return rows
        .map(fromIssueRow)
        .filter((issue) => input.includeArchived || !issue.time.archived)
        .filter((issue) => !input.status || issue.status === input.status)
        .filter((issue) => !input.project || issue.project === input.project)
        .filter((issue) => !input.label || issue.labels.includes(input.label))
        .filter((issue) => !input.assignee || issue.assignee === input.assignee)
        .filter((issue) => !input.delegate || issue.delegate === input.delegate)
        .filter((issue) => !input.parentID || issue.parentID === input.parentID)
        .slice(0, input.limit ?? 100)
    })

    const get = Effect.fn("Task.get")(function* (id: TaskID) {
      const issue = yield* requireExisting(id)
      const [comments, relations] = yield* Effect.all([commentsFor(id), relationsFor(id)])
      return { ...issue, comments, relations }
    })

    const comment = Effect.fn("Task.comment")(function* (input: CommentInput) {
      yield* requireExisting(input.id)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            const id = `tc_${randomUUID()}`
            const sequence = nextCounter(db, "comment")
            db.insert(TaskCommentTable)
              .values({
                id,
                sequence,
                issue_id: input.id,
                body: input.body,
                author: input.author ?? "august",
                time_created: now,
                time_updated: now,
              })
              .run()
            db.update(TaskIssueTable).set({ time_updated: now }).where(eq(TaskIssueTable.id, input.id)).run()
            appendEvent(db, input.id, "commented", eventData({ body: input.body, author: input.author ?? "august" }))
            return db.select().from(TaskCommentTable).where(eq(TaskCommentTable.id, id)).get()
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) return yield* new NotFoundError({ id: input.id })
      return fromCommentRow(row)
    })

    const relate = Effect.fn("Task.relate")(function* (input: RelateInput) {
      yield* requireExisting(input.id)
      yield* requireExisting(input.targetID)
      const row = yield* Effect.sync(() =>
        Database.transaction(
          (db) => {
            const now = Date.now()
            db.insert(TaskRelationTable)
              .values({
                source_id: input.id,
                target_id: input.targetID,
                type: input.type,
                sequence: nextCounter(db, "relation"),
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
                .where(eq(TaskIssueTable.id, input.id))
                .run()
            }
            db.update(TaskIssueTable).set({ time_updated: now }).where(eq(TaskIssueTable.id, input.targetID)).run()
            appendEvent(db, input.id, "related", eventData(input))
            return db
              .select()
              .from(TaskRelationTable)
              .where(eq(TaskRelationTable.source_id, input.id))
              .all()
              .find((item) => item.target_id === input.targetID && item.type === input.type)
          },
          { behavior: "immediate" },
        ),
      )
      if (!row) return yield* new NotFoundError({ id: input.id })
      return fromRelationRow(row)
    })

    const events = Effect.fn("Task.events")(function* (id: TaskID) {
      yield* requireExisting(id)
      const rows = yield* Effect.sync(() =>
        Database.use((db) =>
          db.select().from(TaskEventTable).where(eq(TaskEventTable.issue_id, id)).orderBy(asc(TaskEventTable.sequence)).all(),
        ),
      )
      return rows.map(fromEventRow)
    })

    return Service.of({ create, update, list, get, comment, relate, events })
  }),
)

export const defaultLayer = layer

function nextCounter(db: Database.TxOrDb, name: string) {
  const row = db.select().from(TaskCounterTable).where(eq(TaskCounterTable.name, name)).get()
  const value = (row?.value ?? 0) + 1
  if (row) {
    db.update(TaskCounterTable).set({ value }).where(eq(TaskCounterTable.name, name)).run()
    return value
  }
  db.insert(TaskCounterTable).values({ name, value }).run()
  return value
}

function requireRow(db: Database.TxOrDb, id: TaskID) {
  const row = db.select().from(TaskIssueTable).where(eq(TaskIssueTable.id, id)).get()
  if (!row) throw new Error(`Task not found: ${id}`)
  return row
}

const requireExisting = Effect.fn("Task.requireExisting")(function* (id: TaskID) {
  const row = yield* Effect.sync(() => Database.use((db) => db.select().from(TaskIssueTable).where(eq(TaskIssueTable.id, id)).get()))
  if (!row) return yield* new NotFoundError({ id })
  return fromIssueRow(row)
})

const commentsFor = Effect.fn("Task.commentsFor")(function* (id: TaskID) {
  const rows = yield* Effect.sync(() =>
    Database.use((db) =>
      db.select().from(TaskCommentTable).where(eq(TaskCommentTable.issue_id, id)).orderBy(asc(TaskCommentTable.sequence)).all(),
    ),
  )
  return rows.map(fromCommentRow)
})

const relationsFor = Effect.fn("Task.relationsFor")(function* (id: TaskID) {
  const rows = yield* Effect.sync(() =>
    Database.use((db) =>
      db.select().from(TaskRelationTable).where(eq(TaskRelationTable.source_id, id)).orderBy(asc(TaskRelationTable.sequence)).all(),
    ),
  )
  return rows.map(fromRelationRow)
})

function appendEvent(db: Database.TxOrDb, issueID: TaskID, action: string, data: Record<string, unknown>) {
  db.insert(TaskEventTable)
    .values({
      id: `te_${randomUUID()}`,
      issue_id: issueID,
      sequence: nextCounter(db, "event"),
      action,
      data,
      time_created: Date.now(),
    })
    .run()
}

function eventData(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter((entry) => entry[1] !== undefined))
}

function completedStatus(status?: Status) {
  return status === "done" || status === "canceled" || status === "duplicate"
}

function optional<T>(value: T | null | undefined) {
  return value === null ? undefined : value
}

function fromIssueRow(row: typeof TaskIssueTable.$inferSelect): Issue {
  return {
    id: row.id,
    sequence: row.sequence ?? 0,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    project: optional(row.project),
    labels: row.labels,
    assignee: optional(row.assignee),
    delegate: optional(row.delegate),
    parentID: optional(row.parent_id),
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
    issueID: row.issue_id,
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
    sourceID: row.source_id,
    targetID: row.target_id,
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
    issueID: row.issue_id,
    action: row.action,
    data: row.data,
    time: {
      created: row.time_created,
    },
  }
}

export * as Task from "./task"
