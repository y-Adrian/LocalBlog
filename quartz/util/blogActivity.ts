import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Repository } from "@napi-rs/simple-git"

/** 热力图与列表仅展示最近若干自然月（自展示终点日起往前推） */
export const DISPLAY_MONTHS = 11

/** 时间线最多展示的条目数 */
export const MAX_ACTIVITY_LINES = 48

/** 仓库根目录下的持久化缓存（随 Git 提交，供 CI / GitHub Pages 构建读取） */
export const BLOG_ACTIVITY_CACHE_FILE = "blog-activity.cache.json"

const DAY_MS = 24 * 60 * 60 * 1000

export type ActivityRow = { date: string; label: string }

export type BlogActivityCache = {
  version: 1
  /** 生成缓存时的 ISO 时间（仅供排查） */
  generatedAt: string
  displayMonths: number
  counts: Record<string, number>
  activity: ActivityRow[]
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function displayRangeStart(end: Date): Date {
  const x = startOfDay(end)
  x.setMonth(x.getMonth() - DISPLAY_MONTHS)
  return x
}

function sundayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function saturdayOfWeekContaining(d: Date): Date {
  const sun = sundayOf(d)
  const sat = new Date(sun)
  sat.setDate(sat.getDate() + 6)
  return startOfDay(sat)
}

function calendarDaysInclusive(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.floor((ub - ua) / DAY_MS) + 1
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/")
}

function isUnderLeetcode(relPosix: string, pathPrefix: string): boolean {
  const p = toPosix(relPosix).replace(/^.\//, "")
  const prefix = toPosix(pathPrefix).replace(/\/?$/, "/")
  if (!p.startsWith(prefix)) return false
  return p.slice(prefix.length).toLowerCase().startsWith("leetcode/")
}

function isBlogMarkdown(relPosix: string, pathPrefix: string): boolean {
  const p = toPosix(relPosix).replace(/^.\//, "")
  const prefix = toPosix(pathPrefix).replace(/\/?$/, "/")
  if (!p.startsWith(prefix) || !p.toLowerCase().endsWith(".md")) return false
  if (isUnderLeetcode(p, pathPrefix)) return false
  const base = path.posix.basename(p).toLowerCase()
  return base !== "index.md"
}

function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

export type DayCell = {
  key: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  future: boolean
  beforeWindow: boolean
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd()
  } catch {
    return ""
  }
}

export function resolveRepoAndContentPrefix(contentRoot: string): { repoRoot: string; pathPrefix: string } | null {
  let repoRoot: string
  try {
    const repo = Repository.discover(contentRoot)
    repoRoot = repo.workdir() ?? ""
    if (!repoRoot) return null
  } catch {
    return null
  }

  let rel = path.relative(repoRoot, path.resolve(contentRoot)).replace(/\\/g, "/")
  if (rel.startsWith("..")) {
    return null
  }
  if (rel === "") {
    rel = "."
  }
  const pathPrefix = rel.endsWith("/") ? rel : `${rel}/`

  return { repoRoot, pathPrefix }
}

function readMarkdownTitle(repoRoot: string, relPosix: string): string {
  const abs = path.join(repoRoot, ...relPosix.split("/"))
  let raw: string
  try {
    raw = fs.readFileSync(abs, "utf8")
  } catch {
    return stemTitle(relPosix)
  }

  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const t = line.match(/^\s*title:\s*(.+)\s*$/)
      if (t) {
        let v = t[1].trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (v) return v
      }
    }
  }
  const h1 = raw.match(/^#\s+([^\r\n#][^\r\n]*)/m)
  if (h1) return h1[1].trim()
  return stemTitle(relPosix)
}

function stemTitle(relPosix: string): string {
  const base = path.posix.basename(relPosix, ".md")
  return base || relPosix
}

function parseNameStatusBlogLog(
  out: string,
  repoRoot: string,
  pathPrefix: string,
): { counts: Map<string, number>; activity: ActivityRow[] } {
  const counts = new Map<string, number>()
  const activity: ActivityRow[] = []

  const bump = (date: string, n: number) => {
    counts.set(date, (counts.get(date) ?? 0) + n)
  }

  let curDate: string | null = null

  const handlePathLine = (line: string) => {
    if (!curDate) return
    const row = line.trim()
    if (!row) return
    const parts = row.split("\t")
    if (parts.length < 2) return

    const statusRaw = parts[0].trim()
    const kind = statusRaw.charAt(0)
    if (!"AMDRC".includes(kind)) return

    if (kind === "R" || kind === "C") {
      if (parts.length < 3) return
      const from = toPosix(parts[1])
      const to = toPosix(parts[2])
      if (isUnderLeetcode(from, pathPrefix) || isUnderLeetcode(to, pathPrefix)) return
      const fromOk = isBlogMarkdown(from, pathPrefix)
      const toOk = isBlogMarkdown(to, pathPrefix)
      if (!fromOk && !toOk) return
      const tFrom = fromOk ? readMarkdownTitle(repoRoot, from) : stemTitle(from)
      const tTo = toOk ? readMarkdownTitle(repoRoot, to) : stemTitle(to)
      activity.push({
        date: curDate,
        label: `重命名《${tFrom}》→《${tTo}》`,
      })
      bump(curDate, 1)
      return
    }

    const p = toPosix(parts[1])
    if (!isBlogMarkdown(p, pathPrefix)) return

    const title = readMarkdownTitle(repoRoot, p)
    if (kind === "A") {
      activity.push({ date: curDate, label: `新增《${title}》` })
    } else if (kind === "M") {
      activity.push({ date: curDate, label: `更新《${title}》` })
    } else if (kind === "D") {
      activity.push({ date: curDate, label: `删除《${stemTitle(p)}》` })
    }
    bump(curDate, 1)
  }

  for (const line of out.split("\n")) {
    if (line.startsWith("COMMIT ")) {
      curDate = line.slice("COMMIT ".length).trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(curDate)) curDate = null
      continue
    }
    handlePathLine(line)
  }

  return { counts, activity }
}

/** 从 Git 历史收集博客 Markdown 增删改（构建缓存或本地回退） */
export function collectBlogActivityFromGit(contentRoot: string, end: Date = new Date()): BlogActivityCache | null {
  const resolved = resolveRepoAndContentPrefix(contentRoot)
  if (!resolved) return null

  const { repoRoot, pathPrefix } = resolved
  const windowStart = displayRangeStart(end)
  const sinceYmd = ymd(windowStart)

  const logOut = runGit(repoRoot, [
    "log",
    "--no-merges",
    `--since=${sinceYmd}`,
    "--date=short",
    "--name-status",
    "--pretty=format:COMMIT %ad",
    "--",
    pathPrefix,
  ])

  const { counts, activity } = parseNameStatusBlogLog(logOut, repoRoot, pathPrefix)

  const countsObj: Record<string, number> = {}
  for (const [k, v] of counts) {
    countsObj[k] = v
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    displayMonths: DISPLAY_MONTHS,
    counts: countsObj,
    activity: activity.slice(0, MAX_ACTIVITY_LINES),
  }
}

export function cacheFilePath(repoRoot: string): string {
  return path.join(repoRoot, BLOG_ACTIVITY_CACHE_FILE)
}

export function readBlogActivityCache(repoRoot: string): BlogActivityCache | null {
  const fp = cacheFilePath(repoRoot)
  if (!fs.existsSync(fp)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as BlogActivityCache
    if (raw.version !== 1 || !raw.counts || !Array.isArray(raw.activity)) return null
    return raw
  } catch {
    return null
  }
}

export function writeBlogActivityCache(repoRoot: string, data: BlogActivityCache): void {
  const fp = cacheFilePath(repoRoot)
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8")
}

/** 按当前展示窗口过滤缓存中的热力图与列表 */
export function sliceCacheForDisplay(
  cache: BlogActivityCache,
  end: Date = new Date(),
): { counts: Map<string, number>; activity: ActivityRow[]; windowStart: Date } {
  const windowStart = displayRangeStart(end)
  const sinceYmd = ymd(windowStart)
  const endYmd = ymd(startOfDay(end))

  const counts = new Map<string, number>()
  for (const [k, v] of Object.entries(cache.counts)) {
    if (k >= sinceYmd && k <= endYmd) counts.set(k, v)
  }

  const activity = cache.activity
    .filter((r) => r.date >= sinceYmd && r.date <= endYmd)
    .slice(0, MAX_ACTIVITY_LINES)

  return { counts, activity, windowStart }
}

export function buildContributionColumns(
  counts: Map<string, number>,
  end: Date,
  windowStart: Date,
): { columns: DayCell[][]; monthLabels: string[] } {
  const endDay = startOfDay(end)
  const windowStartDay = startOfDay(windowStart)
  const windowStartStr = ymd(windowStartDay)

  const gridStart = sundayOf(windowStartDay)
  const gridEndSat = saturdayOfWeekContaining(endDay)
  const nDays = calendarDaysInclusive(gridStart, gridEndSat)
  const weeks = Math.max(1, Math.ceil(nDays / 7))

  const columns: DayCell[][] = []
  let dayPtr = new Date(gridStart)
  for (let w = 0; w < weeks; w++) {
    const col: DayCell[] = []
    for (let r = 0; r < 7; r++) {
      const key = ymd(dayPtr)
      const future = dayPtr > endDay
      const beforeWindow = key < windowStartStr
      const inWindow = !future && !beforeWindow
      const count = inWindow ? (counts.get(key) ?? 0) : 0
      const level = future || beforeWindow ? 0 : levelFor(count)
      col.push({ key, count, level, future, beforeWindow })
      dayPtr.setDate(dayPtr.getDate() + 1)
    }
    columns.push(col)
  }

  const monthLabels: string[] = []
  let prevMonth = -1
  for (let w = 0; w < weeks; w++) {
    const s = new Date(gridStart)
    s.setDate(s.getDate() + w * 7)
    const m = s.getMonth()
    if (m !== prevMonth) {
      monthLabels.push(s.toLocaleString("zh-CN", { month: "short" }))
      prevMonth = m
    } else {
      monthLabels.push("")
    }
  }

  return { columns, monthLabels }
}

export function groupActivityByMonth(rows: ActivityRow[]): { label: string; items: string[] }[] {
  const map = new Map<string, string[]>()
  for (const r of rows) {
    const ym = r.date.slice(0, 7)
    const line = `${r.date} · ${r.label}`
    if (!map.has(ym)) map.set(ym, [])
    map.get(ym)!.push(line)
  }
  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
  return keys.map((k) => {
    const [y, m] = k.split("-")
    const d = new Date(Number(y), Number(m) - 1, 1)
    const label = d.toLocaleString("zh-CN", { year: "numeric", month: "long" })
    return { label, items: map.get(k)! }
  })
}

/** 优先读持久化缓存，否则回退到实时 Git */
export function loadBlogActivityForDisplay(contentRoot: string): {
  counts: Map<string, number>
  activity: ActivityRow[]
  windowStart: Date
  ok: boolean
  source: "cache" | "git" | "none"
} {
  const resolved = resolveRepoAndContentPrefix(contentRoot)
  if (!resolved) {
    return { counts: new Map(), activity: [], windowStart: displayRangeStart(new Date()), ok: false, source: "none" }
  }

  const end = new Date()
  const cache = readBlogActivityCache(resolved.repoRoot)
  if (cache) {
    const sliced = sliceCacheForDisplay(cache, end)
    return { ...sliced, ok: true, source: "cache" }
  }

  const fromGit = collectBlogActivityFromGit(contentRoot, end)
  if (!fromGit) {
    return { counts: new Map(), activity: [], windowStart: displayRangeStart(end), ok: false, source: "none" }
  }

  const sliced = sliceCacheForDisplay(fromGit, end)
  return { ...sliced, ok: true, source: "git" }
}
