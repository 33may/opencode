import { Schema } from "effect"

const taskIdSchema = Schema.String.pipe(Schema.brand("TaskID"))
export type TaskID = typeof taskIdSchema.Type
export const TaskID = taskIdSchema

export const Status = Schema.Literals([
  "triage",
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
  "duplicate",
]).annotate({ identifier: "TaskStatus" })
export type Status = Schema.Schema.Type<typeof Status>

export const Priority = Schema.Literals(["none", "urgent", "high", "medium", "low"]).annotate({
  identifier: "TaskPriority",
})
export type Priority = Schema.Schema.Type<typeof Priority>

export const RelationType = Schema.Literals(["related", "blocks", "duplicate"]).annotate({
  identifier: "TaskRelationType",
})
export type RelationType = Schema.Schema.Type<typeof RelationType>

export const StatusValues = [
  "triage",
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
  "duplicate",
] as const satisfies readonly Status[]

export const PriorityValues = ["none", "urgent", "high", "medium", "low"] as const satisfies readonly Priority[]
export const RelationTypeValues = ["related", "blocks", "duplicate"] as const satisfies readonly RelationType[]
