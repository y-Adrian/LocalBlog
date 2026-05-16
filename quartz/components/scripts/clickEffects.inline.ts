/** 全站点击特效：仅粒子；十字准星光标由 clickEffects.scss 提供 */
const PARTICLE_COUNT = 10
const SKIP_SELECTOR =
  "input, textarea, select, option, [contenteditable='true'], .mermaid-container, pre, code"

let layer: HTMLElement | null = null
let listenersAttached = false

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function shouldSkipTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return true
  if (target.closest(SKIP_SELECTOR)) return true
  return false
}

function ensureLayer() {
  if (layer && document.body.contains(layer)) return layer
  layer = document.getElementById("click-fx-layer")
  if (!layer) {
    layer = document.createElement("div")
    layer.id = "click-fx-layer"
    layer.setAttribute("aria-hidden", "true")
    document.body.appendChild(layer)
  }
  return layer
}

function spawnParticles(x: number, y: number) {
  const host = ensureLayer()
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("span")
    p.className = "click-fx-particle"
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + (Math.random() - 0.5) * 0.6
    const dist = 24 + Math.random() * 20
    p.style.left = `${x}px`
    p.style.top = `${y}px`
    p.style.setProperty("--tx", `${Math.cos(angle) * dist}px`)
    p.style.setProperty("--ty", `${Math.sin(angle) * dist}px`)
    host.appendChild(p)
    p.addEventListener("animationend", () => p.remove(), { once: true })
  }
}

function onPointerDown(ev: PointerEvent) {
  if (ev.button !== 0) return
  if (prefersReducedMotion()) return
  if (shouldSkipTarget(ev.target)) return

  spawnParticles(ev.clientX, ev.clientY)
}

function enableCursorClass() {
  if (prefersReducedMotion()) {
    document.documentElement.classList.remove("click-fx-enabled")
    return
  }
  document.documentElement.classList.add("click-fx-enabled")
}

function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true
  document.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true })
  window.addCleanup?.(() => {
    document.removeEventListener("pointerdown", onPointerDown, { capture: true })
    listenersAttached = false
    layer?.remove()
    layer = null
    document.documentElement.classList.remove("click-fx-enabled")
  })
}

function setup() {
  enableCursorClass()
  if (prefersReducedMotion()) {
    layer?.remove()
    layer = null
    return
  }
  ensureLayer()
  attachListeners()
}

document.addEventListener("nav", () => {
  requestAnimationFrame(() => requestAnimationFrame(setup))
})
document.addEventListener("DOMContentLoaded", setup)
setup()
