import { Schema } from "effect"

export const ProjectKey = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Z][A-Z0-9_]{1,15}$/)), Schema.brand("AugustTaskProjectKey"))
export type ProjectKey = typeof ProjectKey.Type

export const ProjectStatus = Schema.Literals(["active", "paused", "archived"]).annotate({
  identifier: "AugustTaskProjectStatus",
})
export type ProjectStatus = typeof ProjectStatus.Type

export const ProjectStatusValues = ["active", "paused", "archived"] as const satisfies readonly ProjectStatus[]

export type Project = {
  key: ProjectKey
  name: string
  description: string
  status: ProjectStatus
  defaultAssignee?: string
  labels: string[]
  time: {
    created: number
    updated: number
  }
}

export function normalizeProjectKey(input: string) {
  return ProjectKey.make(input.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"))
}

export function normalizeProjectKeyOrDefault(input: string | null | undefined) {
  const normalized = input?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_") ?? ""
  if (/^[A-Z][A-Z0-9_]{1,15}$/.test(normalized)) return ProjectKey.make(normalized)
  return ProjectKey.make("AUG")
}

export * as AugustTaskProject from "./project"
