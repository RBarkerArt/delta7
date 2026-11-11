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
