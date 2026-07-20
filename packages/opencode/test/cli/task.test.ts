import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { cliIt } from "../lib/cli-process"

describe("opencode task CLI", () => {
  cliIt.live(
    "creates, lists, updates, comments, relates, and shows tasks as JSON",
    ({ opencode }) =>
      Effect.gen(function* () {
        const env = { OPENCODE_DB: "task-cli.db" }
        const createdResult = yield* opencode.spawn(
          [
            "task",
            "create",
            "Replace Linear with local task DB",
            "--description",
            "Agents need reliable local tracking.",
            "--project",
            "august",
            "--label",
            "task-db",
            "--priority",
            "high",
            "--format",
            "json",
          ],
          { env },
        )
        opencode.expectExit(createdResult, 0, "task create")
        const created = JSON.parse(createdResult.stdout) as { id: string; title: string }
        expect(created).toMatchObject({
          id: "AUG-1",
          title: "Replace Linear with local task DB",
          project: "august",
          labels: ["task-db"],
        })

        const allResult = yield* opencode.spawn(["task", "list", "--format", "json"], { env })
        opencode.expectExit(allResult, 0, "task list all")
        expect(JSON.parse(allResult.stdout)).toEqual([expect.objectContaining({ id: "AUG-1", project: "august" })])

        const listedResult = yield* opencode.spawn(
          ["task", "list", "--project", "august", "--label", "task-db", "--format", "json"],
          { env },
        )
        opencode.expectExit(listedResult, 0, "task list")
        expect(JSON.parse(listedResult.stdout)).toEqual([expect.objectContaining({ id: "AUG-1", project: "august" })])

        const updatedResult = yield* opencode.spawn(
          ["task", "update", "AUG-1", "--status", "in_progress", "--assignee", "agent", "--format", "json"],
          { env },
        )
        opencode.expectExit(updatedResult, 0, "task update")
        expect(JSON.parse(updatedResult.stdout)).toMatchObject({
          id: "AUG-1",
          status: "in_progress",
          assignee: "agent",
        })

        const commentResult = yield* opencode.spawn(
          ["task", "comment", "AUG-1", "Started.", "--author", "august", "--format", "json"],
          { env },
        )
        opencode.expectExit(commentResult, 0, "task comment")
        expect(JSON.parse(commentResult.stdout)).toMatchObject({ issueID: "AUG-1", body: "Started.", author: "august" })

        const blockerResult = yield* opencode.spawn(["task", "create", "Voice companion", "--format", "json"], { env })
        opencode.expectExit(blockerResult, 0, "task create blocker")
        expect(JSON.parse(blockerResult.stdout)).toMatchObject({ id: "AUG-2" })

        const freeFormProjectResult = yield* opencode.spawn(
          ["task", "create", "Free-form project", "--project", "voice companion", "--format", "json"],
          { env },
        )
        opencode.expectExit(freeFormProjectResult, 0, "task create free-form project")
        expect(JSON.parse(freeFormProjectResult.stdout)).toMatchObject({ project: "voice companion" })

        const freeFormProjectList = yield* opencode.spawn(
          ["task", "list", "--project", "voice companion", "--format", "json"],
          { env },
        )
        opencode.expectExit(freeFormProjectList, 0, "task list free-form project")
        expect(JSON.parse(freeFormProjectList.stdout)).toEqual([
          expect.objectContaining({ project: "voice companion" }),
        ])

        const freeFormProjectShown = yield* opencode.spawn(
          ["task", "show", JSON.parse(freeFormProjectResult.stdout).id, "--format", "json"],
          { env },
        )
        opencode.expectExit(freeFormProjectShown, 0, "task show free-form project")
        expect(JSON.parse(freeFormProjectShown.stdout)).toMatchObject({ project: "voice companion" })

        const legacyProjectName = "august-talk/old.value.with.too.long.name"
        const legacyProjectResult = yield* opencode.spawn(
          ["augusttask", "project", "create", "LEGACY_1", legacyProjectName, "--format", "json"],
          { env },
        )
        opencode.expectExit(legacyProjectResult, 0, "augusttask project create legacy mapped project")
        const legacyIssueResult = yield* opencode.spawn(
          ["augusttask", "issue", "create", "LEGACY_1", "Migrated legacy task", "--format", "json"],
          { env },
        )
        opencode.expectExit(legacyIssueResult, 0, "augusttask issue create legacy mapped project")
        const legacyListResult = yield* opencode.spawn(
          ["task", "list", "--project", legacyProjectName, "--format", "json"],
          { env },
        )
        opencode.expectExit(legacyListResult, 0, "task list legacy mapped project name")
        expect(JSON.parse(legacyListResult.stdout)).toEqual([
          expect.objectContaining({ id: "LEGACY_1-1", project: legacyProjectName }),
        ])

        const movedProjectResult = yield* opencode.spawn(
          [
            "task",
            "update",
            JSON.parse(freeFormProjectResult.stdout).id,
            "--project",
            "client-app",
            "--format",
            "json",
          ],
          { env },
        )
        opencode.expectExit(movedProjectResult, 0, "task move free-form project")
        expect(JSON.parse(movedProjectResult.stdout)).toMatchObject({ id: "CLIENT_APP-1", project: "client-app" })

        const relationResult = yield* opencode.spawn(
          ["task", "relate", "AUG-1", "AUG-2", "--type", "blocks", "--format", "json"],
          { env },
        )
        opencode.expectExit(relationResult, 0, "task relate")
        expect(JSON.parse(relationResult.stdout)).toMatchObject({
          sourceID: "AUG-1",
          targetID: "AUG-2",
          type: "blocks",
        })

        const shownResult = yield* opencode.spawn(["task", "show", "AUG-1", "--format", "json"], { env })
        opencode.expectExit(shownResult, 0, "task show")
        expect(JSON.parse(shownResult.stdout)).toMatchObject({
          id: "AUG-1",
          project: "august",
          comments: [{ body: "Started." }],
          relations: [{ targetID: "AUG-2", type: "blocks" }],
        })
      }),
    120_000,
  )
})
