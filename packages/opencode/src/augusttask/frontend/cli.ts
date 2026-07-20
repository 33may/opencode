import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "../../cli/cmd/cmd"
import { effectCmd, fail } from "../../cli/effect-cmd"
import { PriorityValues, RelationTypeValues, StatusValues } from "../domain/issue"
import { ProjectStatusValues } from "../domain/project"
import { AugustTaskRepository } from "../repository/augusttask-repository"
import { AugustTask } from "../service/augusttask-service"

type Format = "text" | "json"
type AugustTaskError =
  | AugustTaskRepository.ProjectAlreadyExistsError
  | AugustTaskRepository.ProjectNotFoundError
  | AugustTaskRepository.IssueNotFoundError
  | AugustTaskRepository.ProjectMoveNotSupportedError

export const AugustTaskCommand = cmd({
  command: "augusttask",
  describe: "manage AugustTask projects and issues",
  builder: (yargs: Argv) => yargs.command(ProjectCommand).command(IssueCommand).demandCommand(),
  async handler() {},
})

export const LegacyTaskCommand = cmd({
  command: "task",
  describe: "manage August local tasks",
  builder: (yargs: Argv) =>
    yargs
      .command(LegacyIssueCreateCommand)
      .command(LegacyIssueListCommand)
      .command(LegacyIssueShowCommand)
      .command(LegacyIssueUpdateCommand)
      .command(LegacyIssueCommentCommand)
      .command(LegacyIssueRelateCommand)
      .command(LegacyIssueEventsCommand)
      .demandCommand(),
  async handler() {},
})

const ProjectCommand = cmd({
  command: "project",
  describe: "manage AugustTask projects",
  builder: (yargs: Argv) =>
    yargs
      .command(ProjectCreateCommand)
      .command(ProjectListCommand)
      .command(ProjectShowCommand)
      .command(ProjectUpdateCommand)
      .demandCommand(),
  async handler() {},
})

const IssueCommand = cmd({
  command: "issue",
  describe: "manage AugustTask issues",
  builder: (yargs: Argv) =>
    yargs
      .command(IssueCreateCommand)
      .command(IssueListCommand)
      .command(IssueShowCommand)
      .command(IssueUpdateCommand)
      .command(IssueStatusCommand)
      .command(IssueCommentCommand)
      .command(IssueRelateCommand)
      .command(IssueEventsCommand)
      .demandCommand(),
  async handler() {},
})

const ProjectCreateCommand = effectCmd({
  command: "create <key> <name>",
  describe: "create an AugustTask project",
  instance: false,
  builder: (yargs) =>
    projectOptions(
      formatOption(
        yargs
          .positional("key", { type: "string", demandOption: true })
          .positional("name", { type: "string", demandOption: true }),
      ),
    ),
  handler: Effect.fn("Cli.augusttask.project.create")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .createProject({
          key: String(args.key),
          name: String(args.name),
          description: optionalString(args.description),
          status: args.status,
          defaultAssignee: optionalString(args.defaultAssignee),
          labels: labels(args.label),
        })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const ProjectListCommand = effectCmd({
  command: "list",
  describe: "list AugustTask projects",
  instance: false,
  builder: (yargs) => formatOption(yargs.option("status", { type: "string", choices: [...ProjectStatusValues] })),
  handler: Effect.fn("Cli.augusttask.project.list")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(yield* augusttask.listProjects({ status: args.status }), args.format)
  }),
})

const ProjectShowCommand = effectCmd({
  command: "show <key>",
  describe: "show an AugustTask project",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("key", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.augusttask.project.show")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(yield* augusttask.getProject(String(args.key)).pipe(catchAugustTaskError), args.format)
  }),
})

const ProjectUpdateCommand = effectCmd({
  command: "update <key>",
  describe: "update an AugustTask project",
  instance: false,
  builder: (yargs) =>
    projectOptions(formatOption(yargs.positional("key", { type: "string", demandOption: true }))).option("name", {
      type: "string",
    }),
  handler: Effect.fn("Cli.augusttask.project.update")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .editProject({
          key: String(args.key),
          name: optionalString(args.name),
          description: optionalString(args.description),
          status: args.status,
          defaultAssignee: optionalString(args.defaultAssignee),
          labels: labels(args.label),
        })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const IssueCreateCommand = effectCmd({
  command: "create <project> <title>",
  describe: "create an AugustTask issue",
  instance: false,
  builder: (yargs) =>
    issueCreateOptions(
      formatOption(
        yargs
          .positional("project", { type: "string", demandOption: true })
          .positional("title", { type: "string", demandOption: true }),
      ),
    ),
  handler: Effect.fn("Cli.augusttask.issue.create")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .createIssue({
          projectKey: String(args.project),
          title: String(args.title),
          description: optionalString(args.description),
          status: args.status,
          priority: args.priority,
          labels: labels(args.label),
          assignee: optionalString(args.assignee),
          delegate: optionalString(args.delegate),
          parentID: optionalString(args.parentId),
          dueDate: optionalString(args.dueDate),
          branch: optionalString(args.branch),
        })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const LegacyIssueCreateCommand = effectCmd({
  command: "create <title>",
  describe: "create an August task",
  instance: false,
  builder: (yargs) => issueOptions(formatOption(yargs.positional("title", { type: "string", demandOption: true }))),
  handler: Effect.fn("Cli.task.create")(function* (args) {
    const augusttask = yield* AugustTask.Service
    const project = optionalString(args.project)
    const projectKey = legacyProjectKey(project)
    yield* ensureLegacyProject(augusttask, project, projectKey)
    const created = yield* augusttask
      .createIssue({
        projectKey,
        title: String(args.title),
        description: optionalString(args.description),
        status: args.status,
        priority: args.priority,
        labels: labels(args.label),
        assignee: optionalString(args.assignee),
        delegate: optionalString(args.delegate),
        parentID: optionalString(args.parentId),
        dueDate: optionalString(args.dueDate),
        branch: optionalString(args.branch),
      })
      .pipe(catchAugustTaskError)
    write(yield* legacyIssueOutput(augusttask, created, project), args.format)
  }),
})

const IssueListCommand = effectCmd({
  command: "list",
  describe: "list AugustTask issues",
  instance: false,
  builder: (yargs) =>
    formatOption(yargs)
      .option("project", { type: "string" })
      .option("status", { type: "string", choices: [...StatusValues] })
      .option("label", { type: "string" })
      .option("assignee", { type: "string" })
      .option("delegate", { type: "string" })
      .option("parent-id", { type: "string" })
      .option("include-archived", { type: "boolean", default: false })
      .option("limit", { type: "number" }),
  handler: Effect.fn("Cli.augusttask.issue.list")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask.listIssues({
        projectKey: optionalString(args.project),
        status: args.status,
        label: optionalString(args.label),
        assignee: optionalString(args.assignee),
        delegate: optionalString(args.delegate),
        parentID: optionalString(args.parentId),
        includeArchived: Boolean(args.includeArchived),
        limit: typeof args.limit === "number" ? args.limit : undefined,
      }),
      args.format,
    )
  }),
})

const LegacyIssueListCommand = effectCmd({
  command: "list",
  describe: "list August tasks",
  instance: false,
  builder: (yargs) =>
    formatOption(yargs)
      .option("project", { type: "string" })
      .option("status", { type: "string", choices: [...StatusValues] })
      .option("label", { type: "string" })
      .option("assignee", { type: "string" })
      .option("delegate", { type: "string" })
      .option("parent-id", { type: "string" })
      .option("include-archived", { type: "boolean", default: false })
      .option("limit", { type: "number" }),
  handler: Effect.fn("Cli.task.list")(function* (args) {
    const augusttask = yield* AugustTask.Service
    const project = optionalString(args.project)
    const issues = yield* augusttask.listIssues({
      projectKey: project ? yield* resolveLegacyProjectKey(augusttask, project) : undefined,
      status: args.status,
      label: optionalString(args.label),
      assignee: optionalString(args.assignee),
      delegate: optionalString(args.delegate),
      parentID: optionalString(args.parentId),
      includeArchived: Boolean(args.includeArchived),
      limit: typeof args.limit === "number" ? args.limit : undefined,
    })
    write(yield* Effect.all(issues.map((issue) => legacyIssueOutput(augusttask, issue, project))), args.format)
  }),
})

const IssueShowCommand = effectCmd({
  command: "show <id>",
  describe: "show an AugustTask issue",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.augusttask.issue.show")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(yield* augusttask.getIssue(String(args.id)).pipe(catchAugustTaskError), args.format)
  }),
})

const LegacyIssueShowCommand = effectCmd({
  command: "show <id>",
  describe: "show an August task",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.task.show")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* legacyIssueOutput(augusttask, yield* augusttask.getIssue(String(args.id)).pipe(catchAugustTaskError)),
      args.format,
    )
  }),
})

const IssueUpdateCommand = effectCmd({
  command: "update <id>",
  describe: "update an AugustTask issue",
  instance: false,
  builder: (yargs) =>
    issueOptions(formatOption(yargs.positional("id", { type: "string", demandOption: true }))).option("archive", {
      type: "boolean",
    }),
  handler: Effect.fn("Cli.augusttask.issue.update")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .editIssue({
          id: String(args.id),
          title: optionalString(args.title),
          description: optionalString(args.description),
          status: args.status,
          priority: args.priority,
          projectKey: optionalString(args.project),
          labels: labels(args.label),
          assignee: optionalString(args.assignee),
          delegate: optionalString(args.delegate),
          parentID: optionalString(args.parentId),
          dueDate: optionalString(args.dueDate),
          branch: optionalString(args.branch),
          archived: typeof args.archive === "boolean" ? args.archive : undefined,
        })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const LegacyIssueUpdateCommand = effectCmd({
  command: "update <id>",
  describe: "update an August task",
  instance: false,
  builder: (yargs) =>
    issueOptions(formatOption(yargs.positional("id", { type: "string", demandOption: true }))).option("archive", {
      type: "boolean",
    }),
  handler: Effect.fn("Cli.task.update")(function* (args) {
    const augusttask = yield* AugustTask.Service
    const project = optionalString(args.project)
    if (project) yield* ensureLegacyProject(augusttask, project, legacyProjectKey(project))
    const updated = yield* augusttask
      .editIssue({
        id: String(args.id),
        title: optionalString(args.title),
        description: optionalString(args.description),
        status: args.status,
        priority: args.priority,
        projectKey: project ? legacyProjectKey(project) : undefined,
        labels: labels(args.label),
        assignee: optionalString(args.assignee),
        delegate: optionalString(args.delegate),
        parentID: optionalString(args.parentId),
        dueDate: optionalString(args.dueDate),
        branch: optionalString(args.branch),
        archived: typeof args.archive === "boolean" ? args.archive : undefined,
      })
      .pipe(catchAugustTaskError)
    write(yield* legacyIssueOutput(augusttask, updated, project), args.format)
  }),
})

const IssueStatusCommand = effectCmd({
  command: "status <id> <status>",
  describe: "set an AugustTask issue status",
  instance: false,
  builder: (yargs) =>
    formatOption(
      yargs
        .positional("id", { type: "string", demandOption: true })
        .positional("status", { type: "string", choices: [...StatusValues], demandOption: true }),
    ),
  handler: Effect.fn("Cli.augusttask.issue.status")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask.setIssueStatus({ id: String(args.id), status: args.status }).pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const IssueCommentCommand = effectCmd({
  command: "comment <id> <body>",
  describe: "comment on an AugustTask issue",
  instance: false,
  builder: (yargs) =>
    formatOption(
      yargs
        .positional("id", { type: "string", demandOption: true })
        .positional("body", { type: "string", demandOption: true })
        .option("author", { type: "string" }),
    ),
  handler: Effect.fn("Cli.augusttask.issue.comment")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .addIssueComment({ id: String(args.id), body: String(args.body), author: optionalString(args.author) })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const LegacyIssueCommentCommand = effectCmd({
  command: "comment <id> <body>",
  describe: "comment on an August task",
  instance: false,
  builder: (yargs) =>
    formatOption(
      yargs
        .positional("id", { type: "string", demandOption: true })
        .positional("body", { type: "string", demandOption: true })
        .option("author", { type: "string" }),
    ),
  handler: Effect.fn("Cli.task.comment")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .addIssueComment({ id: String(args.id), body: String(args.body), author: optionalString(args.author) })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const IssueRelateCommand = effectCmd({
  command: "relate <id> <targetID>",
  describe: "relate two AugustTask issues",
  instance: false,
  builder: (yargs) =>
    formatOption(
      yargs
        .positional("id", { type: "string", demandOption: true })
        .positional("targetID", { type: "string", demandOption: true })
        .option("type", { type: "string", choices: [...RelationTypeValues], default: "related" }),
    ),
  handler: Effect.fn("Cli.augusttask.issue.relate")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .relateIssues({ id: String(args.id), targetID: String(args.targetID), type: args.type })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const LegacyIssueRelateCommand = effectCmd({
  command: "relate <id> <targetID>",
  describe: "relate two August tasks",
  instance: false,
  builder: (yargs) =>
    formatOption(
      yargs
        .positional("id", { type: "string", demandOption: true })
        .positional("targetID", { type: "string", demandOption: true })
        .option("type", { type: "string", choices: [...RelationTypeValues], default: "related" }),
    ),
  handler: Effect.fn("Cli.task.relate")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(
      yield* augusttask
        .relateIssues({ id: String(args.id), targetID: String(args.targetID), type: args.type })
        .pipe(catchAugustTaskError),
      args.format,
    )
  }),
})

const IssueEventsCommand = effectCmd({
  command: "events <id>",
  describe: "show AugustTask issue audit events",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.augusttask.issue.events")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(yield* augusttask.listIssueEvents(String(args.id)).pipe(catchAugustTaskError), args.format)
  }),
})

const LegacyIssueEventsCommand = effectCmd({
  command: "events <id>",
  describe: "show August task audit events",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.task.events")(function* (args) {
    const augusttask = yield* AugustTask.Service
    write(yield* augusttask.listIssueEvents(String(args.id)).pipe(catchAugustTaskError), args.format)
  }),
})

function formatOption<T>(yargs: Argv<T>) {
  return yargs.option("format", { type: "string", choices: ["text", "json"], default: "text" })
}

function projectOptions<T>(yargs: Argv<T>) {
  return yargs
    .option("description", { type: "string" })
    .option("status", { type: "string", choices: [...ProjectStatusValues] })
    .option("default-assignee", { type: "string" })
    .option("label", { type: "string", array: true })
}

function issueOptions<T>(yargs: Argv<T>) {
  return yargs
    .option("description", { type: "string" })
    .option("project", { type: "string" })
    .option("status", { type: "string", choices: [...StatusValues] })
    .option("priority", { type: "string", choices: [...PriorityValues] })
    .option("label", { type: "string", array: true })
    .option("assignee", { type: "string" })
    .option("delegate", { type: "string" })
    .option("parent-id", { type: "string" })
    .option("due-date", { type: "string" })
    .option("branch", { type: "string" })
}

function issueCreateOptions<T>(yargs: Argv<T>) {
  return yargs
    .option("description", { type: "string" })
    .option("status", { type: "string", choices: [...StatusValues] })
    .option("priority", { type: "string", choices: [...PriorityValues] })
    .option("label", { type: "string", array: true })
    .option("assignee", { type: "string" })
    .option("delegate", { type: "string" })
    .option("parent-id", { type: "string" })
    .option("due-date", { type: "string" })
    .option("branch", { type: "string" })
}

function write(value: unknown, format: Format | string | undefined) {
  if (format === "json") {
    console.log(JSON.stringify(value, null, 2))
    return
  }
  if (Array.isArray(value)) {
    console.log(value.map((item) => formatValue(item)).join("\n"))
    return
  }
  console.log(formatValue(value))
}

function formatValue(value: unknown) {
  if (!value || typeof value !== "object") return String(value)
  if ("id" in value && "title" in value && "status" in value) return `${value.id} ${value.status} ${value.title}`
  if ("key" in value && "name" in value && "status" in value) return `${value.key} ${value.status} ${value.name}`
  return JSON.stringify(value)
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined
  if (value.length === 0) return undefined
  return value
}

function labels(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  const text = optionalString(value)
  return text ? [text] : undefined
}

function legacyProjectKey(project: string | undefined) {
  if (!project) return "AUG"
  if (project.trim().toLowerCase() === "august") return "AUG"
  const normalized = project
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
  const key = /^[A-Z]/.test(normalized) ? normalized : `P_${normalized}`
  return key.padEnd(2, "_").slice(0, 16)
}

function legacyProjectName(project: string | undefined, projectKey: string) {
  if (project) return project
  return projectKey === "AUG" ? "august" : projectKey
}

const resolveLegacyProjectKey = Effect.fn("Cli.task.resolveLegacyProjectKey")(function* (
  augusttask: AugustTask.Interface,
  project: string,
) {
  const projectKey = legacyProjectKey(project)
  return yield* augusttask.getProject(projectKey).pipe(
    Effect.as(projectKey),
    Effect.catchTag("AugustTaskProjectNotFoundError", () =>
      Effect.gen(function* () {
        return (yield* augusttask.listProjects({})).find((item) => item.name === project)?.key ?? projectKey
      }),
    ),
  )
})

function legacyIssueOutput<T extends { projectKey: string }>(
  augusttask: AugustTask.Interface,
  issue: T,
  project?: string,
) {
  if (project) return Effect.succeed({ ...issue, project })
  if (issue.projectKey === "AUG") return Effect.succeed({ ...issue, project: "august" })
  return augusttask.getProject(issue.projectKey).pipe(
    Effect.map((stored) => ({ ...issue, project: stored.name })),
    Effect.catchTag("AugustTaskProjectNotFoundError", () =>
      Effect.succeed({ ...issue, project: legacyProjectName(undefined, issue.projectKey) }),
    ),
  )
}

function ensureLegacyProject(augusttask: AugustTask.Interface, project: string | undefined, projectKey: string) {
  return augusttask
    .getProject(projectKey)
    .pipe(
      Effect.catchTag("AugustTaskProjectNotFoundError", () =>
        augusttask
          .createProject({ key: projectKey, name: legacyProjectName(project, projectKey) })
          .pipe(Effect.catchTag("AugustTaskProjectAlreadyExistsError", () => Effect.void)),
      ),
    )
}

const catchAugustTaskError = <A, R>(effect: Effect.Effect<A, AugustTaskError, R>) =>
  effect.pipe(
    Effect.catchTags({
      AugustTaskProjectNotFoundError: (error) => fail(`AugustTask project not found: ${error.key}`),
      AugustTaskProjectAlreadyExistsError: (error) => fail(`AugustTask project already exists: ${error.key}`),
      AugustTaskIssueNotFoundError: (error) => fail(`AugustTask issue not found: ${error.id}`),
      AugustTaskProjectMoveNotSupportedError: (error) => fail(`AugustTask issue cannot move projects: ${error.id}`),
    }),
  )

export * as AugustTaskCli from "./cli"
