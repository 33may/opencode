import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Effect } from "effect"
import * as z from "zod/v4"
import { AugustTask } from "../service/augusttask-service"
import { PriorityValues, RelationTypeValues, StatusValues } from "../domain/issue"
import { ProjectStatusValues } from "../domain/project"

export const server = new McpServer({ name: "augusttask", version: "1.0.0" })

const statusSchema = z.enum(StatusValues)
const prioritySchema = z.enum(PriorityValues)
const relationTypeSchema = z.enum(RelationTypeValues)
const projectStatusSchema = z.enum(ProjectStatusValues)

server.registerTool(
  "create_project",
  {
    title: "Create AugustTask project",
    description: "Create an AugustTask project. Project keys are normalized by AugustTask.Service.",
    inputSchema: {
      key: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: projectStatusSchema.optional(),
      default_assignee: z.string().optional(),
      labels: z.array(z.string()).optional(),
    },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.createProject({
        key: params.key,
        name: params.name,
        description: optionalString(params.description),
        status: optionalString(params.status),
        defaultAssignee: optionalString(params.default_assignee),
        labels: optionalArray(params.labels),
      }),
    ),
)

server.registerTool(
  "list_projects",
  {
    title: "List AugustTask projects",
    description: "List AugustTask projects, optionally filtered by status.",
    inputSchema: { status: projectStatusSchema.optional() },
  },
  async (params) => run((augusttask) => augusttask.listProjects({ status: optionalString(params.status) })),
)

server.registerTool(
  "get_project",
  {
    title: "Get AugustTask project",
    description: "Get one AugustTask project by key.",
    inputSchema: { key: z.string() },
  },
  async (params) => run((augusttask) => augusttask.getProject(params.key)),
)

server.registerTool(
  "edit_project",
  {
    title: "Edit AugustTask project",
    description: "Edit mutable AugustTask project fields.",
    inputSchema: {
      key: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      status: projectStatusSchema.optional(),
      default_assignee: z.string().optional(),
      labels: z.array(z.string()).optional(),
    },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.editProject({
        key: params.key,
        name: optionalString(params.name),
        description: optionalString(params.description),
        status: optionalString(params.status),
        defaultAssignee: optionalString(params.default_assignee),
        labels: optionalArray(params.labels),
      }),
    ),
)

server.registerTool(
  "create_issue",
  {
    title: "Create AugustTask issue",
    description: "Create an AugustTask issue in a project.",
    inputSchema: {
      project_key: z.string(),
      title: z.string(),
      description: z.string().optional(),
      status: statusSchema.optional(),
      priority: prioritySchema.optional(),
      labels: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      delegate: z.string().optional(),
      parent_id: z.string().optional(),
      due_date: z.string().optional(),
      branch: z.string().optional(),
      source: z.string().optional(),
    },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.createIssue({
        projectKey: params.project_key,
        title: params.title,
        description: optionalString(params.description),
        status: optionalString(params.status),
        priority: optionalString(params.priority),
        labels: optionalArray(params.labels),
        assignee: optionalString(params.assignee),
        delegate: optionalString(params.delegate),
        parentID: optionalString(params.parent_id),
        dueDate: optionalString(params.due_date),
        branch: optionalString(params.branch),
        source: optionalString(params.source),
      }),
    ),
)

server.registerTool(
  "list_issues",
  {
    title: "List AugustTask issues",
    description: "List AugustTask issues using semantic filters. This is not a SQL/query interface.",
    inputSchema: {
      project_key: z.string().optional(),
      status: statusSchema.optional(),
      label: z.string().optional(),
      assignee: z.string().optional(),
      delegate: z.string().optional(),
      parent_id: z.string().optional(),
      include_archived: z.boolean().optional(),
      limit: z.number().optional(),
    },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.listIssues({
        projectKey: optionalString(params.project_key),
        status: optionalString(params.status),
        label: optionalString(params.label),
        assignee: optionalString(params.assignee),
        delegate: optionalString(params.delegate),
        parentID: optionalString(params.parent_id),
        includeArchived: params.include_archived,
        limit: params.limit,
      }),
    ),
)

server.registerTool(
  "get_issue",
  {
    title: "Get AugustTask issue",
    description: "Get one AugustTask issue with comments and relations.",
    inputSchema: { id: z.string() },
  },
  async (params) => run((augusttask) => augusttask.getIssue(params.id)),
)

server.registerTool(
  "edit_issue",
  {
    title: "Edit AugustTask issue",
    description: "Edit mutable AugustTask issue fields. Moving between projects is rejected by the service.",
    inputSchema: {
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: statusSchema.optional(),
      priority: prioritySchema.optional(),
      labels: z.array(z.string()).optional(),
      assignee: z.string().optional(),
      delegate: z.string().optional(),
      parent_id: z.string().optional(),
      due_date: z.string().optional(),
      branch: z.string().optional(),
      project_key: z.string().optional(),
      archived: z.boolean().optional(),
    },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.editIssue({
        id: params.id,
        title: optionalString(params.title),
        description: optionalString(params.description),
        status: optionalString(params.status),
        priority: optionalString(params.priority),
        labels: optionalArray(params.labels),
        assignee: optionalString(params.assignee),
        delegate: optionalString(params.delegate),
        parentID: optionalString(params.parent_id),
        dueDate: optionalString(params.due_date),
        branch: optionalString(params.branch),
        projectKey: optionalString(params.project_key),
        archived: params.archived,
      }),
    ),
)

server.registerTool(
  "set_issue_status",
  {
    title: "Set AugustTask issue status",
    description: "Set an AugustTask issue status.",
    inputSchema: { id: z.string(), status: statusSchema },
  },
  async (params) => run((augusttask) => augusttask.setIssueStatus({ id: params.id, status: optionalString(params.status) ?? params.status })),
)

server.registerTool(
  "add_issue_comment",
  {
    title: "Add AugustTask issue comment",
    description: "Add a comment to an AugustTask issue.",
    inputSchema: { id: z.string(), body: z.string(), author: z.string().optional() },
  },
  async (params) =>
    run((augusttask) => augusttask.addIssueComment({ id: params.id, body: params.body, author: optionalString(params.author) })),
)

server.registerTool(
  "relate_issues",
  {
    title: "Relate AugustTask issues",
    description: "Create or update a semantic relation between two AugustTask issues.",
    inputSchema: { id: z.string(), target_id: z.string(), type: relationTypeSchema },
  },
  async (params) =>
    run((augusttask) =>
      augusttask.relateIssues({ id: params.id, targetID: params.target_id, type: optionalString(params.type) ?? params.type }),
    ),
)

server.registerTool(
  "list_issue_events",
  {
    title: "List AugustTask issue events",
    description: "List event history for one AugustTask issue.",
    inputSchema: { id: z.string() },
  },
  async (params) => run((augusttask) => augusttask.listIssueEvents(params.id)),
)

async function run<A>(effect: (augusttask: AugustTask.Interface) => Effect.Effect<A, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          await Effect.runPromise(AugustTask.Service.use(effect).pipe(Effect.provide(AugustTask.defaultLayer))),
          null,
          2,
        ),
      },
    ],
  }
}

function optionalString<T extends string>(value: T | undefined) {
  if (value === undefined) return undefined
  if (value.trim() === "") return undefined
  return value
}

function optionalArray<T>(value: T[] | undefined) {
  if (value === undefined) return undefined
  if (value.length === 0) return undefined
  return value
}

export * as AugustTaskMcp from "./mcp"
