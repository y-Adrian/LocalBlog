// @ts-ignore
import clipboardScript from "./scripts/clipboard.inline"
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
  clickEffectsScript,
)
Body.css = concatenateResources(clipboardStyle, clickEffectsStyle)

export default (() => Body) satisfies QuartzComponentConstructor
