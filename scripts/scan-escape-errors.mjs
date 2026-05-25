import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CONTENT = path.join(ROOT, "content")

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith(".md")) acc.push(p)
  }
  return acc
}

const patterns = [
  { name: "C++ escaped (C\\+\\+)", re: /C\\+\\+/g },
  { name: "g++ escaped", re: /g\\+\\+/g },
  { name: "c++ escaped", re: /c\\+\\+/g },
  { name: "HTML entity \\&#34;", re: /\\&#34;/g },
  { name: "title contains backslash", re: /^title:.*\\/gm },
  { name: "heading number dot (1\\.)", re: /^#{1,6} \d+\\./gm },
  { name: "backslash-hyphen (\\-)", re: /\\-/g },
  { name: "backslash-plus at EOL/word", re: /\\\+/g },
  { name: "backslash-tilde", re: /\\~/g },
  { name: "footnote \\* at line start", re: /^\\\* /gm },
  { name: "xxx\\.cpp escaped", re: /\\\.cpp/g },
]

const report = {}
for (const abs of walk(CONTENT)) {
  const text = fs.readFileSync(abs, "utf8")
  const rel = path.relative(ROOT, abs)
  for (const p of patterns) {
    const m = text.match(p.re)
    if (m?.length) {
      if (!report[p.name]) report[p.name] = []
      report[p.name].push({ file: rel, count: m.length })
    }
  }
}

for (const [name, items] of Object.entries(report).sort()) {
  const total = items.reduce((s, x) => s + x.count, 0)
  console.log(`\n=== ${name} (${total} hits, ${items.length} files) ===`)
  for (const x of items.sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(x.count).padStart(4)}  ${x.file}`)
  }
}
