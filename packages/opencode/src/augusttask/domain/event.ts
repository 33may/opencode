import type { IssueID } from "./issue"

export type Event = {
  id: string
  sequence: number
  issueID: IssueID
  action: string
  data: Record<string, unknown>
  time: {
    created: number
  }
}

export * as AugustTaskEvent from "./event"
