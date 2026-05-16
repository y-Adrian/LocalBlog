#!/usr/bin/env npx tsx
/**
 * 根据 Git 中 content/ 下博客 Markdown 的增删改，写入 blog-activity.cache.json。
 * 本地 post-commit 钩子与 CI 构建前会调用；请将生成的文件一并提交并 push。
 */
import path from "node:path"
import {
  BLOG_ACTIVITY_CACHE_FILE,
  collectBlogActivityFromGit,
  resolveRepoAndContentPrefix,
  writeBlogActivityCache,
} from "../quartz/util/blogActivity.ts"

const contentRoot = path.resolve(process.cwd(), "content")

const resolved = resolveRepoAndContentPrefix(contentRoot)
if (!resolved) {
  console.error("未找到 Git 仓库，无法生成", BLOG_ACTIVITY_CACHE_FILE)
  process.exit(1)
}

const data = collectBlogActivityFromGit(contentRoot)
if (!data) {
  console.error("无法从 Git 收集博客变动记录")
  process.exit(1)
}

writeBlogActivityCache(resolved.repoRoot, data)
console.log(`已写入 ${BLOG_ACTIVITY_CACHE_FILE}（${Object.keys(data.counts).length} 天有记录，${data.activity.length} 条动态）`)
