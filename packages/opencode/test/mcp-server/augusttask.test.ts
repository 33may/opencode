import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { tmpdir } from "../fixture/fixture"
import { Database } from "@/storage/db"

const root = path.resolve(import.meta.dir, "../..")
const serverEntry = path.join(root, "src/mcp-server/augusttask.ts")
const configEntry = path.resolve(root, "../../.opencode/opencode.jsonc")

describe("augusttask MCP server", () => {
  test("config only enables the semantic augusttask MCP server", async () => {
    const config = await Bun.file(configEntry).text()
    expect(config).toContain('"augusttask"')
    expect(config).not.toContain('"august-taskdb"')
    expect(config).not.toContain("packages/opencode/src/mcp-server/taskdb.ts")
  })

  test("exposes semantic AugustTask tools over MCP", async () => {
    await using tmp = await tmpdir()
    const client = new Client({ name: "augusttask-mcp-test", version: "1.0.0" })
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["--conditions=browser", serverEntry],
      cwd: root,
      env: {
        ...process.env,
        OPENCODE_DB: path.join(tmp.path, "augusttask-mcp.sqlite"),
        XDG_CONFIG_HOME: path.join(tmp.path, "config"),
        XDG_DATA_HOME: path.join(tmp.path, "data"),
        XDG_STATE_HOME: path.join(tmp.path, "state"),
        XDG_CACHE_HOME: path.join(tmp.path, "cache"),
      },
    })

    try {
      await client.connect(transport)
      expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
        "add_issue_comment",
        "create_issue",
        "create_project",
        "edit_issue",
        "edit_project",
        "get_issue",
        "get_project",
        "list_issue_events",
        "list_issues",
        "list_projects",
        "relate_issues",
        "set_issue_status",
      ])

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "create_project", arguments: { key: "voice", name: "Voice Companion", default_assignee: "may" } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({ key: "VOICE", name: "Voice Companion", defaultAssignee: "may" })

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "create_issue", arguments: { project_key: "VOICE", title: "Build talker", due_date: "2026-06-01" } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({ id: "VOICE-1", projectKey: "VOICE", title: "Build talker", dueDate: "2026-06-01" })

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "create_issue", arguments: { project_key: "VOICE", title: "Child", parent_id: "VOICE-1" } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({ id: "VOICE-2", parentID: "VOICE-1" })

      expect(
        JSON.parse(
          text(
            await client.callTool(
              {
                name: "create_issue",
                arguments: {
                  project_key: "VOICE",
                  title: "Sanitize empty optionals",
                  description: "",
                  assignee: "",
                  delegate: "",
                  due_date: "",
                  branch: "",
                  source: "",
                  labels: [],
                },
              },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({
        id: "VOICE-3",
        title: "Sanitize empty optionals",
        description: "",
        labels: [],
        source: "august",
      })

      const sanitized = JSON.parse(
        text(await client.callTool({ name: "get_issue", arguments: { id: "VOICE-3" } }, CallToolResultSchema)),
      )
      expect(sanitized).not.toHaveProperty("assignee")
      expect(sanitized).not.toHaveProperty("delegate")
      expect(sanitized).not.toHaveProperty("dueDate")
      expect(sanitized).not.toHaveProperty("branch")
      expect(sanitized.source).toBe("august")

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "set_issue_status", arguments: { id: "VOICE-1", status: "in_progress" } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({ id: "VOICE-1", status: "in_progress" })

      expect(
        JSON.parse(text(await client.callTool({ name: "list_issue_events", arguments: { id: "VOICE-1" } }, CallToolResultSchema))),
      ).toEqual(expect.arrayContaining([expect.objectContaining({ issueID: "VOICE-1" })]))

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "relate_issues", arguments: { id: "VOICE-2", target_id: "VOICE-1", type: "related" } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toMatchObject({ sourceID: "VOICE-2", targetID: "VOICE-1", type: "related" })

      expect(
        JSON.parse(
          text(
            await client.callTool(
              { name: "list_issues", arguments: { project_key: "VOICE", include_archived: true } },
              CallToolResultSchema,
            ),
          ),
        ),
      ).toEqual(expect.arrayContaining([expect.objectContaining({ id: "VOICE-1" })]))
    } finally {
      await client.close()
      Database.close()
    }
  }, 60_000)
})

function text(result: unknown) {
  const item = (result as { content: Array<{ type: string; text?: string }> }).content.find((entry) => entry.type === "text")
  if (!item?.text) throw new Error("MCP result did not include text content")
  return item.text
}
