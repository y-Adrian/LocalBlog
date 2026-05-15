import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/siteTagline.scss"

/** 首页顶栏主标题（与正文分离，位于 sticky .page-header 内） */
const SiteTagline: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <div class="site-tagline-wrap">
      <h1 class="site-tagline">记录想法，分享见解</h1>
    </div>
  )
}

SiteTagline.css = style

export default (() => SiteTagline) satisfies QuartzComponentConstructor
