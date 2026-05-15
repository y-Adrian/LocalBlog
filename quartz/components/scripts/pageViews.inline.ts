function updatePageViewCount() {
  const el = document.querySelector(".content-meta-views")
  if (!el) return

  const template = el.getAttribute("data-template")
  if (!template) return

  const base = (window as unknown as { __gcViewsBase?: string }).__gcViewsBase
  if (!base) return

  const path = location.pathname
  const url = `${base}/counter/${encodeURIComponent(path)}.json`

  fetch(url)
    .then((res) => (res.ok ? res.json() : Promise.reject()))
    .then((data: { count?: string }) => {
      if (!data?.count) {
        el.remove()
        return
      }

      const prefix = el.classList.contains("content-meta-views--standalone") ? "" : "，"
      el.textContent = `${prefix}${template.replace("{count}", data.count)}`
      el.removeAttribute("aria-hidden")
      el.classList.add("content-meta-views--ready")
    })
    .catch(() => {
      el.remove()
    })
}

document.addEventListener("DOMContentLoaded", updatePageViewCount)
document.addEventListener("nav", updatePageViewCount)
