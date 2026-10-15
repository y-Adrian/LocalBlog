import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Adrian's Space",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    // 免费个人站统计：https://www.goatcounter.com 注册后把 websiteId 改成你的站点代号
    analytics: {
      provider: "goatcounter",
      websiteId: "adrianblog",
    },
    locale: "zh-CN",
    baseUrl: "y-Adrian.github.io/LocalBlog",
    ignorePatterns: ["private", "templates", ".obsidian", "leetcode/**"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        /* Roboto Slab headings; Noto Sans SC remains the CJK fallback. */
        title: { name: "Roboto Slab", weights: [400, 500, 600, 700], includeItalic: false },
        header: { name: "Roboto Slab", weights: [400, 500, 600, 700], includeItalic: false },
        /* Chinese prose fallback; custom.scss uses locally hosted Go Mono for Powerline first. */
        body: { name: "LXGW WenKai", weights: [400, 700], includeItalic: true },
        /* Fira Code for code; Sarasa Mono SC remains the CJK fallback. */
        code: { name: "Fira Code", weights: [400, 500, 600, 700], includeItalic: false },
      },
      colors: {
        lightMode: {
          light: "#faf8ff",
          lightgray: "#e6dff2",
          gray: "#878093",
          darkgray: "#403a4c",
          dark: "#252130",
          secondary: "#7850c8",
          tertiary: "#6238ad",
          highlight: "rgba(151, 112, 245, 0.12)",
          textHighlight: "rgba(151, 112, 245, 0.25)",
        },
        darkMode: {
          light: "#15121c",
          lightgray: "#30283f",
          gray: "#a098b0",
          darkgray: "#e5dfee",
          dark: "#f6f1ff",
          secondary: "#be9bff",
          tertiary: "#d7bfff",
          highlight: "rgba(190, 155, 255, 0.12)",
          textHighlight: "rgba(190, 155, 255, 0.28)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown({ enableSmartyPants: false }),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // CustomOgImages 需联网拉字体；CI 或离线构建可关闭
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
