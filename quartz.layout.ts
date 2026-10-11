import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { isWrittenArticle } from "./quartz/util/content"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.SiteNav(), Component.Search(), Component.Darkmode()],
  afterBody: [],
  footer: Component.Footer({
    socialLinks: [
      { name: "GitHub", url: "https://github.com/y-Adrian", icon: "github" },
      { name: "Gmail", url: "mailto:storyvs7263@gmail.com", icon: "gmail" },
      { name: "X", url: "https://x.com/story95080", icon: "x" },
    ],
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ showCurrentPage: false }),
      condition: (page) =>
        isWrittenArticle(page.fileData) ||
        page.fileData.frontmatter?.contentType === "knowledge" ||
        page.fileData.slug?.startsWith("knowledge"),
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) =>
        isWrittenArticle(page.fileData) && page.fileData.frontmatter?.hideTitle !== true,
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "index",
    }),
  ],
  afterBody: [
    Component.ConditionalRender({
      component: Component.FocusMode(),
      condition: (page) => page.fileData.slug !== "index",
    }),
  ],
  left: [],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ showCurrentPage: false }),
      condition: (page) =>
        page.fileData.frontmatter?.contentType === "knowledge" ||
        page.fileData.slug?.startsWith("knowledge"),
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.frontmatter?.hideTitle !== true,
    }),
    Component.ContentMeta(),
  ],
  left: [],
  right: [],
}
