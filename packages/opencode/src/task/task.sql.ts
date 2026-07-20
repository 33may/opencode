import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"
import type { Priority, RelationType, Status, TaskID } from "./schema"

export const TaskCounterTable = sqliteTable("task_counter", {
  name: text().primaryKey(),
  value: integer().notNull(),
})

export const TaskIssueTable = sqliteTable(
  "task_issue",
  {
    id: text().$type<TaskID>().primaryKey(),
    sequence: integer().notNull(),
    title: text().notNull(),
    description: text().notNull().default(""),
    status: text().$type<Status>().notNull().default("todo"),
    priority: text().$type<Priority>().notNull().default("medium"),
    project: text(),
    labels: text({ mode: "json" }).notNull().$type<string[]>().default([]),
    assignee: text(),
    delegate: text(),
    parent_id: text().$type<TaskID>(),
    due_date: text(),
    branch: text(),
    source: text().notNull().default("august"),
    ...Timestamps,
    time_started: integer(),
    time_completed: integer(),
    time_archived: integer(),
  },
  (table) => [
    index("task_issue_sequence_idx").on(table.sequence),
    index("task_issue_status_idx").on(table.status),
    index("task_issue_project_idx").on(table.project),
    index("task_issue_parent_idx").on(table.parent_id),
    index("task_issue_updated_idx").on(table.time_updated),
  ],
)

export const TaskCommentTable = sqliteTable(
  "task_comment",
  {
    id: text().primaryKey(),
    sequence: integer(),
    issue_id: text()
      .$type<TaskID>()
      .notNull()
      .references(() => TaskIssueTable.id, { onDelete: "cascade" }),
    body: text().notNull(),
    author: text().notNull().default("august"),
    ...Timestamps,
  },
  (table) => [uniqueIndex("task_comment_sequence_idx").on(table.sequence), index("task_comment_issue_idx").on(table.issue_id)],
)

export const TaskRelationTable = sqliteTable(
  "task_relation",
  {
    source_id: text()
      .$type<TaskID>()
      .notNull()
      .references(() => TaskIssueTable.id, { onDelete: "cascade" }),
    target_id: text()
      .$type<TaskID>()
      .notNull()
      .references(() => TaskIssueTable.id, { onDelete: "cascade" }),
    type: text().$type<RelationType>().notNull(),
    sequence: integer(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.source_id, table.target_id, table.type] }),
    uniqueIndex("task_relation_sequence_idx").on(table.sequence),
    index("task_relation_source_idx").on(table.source_id),
    index("task_relation_target_idx").on(table.target_id),
  ],
)

export const TaskEventTable = sqliteTable(
  "task_event",
  {
    id: text().primaryKey(),
    issue_id: text()
      .$type<TaskID>()
      .notNull()
      .references(() => TaskIssueTable.id, { onDelete: "cascade" }),
    sequence: integer(),
    action: text().notNull(),
    data: text({ mode: "json" }).notNull().$type<Record<string, unknown>>(),
    time_created: integer()
      .notNull()
      .$default(() => Date.now()),
  },
  (table) => [uniqueIndex("task_event_sequence_idx").on(table.sequence), index("task_event_issue_idx").on(table.issue_id, table.sequence)],
)
