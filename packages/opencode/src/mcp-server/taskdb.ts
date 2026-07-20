import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Effect } from "effect"
import * as z from "zod/v4"
import { Database } from "@/storage/db"
import { AugustTask } from "@/augusttask/service/augusttask-service"
import { executeAction } from "@/tool/taskdb"

export const server = new McpServer({ name: "august-taskdb", version: "1.0.0" })

server.registerTool(
  "taskdb",
  {
    title: "August Task DB",
    description: [
      "Create, list, show, update, comment on, relate, and inspect August-local tasks.",
      "Use this instead of Linear. The source of truth is the local SQLite task DB.",
    ].join("\n"),
    inputSchema: z.object({
      action: z.enum(["create", "list", "show", "update", "comment", "relate", "events"]),
      id: z.string().optional(),
      targetID: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
      project: z.string().optional(),
      labels: z.array(z.string()).optional(),
      label: z.string().optional(),
      assignee: z.string().optional(),
      delegate: z.string().optional(),
      parentID: z.string().optional(),
      dueDate: z.string().optional(),
      branch: z.string().optional(),
      body: z.string().optional(),
      author: z.string().optional(),
      type: z.string().optional(),
      includeArchived: z.boolean().optional(),
      limit: z.number().optional(),
    }),
  },
  async (params) => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          await Effect.runPromise(
            AugustTask.Service.use((task) => executeAction(task, params)).pipe(Effect.provide(AugustTask.defaultLayer)),
          ),
          null,
          2,
        ),
      },
    ],
  }),
)

if (import.meta.main) {
  await server.connect(new StdioServerTransport()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  process.on("beforeExit", () => Database.close())
}
