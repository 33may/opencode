import fs from "fs/promises"
import path from "path"

type SymbolKind = "class" | "function" | "const" | "interface" | "type" | "method"

export type Symbol = {
  name: string
  kind: SymbolKind
  file: string
  line: number
  column: number
}

export type Import = {
  file: string
  source: string
  symbols: string[]
  line: number
}

export type Reference = {
  name: string
  file: string
  line: number
  column: number
}

export type Graph = {
  version: 1
  root: string
  generated_at: string
  files: string[]
  symbols: Symbol[]
  imports: Import[]
  references: Reference[]
}

export async function refresh(input: { cwd: string }) {
  const files = await sourceFiles(input.cwd)
  const scanned = await Promise.all(
    files.map(async (file) => ({
      file,
      content: await Bun.file(path.join(input.cwd, file)).text(),
    })),
  )
  const symbols = scanned.flatMap((item) => parseSymbols(item.file, item.content))
  const graph = {
    version: 1 as const,
    root: input.cwd,
    generated_at: new Date().toISOString(),
    files,
    symbols,
    imports: scanned.flatMap((item) => parseImports(item.file, item.content)),
    references: scanned.flatMap((item) => parseReferences(item.file, item.content, symbols)),
  }
  await fs.mkdir(path.join(input.cwd, ".august", "codegraph"), { recursive: true })
  await Bun.write(path.join(input.cwd, ".august", "codegraph", "index.json"), JSON.stringify(graph, null, 2))
  return graph
}

export async function find(input: { cwd: string; query: string; limit?: number }) {
  return (await read(input.cwd)).symbols
    .filter((item) => item.name.toLowerCase().includes(input.query.toLowerCase()))
    .slice(0, input.limit ?? 20)
}

export async function context(input: { cwd: string; symbol: string }) {
  const graph = await read(input.cwd)
  const symbol = graph.symbols.find((item) => item.name === input.symbol)
  if (!symbol) return undefined
  return {
    symbol,
    snippet: (await Bun.file(path.join(input.cwd, symbol.file)).text())
      .split(/\r?\n/)
      .slice(Math.max(symbol.line - 3, 0), symbol.line + 5)
      .join("\n"),
    references: graph.references.filter((item) => item.name === symbol.name),
  }
}

export async function impact(input: { cwd: string; file: string }) {
  const graph = await read(input.cwd)
  const exports = graph.symbols.filter((item) => item.file === input.file).map((item) => item.name)
  return {
    file: input.file,
    importers: [...new Set(graph.imports.filter((item) => resolvesTo(item.source, item.file, input.file)).map((item) => item.file))],
    references: graph.references.filter((item) => exports.includes(item.name) && item.file !== input.file),
  }
}

async function read(cwd: string): Promise<Graph> {
  return Bun.file(path.join(cwd, ".august", "codegraph", "index.json")).json()
}

async function sourceFiles(cwd: string) {
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,py,go,rs}")
  const files = []
  for await (const file of glob.scan({ cwd, absolute: false, dot: false })) {
    if (file.includes("node_modules/") || file.includes(".git/") || file.includes(".august/")) continue
    files.push(file)
  }
  return files.sort()
}

function parseSymbols(file: string, content: string): Symbol[] {
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(
      /(?:export\s+)?(?:abstract\s+)?(class|interface|type|function|const)\s+([A-Za-z_$][\w$]*)|^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
    )
    if (!match) return []
    const name = match[2] ?? match[3]
    return [
      {
        name,
        kind: match[3] ? "method" : (match[1] as SymbolKind),
        file,
        line: index + 1,
        column: line.indexOf(name) + 1,
      },
    ]
  })
}

function parseImports(file: string, content: string): Import[] {
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/import\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\s+from\s+["']([^"']+)["']/)
    if (!match) return []
    return [
      {
        file,
        source: match[3],
        symbols: (match[1] ?? match[2]).split(",").map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean),
        line: index + 1,
      },
    ]
  })
}

function parseReferences(file: string, content: string, symbols: Symbol[]): Reference[] {
  return symbols.flatMap((symbol) =>
    content.split(/\r?\n/).flatMap((line, index) => {
      const column = line.indexOf(symbol.name)
      if (column < 0) return []
      if (symbol.file === file && symbol.line === index + 1) return []
      return [{ name: symbol.name, file, line: index + 1, column: column + 1 }]
    }),
  )
}

function resolvesTo(source: string, importer: string, target: string) {
  if (!source.startsWith(".")) return false
  const resolved = path.normalize(path.join(path.dirname(importer), source))
  return [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`].includes(target)
}

export * as CodeGraph from "./codegraph"
