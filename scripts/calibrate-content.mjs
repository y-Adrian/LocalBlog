#!/usr/bin/env node
// Calibrate all markdown under content/: dates from git, KaTeX, bold+code, tilde.
// Usage: node scripts/calibrate-content.mjs [--dry-run] [--dates-only] [--format-only]
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const CONTENT = path.join(ROOT, "content")
const dryRun = process.argv.includes("--dry-run")
const datesOnly = process.argv.includes("--dates-only")
const formatOnly = process.argv.includes("--format-only")

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (ent.name.endsWith(".md")) acc.push(p)
  }
  return acc
}

function gitFirstAddDate(rel) {
  try {
    const out = execSync(
      `git log --follow --diff-filter=A --format=%aI -1 -- "${rel}"`,
      { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim()
    if (!out) return null
    const d = new Date(out)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}/${m}/${day}`
  } catch {
    return null
  }
}

/** leetcode daily: date from filename YYYY-MM-DD */
function dateFromFilename(filePath) {
  const m = filePath.match(/leetcode\/daily\/(\d{4})-(\d{2})-(\d{2})\.md$/)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  return null
}

function fixFormat(body) {
  let s = body
  let changes = []

  // \~ -> ~
  const tilde = (s.match(/\\~/g) || []).length
  if (tilde) {
    s = s.replaceAll("\\~", "~")
    changes.push(`tilde:${tilde}`)
  }

  // **\`code\`** -> `code` (non-greedy backtick content)
  const boldCode = /\*\*`([^`]+)`\*\*/g
  let n = 0
  s = s.replace(boldCode, (_, code) => {
    n++
    return `\`${code}\``
  })
  if (n) changes.push(`boldCode:${n}`)

  // LaTeX \( \) outside fenced code blocks
  const parts = s.split(/(```[\s\S]*?```)/g)
  for (let i = 0; i < parts.length; i += 2) {
    let block = parts[i]
    const inlineOpen = (block.match(/\\\(/g) || []).length
    if (inlineOpen) {
      block = block.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner.trim()}$`)
      changes.push(`inlineMath:${inlineOpen}`)
    }
    const displayOpen = (block.match(/\\\[/g) || []).length
    if (displayOpen) {
      block = block.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\n$$\n${inner.trim()}\n$$\n`)
      changes.push(`displayMath:${displayOpen}`)
    }
    parts[i] = block
  }
  s = parts.join("")

  return { body: s, changes }
}

function titleFromBody(body) {
  const m = body.match(/^#\s+(?:\d+[\.\s]+)?(.+)$/m)
  if (m) return m[1].replace(/`/g, "").trim()
  return null
}

function frontmatterBounds(text) {
  if (!text.startsWith("---\n")) return null
  const lines = text.split("\n")
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      const fm = lines.slice(1, i).join("\n")
      const rest = lines.slice(i + 1).join("\n")
      const restWithNl = rest.length ? (lines[i + 1] === "" ? "\n" + rest : "\n\n" + rest) : "\n"
      return { fm, rest: restWithNl.replace(/^\n+/, "\n") }
    }
  }
  return null
}

function ensureFrontmatter(text, { title, date }) {
  const bounds = frontmatterBounds(text)
  if (bounds) {
    let fm = bounds.fm
    let rest = bounds.rest.startsWith("\n") ? bounds.rest : "\n" + bounds.rest
    const notes = []
    if (title && !/^title:/m.test(fm)) {
      fm = `title: ${title}\n` + fm
      notes.push("addTitle")
    }
    if (date) {
      const dateRe = /^date:\s*.+$/m
      const neu = `date: ${date}`
      if (dateRe.test(fm)) {
        const old = fm.match(dateRe)[0]
        if (old !== neu) {
          fm = fm.replace(dateRe, neu)
          notes.push(`date→${date}`)
        }
      } else {
        fm = fm.trimEnd() + `\n${neu}\n`
        notes.push(`date→${date}`)
      }
    }
    if (!notes.length) return { text, updated: false, notes }
    return { text: `---\n${fm}\n---${rest}`, updated: true, notes }
  }
  const bodyTitle = titleFromBody(text) || title
  const lines = ["---"]
  if (bodyTitle) lines.push(`title: ${bodyTitle}`)
  if (date) lines.push(`date: ${date}`)
  lines.push("---", "")
  return {
    text: lines.join("\n") + text,
    updated: true,
    notes: ["newFrontmatter"],
  }
}

const files = walk(CONTENT)
const report = { dates: [], format: [], frontmatter: [], unchanged: 0 }

for (const abs of files) {
  const rel = path.relative(ROOT, abs).replaceAll("\\", "/")
  let text = fs.readFileSync(abs, "utf8")
  let modified = false
  const notes = []

  if (!formatOnly) {
    const fromName = dateFromFilename(rel)
    const fromGit = gitFirstAddDate(rel)
    const target = fromName || fromGit
    const base = path.basename(abs, ".md")
    const { text: t2, updated, notes: fmNotes } = ensureFrontmatter(text, {
      title: titleFromBody(text) || base,
      date: target,
    })
    if (updated) {
      text = t2
      modified = true
      notes.push(...fmNotes)
      if (fmNotes.some((n) => n.startsWith("date"))) report.dates.push({ rel, date: target })
      if (fmNotes.includes("newFrontmatter") || fmNotes.includes("addTitle"))
        report.frontmatter = report.frontmatter || []
      report.frontmatter?.push({ rel, notes: fmNotes.join(",") })
    }
  }

  if (!datesOnly) {
    const { body, changes } = fixFormat(text)
    if (changes.length) {
      text = body
      modified = true
      notes.push(...changes)
      report.format.push({ rel, changes: changes.join(",") })
    }
  }

  if (modified) {
    if (!dryRun) fs.writeFileSync(abs, text, "utf8")
  } else {
    report.unchanged++
  }
}

console.log(JSON.stringify(report, null, 2))
console.log(
  `\nSummary: ${files.length} files, date updates: ${report.dates.length}, format fixes: ${report.format.length}, unchanged: ${report.unchanged}${dryRun ? " (dry-run)" : ""}`,
)
