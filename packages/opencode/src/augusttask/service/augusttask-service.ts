import { Context, Effect, Layer } from "effect"
import type { Comment } from "../domain/comment"
import type { Event } from "../domain/event"
import { IssueID, makeIssueID } from "../domain/issue"
import type { Issue, Priority, RelationType, Status } from "../domain/issue"
import { normalizeProjectKey } from "../domain/project"
import type { Project, ProjectStatus } from "../domain/project"
import type { Relation } from "../domain/relation"
import { AugustTaskRepository } from "../repository/augusttask-repository"
import { SqliteAugustTaskRepository } from "../repository/sqlite-augusttask-repository"

export type CreateProjectInput = {
  key: string
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
  key: string
}

export type CreateIssueInput = {
  projectKey: string
  title: string
  description?: string
  status?: Status
  priority?: Priority
  labels?: string[]
  assignee?: string
  delegate?: string
  parentID?: string
  dueDate?: string
  branch?: string
  source?: string
}

export type ListIssuesInput = {
  projectKey?: string
  status?: Status
  label?: string
  assignee?: string
  delegate?: string
  parentID?: string
  includeArchived?: boolean
  limit?: number
}

export type UpdateIssueInput = Partial<Omit<CreateIssueInput, "projectKey" | "source">> & {
  id: string
  projectKey?: string
  archived?: boolean
}

export type SetIssueStatusInput = {
  id: string
  status: Status
}

export type AddIssueCommentInput = {
  id: string
  body: string
  author?: string
}

export type RelateIssuesInput = {
  id: string
  targetID: string
  type: RelationType
}

export type IssueDetail = AugustTaskRepository.IssueDetail

export interface Interface {
  readonly createProject: (
    input: CreateProjectInput,
  ) => Effect.Effect<Project, AugustTaskRepository.ProjectAlreadyExistsError>
  readonly listProjects: (input?: ListProjectsInput) => Effect.Effect<Project[]>
  readonly getProject: (key: string) => Effect.Effect<Project, AugustTaskRepository.ProjectNotFoundError>
  readonly editProject: (input: UpdateProjectInput) => Effect.Effect<Project, AugustTaskRepository.ProjectNotFoundError>
  readonly createIssue: (
    input: CreateIssueInput,
  ) => Effect.Effect<Issue, AugustTaskRepository.ProjectNotFoundError | AugustTaskRepository.IssueNotFoundError>
  readonly listIssues: (input?: ListIssuesInput) => Effect.Effect<Issue[]>
  readonly getIssue: (id: string) => Effect.Effect<IssueDetail, AugustTaskRepository.IssueNotFoundError>
  readonly editIssue: (
    input: UpdateIssueInput,
  ) => Effect.Effect<Issue, AugustTaskRepository.IssueNotFoundError | AugustTaskRepository.ProjectNotFoundError>
  readonly setIssueStatus: (input: SetIssueStatusInput) => Effect.Effect<Issue, AugustTaskRepository.IssueNotFoundError>
  readonly addIssueComment: (
    input: AddIssueCommentInput,
  ) => Effect.Effect<Comment, AugustTaskRepository.IssueNotFoundError>
  readonly relateIssues: (input: RelateIssuesInput) => Effect.Effect<Relation, AugustTaskRepository.IssueNotFoundError>
  readonly listIssueEvents: (id: string) => Effect.Effect<Event[], AugustTaskRepository.IssueNotFoundError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AugustTask") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const repository = yield* AugustTaskRepository.Service

    const createProject = Effect.fn("AugustTask.createProject")(function* (input: CreateProjectInput) {
      return yield* repository.createProject({
        key: normalizeProjectKey(input.key),
        name: input.name,
        description: input.description,
        status: input.status,
        defaultAssignee: input.defaultAssignee,
        labels: input.labels,
      })
    })

    const listProjects = Effect.fn("AugustTask.listProjects")(function* (input: ListProjectsInput = {}) {
      return yield* repository.listProjects(input)
    })

    const getProject = Effect.fn("AugustTask.getProject")(function* (key: string) {
      return yield* repository.getProject(normalizeProjectKey(key))
    })

    const editProject = Effect.fn("AugustTask.editProject")(function* (input: UpdateProjectInput) {
      return yield* repository.updateProject({
        key: normalizeProjectKey(input.key),
        name: input.name,
        description: input.description,
        status: input.status,
        defaultAssignee: input.defaultAssignee,
        labels: input.labels,
      })
    })

    const createIssue = Effect.fn("AugustTask.createIssue")(function* (input: CreateIssueInput) {
      const projectKey = normalizeProjectKey(input.projectKey)
      yield* repository.getProject(projectKey)
      if (input.parentID) yield* repository.getIssue(IssueID.make(input.parentID))
      const sequence = yield* repository.nextIssueSequence(projectKey)
      return yield* repository.createIssue({
        id: makeIssueID(projectKey, sequence),
        projectKey,
        sequence,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        labels: input.labels,
        assignee: input.assignee,
        delegate: input.delegate,
        parentID: input.parentID ? IssueID.make(input.parentID) : undefined,
        dueDate: input.dueDate,
        branch: input.branch,
        source: input.source,
      })
    })

    const listIssues = Effect.fn("AugustTask.listIssues")(function* (input: ListIssuesInput = {}) {
      return yield* repository.listIssues({
        projectKey: input.projectKey ? normalizeProjectKey(input.projectKey) : undefined,
        status: input.status,
        label: input.label,
        assignee: input.assignee,
        delegate: input.delegate,
        parentID: input.parentID ? IssueID.make(input.parentID) : undefined,
        includeArchived: input.includeArchived,
        limit: input.limit,
      })
    })

    const getIssue = Effect.fn("AugustTask.getIssue")(function* (id: string) {
      return yield* repository.getIssue(IssueID.make(id))
    })

    const editIssue = Effect.fn("AugustTask.editIssue")(function* (input: UpdateIssueInput) {
      const projectKey = input.projectKey ? normalizeProjectKey(input.projectKey) : undefined
      if (projectKey) {
        const issue = yield* repository.getIssue(IssueID.make(input.id))
        if (projectKey !== issue.projectKey) {
          yield* repository.getProject(projectKey)
          if (input.parentID) yield* repository.getIssue(IssueID.make(input.parentID))
          const sequence = yield* repository.nextIssueSequence(projectKey)
          return yield* repository.moveIssue({
            id: IssueID.make(input.id),
            newID: makeIssueID(projectKey, sequence),
            projectKey,
            sequence,
            title: input.title,
            description: input.description,
            status: input.status,
            priority: input.priority,
            labels: input.labels,
            assignee: input.assignee,
            delegate: input.delegate,
            parentID: input.parentID ? IssueID.make(input.parentID) : undefined,
            dueDate: input.dueDate,
            branch: input.branch,
            archived: input.archived,
          })
        }
      }
      if (input.parentID) yield* repository.getIssue(IssueID.make(input.parentID))
      return yield* repository.updateIssue({
        id: IssueID.make(input.id),
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        labels: input.labels,
        assignee: input.assignee,
        delegate: input.delegate,
        parentID: input.parentID ? IssueID.make(input.parentID) : undefined,
        dueDate: input.dueDate,
        branch: input.branch,
        archived: input.archived,
      })
    })

    const setIssueStatus = Effect.fn("AugustTask.setIssueStatus")(function* (input: SetIssueStatusInput) {
      return yield* repository.updateIssue({ id: IssueID.make(input.id), status: input.status })
    })

    const addIssueComment = Effect.fn("AugustTask.addIssueComment")(function* (input: AddIssueCommentInput) {
      return yield* repository.addComment({ id: IssueID.make(input.id), body: input.body, author: input.author })
    })

    const relateIssues = Effect.fn("AugustTask.relateIssues")(function* (input: RelateIssuesInput) {
      return yield* repository.relateIssues({
        id: IssueID.make(input.id),
        targetID: IssueID.make(input.targetID),
        type: input.type,
      })
    })

    const listIssueEvents = Effect.fn("AugustTask.listIssueEvents")(function* (id: string) {
      return yield* repository.listEvents(IssueID.make(id))
    })

    return Service.of({
      createProject,
      listProjects,
      getProject,
      editProject,
      createIssue,
      listIssues,
      getIssue,
      editIssue,
      setIssueStatus,
      addIssueComment,
      relateIssues,
      listIssueEvents,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(SqliteAugustTaskRepository.layer))

export * as AugustTask from "./augusttask-service"
