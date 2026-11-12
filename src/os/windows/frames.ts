// Desktop window geometry: bounds, clamping, rubber-banding, cascade, and per-app persistence. Pure helpers only.
import { readJSON, removeKey, writeJSON } from '../lib/storage'
import type { AppDefinition, AppId } from '../types'

export interface Frame {
  x: number
  y: number
  w: number
  h: number
}

export interface SavedFrame extends Frame {
  maximized: boolean
}

export interface Viewport {
  w: number
  h: number
}

/** Height of the desktop top bar; windows never go under it. */
export const TOP_INSET = 64
/** Breathing room kept between a window and the viewport edges. */
export const EDGE = 8
/** Maximized windows keep a hair of wallpaper around them. */
export const MAX_GAP = 6
const CASCADE_STEP = 30

export function viewport(): Viewport {
  return { w: window.innerWidth, h: window.innerHeight }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Allowed top-left range for a window of the given size. */
export function bounds(w: number, h: number, vp: Viewport) {
  const minX = EDGE
  const minY = TOP_INSET
  return {
    minX,
    minY,
    maxX: Math.max(minX, vp.w - w - EDGE),
    maxY: Math.max(minY, vp.h - h - EDGE),
  }
}

/** Largest size a window may have in this viewport. */
export function maxSize(vp: Viewport) {
  return { w: Math.max(200, vp.w - EDGE * 2), h: Math.max(160, vp.h - TOP_INSET - EDGE) }
}

/** Size first (never larger than the viewport, never smaller than min), then position inside bounds. */
export function clampFrame(f: Frame, min: { w: number; h: number }, vp: Viewport): Frame {
  const max = maxSize(vp)
  const w = clamp(f.w, Math.min(min.w, max.w), max.w)
  const h = clamp(f.h, Math.min(min.h, max.h), max.h)
  const b = bounds(w, h, vp)
  return { w, h, x: clamp(f.x, b.minX, b.maxX), y: clamp(f.y, b.minY, b.maxY) }
}

export function maximizedFrame(vp: Viewport): Frame {
  return { x: MAX_GAP, y: TOP_INSET, w: vp.w - MAX_GAP * 2, h: vp.h - TOP_INSET - MAX_GAP }
}

/** Soft resistance past an edge: follows 1:1 at first, then flattens out (never more than ~`limit` px). */
export function rubber(overshoot: number, limit = 140): number {
  const sign = Math.sign(overshoot)
  const o = Math.abs(overshoot)
  return sign * (limit * (1 - 1 / ((o * 0.55) / limit + 1)))
}

/** Position with rubber-banding outside [lo, hi]. */
export function rubberClamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo + rubber(v - lo)
  if (v > hi) return hi + rubber(v - hi)
  return v
}

/* ---------- persistence: d7os:win:<id> ---------- */

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function loadFrame(id: AppId): SavedFrame | null {
  const raw = readJSON<Partial<SavedFrame> | null>(`win:${id}`, null)
  if (!raw || !isFiniteNum(raw.x) || !isFiniteNum(raw.y) || !isFiniteNum(raw.w) || !isFiniteNum(raw.h)) return null
  return { x: raw.x, y: raw.y, w: raw.w, h: raw.h, maximized: raw.maximized === true }
}

/** The `memories` app is now `gallery` (its remembered frame moves with it) and `find` is gone. Runs once per load. */
function migrateRenamedFrames() {
  const old = readJSON<unknown>('win:memories', null)
  if (old != null && readJSON<unknown>('win:gallery', null) == null) writeJSON('win:gallery', old)
  removeKey('win:memories')
  removeKey('win:find')
}
if (typeof window !== 'undefined') migrateRenamedFrames()

export function saveFrame(id: AppId, f: SavedFrame) {
  writeJSON(`win:${id}`, {
    x: Math.round(f.x),
    y: Math.round(f.y),
    w: Math.round(f.w),
    h: Math.round(f.h),
    maximized: f.maximized,
  })
}

/** Where a window opens: its remembered frame if any, else centred with a cascade offset so windows don't stack exactly. */
export function initialFrame(def: AppDefinition, cascadeIndex: number, vp: Viewport): SavedFrame {
  const saved = loadFrame(def.id)
  if (saved) return { ...clampFrame(saved, def.minSize, vp), maximized: saved.maximized }
  const max = maxSize(vp)
  const w = Math.min(def.defaultSize.w, max.w)
  const h = Math.min(def.defaultSize.h, max.h - 40)
  const step = (cascadeIndex % 6) * CASCADE_STEP
  const cx = (vp.w - w) / 2 - 2.5 * CASCADE_STEP + step
  const cy = TOP_INSET + (vp.h - TOP_INSET - h) / 2 - 2 * CASCADE_STEP + step
  return { ...clampFrame({ x: cx, y: cy, w, h }, def.minSize, vp), maximized: false }
}
