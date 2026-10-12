import { pageViewsURL, readPageViews } from "../../util/pageViews"

let pageViewsTimer: ReturnType<typeof setTimeout> | undefined
let pageViewsRequest: AbortController | undefined

async function updatePageViewCount() {
  const el = document.querySelector<HTMLElement>(".content-meta-views")
  if (!el) return

  const template = el.getAttribute("data-template")
  const labelTemplate = el.getAttribute("data-label-template")
  const countElement = el.querySelector<HTMLElement>(".content-meta-views-count")
  if (!template || !labelTemplate || !countElement) return

  const state = window as unknown as { __gcViewsBase?: string; __gcViewsReady?: boolean }
  if (!state.__gcViewsBase || state.__gcViewsReady === false) return

  const path = location.pathname
  const request = new AbortController()
  pageViewsRequest = request
  try {
    const response = await fetch(pageViewsURL(state.__gcViewsBase, path), {
      cache: "no-store",
      signal: request.signal,
    })
    const count = await readPageViews(response)
    if (request.signal.aborted || !el.isConnected || location.pathname !== path) return
    countElement.textContent = template.replace("{count}", count)
    el.setAttribute("aria-label", labelTemplate.replace("{count}", count))
    el.setAttribute("title", labelTemplate.replace("{count}", count))
    el.removeAttribute("aria-hidden")
    el.classList.add("content-meta-views--ready")
  } catch (error) {
    if (request.signal.aborted || !el.isConnected || location.pathname !== path) return
    countElement.textContent = "—"
    el.removeAttribute("aria-hidden")
    el.classList.add("content-meta-views--ready")
    console.warn("Unable to read GoatCounter page views:", error)
  }
}

function schedulePageViewCount() {
  clearTimeout(pageViewsTimer)
  pageViewsRequest?.abort()
  // Send the page visit first; then read its count. The public endpoint still
  // has a service-side cache, so this is not a real-time read counter.
  pageViewsTimer = setTimeout(updatePageViewCount, 2000)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", schedulePageViewCount, { once: true })
} else {
  schedulePageViewCount()
}
document.addEventListener("nav", schedulePageViewCount)
document.addEventListener("goatcounter:ready", schedulePageViewCount)
