import { ComponentChildren } from "preact"
import { Element, ElementContent } from "hast"
import { visit } from "unist-util-visit"
import { htmlToJsx } from "../../util/jsx"
import { resolveRelative } from "../../util/path"
import { isWrittenArticle } from "../../util/content"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

function element(
  tagName: string,
  className: string | undefined,
  children: ElementContent[],
  properties: Record<string, unknown> = {},
): Element {
  return {
    type: "element",
    tagName,
    properties: className ? { ...properties, className: [className] } : properties,
    children,
  }
}

function text(value: string): ElementContent {
  return { type: "text", value }
}

function nodeText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") return node.children.map(nodeText).join("")
  return ""
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/^\d+(?:[.)、]\s*|\s+)/, "").trim()
}

function formatPublishedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function githubRepository(href: unknown): { url: string; owner: string; repo: string } | undefined {
  if (typeof href !== "string") return undefined

  try {
    const url = new URL(href)
    if (url.hostname !== "github.com") return undefined

    const [owner, rawRepo] = url.pathname.split("/").filter(Boolean)
    const repo = rawRepo?.replace(/\.git$/u, "")
    if (!owner || !repo) return undefined

    return { url: `https://github.com/${owner}/${repo}`, owner, repo }
  } catch {
    return undefined
  }
}

const Content: QuartzComponent = ({ fileData, tree, allFiles }: QuartzComponentProps) => {
  if (fileData.slug === "index") {
    let followsProjectsHeading = false
    visit(tree, "element", (node) => {
      if (node.tagName === "h1" || node.tagName === "h2" || node.tagName === "h3") {
        followsProjectsHeading = node.properties.id === "projects"
        return
      }
      if (node.tagName !== "ul" || !followsProjectsHeading) return
      followsProjectsHeading = false

      for (const item of node.children) {
        if (item.type !== "element" || item.tagName !== "li") continue

        const paragraph = item.children.find(
          (child): child is Element => child.type === "element" && child.tagName === "p",
        )
        const badgeContainer = paragraph ?? item

        const repositories: { url: string; owner: string; repo: string }[] = []
        visit(item, "element", (child) => {
          if (child.tagName !== "a") return
          const repository = githubRepository(child.properties.href)
          if (repository) repositories.push(repository)
        })

        for (const repository of repositories) {
          const badgeUrl = new URL(
            `https://img.shields.io/github/stars/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}`,
          )
          badgeUrl.search = new URLSearchParams({
            style: "flat",
            logo: "github",
            logoColor: "181717",
            label: "Stars",
            color: "ffffff",
            labelColor: "ffffff",
            cacheSeconds: "600",
          }).toString()

          badgeContainer.children.push(text(" "))
          badgeContainer.children.push(
            element("a", "home-project-stars", [
              element("img", undefined, [], {
                src: badgeUrl.toString(),
                alt: "GitHub Stars",
                loading: "lazy",
                decoding: "async",
              }),
            ], {
              href: repository.url,
              target: "_blank",
              rel: "noopener noreferrer",
              "aria-label": `GitHub stars for ${repository.owner}/${repository.repo}`,
            }),
          )
        }
      }
    })

    const articles = allFiles
      .filter((page) => isWrittenArticle(page) && page.slug?.startsWith("articles/"))
      .filter((page) => page.dates?.published)
      .sort((a, b) => {
        const dateDiff = b.dates!.published!.getTime() - a.dates!.published!.getTime()
        return dateDiff || (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? "")
      })

    const renderList = (pages: typeof articles): Element =>
      element(
        "ul",
        "home-recent-articles-list",
        pages.map((page) => {
          const published = page.dates!.published!
          return element("li", "home-recent-article", [
            element("a", undefined, [text(page.frontmatter?.title ?? "Untitled")], {
              href: resolveRelative(fileData.slug!, page.slug!),
              className: ["internal"],
            }),
            element("time", "home-recent-article-date", [
              text(formatPublishedDate(published)),
            ], { datetime: published.toISOString() }),
          ])
        }),
      )

    visit(tree, "element", (node) => {
      const classNames = node.properties?.className
      if (
        node.tagName !== "div" ||
        !Array.isArray(classNames) ||
        !classNames.includes("recent-articles-slot")
      ) {
        return
      }

      node.children = [renderList(articles.slice(0, 5))]

      if (articles.length > 5) {
        node.children.push(
          element("p", "home-recent-articles-more", [
            element("a", undefined, [text("see more ->")], {
              href: resolveRelative(fileData.slug!, "articles/index"),
              className: ["internal"],
            }),
          ]),
        )
      }
    })
  }

  const content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const firstElement = tree.children.find((node): node is Element => node.type === "element")
  const title = fileData.frontmatter?.title?.trim()
  const hasDuplicateKnowledgeTitle =
    fileData.frontmatter?.contentType === "knowledge" &&
    fileData.frontmatter?.showArticleMeta === true &&
    firstElement?.tagName === "h1" &&
    title !== undefined &&
    normalizeHeading(nodeText(firstElement)).toLocaleLowerCase() ===
      normalizeHeading(title).toLocaleLowerCase()
  if (hasDuplicateKnowledgeTitle) classes.push("knowledge-title-duplicate")
  const classString = ["popover-hint", ...classes].join(" ")
  return <article class={classString}>{content}</article>
}

export default (() => Content) satisfies QuartzComponentConstructor
