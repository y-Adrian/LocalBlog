import { QuartzPluginData } from "../plugins/vfile"

/** True only for authored blog posts explicitly marked in frontmatter. */
export function isWrittenArticle(fileData: QuartzPluginData): boolean {
  return fileData.frontmatter?.contentType === "article"
}
