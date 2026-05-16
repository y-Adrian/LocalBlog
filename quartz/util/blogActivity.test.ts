import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  parseNameStatusBlogLog,
  refineBlogActivity,
  titleFromMarkdown,
  unquoteGitPath,
} from "./blogActivity.ts"

describe("unquoteGitPath", () => {
  it("leaves unquoted paths unchanged", () => {
    assert.equal(unquoteGitPath("content/foo.md"), "content/foo.md")
  })

  it("unescapes quoted git paths", () => {
    assert.equal(unquoteGitPath('"content/a\\tb.md"'), "content/a\tb.md")
  })
})

describe("titleFromMarkdown", () => {
  it("reads frontmatter title", () => {
    const raw = `---\ntitle: Hello World\n---\n# Other\n`
    assert.equal(titleFromMarkdown(raw, "x.md"), "Hello World")
  })

  it("falls back to first h1", () => {
    const raw = `# My Article\n\nbody`
    assert.equal(titleFromMarkdown(raw, "x.md"), "My Article")
  })
})

describe("parseNameStatusBlogLog", () => {
  const repoRoot = process.cwd()
  const pathPrefix = "content/"

  it("splits rename lines on the first two tabs only", () => {
    const out = [
      "COMMIT deadbeef2026051512345678901234567890abcd 2026-05-15",
      "R100\tcontent/DPDK/dpdk-tutorial-01-hugepage-cpu-bind-devbind-testpmd.md\tcontent/DPDK/DPDK 教程 1：Hugepage、绑核、dpdk-devbind 与跑通 testpmd.md",
    ].join("\n")

    const { activity } = parseNameStatusBlogLog(out, repoRoot, pathPrefix)
    assert.equal(activity.length, 1)
    assert.match(activity[0].label, /重命名《dpdk-tutorial-01-hugepage-cpu-bind-devbind-testpmd》/)
    assert.match(activity[0].label, /DPDK 教程 1：Hugepage/)
  })
})

describe("refineBlogActivity", () => {
  it("drops adds for paths that were later renamed away", () => {
    const rows = refineBlogActivity([
      {
        date: "2026-05-15",
        label: "重命名《dpdk-tutorial-01》→《DPDK 教程 1》",
        kind: "rename",
        fromPath: "content/a/dpdk-tutorial-01.md",
        toPath: "content/a/DPDK 教程 1.md",
      },
      {
        date: "2026-05-15",
        label: "新增《dpdk-tutorial-01》",
        kind: "add",
        path: "content/a/dpdk-tutorial-01.md",
      },
    ])
    assert.equal(rows.length, 1)
    assert.match(rows[0].label, /^新增《DPDK 教程 1》/)
  })

  it("drops cosmetic renames that only add a numeric prefix", () => {
    const rows = refineBlogActivity([
      {
        date: "2026-05-15",
        label: "重命名《Mac 本地部署大模型》→《1 Mac 本地部署大模型》",
        kind: "rename",
        fromPath: "content/AI/Mac.md",
        toPath: "content/AI/1 Mac.md",
      },
    ])
    assert.equal(rows.length, 0)
  })
})
