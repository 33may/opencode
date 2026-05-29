import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { tmpdir } from "../fixture/fixture"
import { Database } from "@/storage/db"

const root = path.resolve(import.meta.dir, "../..")
const serverEntry = path.join(root, "src/mcp-server/taskdb.ts")

describe("taskdb MCP server", () => {
  test("lists taskdb and can create and show tasks through MCP", async () => {
    await using tmp = await tmpdir()
    const client = new Client({ name: "taskdb-mcp-test", version: "1.0.0" })
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["--conditions=browser", serverEntry],
      cwd: root,
      env: {
        ...process.env,
        OPENCODE_DB: path.join(tmp.path, "taskdb-mcp.sqlite"),
        XDG_CONFIG_HOME: path.join(tmp.path, "config"),
        XDG_DATA_HOME: path.join(tmp.path, "data"),
        XDG_STATE_HOME: path.join(tmp.path, "state"),
        XDG_CACHE_HOME: path.join(tmp.path, "cache"),
      },
    })

    try {
      await client.connect(transport)
      expect((await client.listTools()).tools.map((tool) => tool.name)).toContain("taskdb")

      const created = await client.callTool(
        {
          name: "taskdb",
          arguments: { action: "create", title: "Expose task DB over MCP", project: "august" },
        },
        CallToolResultSchema,
      )
      expect(JSON.parse(text(created))).toMatchObject({ id: "AUG-1", title: "Expose task DB over MCP" })

      const shown = await client.callTool(
        { name: "taskdb", arguments: { action: "show", id: "AUG-1" } },
        CallToolResultSchema,
      )
      expect(JSON.parse(text(shown))).toMatchObject({ id: "AUG-1", project: "august" })
    } finally {
      await client.close()
      Database.close()
    }
  }, 60_000)
})

function text(result: unknown) {
  const item = (result as { content: Array<{ type: string; text?: string }> }).content.find(
    (entry) => entry.type === "text",
  )
  if (!item?.text) throw new Error("MCP result did not include text content")
  return item.text
}
