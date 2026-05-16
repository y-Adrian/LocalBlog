// @ts-ignore
import clipboardScript from "./scripts/clipboard.inline"
// @ts-ignore
import revealScrollScript from "./scripts/revealScroll.inline"
// @ts-ignore
import pageHeaderScrollScript from "./scripts/pageHeaderScroll.inline"
// @ts-ignore
import clickEffectsScript from "./scripts/clickEffects.inline"
import clipboardStyle from "./styles/clipboard.scss"
import clickEffectsStyle from "./styles/clickEffects.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { concatenateResources } from "../util/resources"

const Body: QuartzComponent = ({ children }: QuartzComponentProps) => {
  return <div id="quartz-body">{children}</div>
}

Body.afterDOMLoaded = concatenateResources(
  clipboardScript,
  revealScrollScript,
  pageHeaderScrollScript,
  clickEffectsScript,
)
Body.css = concatenateResources(clipboardStyle, clickEffectsStyle)

export default (() => Body) satisfies QuartzComponentConstructor
