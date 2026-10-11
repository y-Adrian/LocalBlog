import { Date } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { JSX } from "preact"
import style from "./styles/contentMeta.scss"
import { isWrittenArticle } from "../util/content"

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
    const isArticle = isWrittenArticle(fileData)
    const showReadingTime =
      options.showReadingTime &&
      isArticle &&
      fileData.frontmatter?.hideReadingTime !== true
    const showCreatedDate = isArticle && fileData.frontmatter?.hideCreatedDate !== true

    if (text) {
      const segments: (string | JSX.Element)[] = []

      if (showCreatedDate && fileData.dates?.created) {
        segments.push(<Date date={fileData.dates.created} locale={cfg.locale} />)
      }

      const showPageViews = cfg.analytics?.provider === "goatcounter"
      const pageViewsTemplate = showPageViews
        ? i18n(cfg.locale).components.contentMeta.pageViews({ count: "{count}" })
        : null

      // Display reading time if enabled
      if (showReadingTime) {
        const { minutes, words: _words } = readingTime(text)
        const displayedTime = i18n(cfg.locale).components.contentMeta.readingTime({
          minutes: Math.ceil(minutes),
        })
        segments.push(
          <span>
            {displayedTime}
            {showPageViews && (
              <span
                class="content-meta-views"
                data-template={pageViewsTemplate!}
                aria-hidden="true"
              />
            )}
          </span>,
        )
      } else if (showPageViews) {
        segments.push(
          <span
            class="content-meta-views content-meta-views--standalone"
            data-template={pageViewsTemplate!}
            aria-hidden="true"
          />,
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
