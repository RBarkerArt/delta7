import { createStore } from './createStore'
import { clearNew } from './signal'
import type { AppId, AppParams } from '../types'

export interface OpenApp {
  id: AppId
  params?: AppParams
  minimized: boolean
  z: number
  openedAt: number
}

interface WindowsState {
  apps: OpenApp[]
  /** Top-most non-minimized app, or null. */
  focusedId: AppId | null
}

export const windowsStore = createStore<WindowsState>({ apps: [], focusedId: null })

let zCounter = 1

function topVisible(apps: OpenApp[]): AppId | null {
  let best: OpenApp | null = null
  for (const a of apps) if (!a.minimized && (!best || a.z > best.z)) best = a
  return best ? best.id : null
}

export function useOpenApps(): OpenApp[] {
  return windowsStore.use((s) => s.apps)
}
export function useIsOpen(id: AppId): boolean {
  return windowsStore.use((s) => s.apps.some((a) => a.id === id))
}
export function useFocusedAppId(): AppId | null {
  return windowsStore.use((s) => s.focusedId)
}
export function getOpenApps(): OpenApp[] {
  return windowsStore.get().apps
}
export function getFocusedAppId(): AppId | null {
  return windowsStore.get().focusedId
}

/** Open apps, most recently focused first (what a future mobile app switcher would show). */
export function sortByRecency(apps: OpenApp[]): OpenApp[] {
  return [...apps].sort((a, b) => b.z - a.z)
}

/** Opens the app, or if already open: un-minimizes, focuses, and replaces params. */
export function openApp(id: AppId, params?: AppParams) {
  if (id === 'delta7') clearNew()
  const z = ++zCounter
  windowsStore.set((s) => {
    const existing = s.apps.find((a) => a.id === id)
    const apps = existing
      ? s.apps.map((a) => (a.id === id ? { ...a, params, minimized: false, z } : a))
      : [...s.apps, { id, params, minimized: false, z, openedAt: Date.now() }]
    return { apps, focusedId: id }
  })
}

export function closeApp(id: AppId) {
  windowsStore.set((s) => {
    const apps = s.apps.filter((a) => a.id !== id)
    return { apps, focusedId: topVisible(apps) }
  })
}

export function focusApp(id: AppId) {
  const s = windowsStore.get()
  const app = s.apps.find((a) => a.id === id)
  if (!app || (s.focusedId === id && !app.minimized)) return
  const z = ++zCounter
  windowsStore.set((st) => ({
    apps: st.apps.map((a) => (a.id === id ? { ...a, minimized: false, z } : a)),
    focusedId: id,
  }))
}

export function minimizeApp(id: AppId) {
  windowsStore.set((s) => {
    const apps = s.apps.map((a) => (a.id === id ? { ...a, minimized: true } : a))
    return { apps, focusedId: topVisible(apps) }
  })
}

/** Mobile: only one app is in front; every other open app is backgrounded (kept open, minimized). */
export function backgroundAllExcept(id: AppId) {
  windowsStore.set((s) => {
    if (!s.apps.some((a) => a.id !== id && !a.minimized)) return {}
    return { apps: s.apps.map((a) => (a.id === id || a.minimized ? a : { ...a, minimized: true })) }
  })
}

/** Brings the bottom-most visible window to the front, so repeated calls cycle through all of them. */
export function cycleFocus() {
  const visible = windowsStore.get().apps.filter((a) => !a.minimized)
  if (visible.length < 2) return
  const lowest = visible.reduce((lo, a) => (a.z < lo.z ? a : lo))
  focusApp(lowest.id)
}

/* ---------- icon rects (launch / close animation origin) ---------- */

const iconEls = new Map<AppId, HTMLElement>()

/** AppIcon registers its tile element here (pass null on unmount). */
export function registerIconEl(id: AppId, el: HTMLElement | null) {
  if (el) iconEls.set(id, el)
  else iconEls.delete(id)
}

export function getIconRect(id: AppId): DOMRect | null {
  const el = iconEls.get(id)
  return el && el.isConnected ? el.getBoundingClientRect() : null
}

/**
 * The icon's rect only if the user can actually see it right now: mounted, on the current home page (not inside an
 * `inert` page), and inside the viewport. Otherwise null, and launch/close animations fall back to a centre fade.
 */
export function getVisibleIconRect(id: AppId): DOMRect | null {
  const el = iconEls.get(id)
  if (!el || !el.isConnected || el.closest('[inert]')) return null
  const r = el.getBoundingClientRect()
  if (r.width < 4 || r.height < 4) return null
  if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) return null
  return r
}
