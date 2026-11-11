import { useMemo } from 'react'
import { animate } from 'motion/react'
import type { MotionValue } from 'motion/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { EDGE, TOP_INSET, bounds, clampFrame, rubberClamp, viewport } from './frames'
import type { Frame } from './frames'
import { frameSpring } from './pose'
import { trackPointer } from './pointerTrack'

export interface FrameValues {
  x: MotionValue<number>
  y: MotionValue<number>
  w: MotionValue<number>
  h: MotionValue<number>
}

export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const EDGE_CURSOR: Record<Edge, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

export interface FrameGestureOptions {
  frame: FrameValues
  minSize: { w: number; h: number }
  /** Read at gesture start: is the window maximized, and what frame would it restore to? */
  maximizedRestore: () => Frame | null
  /** Called once when a drag pulls a maximized window off the top. */
  leaveMaximized: () => void
  /** Persist the settled frame. */
  commit: () => void
}

const DRAG_SLOP = 3

export function readFrame(f: FrameValues): Frame {
  return { x: f.x.get(), y: f.y.get(), w: f.w.get(), h: f.h.get() }
}

export function writeFrame(f: FrameValues, v: Frame) {
  f.x.set(v.x)
  f.y.set(v.y)
  f.w.set(v.w)
  f.h.set(v.h)
}

export function stopFrame(f: FrameValues) {
  f.x.stop()
  f.y.stop()
  f.w.stop()
  f.h.stop()
}

/** Springs the frame to `to`; resolves when it settles. */
export function animateFrame(f: FrameValues, to: Frame, reduced: boolean) {
  const t = reduced ? { duration: 0 } : frameSpring
  return Promise.all([animate(f.x, to.x, t), animate(f.y, to.y, t), animate(f.w, to.w, t), animate(f.h, to.h, t)].map((c) => c.finished))
}

/**
 * Drag-by-title and resize-from-edges for a desktop window. Writes motion values directly (motion batches them per
 * animation frame), so React never re-renders mid-gesture; the frame is committed on release.
 */
export function useFrameGestures(opts: FrameGestureOptions, reduced: boolean) {
  const { frame, minSize, maximizedRestore, leaveMaximized, commit } = opts

  return useMemo(() => {
    const onTitlePointerDown = (e: ReactPointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest('button')) return
      e.preventDefault() // no text selection while dragging
      stopFrame(frame)
      const sx = e.clientX
      const sy = e.clientY
      let start = readFrame(frame)
      let started = false
      const restore = maximizedRestore()
      trackPointer(
        e.pointerId,
        (ev) => {
          const dx = ev.clientX - sx
          const dy = ev.clientY - sy
          if (!started) {
            if (Math.hypot(dx, dy) < DRAG_SLOP) return
            started = true
            document.documentElement.classList.add('os-dragging')
            if (restore) {
              // Pull a maximized window off the top: restore its size under the pointer, keeping the grab ratio.
              const ratio = (sx - start.x) / Math.max(1, start.w)
              start = { x: sx - ratio * restore.w, y: start.y, w: restore.w, h: restore.h }
              frame.w.set(restore.w)
              frame.h.set(restore.h)
              leaveMaximized()
            }
          }
          const vp = viewport()
          const b = bounds(start.w, start.h, vp)
          frame.x.set(rubberClamp(start.x + dx, b.minX, b.maxX))
          frame.y.set(rubberClamp(start.y + dy, b.minY, b.maxY))
        },
        () => {
          if (!started) return
          document.documentElement.classList.remove('os-dragging')
          const now = readFrame(frame)
          const settled = clampFrame(now, minSize, viewport())
          if (settled.x !== now.x || settled.y !== now.y) {
            void animateFrame(frame, settled, reduced).then(commit)
          } else commit()
        },
      )
    }

    const onEdgePointerDown = (edge: Edge) => (e: ReactPointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      stopFrame(frame)
      const sx = e.clientX
      const sy = e.clientY
      const start = readFrame(frame)
      const vp = viewport()
      const root = document.documentElement
      root.style.cursor = EDGE_CURSOR[edge]
      root.classList.add('os-dragging')
      trackPointer(
        e.pointerId,
        (ev) => {
          const dx = ev.clientX - sx
          const dy = ev.clientY - sy
          let { x, y, w, h } = start
          if (edge.includes('e')) w = Math.max(minSize.w, Math.min(start.w + dx, vp.w - EDGE - start.x))
          if (edge.includes('w')) {
            const right = start.x + start.w
            x = Math.min(Math.max(start.x + dx, EDGE), right - minSize.w)
            w = right - x
          }
          if (edge.includes('s')) h = Math.max(minSize.h, Math.min(start.h + dy, vp.h - EDGE - start.y))
          if (edge.startsWith('n')) {
            const bottom = start.y + start.h
            y = Math.min(Math.max(start.y + dy, TOP_INSET), bottom - minSize.h)
            h = bottom - y
          }
          writeFrame(frame, { x, y, w, h })
        },
        () => {
          root.style.cursor = ''
          root.classList.remove('os-dragging')
          commit()
        },
      )
    }

    return { onTitlePointerDown, onEdgePointerDown }
  }, [frame, minSize, maximizedRestore, leaveMaximized, commit, reduced])
}
