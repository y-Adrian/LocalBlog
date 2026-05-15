import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"
import { version } from "../../package.json"
import { i18n } from "../i18n"
import { SocialIcon, SocialIconName } from "./SocialIcon"

export interface SocialLink {
  name: string
  url: string
  icon: SocialIconName
}

interface Options {
  /** @deprecated 使用 socialLinks */
  links?: Record<string, string>
  socialLinks?: SocialLink[]
}

export default ((opts?: Options) => {
  const Footer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const year = new Date().getFullYear()
    const socialLinks =
      opts?.socialLinks ??
      Object.entries(opts?.links ?? {}).map(([name, url]) => ({
        name,
        url,
        icon: "github" as SocialIconName,
      }))

    return (
      <footer class={`${displayClass ?? ""}`}>
        <p>
          {i18n(cfg.locale).components.footer.createdWith}{" "}
          <a href="https://quartz.jzhao.xyz/">Quartz v{version}</a> © {year}
        </p>
        {socialLinks.length > 0 && (
          <ul class="social-links">
            {socialLinks.map(({ name, url, icon }) => (
              <li>
                <a
                  class={`social-link social-link--${icon}`}
                  href={url}
                  aria-label={name}
                  title={name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SocialIcon name={icon} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
