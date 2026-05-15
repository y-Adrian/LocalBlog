// 非首页：可纵向滚动时顶栏随阅读方向收起/展开（累计位移 + 布局锁，避免 scroll anchoring 误判导致抖动）
const TOP_REVEAL_PX = 48
const MIN_SCROLL_ROOM = 24
/** 顶栏展开时：累计向下滚动超过该值后收起 */
const HIDE_AFTER_DOWN_PX = 56
/** 顶栏收起时：累计向上滚动超过该值后再展开 */
const SHOW_AFTER_UP_PX = 28
/** 收起/展开触发布局变化后，忽略滚动推导的时间（需 ≥ max-height 等过渡） */
const LAYOUT_LOCK_MS = 580

let prevScrollY = 0
let downAccum = 0
let upAccum = 0
let rafPending = false
let listenersAttached = false
let layoutLockUntil = 0
let layoutLockTimer: ReturnType<typeof setTimeout> | null = null

function getHeader() {
  return document.querySelector<HTMLElement>(".center .page-header")
}

function documentHasVerticalScroll() {
  const el = document.documentElement
  return el.scrollHeight > el.clientHeight + MIN_SCROLL_ROOM
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function clearLayoutLock() {
  layoutLockUntil = 0
  if (layoutLockTimer !== null) {
    clearTimeout(layoutLockTimer)
    layoutLockTimer = null
  }
}

/** 顶栏高度/外边距动画会改变 scrollHeight 与 scrollY，期间暂停用 dy 推导意图，避免误判振荡 */
function armLayoutLock() {
  clearLayoutLock()
  layoutLockUntil = performance.now() + LAYOUT_LOCK_MS
  layoutLockTimer = setTimeout(() => {
    layoutLockTimer = null
    layoutLockUntil = 0
    resetScrollTracking()
  }, LAYOUT_LOCK_MS)
}

function resetScrollTracking() {
  prevScrollY = window.scrollY
  downAccum = 0
  upAccum = 0
}

function syncHeader() {
  rafPending = false
  const header = getHeader()
  if (!header) return

  if (document.body.dataset.slug === "index") {
    header.classList.remove("page-header--scroll-hidden")
    clearLayoutLock()
    return
  }

  if (prefersReducedMotion() || !documentHasVerticalScroll()) {
    header.classList.remove("page-header--scroll-hidden")
    resetScrollTracking()
    clearLayoutLock()
    return
  }

  if (performance.now() < layoutLockUntil) {
    return
  }

  const y = window.scrollY
  const dy = y - prevScrollY
  prevScrollY = y

  if (y < TOP_REVEAL_PX) {
    const wasHidden = header.classList.contains("page-header--scroll-hidden")
    header.classList.remove("page-header--scroll-hidden")
    downAccum = 0
    upAccum = 0
    if (wasHidden) {
      armLayoutLock()
    }
    return
  }

  const hidden = header.classList.contains("page-header--scroll-hidden")

  if (!hidden) {
    if (dy > 0) {
      downAccum += dy
    } else {
      downAccum = Math.max(0, downAccum + dy)
    }
    upAccum = 0
    if (downAccum >= HIDE_AFTER_DOWN_PX) {
      header.classList.add("page-header--scroll-hidden")
      downAccum = 0
      upAccum = 0
      armLayoutLock()
    }
  } else {
    if (dy < 0) {
      upAccum += -dy
    } else {
      upAccum = Math.max(0, upAccum - dy)
    }
    downAccum = 0
    if (upAccum >= SHOW_AFTER_UP_PX) {
      header.classList.remove("page-header--scroll-hidden")
      downAccum = 0
      upAccum = 0
      armLayoutLock()
    }
  }
}

function onScroll() {
  if (performance.now() < layoutLockUntil) {
    return
  }
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(syncHeader)
}

function onResizeOrLoad() {
  clearLayoutLock()
  resetScrollTracking()
  syncHeader()
}

function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onResizeOrLoad)
  window.addEventListener("load", onResizeOrLoad)
  window.addCleanup?.(() => {
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onResizeOrLoad)
    window.removeEventListener("load", onResizeOrLoad)
    clearLayoutLock()
    listenersAttached = false
  })
}

function setup() {
  clearLayoutLock()
  if (document.body.dataset.slug === "index") {
    getHeader()?.classList.remove("page-header--scroll-hidden")
    return
  }

  const header = getHeader()
  if (!header) return

  header.classList.remove("page-header--scroll-hidden")
  resetScrollTracking()
  syncHeader()
  attachListeners()
}

document.addEventListener("nav", () => {
  requestAnimationFrame(() => {
    requestAnimationFrame(setup)
  })
})
document.addEventListener("DOMContentLoaded", setup)
setup()
