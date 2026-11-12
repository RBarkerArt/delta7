import { createStore } from './createStore'
import { readJSON, writeJSON } from '../lib/storage'
import { urlParam } from '../lib/url'

export type WallpaperName = 'haze' | 'dusk' | 'ember' | 'fog'
export const WALLPAPER_NAMES: readonly WallpaperName[] = ['haze', 'dusk', 'ember', 'fog']

export interface Settings {
  wallpaper: WallpaperName
  sound: boolean
  reduceMotion: boolean
  vibrate: boolean
}

const KEY = 'settings'
const DEFAULTS: Settings = { wallpaper: 'haze', sound: true, reduceMotion: false, vibrate: false }

function isWallpaper(v: unknown): v is WallpaperName {
  return typeof v === 'string' && (WALLPAPER_NAMES as readonly string[]).includes(v)
}

function load(): Settings {
  const raw = readJSON<Partial<Settings>>(KEY, {})
  return {
    wallpaper: isWallpaper(raw.wallpaper) ? raw.wallpaper : DEFAULTS.wallpaper,
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULTS.sound,
    reduceMotion: typeof raw.reduceMotion === 'boolean' ? raw.reduceMotion : DEFAULTS.reduceMotion,
    vibrate: typeof raw.vibrate === 'boolean' ? raw.vibrate : DEFAULTS.vibrate,
  }
}

const persisted = load()
// `?wallpaper=<name>` overrides for the session only (handy for screenshots); never persisted.
const urlWallpaper = urlParam('wallpaper')
const initial: Settings = isWallpaper(urlWallpaper) ? { ...persisted, wallpaper: urlWallpaper } : persisted

export const settingsStore = createStore<Settings>(initial)

let saved: Settings = persisted
function persist(patch: Partial<Settings>) {
  saved = { ...saved, ...patch }
  writeJSON(KEY, saved)
}

export function useSettings<S>(selector: (s: Settings) => S): S {
  return settingsStore.use(selector)
}

export function setWallpaper(wallpaper: WallpaperName) {
  settingsStore.set({ wallpaper })
  persist({ wallpaper })
}
export function setSound(sound: boolean) {
  settingsStore.set({ sound })
  persist({ sound })
}
export function setReduceMotion(reduceMotion: boolean) {
  settingsStore.set({ reduceMotion })
  persist({ reduceMotion })
}
export function setVibrate(vibrate: boolean) {
  settingsStore.set({ vibrate })
  persist({ vibrate })
}

/** Optional tiny haptic tick; only when the user enabled it in the menu. */
export function haptic(ms = 8) {
  if (!settingsStore.get().vibrate) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* unsupported */
  }
}
