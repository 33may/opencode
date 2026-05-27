import { expect, test } from "bun:test"
import path from "path"

const root = path.resolve(import.meta.dir, "../../../..")

test("August default config allows all permissions", async () => {
  expect(await Bun.file(path.join(root, ".opencode", "opencode.jsonc")).text()).toContain('"*": "allow"')
  expect(await Bun.file(path.join(root, ".opencode", "agent", "august.md")).text()).not.toContain("permission: allow")
})
