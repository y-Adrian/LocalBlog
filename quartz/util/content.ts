import { QuartzPluginData } from "../plugins/vfile"

/** True only for authored blog posts explicitly marked in frontmatter. */
export function isWrittenArticle(fileData: QuartzPluginData): boolean {
  return fileData.frontmatter?.contentType === "article"
}

/** Written posts show metadata by default; Knowledge entries opt in per page. */
export function shouldShowArticleMeta(fileData: QuartzPluginData): boolean {
  return (
    isWrittenArticle(fileData) ||
    (fileData.frontmatter?.contentType === "knowledge" &&
      fileData.frontmatter?.showArticleMeta === true)
  )
}
