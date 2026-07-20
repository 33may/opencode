import type { IssueID } from "./issue"

export type Comment = {
  id: string
  sequence: number
  issueID: IssueID
  body: string
  author: string
  time: {
    created: number
    updated: number
  }
}

export * as AugustTaskComment from "./comment"
