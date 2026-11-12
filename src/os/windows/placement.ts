// Where a newly opened desktop window goes. Pure: frames in, frame out.
import { CASCADE_STEP, EDGE, TITLE_H, TOP_INSET, bounds, clampFrame, defaultSize } from './frames'
import type { Frame, SavedFrame, Viewport } from './frames'
import type { AppDefinition } from '../types'

/** An open, visible window: its frame and stacking order. */
export interface Placed {
  frame: Frame
  z: number
}

const SAMPLE = 8
/** A title bar "shows" while at least this many px of it (two 8px sample rows deep) are uncovered. */
const MIN_SHOWING_W = 48

function inside(x: number, y: number, f: Frame): boolean {
  return x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h
}

/** Is enough of `a`'s title bar left uncovered by the frames above it to find and grab it? */
export function titleShowing(a: Frame, above: Frame[]): boolean {
  let cols = 0
  for (let x = a.x + 6; x < a.x + a.w - 6; x += SAMPLE) {
    let rows = 0
    for (let y = a.y + 6; y < a.y + TITLE_H - 4; y += SAMPLE) if (!above.some((b) => inside(x, y, b))) rows++
    if (rows >= 2 && ++cols * SAMPLE >= MIN_SHOWING_W) return true
  }
  return false
}

/** Two frames whose top-left corners nearly coincide read as one window. */
function nearlySame(a: Frame, b: Frame): boolean {
  return Math.abs(a.x - b.x) < CASCADE_STEP / 2 && Math.abs(a.y - b.y) < CASCADE_STEP / 2
}

/** The candidate opens on top of everything: every other title bar must still show, and it must not sit on another. */
export function fits(candidate: Frame, others: Placed[]): boolean {
  for (const o of others) {
    if (nearlySame(candidate, o.frame)) return false
    const above = others.filter((p) => p.z > o.z).map((p) => p.frame)
    if (!titleShowing(o.frame, [...above, candidate])) return false
  }
  return true
}

/** Candidate top-left corners in order of preference: down-right from the top window, then fresh diagonals. */
function* cascadeFrom(top: Frame | null, size: { w: number; h: number }, vp: Viewport): Generator<{ x: number; y: number }> {
  const b = bounds(size.w, size.h, vp)
  if (top) {
    for (let k = 1; ; k++) {
      const x = top.x + k * CASCADE_STEP
      const y = top.y + k * CASCADE_STEP
      if (x > b.maxX || y > b.maxY) break
      yield { x, y }
    }
  }
  // Wrap: diagonals that start along the top-left, before a window would leave the viewport.
  const x0 = EDGE + 2 * CASCADE_STEP
  const y0 = TOP_INSET + CASCADE_STEP
  for (let d = 0; x0 + d * 2 * CASCADE_STEP <= b.maxX; d++) {
    for (let k = 0; ; k++) {
      const x = x0 + d * 2 * CASCADE_STEP + k * CASCADE_STEP
      const y = y0 + k * CASCADE_STEP
      if (x > b.maxX || y > b.maxY) break
      yield { x, y }
    }
  }
}

/**
 * Frame for a window that is opening now.
 * - Nothing else visible: its remembered frame (maximized too), else its default slot.
 * - Otherwise its remembered frame still wins if it neither hides another window's title bar nor sits on another
 *   window; else it cascades down-right from the current top window, wrapping before it leaves the viewport, to the
 *   first spot where every open window's title bar stays visible. A remembered "maximized" waits until the window is
 *   alone (it would cover everything), so the window opens at its remembered restore size instead.
 */
export function placeWindow(def: AppDefinition, saved: SavedFrame | null, fallback: SavedFrame, others: Placed[], vp: Viewport): SavedFrame {
  if (others.length === 0) return saved ? { ...clampFrame(saved, def.minSize, vp), maximized: saved.maximized } : fallback
  const size = saved ? clampFrame(saved, def.minSize, vp) : clampFrame({ x: 0, y: 0, ...defaultSize(def, vp) }, def.minSize, vp)
  if (saved && fits(size, others)) return { ...size, maximized: false }

  const top = others.reduce<Placed | null>((t, o) => (!t || o.z > t.z ? o : t), null)
  let first: Frame | null = null
  let n = 0
  for (const p of cascadeFrom(top?.frame ?? null, size, vp)) {
    const f = clampFrame({ ...p, w: size.w, h: size.h }, def.minSize, vp)
    first ??= f
    if (fits(f, others)) return { ...f, maximized: false }
    if (++n > 400) break
  }
  return { ...(first ?? clampFrame({ ...fallback }, def.minSize, vp)), maximized: false }
}
