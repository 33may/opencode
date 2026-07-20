import { Schema } from "effect"
import type { ProjectKey } from "./project"

export const IssueID = Schema.String.pipe(Schema.brand("AugustTaskIssueID"))
export type IssueID = typeof IssueID.Type

export const Status = Schema.Literals(["triage", "backlog", "todo", "in_progress", "in_review", "done", "canceled", "duplicate"]).annotate({
  identifier: "AugustTaskIssueStatus",
})
export type Status = typeof Status.Type

export const Priority = Schema.Literals(["none", "urgent", "high", "medium", "low"]).annotate({
  identifier: "AugustTaskIssuePriority",
})
export type Priority = typeof Priority.Type

export const RelationType = Schema.Literals(["related", "blocks", "duplicate"]).annotate({
  identifier: "AugustTaskRelationType",
})
export type RelationType = typeof RelationType.Type

export const StatusValues = ["triage", "backlog", "todo", "in_progress", "in_review", "done", "canceled", "duplicate"] as const satisfies readonly Status[]
export const PriorityValues = ["none", "urgent", "high", "medium", "low"] as const satisfies readonly Priority[]
export const RelationTypeValues = ["related", "blocks", "duplicate"] as const satisfies readonly RelationType[]

export type Issue = {
  id: IssueID
  projectKey: ProjectKey
  sequence: number
  title: string
  description: string
  status: Status
  priority: Priority
  labels: string[]
  assignee?: string
  delegate?: string
  parentID?: IssueID
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

export function makeIssueID(projectKey: ProjectKey, sequence: number) {
  return IssueID.make(`${projectKey}-${sequence}`)
}

export function completedStatus(status?: Status) {
  return status === "done" || status === "canceled" || status === "duplicate"
}

export * as AugustTaskIssue from "./issue"
