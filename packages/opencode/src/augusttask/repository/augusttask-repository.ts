import { Context, Effect, Schema } from "effect"
import type { Comment } from "../domain/comment"
import type { Event } from "../domain/event"
import type { Issue, IssueID, Priority, RelationType, Status } from "../domain/issue"
import type { Project, ProjectKey, ProjectStatus } from "../domain/project"
import type { Relation } from "../domain/relation"

export class ProjectNotFoundError extends Schema.TaggedErrorClass<ProjectNotFoundError>()(
  "AugustTaskProjectNotFoundError",
  {
    key: Schema.String,
  },
) {}

export class ProjectAlreadyExistsError extends Schema.TaggedErrorClass<ProjectAlreadyExistsError>()(
  "AugustTaskProjectAlreadyExistsError",
  {
    key: Schema.String,
  },
) {}

export class IssueNotFoundError extends Schema.TaggedErrorClass<IssueNotFoundError>()("AugustTaskIssueNotFoundError", {
  id: Schema.String,
}) {}

export class InvalidStatusTransitionError extends Schema.TaggedErrorClass<InvalidStatusTransitionError>()(
  "AugustTaskInvalidStatusTransitionError",
  {
    id: Schema.String,
    status: Schema.String,
  },
) {}

export class ProjectMoveNotSupportedError extends Schema.TaggedErrorClass<ProjectMoveNotSupportedError>()(
  "AugustTaskProjectMoveNotSupportedError",
  {
    id: Schema.String,
    currentProjectKey: Schema.String,
    requestedProjectKey: Schema.String,
  },
) {}

export type CreateProjectInput = {
  key: ProjectKey
  name: string
  description?: string
  status?: ProjectStatus
  defaultAssignee?: string
  labels?: string[]
}

export type ListProjectsInput = {
  status?: ProjectStatus
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "key">> & {
  key: ProjectKey
}

export type RepositoryCreateIssueInput = {
  id: IssueID
  projectKey: ProjectKey
  sequence: number
  title: string
  description?: string
  status?: Status
  priority?: Priority
  labels?: string[]
  assignee?: string
  delegate?: string
  parentID?: IssueID
  dueDate?: string
  branch?: string
  source?: string
}

export type ListIssuesInput = {
  projectKey?: ProjectKey
  status?: Status
  label?: string
  assignee?: string
  delegate?: string
  parentID?: IssueID
  includeArchived?: boolean
  limit?: number
}

export type RepositoryUpdateIssueInput = Partial<
  Omit<RepositoryCreateIssueInput, "id" | "projectKey" | "sequence" | "source">
> & {
  id: IssueID
  archived?: boolean
}

export type RepositoryMoveIssueInput = RepositoryUpdateIssueInput & {
  newID: IssueID
  projectKey: ProjectKey
  sequence: number
}

export type AddCommentInput = {
  id: IssueID
  body: string
  author?: string
}

export type RelateIssuesInput = {
  id: IssueID
  targetID: IssueID
  type: RelationType
}

export type IssueDetail = Issue & {
  comments: Comment[]
  relations: Relation[]
}

export interface Interface {
  readonly createProject: (input: CreateProjectInput) => Effect.Effect<Project, ProjectAlreadyExistsError>
  readonly listProjects: (input?: ListProjectsInput) => Effect.Effect<Project[]>
  readonly getProject: (key: ProjectKey) => Effect.Effect<Project, ProjectNotFoundError>
  readonly updateProject: (input: UpdateProjectInput) => Effect.Effect<Project, ProjectNotFoundError>
  readonly nextIssueSequence: (projectKey: ProjectKey) => Effect.Effect<number, ProjectNotFoundError>
  readonly createIssue: (
    input: RepositoryCreateIssueInput,
  ) => Effect.Effect<Issue, IssueNotFoundError | ProjectNotFoundError>
  readonly listIssues: (input?: ListIssuesInput) => Effect.Effect<Issue[]>
  readonly getIssue: (id: IssueID) => Effect.Effect<IssueDetail, IssueNotFoundError>
  readonly updateIssue: (input: RepositoryUpdateIssueInput) => Effect.Effect<Issue, IssueNotFoundError>
  readonly moveIssue: (input: RepositoryMoveIssueInput) => Effect.Effect<Issue, IssueNotFoundError>
  readonly addComment: (input: AddCommentInput) => Effect.Effect<Comment, IssueNotFoundError>
  readonly relateIssues: (input: RelateIssuesInput) => Effect.Effect<Relation, IssueNotFoundError>
  readonly listEvents: (id: IssueID) => Effect.Effect<Event[], IssueNotFoundError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AugustTaskRepository") {}

export * as AugustTaskRepository from "./augusttask-repository"
