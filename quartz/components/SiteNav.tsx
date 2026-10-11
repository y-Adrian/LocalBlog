import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/siteNav.scss"

const knowledgeSections = [
  "工程基础",
  "linux",
  "网络与DPDK",
  "编程语言",
  "数据库",
  "分布式系统",
  "系统调试",
  "AI",
  "成长路径",
  "学习疑问",
]

const links: Array<{ label: string; slug: FullSlug }> = [
  { label: "Home", slug: "index" as FullSlug },
  { label: "About", slug: "about/index" as FullSlug },
  { label: "Hire Me", slug: "hire-me/index" as FullSlug },
  { label: "Articles", slug: "articles/index" as FullSlug },
  { label: "Knowledge Base", slug: "knowledge-base/index" as FullSlug },
  { label: "Support the blog", slug: "support-the-blog/index" as FullSlug },
]

const SiteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  return (
    <nav class="site-nav" aria-label="Main navigation">
      {links.map(({ label, slug }) => {
        const currentSlug = fileData.slug ?? ""
        const active =
          currentSlug === slug ||
          (slug === "articles/index" && currentSlug.startsWith("articles/")) ||
          (slug === "knowledge-base/index" &&
            knowledgeSections.some((section) => currentSlug.startsWith(`${section}/`))) ||
          (slug === "index" && currentSlug === "index")
        return (
          <a
            href={resolveRelative(fileData.slug!, slug)}
            class={active ? "site-nav-link active" : "site-nav-link"}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </a>
        )
      })}
    </nav>
  )
}

SiteNav.css = style
export default (() => SiteNav) satisfies QuartzComponentConstructor
