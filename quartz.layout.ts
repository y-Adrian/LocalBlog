import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

/** 侧栏目录：不展示 tags、leetcode（leetcode 亦在 quartz.config ignorePatterns 中排除构建） */
const explorer = Component.Explorer({
  filterFn: (node) => node.slugSegment !== "tags" && node.slugSegment !== "leetcode",
  mapFn: (node) => {
    const labels: Record<string, string> = {
      articles: "Articles",
      "knowledge-base": "Knowledge Base",
      about: "About",
      工程基础: "Engineering Fundamentals",
      linux: "Linux",
      "网络与DPDK": "Networking & DPDK",
      编程语言: "Programming Languages",
      数据库: "Databases",
      分布式系统: "Distributed Systems",
      系统调试: "Systems Debugging",
      AI: "AI Tools",
      成长路径: "Learning Paths",
      学习疑问: "Study Questions",
    }
    const label = labels[node.slugSegment]
    if (label) node.displayName = label
  },
})

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.SiteNav()],
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
      component: Component.FocusMode(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.slug !== "index",
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
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    explorer,
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    explorer,
  ],
  right: [],
}
