import { Date } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"
import { shouldShowArticleMeta } from "../util/content"

interface ContentMetaOptions {
  /**
   * Whether to display reading time
   */
  showReadingTime: boolean
  showComma: boolean
}

const defaultOptions: ContentMetaOptions = {
  showReadingTime: true,
  showComma: true,
}

export default ((opts?: Partial<ContentMetaOptions>) => {
  // Merge options with defaults
  const options: ContentMetaOptions = { ...defaultOptions, ...opts }

  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    const text = fileData.text
    const showArticleMeta = shouldShowArticleMeta(fileData)
    const showReadingTime =
      options.showReadingTime &&
      showArticleMeta &&
      fileData.frontmatter?.hideReadingTime !== true
    const showCreatedDate = showArticleMeta && fileData.frontmatter?.hideCreatedDate !== true

    if (text) {
      const segments: (string | JSX.Element)[] = []

      if (showCreatedDate && fileData.dates?.created) {
        segments.push(<Date date={fileData.dates.created} locale={cfg.locale} />)
      }

      const showPageViews = showArticleMeta && cfg.analytics?.provider === "goatcounter"
      const pageViewsTemplate = showPageViews
        ? i18n(cfg.locale).components.contentMeta.pageViews({ count: "{count}" })
        : null
      const pageViewsLabelTemplate = showPageViews
        ? i18n(cfg.locale).components.contentMeta.pageViews({ count: "{count}" })
        : null

      // Display reading time and page views as separate metadata items.
      if (showReadingTime) {
        const { minutes, words: _words } = readingTime(text)
        const displayedTime = i18n(cfg.locale).components.contentMeta.readingTime({
          minutes: Math.ceil(minutes),
        })
        segments.push(<span>{displayedTime}</span>)
      }

      if (showPageViews) {
        segments.push(
          <span
            class="content-meta-views"
            data-template={pageViewsTemplate!}
            data-label-template={pageViewsLabelTemplate!}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span class="content-meta-views-count">…</span>
          </span>,
        )
      }

      if (segments.length === 0) {
        return null
      }

      return (
        <p show-comma={options.showComma} class={classNames(displayClass, "content-meta")}>
          {segments}
        </p>
      )
    } else {
      return null
    }
  }

  ContentMetadata.css = style

  return ContentMetadata
}) satisfies QuartzComponentConstructor
