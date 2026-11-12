import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { pagerHandoff, pagerProgress } from './pagerMotion'
import { getCurrentPage, getPageCount, setPage } from '../store/layout'
import { springs } from '../lib/motion'

const DRAG_THRESHOLD = 8
const FLICK_PX_PER_MS = 0.35
const WHEEL_TRIGGER = 36
const WHEEL_IDLE_MS = 220
const WHEEL_MIN_LOCK_MS = 450

/** iOS-style rubber band: resistance grows with distance. */
function rubber(overshootPx: number, width: number): number {
  const c = 0.55
  return (1 - 1 / ((overshootPx * c) / width + 1)) * width
}

/**
 * Pointer swipe (velocity-aware, rubber-banded) + horizontal trackpad wheel for the home pager.
 * Taps on icons still work: a drag only starts past a small threshold, and a click that ends a drag is swallowed.
 */
export function usePagerGestures(el: HTMLElement | null, width: number, enabled: boolean) {
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  useEffect(() => {
    if (!el || !enabled) return
    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let startP = 0
    let dragging = false
    let suppressClick = false
    let samples: { t: number; x: number }[] = []

    const settleTo = (page: number, velocityPx = 0) => {
      const w = widthRef.current || 1
      const target = Math.max(0, Math.min(getPageCount() - 1, page))
      const velocity = (-velocityPx * 1000) / w
      if (target !== getCurrentPage()) {
        pagerHandoff.velocity = velocity
        setPage(target)
      } else {
        animate(pagerProgress, target, { ...springs.soft, velocity })
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || pointerId !== null) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startP = pagerProgress.get()
      dragging = false
      samples = [{ t: e.timeStamp, x: e.clientX }]
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!dragging) {
        // One page: nothing to page to, so no drag and no rubber band (taps stay plain taps).
        if (getPageCount() < 2) {
          pointerId = null
          return
        }
        if (Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) {
          if (Math.abs(dy) > DRAG_THRESHOLD * 2) pointerId = null // vertical intent: give up
          return
        }
        dragging = true
        pagerProgress.stop()
        startX = e.clientX // no jump at the threshold
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      const w = widthRef.current || 1
      const max = getPageCount() - 1
      let px = startP * w - (e.clientX - startX)
      if (px < 0) px = -rubber(-px, w)
      else if (px > max * w) px = max * w + rubber(px - max * w, w)
      pagerProgress.set(px / w)
      samples.push({ t: e.timeStamp, x: e.clientX })
      if (samples.length > 6) samples.shift()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (!dragging) return
      dragging = false
      suppressClick = true
      setTimeout(() => (suppressClick = false), 0)
      const first = samples[0]
      const last = samples[samples.length - 1]
      const dt = Math.max(1, last.t - first.t)
      const v = (last.x - first.x) / dt // px per ms, + = finger moving right
      const w = widthRef.current || 1
      const current = getCurrentPage()
      const moved = (startP - pagerProgress.get()) * w // + = dragged right
      let target = current
      if (v < -FLICK_PX_PER_MS || moved < -w * 0.25) target = current + 1
      else if (v > FLICK_PX_PER_MS || moved > w * 0.25) target = current - 1
      settleTo(target, v)
    }
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (dragging) {
        dragging = false
        settleTo(getCurrentPage())
      }
    }
    const onClickCapture = (e: MouseEvent) => {
      if (suppressClick) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    // Trackpad: one page per horizontal gesture; inertia is ignored until the wheel goes idle.
    let acc = 0
    let locked = false
    let lockedAt = 0
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    const release = () => {
      const wait = WHEEL_MIN_LOCK_MS - (performance.now() - lockedAt)
      if (wait > 0) {
        idleTimer = setTimeout(release, wait)
        return
      }
      idleTimer = null
      locked = false
      acc = 0
    }
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault() // also with one page: a sideways trackpad swipe never pans or navigates the browser
      if (getPageCount() < 2) return
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(release, WHEEL_IDLE_MS)
      if (locked) return
      acc += e.deltaX
      if (Math.abs(acc) >= WHEEL_TRIGGER) {
        const dir = acc > 0 ? 1 : -1
        acc = 0
        locked = true
        lockedAt = performance.now()
        setPage(getCurrentPage() + dir)
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    el.addEventListener('click', onClickCapture, true)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.removeEventListener('click', onClickCapture, true)
      el.removeEventListener('wheel', onWheel)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [el, enabled])
}
