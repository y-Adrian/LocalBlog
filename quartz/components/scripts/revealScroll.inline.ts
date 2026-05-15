// Scroll-in reveal for article blocks (respects SPA `nav` events)
let revealObserver: IntersectionObserver | null = null

function teardownReveal() {
  if (revealObserver) {
    revealObserver.disconnect()
    revealObserver = null
  }
  document.querySelectorAll(".q-reveal, .q-reveal-visible").forEach((el) => {
    el.classList.remove("q-reveal", "q-reveal-visible")
    ;(el as HTMLElement).style.transitionDelay = ""
  })
}

function setupReveal() {
  teardownReveal()
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return
  }

  const article = document.querySelector(".center article")
  if (!article) return

  const blocks = Array.from(article.children).filter(
    (el) => el.tagName !== "SCRIPT" && el.tagName !== "STYLE",
  )
  if (blocks.length === 0) return

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("q-reveal-visible")
          revealObserver?.unobserve(e.target)
        }
      }
    },
    { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.02 },
  )

  blocks.forEach((el, i) => {
    el.classList.add("q-reveal")
    ;(el as HTMLElement).style.transitionDelay = `${Math.min(i, 14) * 0.035}s`
    revealObserver?.observe(el)
  })
}

document.addEventListener("nav", setupReveal)
document.addEventListener("DOMContentLoaded", setupReveal)
setupReveal()
