import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"
import type { ProjectKey, ProjectStatus } from "./domain/project"

export const AugustTaskProjectTable = sqliteTable(
  "augusttask_project",
  {
    key: text().$type<ProjectKey>().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(""),
    status: text().$type<ProjectStatus>().notNull().default("active"),
    default_assignee: text(),
    labels: text({ mode: "json" }).notNull().$type<string[]>().default([]),
    ...Timestamps,
  },
  (table) => [uniqueIndex("augusttask_project_name_idx").on(table.name), index("augusttask_project_status_idx").on(table.status)],
)
