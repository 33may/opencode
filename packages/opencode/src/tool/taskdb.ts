import { Cause, Effect, Schema } from "effect"
import * as Tool from "./tool"
import { AugustTask } from "@/augusttask/service/augusttask-service"
import { normalizeProjectKeyOrDefault } from "@/augusttask/domain/project"
import { Priority, PriorityValues, RelationType, RelationTypeValues, Status, StatusValues } from "@/task/schema"

export const Parameters = Schema.Struct({
  action: Schema.Literals(["create", "list", "show", "update", "comment", "relate", "events"]).annotate({
    description: "Task DB action to run",
  }),
  id: Schema.optional(Schema.String).annotate({ description: "Task id, e.g. AUG-1" }),
  targetID: Schema.optional(Schema.String).annotate({ description: "Target task id for relations" }),
  title: Schema.optional(Schema.String).annotate({ description: "Task title" }),
  description: Schema.optional(Schema.String).annotate({ description: "Task description" }),
  status: Schema.optional(Schema.String).annotate({ description: "Task status" }),
  priority: Schema.optional(Schema.String).annotate({ description: "Task priority" }),
  project: Schema.optional(Schema.String).annotate({ description: "Project or feature slug" }),
  labels: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({ description: "Task labels" }),
  label: Schema.optional(Schema.String).annotate({ description: "Single label filter for list" }),
  assignee: Schema.optional(Schema.String).annotate({ description: "Assignee name or agent" }),
  delegate: Schema.optional(Schema.String).annotate({ description: "Delegate agent name" }),
  parentID: Schema.optional(Schema.String).annotate({ description: "Parent task id" }),
  dueDate: Schema.optional(Schema.String).annotate({ description: "Due date string" }),
  branch: Schema.optional(Schema.String).annotate({ description: "Git branch tied to this task" }),
  body: Schema.optional(Schema.String).annotate({ description: "Comment body" }),
  author: Schema.optional(Schema.String).annotate({ description: "Comment author" }),
  type: Schema.optional(Schema.String).annotate({ description: "Relation type" }),
  includeArchived: Schema.optional(Schema.Boolean).annotate({ description: "Include archived tasks in list" }),
  limit: Schema.optional(Schema.Number).annotate({ description: "Maximum list items" }),
})

type Metadata = {
  action: Schema.Schema.Type<typeof Parameters>["action"]
  id?: string
}

export type TaskDBParams = Schema.Schema.Type<typeof Parameters>

export const TaskDBTool = Tool.define<typeof Parameters, Metadata, AugustTask.Service>(
  "taskdb",
  Effect.gen(function* () {
    const task = yield* AugustTask.Service

    return {
      description: [
        "Create, list, show, update, comment on, relate, and inspect August-local tasks.",
        "Use this instead of Linear. The source of truth is the local SQLite task DB.",
      ].join("\n"),
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          if (["create", "update", "comment", "relate"].includes(params.action)) {
            yield* ctx.ask({ permission: "taskdb", patterns: [params.action], always: [params.action], metadata: {} })
          }

          const output = yield* executeAction(task, params)
          return {
            title: title(output),
            output: JSON.stringify(output, null, 2),
            metadata: { action: params.action, id: outputID(output) },
          }
        }),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)

export const executeAction = Effect.fn("TaskDBTool.executeAction")(function* (task: AugustTask.Interface, params: TaskDBParams) {
  return yield* runAction(task, params).pipe(
    Effect.matchCauseEffect({
      onSuccess: Effect.succeed,
      onFailure: (cause) => Effect.succeed({ error: { message: causeMessage(cause) } }),
    }),
  )
})

export const runAction = Effect.fn("TaskDBTool.runAction")(function* (
  task: AugustTask.Interface,
  params: TaskDBParams,
) {
  if (params.action === "create") {
    if (!params.title) return yield* Effect.fail(new Error("taskdb create requires title"))
    const projectKey = projectKeyOrDefault(params.project)
    yield* ensureCompatibilityProject(task, projectKey, params.project)
    return compatIssue(yield* task.createIssue({
      projectKey,
      title: params.title,
      description: optionalString(params.description),
      status: status(params.status),
      priority: priority(params.priority),
      labels: optionalLabels(params.labels),
      assignee: optionalString(params.assignee),
      delegate: optionalString(params.delegate),
      parentID: optionalString(params.parentID),
      dueDate: optionalString(params.dueDate),
      branch: optionalString(params.branch),
    }), legacyProject(projectKey, params.project))
  }

  if (params.action === "list") {
    return (yield* task.listIssues({
      status: status(params.status),
      projectKey: params.project ? yield* resolveProjectFilter(task, params.project) : undefined,
      label: optionalString(params.label),
      assignee: optionalString(params.assignee),
      delegate: optionalString(params.delegate),
      parentID: optionalString(params.parentID),
      includeArchived: params.includeArchived,
      limit: params.limit && params.limit > 0 ? params.limit : undefined,
    })).map((issue) => compatIssue(issue, legacyProject(issue.projectKey, params.project)))
  }

  if (params.action === "show") {
    const issue = yield* task.getIssue(requiredID(params.id))
    return compatIssue(issue, legacyProject(issue.projectKey))
  }

  if (params.action === "update") {
    const projectKey = params.project ? projectKeyOrDefault(params.project) : undefined
    if (projectKey) yield* ensureCompatibilityProject(task, projectKey, params.project)
    const issue = yield* task.editIssue({
      id: requiredID(params.id),
      projectKey,
      title: optionalString(params.title),
      description: optionalString(params.description),
      status: status(params.status),
      priority: priority(params.priority),
      labels: optionalLabels(params.labels),
      assignee: optionalString(params.assignee),
      delegate: optionalString(params.delegate),
      parentID: optionalString(params.parentID),
      dueDate: optionalString(params.dueDate),
      branch: optionalString(params.branch),
    })
    return compatIssue(issue, legacyProject(issue.projectKey, params.project))
  }

  if (params.action === "comment") {
    const body = optionalString(params.body)
    if (!body) return yield* Effect.fail(new Error("taskdb comment requires body"))
    return yield* task.addIssueComment({ id: requiredID(params.id), body, author: optionalString(params.author) })
  }

  if (params.action === "relate") {
    return yield* task.relateIssues({
      id: requiredID(params.id),
      targetID: requiredID(params.targetID),
      type: relationType(params.type) ?? "related",
    })
  }

  return yield* task.listIssueEvents(requiredID(params.id))
})

function requiredID(id: string | undefined) {
  const text = optionalString(id)
  if (!text) throw new Error("taskdb action requires id")
  return text
}

function projectKeyOrDefault(project: string | undefined) {
  const value = optionalString(project)
  if (!value || value.toLowerCase() === "august") return normalizeProjectKeyOrDefault("AUG")
  return normalizeProjectKeyOrDefault(value)
}

const ensureCompatibilityProject = Effect.fn("TaskDBTool.ensureCompatibilityProject")(function* (
  task: AugustTask.Interface,
  projectKey: string,
  project: string | undefined,
) {
  yield* task.getProject(projectKey).pipe(
    Effect.catchTag("AugustTaskProjectNotFoundError", () =>
      task
        .createProject({ key: projectKey, name: optionalString(project) ?? projectKey })
        .pipe(Effect.catchTag("AugustTaskProjectAlreadyExistsError", () => Effect.void)),
    ),
  )
})

const resolveProjectFilter = Effect.fn("TaskDBTool.resolveProjectFilter")(function* (
  task: AugustTask.Interface,
  project: string,
) {
  const projectKey = projectKeyFilter(project)
  if (projectKey) {
    return yield* task.getProject(projectKey).pipe(
      Effect.as(projectKey),
      Effect.catchTag("AugustTaskProjectNotFoundError", () =>
        Effect.gen(function* () {
          return (yield* task.listProjects({})).find((item) => item.name === project)?.key ?? projectKey
        }),
      ),
    )
  }
  return (yield* task.listProjects({})).find((item) => item.name === project)?.key ?? projectKeyOrDefault(project)
})

function projectKeyFilter(project: string) {
  if (project.trim().toLowerCase() === "august") return normalizeProjectKeyOrDefault("AUG")
  const normalized = project.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_")
  if (/^[A-Z][A-Z0-9_]{1,15}$/.test(normalized)) return normalizeProjectKeyOrDefault(normalized)
  return undefined
}

function legacyProject(projectKey: string, project?: string) {
  const value = optionalString(project)
  if (value) return value
  return projectKey === "AUG" ? "august" : projectKey
}

function compatIssue<T extends { projectKey: string }>(issue: T, project: string) {
  return { ...issue, project }
}

function optionalString(value: string | undefined) {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optionalLabels(value: string[] | undefined) {
  const items = value?.map((item) => item.trim()).filter(Boolean)
  return items?.length ? items : undefined
}

function status(value: string | undefined): Status | undefined {
  const text = optionalString(value)
  if (!text) return undefined
  if (StatusValues.includes(text as Status)) return text as Status
  throw new Error(`invalid task status: ${text}`)
}

function priority(value: string | undefined): Priority | undefined {
  const text = optionalString(value)
  if (!text) return undefined
  if (PriorityValues.includes(text as Priority)) return text as Priority
  throw new Error(`invalid task priority: ${text}`)
}

function relationType(value: string | undefined): RelationType | undefined {
  const text = optionalString(value)
  if (!text) return undefined
  if (RelationTypeValues.includes(text as RelationType)) return text as RelationType
  throw new Error(`invalid task relation type: ${text}`)
}

function title(output: unknown) {
  if (output && typeof output === "object" && "error" in output) return "taskdb error"
  const id = outputID(output)
  if (id) return id
  if (Array.isArray(output)) return `${output.length} tasks`
  return "taskdb"
}

function causeMessage(cause: Cause.Cause<unknown>) {
  const error = Cause.squash(cause)
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "id" in error && typeof error.id === "string") return `Task not found: ${error.id}`
  return String(error)
}

function outputID(output: unknown) {
  if (output && typeof output === "object" && "id" in output && typeof output.id === "string") return output.id
  if (output && typeof output === "object" && "issueID" in output && typeof output.issueID === "string") return output.issueID
  if (output && typeof output === "object" && "sourceID" in output && typeof output.sourceID === "string") return output.sourceID
  return undefined
}
