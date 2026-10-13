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

const Content: QuartzComponent = ({ fileData, tree, allFiles }: QuartzComponentProps) => {
  if (fileData.slug === "index") {
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
