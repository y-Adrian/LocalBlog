import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CONTENT = path.join(ROOT, "content")
const apply = process.argv.includes("--fix")
const BS = "\\"

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith(".md")) acc.push(p)
  }
  return acc
}

function splitBlocks(text) {
  return text.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$)/g)
}

/** Ordered replacements in prose (longer patterns first) */
function buildReplacements() {
  const p = (s) => s
  return [
    [p("C++"), p("C++")], // noop anchor
    [p("C") + BS + "+" + BS + "+", "C++"],
    [p("g") + BS + "+" + BS + "+", "g++"],
    [p("c") + BS + "+" + BS + "+11", "c++11"],
    [p("c") + BS + "+" + BS + "+", "c++"],
    [BS + "&" + BS + "#34;", '"'],
    ["xxx" + BS + ".cpp", "xxx.cpp"],
    [BS + ".cpp", ".cpp"],
    [BS + "-", "-"],
    [BS + "+", "+"],
    [BS + ".", "."],
    [BS + "* ", "* "],
  ].slice(1)
}

const replacements = buildReplacements()

function fixProse(prose) {
  let s = prose
  let changed = false
  for (const [from, to] of replacements) {
    if (!s.includes(from)) continue
    const next = s.split(from).join(to)
    if (next !== s) {
      changed = true
      s = next
    }
  }
  return { text: s, changed }
}

function fixFile(text) {
  const parts = splitBlocks(text)
  let changed = false
  const out = parts
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk
      const inlineParts = chunk.split(/(\$[^$\n]+\$)/g)
      return inlineParts
        .map((p, j) => {
          if (j % 2 === 1) return p
          const r = fixProse(p)
          if (r.changed) changed = true
          return r.text
        })
        .join("")
    })
    .join("")
  return { text: out, changed }
}

function scanProse(prose) {
  const hits = []
  for (const [from] of replacements) {
    const n = prose.split(from).length - 1
    if (n) hits.push({ pattern: from.replace(/\n/g, "\\n"), count: n })
  }
  return hits
}

const reports = []
let fixedFiles = 0

for (const abs of walk(CONTENT)) {
  const rel = path.relative(ROOT, abs)
  const raw = fs.readFileSync(abs, "utf8")
  const prose = splitBlocks(raw)
    .filter((_, i) => i % 2 === 0)
    .join("")
  const hits = scanProse(prose)
  if (hits.length) reports.push({ rel, hits })

  if (apply) {
    const { text, changed } = fixFile(raw)
    if (changed) {
      fs.writeFileSync(abs, text, "utf8")
      fixedFiles++
    }
  }
}

console.log(apply ? `FIXED ${fixedFiles} file(s)\n` : "SCAN\n")
for (const r of reports.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(r.rel)
  for (const h of r.hits) console.log(`  ${h.count}\t${h.pattern}`)
}
console.log(`\n${reports.length} file(s) with issues`)
