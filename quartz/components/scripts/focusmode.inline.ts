const FOCUS_KEY = "focus-mode"

const readSaved = (): "on" | "off" =>
  (localStorage.getItem(FOCUS_KEY) as "on" | "off" | null) ?? "off"

// 初次硬加载时立即恢复，避免正文闪一下再变宽（仅在文章页有按钮时才生效）
document.documentElement.setAttribute(FOCUS_KEY, readSaved())

document.addEventListener("nav", () => {
  // 按钮默认渲染在 .page-header 内，而 page-header 带 transform（滚动动画），
  // 会成为 position:fixed 的包含块，导致按钮跟着正文列走而非固定视口。
  // 这里把它移到 <body> 直下（body/html 无 transform），并清理 SPA 导航遗留的旧按钮。
  document
    .querySelectorAll("body > button.focusmode")
    .forEach((stale) => stale.remove())
  const fresh = document.querySelector<HTMLElement>(".page button.focusmode")
  if (fresh) {
    document.body.appendChild(fresh)
  }

  const buttons = document.getElementsByClassName("focusmode")
  const hasToggle = buttons.length > 0

  // 没有聚焦按钮的页面（如首页/列表页）强制关闭，避免隐藏侧栏后无法退出
  const desired = hasToggle ? readSaved() : "off"
  document.documentElement.setAttribute(FOCUS_KEY, desired)

  const toggle = () => {
    const next =
      document.documentElement.getAttribute(FOCUS_KEY) === "on" ? "off" : "on"
    document.documentElement.setAttribute(FOCUS_KEY, next)
    localStorage.setItem(FOCUS_KEY, next)
  }

  for (const btn of buttons) {
    btn.addEventListener("click", toggle)
    window.addCleanup(() => btn.removeEventListener("click", toggle))
  }

  // Esc 退出聚焦
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && document.documentElement.getAttribute(FOCUS_KEY) === "on") {
      document.documentElement.setAttribute(FOCUS_KEY, "off")
      localStorage.setItem(FOCUS_KEY, "off")
    }
  }
  if (hasToggle) {
    document.addEventListener("keydown", onKey)
    window.addCleanup(() => document.removeEventListener("keydown", onKey))
  }
})
