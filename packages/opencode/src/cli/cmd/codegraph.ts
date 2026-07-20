import { EOL } from "os"
import { CodeGraph } from "@/august/codegraph"
import { cmd } from "./cmd"

export const CodeGraphCommand = cmd({
  command: "codegraph",
  describe: "build and query the local August code graph",
  builder: (yargs) =>
    yargs
      .command(RefreshCommand)
      .command(FindCommand)
      .command(ContextCommand)
      .command(ImpactCommand)
      .demandCommand(),
  async handler() {},
})

const RefreshCommand = cmd({
  command: "refresh",
  describe: "refresh .august/codegraph/index.json",
  builder: (yargs) =>
    yargs.option("cwd", {
      type: "string",
      description: "Workspace directory",
    }),
  async handler(args) {
    const graph = await CodeGraph.refresh({ cwd: args.cwd ?? process.cwd() })
    process.stdout.write(JSON.stringify({ files: graph.files.length, symbols: graph.symbols.length }, null, 2) + EOL)
  },
})

const FindCommand = cmd({
  command: "find <query>",
  describe: "find symbols by name",
  builder: (yargs) =>
    yargs
      .positional("query", {
        type: "string",
        demandOption: true,
      })
      .option("cwd", {
        type: "string",
        description: "Workspace directory",
      })
      .option("limit", {
        type: "number",
        description: "Maximum symbols to return",
      }),
  async handler(args) {
    process.stdout.write(
      JSON.stringify(await CodeGraph.find({ cwd: args.cwd ?? process.cwd(), query: args.query, limit: args.limit }), null, 2) + EOL,
    )
  },
})

const ContextCommand = cmd({
  command: "context <symbol>",
  describe: "show symbol context and references",
  builder: (yargs) =>
    yargs
      .positional("symbol", {
        type: "string",
        demandOption: true,
      })
      .option("cwd", {
        type: "string",
        description: "Workspace directory",
      }),
  async handler(args) {
    process.stdout.write(JSON.stringify(await CodeGraph.context({ cwd: args.cwd ?? process.cwd(), symbol: args.symbol }), null, 2) + EOL)
  },
})

const ImpactCommand = cmd({
  command: "impact <file>",
  describe: "show files and references impacted by a file",
  builder: (yargs) =>
    yargs
      .positional("file", {
        type: "string",
        demandOption: true,
      })
      .option("cwd", {
        type: "string",
        description: "Workspace directory",
      }),
  async handler(args) {
    process.stdout.write(JSON.stringify(await CodeGraph.impact({ cwd: args.cwd ?? process.cwd(), file: args.file }), null, 2) + EOL)
  },
})
