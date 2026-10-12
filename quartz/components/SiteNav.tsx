import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/siteNav.scss"

const links: Array<{ label: string; slug: FullSlug }> = [
  { label: "Home", slug: "index" as FullSlug },
  { label: "About", slug: "about/index" as FullSlug },
  { label: "Hire Me", slug: "hire-me/index" as FullSlug },
  { label: "Articles", slug: "articles/index" as FullSlug },
  { label: "Knowledge", slug: "knowledge/index" as FullSlug },
  { label: "Support Me", slug: "support-the-blog/index" as FullSlug },
]

const SiteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  return (
    <nav class="site-nav" aria-label="Main navigation">
      {links.map(({ label, slug }) => {
        const currentSlug = fileData.slug ?? ""
        const active =
          currentSlug === slug ||
          (slug === "articles/index" && currentSlug.startsWith("articles/")) ||
          (slug === "knowledge/index" && currentSlug.startsWith("knowledge/")) ||
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
