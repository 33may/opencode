import { describe, expect } from "bun:test"
import { Effect } from "effect"
import path from "node:path"
import { cliIt } from "../lib/cli-process"

describe("augusttask CLI", () => {
  cliIt.live(
    "creates projects and issues, updates status, and filters by project",
    ({ home, opencode }) =>
      Effect.gen(function* () {
        const opts = { env: { OPENCODE_DB: path.join(home, "augusttask-cli.sqlite") } }
        const project = yield* opencode.spawn(
          ["augusttask", "project", "create", "VOICE", "Voice Companion", "--format", "json"],
          opts,
        )
        opencode.expectExit(project, 0, "augusttask project create")
        expect(JSON.parse(project.stdout)).toMatchObject({ key: "VOICE", name: "Voice Companion", status: "active" })

        const missingTitle = yield* opencode.spawn(
          ["augusttask", "issue", "create", "Only title", "--format", "json"],
          opts,
        )
        expect(missingTitle.exitCode).not.toBe(0)
        expect(missingTitle.stderr).toContain("opencode augusttask issue create <project> <title>")

        const first = yield* opencode.spawn(
          ["augusttask", "issue", "create", "VOICE", "Build talker", "--format", "json"],
          opts,
        )
        opencode.expectExit(first, 0, "augusttask issue create first")
        expect(JSON.parse(first.stdout)).toMatchObject({
          id: "VOICE-1",
          projectKey: "VOICE",
          title: "Build talker",
          status: "todo",
        })

        const second = yield* opencode.spawn(
          ["augusttask", "issue", "create", "AUG", "Default project issue", "--format", "json"],
          opts,
        )
        opencode.expectExit(second, 0, "augusttask issue create second")
        expect(JSON.parse(second.stdout)).toMatchObject({ id: "AUG-1", projectKey: "AUG" })

        const status = yield* opencode.spawn(
          ["augusttask", "issue", "status", "VOICE-1", "in_progress", "--format", "json"],
          opts,
        )
        opencode.expectExit(status, 0, "augusttask issue status")
        expect(JSON.parse(status.stdout)).toMatchObject({ id: "VOICE-1", status: "in_progress" })

        const list = yield* opencode.spawn(
          ["augusttask", "issue", "list", "--project", "VOICE", "--format", "json"],
          opts,
        )
        opencode.expectExit(list, 0, "augusttask issue list")
        expect(JSON.parse(list.stdout)).toEqual([
          expect.objectContaining({ id: "VOICE-1", projectKey: "VOICE", title: "Build talker", status: "in_progress" }),
        ])
      }),
    120_000,
  )
})
