import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { readFileSync, readdirSync } from "fs"
import path from "path"

const target = "20260529094159_augusttask_project"

function migrations() {
  return readdirSync(path.join(import.meta.dirname, "../../migration"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      timestamp: Number(entry.name.split("_")[0]),
      sql: readFileSync(path.join(import.meta.dirname, "../../migration", entry.name, "migration.sql"), "utf-8"),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

describe("AugustTask project migration", () => {
  test("preserves legacy free-form project names under valid project keys", () => {
    const sqlite = new Database(":memory:")
    const db = drizzle({ client: sqlite })
    const entries = migrations()
    const index = entries.findIndex((entry) => entry.name === target)

    expect(index).toBeGreaterThan(0)

    migrate(db, entries.slice(0, index))
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["AUG-77", 77, "Voice issue", "", "todo", "medium", "voice companion", "[]", "august", 1, 1],
    )
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["AUG-79", 79, "Lowercase August issue", "", "todo", "medium", "august", "[]", "august", 1, 1],
    )
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["AUG-80", 80, "Null project issue", "", "todo", "medium", null, "[]", "august", 1, 1],
    )
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["AUG-81", 81, "Empty project issue", "", "todo", "medium", "", "[]", "august", 1, 1],
    )
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["AUG-82", 82, "Normalized August issue", "", "todo", "medium", "AUG", "[]", "august", 1, 1],
    )
    sqlite.run(
      "INSERT INTO task_issue (id, sequence, title, description, status, priority, project, labels, source, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        "AUG-78",
        78,
        "Legacy invalid project",
        "",
        "todo",
        "medium",
        "august-talk/old.value.with.too.long.name",
        "[]",
        "august",
        1,
        1,
      ],
    )

    migrate(db, entries.slice(index))

    expect(sqlite.query("SELECT key, name FROM augusttask_project WHERE name = ?").get("voice companion")).toEqual({
      key: "VOICE_COMPANION",
      name: "voice companion",
    })
    expect(sqlite.query("SELECT key, name FROM augusttask_project WHERE name = ?").get("august-talk/old.value.with.too.long.name")).toEqual({
      key: "LEGACY_1",
      name: "august-talk/old.value.with.too.long.name",
    })
    expect(sqlite.query("SELECT id, project FROM task_issue ORDER BY id").all()).toEqual([
      { id: "AUG-77", project: "VOICE_COMPANION" },
      { id: "AUG-78", project: "LEGACY_1" },
      { id: "AUG-79", project: "AUG" },
      { id: "AUG-80", project: "AUG" },
      { id: "AUG-81", project: "AUG" },
      { id: "AUG-82", project: "AUG" },
    ])
    expect(sqlite.query("SELECT name, value FROM task_counter WHERE name IN (?, ?) ORDER BY name").all("issue:LEGACY_1", "issue:VOICE_COMPANION")).toEqual([
      { name: "issue:LEGACY_1", value: 78 },
      { name: "issue:VOICE_COMPANION", value: 77 },
    ])
  })
})
