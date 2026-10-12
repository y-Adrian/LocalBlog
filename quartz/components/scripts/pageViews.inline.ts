function updatePageViewCount() {
  const el = document.querySelector<HTMLElement>(".content-meta-views")
  if (!el) return

  const template = el.getAttribute("data-template")
  const labelTemplate = el.getAttribute("data-label-template")
  const countElement = el.querySelector<HTMLElement>(".content-meta-views-count")
  if (!template || !labelTemplate || !countElement) return

  const base = (window as unknown as { __gcViewsBase?: string }).__gcViewsBase
  if (!base) return

  const path = location.pathname
  const url = `${base}/counter/${encodeURIComponent(path)}.json`

  fetch(url)
    .then((res) => {
      if (res.status === 404) return { count: "0" }
      if (!res.ok) return Promise.reject()
      return res.json()
    })
    .then((data: { count?: string }) => {
      const count = data?.count ?? "0"
      countElement.textContent = template.replace("{count}", count)
      el.setAttribute("aria-label", labelTemplate.replace("{count}", count))
      el.setAttribute("title", labelTemplate.replace("{count}", count))
      el.removeAttribute("aria-hidden")
      el.classList.add("content-meta-views--ready")
    })
    .catch(() => {
      el.remove()
    })
}

// This bundle runs after DOMContentLoaded in Quartz; run immediately on first load,
// then refresh after each SPA navigation.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", updatePageViewCount, { once: true })
} else {
  updatePageViewCount()
}
document.addEventListener("nav", updatePageViewCount)
