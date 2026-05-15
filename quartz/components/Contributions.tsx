import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Repository } from "@napi-rs/simple-git"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/contributions.scss"

/** 热力图与列表仅展示最近若干自然月（自「今天」往前推） */
const DISPLAY_MONTHS = 11

/** 时间线最多展示的条目数 */
const MAX_ACTIVITY_LINES = 48

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 自 `end` 当日起往前 `DISPLAY_MONTHS` 个自然月的同日（用于展示窗口左边界） */
function displayRangeStart(end: Date): Date {
  const x = startOfDay(end)
  x.setMonth(x.getMonth() - DISPLAY_MONTHS)
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

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sundayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/")
}

/** 统计 / 展示用的博客 Markdown：`pathPrefix` 下 `.md`，且排除各层级的 `index.md` */
function isBlogMarkdown(relPosix: string, pathPrefix: string): boolean {
  const p = toPosix(relPosix).replace(/^.\//, "")
  const prefix = toPosix(pathPrefix).replace(/\/?$/, "/")
  if (!p.startsWith(prefix) || !p.toLowerCase().endsWith(".md")) return false
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

type DayCell = {
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

/** Quartz 的 `argv.directory` 默认是 `content/`，`.git` 在仓库根目录，需 discover 后再跑 git。 */
function resolveRepoAndContentPrefix(contentRoot: string): { repoRoot: string; pathPrefix: string } | null {
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

/** 从当前工作区文件读取标题（优先 YAML `title`，否则首个一级标题，否则文件名） */
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

type ActivityRow = { date: string; label: string }

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

  return { counts, activity: activity.slice(0, MAX_ACTIVITY_LINES) }
}

function loadGitData(contentRoot: string, sinceYmd: string): {
  counts: Map<string, number>
  activity: ActivityRow[]
  ok: boolean
} {
  const resolved = resolveRepoAndContentPrefix(contentRoot)
  if (!resolved) {
    return { counts: new Map(), activity: [], ok: false }
  }
  const { repoRoot, pathPrefix } = resolved

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
  return { counts, activity, ok: true }
}

function buildColumns(
  counts: Map<string, number>,
  end: Date,
  windowStart: Date,
): { columns: DayCell[][]; monthLabels: string[]; gridStart: Date } {
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

  return { columns, monthLabels, gridStart }
}

function groupActivityByMonth(rows: ActivityRow[]): { label: string; items: string[] }[] {
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

/** 首页：根据 Git 对博客 Markdown（排除 index.md）的增删改绘制热力图与时间线（仅构建时执行 git） */
const Contributions: QuartzComponent = (props: QuartzComponentProps) => {
  const contentRoot = path.resolve(props.ctx.argv.directory)
  const end = new Date()
  const windowStart = displayRangeStart(end)
  const sinceYmd = ymd(windowStart)
  const { counts, activity, ok } = loadGitData(contentRoot, sinceYmd)
  const { columns, monthLabels } = buildColumns(counts, end, windowStart)
  const activityGroups = groupActivityByMonth(activity)

  const rowLabelFor = (rowIndex: number) => {
    if (rowIndex === 1) return "一"
    if (rowIndex === 3) return "三"
    if (rowIndex === 5) return "五"
    return ""
  }

  return (
    <section class="contrib-section">
      <div class="contrib-header">
        <h2 class="contrib-title">内容更新</h2>
      </div>

      {!ok ? (
        <p class="contrib-empty">
          请在仓库根目录执行 <code>npx quartz build</code>，并确保该仓库能覆盖你的 Quartz 内容目录（默认 <code>content/</code>
          ）；若在无 Git 的 CI 里构建，则无法生成热力图。
        </p>
      ) : (
        <>
          <div class="contrib-wrap">
            <div class="contrib-matrix">
              <div class="contrib-gutter">
                <div class="contrib-gutter-spacer" aria-hidden="true" />
                <div class="contrib-rows-label" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i}>{rowLabelFor(i)}</span>
                  ))}
                </div>
              </div>
              {columns.map((col, wi) => (
                <div class="contrib-col" key={wi}>
                  <div class="contrib-month-cap" aria-hidden="true">
                    {monthLabels[wi] ? monthLabels[wi] : "\u00a0"}
                  </div>
                  <div class="contrib-week">
                    {col.map((cell, ri) => (
                      <span
                        class="contrib-cell"
                        data-level={cell.future ? 0 : cell.level}
                        title={
                          cell.future
                            ? `${cell.key}（未到）`
                            : cell.beforeWindow
                              ? `${cell.key}`
                              : `${cell.key} · ${cell.count} 处笔记变动`
                        }
                        key={ri}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div class="contrib-legend" aria-hidden="true">
            <span>少</span>
            <div class="contrib-legend-cells">
              {[0, 1, 2, 3, 4].map((lv) => (
                <span class="contrib-cell" data-level={lv} key={lv} />
              ))}
            </div>
            <span>多</span>
          </div>

          {activityGroups.length > 0 ? (
            <div class="contrib-activity">
              <h3>文章动态</h3>
              {activityGroups.map((g) => (
                <div key={g.label}>
                  <div class="contrib-activity-month">{g.label}</div>
                  <ul>
                    {g.items.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

Contributions.css = style

export default (() => Contributions) satisfies QuartzComponentConstructor
