import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { AugustTaskMcp } from "@/augusttask/frontend/mcp"
import { Database } from "@/storage/db"

if (import.meta.main) {
  await AugustTaskMcp.server.connect(new StdioServerTransport()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  process.on("beforeExit", () => Database.close())
}

export const server = AugustTaskMcp.server
