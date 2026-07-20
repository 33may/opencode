import type { IssueID, RelationType } from "./issue"

export type Relation = {
  sequence: number
  sourceID: IssueID
  targetID: IssueID
  type: RelationType
  time: {
    created: number
    updated: number
  }
}

export * as AugustTaskRelation from "./relation"
