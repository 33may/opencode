import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { CodeGraph } from "@/august/codegraph"
import { tmpdir } from "../fixture/fixture"

describe("august codegraph", () => {
  test("refresh persists symbols, imports, and references", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "src"), { recursive: true })
        await Bun.write(
          path.join(dir, "src", "button.ts"),
          [
            "export class ButtonController {",
            "  render() {",
            "    return createButtonLabel()",
            "  }",
            "}",
            "export function createButtonLabel() {",
            "  return 'button'",
            "}",
          ].join("\n"),
        )
        await Bun.write(
          path.join(dir, "src", "app.ts"),
          [
            "import { ButtonController } from './button'",
            "export const app = new ButtonController()",
          ].join("\n"),
        )
      },
    })

    const graph = await CodeGraph.refresh({ cwd: tmp.path })

    expect(graph.symbols).toContainEqual(
      expect.objectContaining({ name: "ButtonController", kind: "class", file: "src/button.ts", line: 1 }),
    )
    expect(graph.symbols).toContainEqual(
      expect.objectContaining({ name: "createButtonLabel", kind: "function", file: "src/button.ts", line: 6 }),
    )
    expect(graph.imports).toContainEqual(
      expect.objectContaining({ file: "src/app.ts", source: "./button", symbols: ["ButtonController"] }),
    )
    expect(graph.references).toContainEqual(
      expect.objectContaining({ name: "ButtonController", file: "src/app.ts", line: 2 }),
    )
    expect(await Bun.file(path.join(tmp.path, ".august", "codegraph", "index.json")).json()).toEqual(graph)
  })

  test("find, context, and impact read the persisted graph", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "src"), { recursive: true })
        await Bun.write(
          path.join(dir, "src", "button.ts"),
          [
            "export class ButtonController {",
            "  render() {",
            "    return 'button'",
            "  }",
            "}",
          ].join("\n"),
        )
        await Bun.write(
          path.join(dir, "src", "app.ts"),
          "import { ButtonController } from './button'\nexport const app = new ButtonController()\n",
        )
      },
    })
    await CodeGraph.refresh({ cwd: tmp.path })

    expect(await CodeGraph.find({ cwd: tmp.path, query: "button", limit: 1 })).toEqual([
      expect.objectContaining({ name: "ButtonController", file: "src/button.ts" }),
    ])
    expect(await CodeGraph.context({ cwd: tmp.path, symbol: "ButtonController" })).toMatchObject(
      {
        symbol: expect.objectContaining({ name: "ButtonController" }),
        snippet: expect.stringContaining("export class ButtonController"),
        references: expect.arrayContaining([expect.objectContaining({ file: "src/app.ts" })]),
      },
    )
    expect(await CodeGraph.impact({ cwd: tmp.path, file: "src/button.ts" })).toMatchObject(
      { importers: ["src/app.ts"], references: expect.arrayContaining([expect.objectContaining({ file: "src/app.ts" })]) },
    )
  })
})
