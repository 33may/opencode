import type { Argv } from "yargs"
import { Effect } from "effect"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import { Task } from "@/task/task"
import { PriorityValues, RelationTypeValues, StatusValues, TaskID } from "@/task/schema"

type Format = "text" | "json"

export const TaskCommand = cmd({
  command: "task",
  describe: "manage August local tasks",
  builder: (yargs: Argv) =>
    yargs
      .command(TaskCreateCommand)
      .command(TaskListCommand)
      .command(TaskShowCommand)
      .command(TaskUpdateCommand)
      .command(TaskCommentCommand)
      .command(TaskRelateCommand)
      .command(TaskEventsCommand)
      .demandCommand(),
  async handler() {},
})

const TaskCreateCommand = effectCmd({
  command: "create <title>",
  describe: "create an August task",
  instance: false,
  builder: (yargs) => commonIssueOptions(formatOption(yargs.positional("title", { type: "string", demandOption: true }))),
  handler: Effect.fn("Cli.task.create")(function* (args) {
    const task = yield* Task.Service
    write(
      yield* task
        .create({
          title: String(args.title),
          description: optionalString(args.description),
          status: args.status,
          priority: args.priority,
          project: optionalString(args.project),
          labels: labels(args.label),
          assignee: optionalString(args.assignee),
          delegate: optionalString(args.delegate),
          parentID: optionalTaskID(args.parentId),
          dueDate: optionalString(args.dueDate),
          branch: optionalString(args.branch),
        })
        .pipe(catchTaskError),
      args.format,
    )
  }),
})

const TaskListCommand = effectCmd({
  command: "list",
  describe: "list August tasks",
  instance: false,
  builder: (yargs) =>
    formatOption(yargs)
      .option("status", { type: "string", choices: [...StatusValues] })
      .option("project", { type: "string" })
      .option("label", { type: "string" })
      .option("assignee", { type: "string" })
      .option("delegate", { type: "string" })
      .option("parent-id", { type: "string" })
      .option("include-archived", { type: "boolean", default: false })
      .option("limit", { type: "number" }),
  handler: Effect.fn("Cli.task.list")(function* (args) {
    const task = yield* Task.Service
    write(
      yield* task.list({
        status: args.status,
        project: optionalString(args.project),
        label: optionalString(args.label),
        assignee: optionalString(args.assignee),
        delegate: optionalString(args.delegate),
        parentID: optionalTaskID(args.parentId),
        includeArchived: Boolean(args.includeArchived),
        limit: typeof args.limit === "number" ? args.limit : undefined,
      }),
      args.format,
    )
  }),
})

const TaskShowCommand = effectCmd({
  command: "show <id>",
  describe: "show an August task",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.task.show")(function* (args) {
    const task = yield* Task.Service
    write(yield* task.get(TaskID.make(String(args.id))).pipe(catchTaskError), args.format)
  }),
})

const TaskUpdateCommand = effectCmd({
  command: "update <id>",
  describe: "update an August task",
  instance: false,
  builder: (yargs) =>
    commonIssueOptions(formatOption(yargs.positional("id", { type: "string", demandOption: true }))).option("archive", {
      type: "boolean",
    }),
  handler: Effect.fn("Cli.task.update")(function* (args) {
    const task = yield* Task.Service
    write(
      yield* task
        .update({
          id: TaskID.make(String(args.id)),
          title: optionalString(args.title),
          description: optionalString(args.description),
          status: args.status,
          priority: args.priority,
          project: optionalString(args.project),
          labels: labels(args.label),
          assignee: optionalString(args.assignee),
          delegate: optionalString(args.delegate),
          parentID: optionalTaskID(args.parentId),
          dueDate: optionalString(args.dueDate),
          branch: optionalString(args.branch),
          archived: typeof args.archive === "boolean" ? args.archive : undefined,
        })
        .pipe(catchTaskError),
      args.format,
    )
  }),
})

const TaskCommentCommand = effectCmd({
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
    const task = yield* Task.Service
    write(
      yield* task
        .comment({ id: TaskID.make(String(args.id)), body: String(args.body), author: optionalString(args.author) })
        .pipe(catchTaskError),
      args.format,
    )
  }),
})

const TaskRelateCommand = effectCmd({
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
    const task = yield* Task.Service
    write(
      yield* task
        .relate({ id: TaskID.make(String(args.id)), targetID: TaskID.make(String(args.targetID)), type: args.type })
        .pipe(catchTaskError),
      args.format,
    )
  }),
})

const TaskEventsCommand = effectCmd({
  command: "events <id>",
  describe: "show August task audit events",
  instance: false,
  builder: (yargs) => formatOption(yargs.positional("id", { type: "string", demandOption: true })),
  handler: Effect.fn("Cli.task.events")(function* (args) {
    const task = yield* Task.Service
    write(yield* task.events(TaskID.make(String(args.id))).pipe(catchTaskError), args.format)
  }),
})

function formatOption<T>(yargs: Argv<T>) {
  return yargs.option("format", { type: "string", choices: ["text", "json"], default: "text" })
}

function commonIssueOptions<T>(yargs: Argv<T>) {
  return yargs
    .option("description", { type: "string" })
    .option("status", { type: "string", choices: [...StatusValues] })
    .option("priority", { type: "string", choices: [...PriorityValues] })
    .option("project", { type: "string" })
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
  if ("id" in value && "title" in value && "status" in value) {
    return `${value.id} ${value.status} ${value.title}`
  }
  return JSON.stringify(value)
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined
  if (value.length === 0) return undefined
  return value
}

function optionalTaskID(value: unknown) {
  const text = optionalString(value)
  return text ? TaskID.make(text) : undefined
}

function labels(value: unknown) {
  if (Array.isArray(value)) return value.map(String)
  const text = optionalString(value)
  return text ? [text] : undefined
}

const catchTaskError = <A, R>(effect: Effect.Effect<A, Task.NotFoundError, R>) =>
  effect.pipe(Effect.catchTag("TaskNotFoundError", (error) => fail(`Task not found: ${error.id}`)))
