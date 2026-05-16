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
        /* 思源宋体（简体）= Noto Serif SC；与 custom.scss 中 local 名「思源宋体」配合 */
        title: { name: "Noto Serif SC", weights: [400, 600, 700], includeItalic: false },
        header: { name: "Noto Serif SC", weights: [400, 600, 700], includeItalic: false },
        /* 英文正文/代码：Fira Mono（Powerline 变体见 custom.scss local()，需本机安装或自托管） */
        body: { name: "Fira Mono", weights: [400, 500, 700], includeItalic: false },
        code: { name: "Fira Mono", weights: [400, 500, 700], includeItalic: false },
      },
      colors: {
        lightMode: {
          light: "#faf7f2",
          lightgray: "#ebe5dc",
          gray: "#9c9589",
          darkgray: "#3d3a36",
          dark: "#1a2228",
          secondary: "#b45309",
          tertiary: "#0f766e",
          highlight: "rgba(180, 83, 9, 0.14)",
          textHighlight: "rgba(234, 179, 8, 0.42)",
        },
        darkMode: {
          light: "#0f1216",
          lightgray: "#252a32",
          gray: "#8b93a1",
          darkgray: "#e8e4dc",
          dark: "#f7f4ee",
          secondary: "#fbbf24",
          tertiary: "#5eead4",
          highlight: "rgba(251, 191, 36, 0.12)",
          textHighlight: "rgba(250, 204, 21, 0.35)",
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
      Plugin.GitHubFlavoredMarkdown(),
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
