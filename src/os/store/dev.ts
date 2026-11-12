import { createStore } from './createStore'
import { urlFlag } from '../lib/url'
import { DEV_MODE } from '../lib/devMode'
import { MOCK_DAY } from '../mock/engine'

/** Dev tools exist only in dev builds (`vite dev`, or a build with `VITE_D7_DEV=1`); `?dev=1` opens the panel there. */
export const devEnabled: boolean = DEV_MODE

const fromUrl = urlFlag('dev')

interface DevState {
  devOpen: boolean
  /** Mocked story day. TODO(engine): CoherenceContext.currentDay */
  day: number
}

export const devStore = createStore<DevState>({ devOpen: fromUrl, day: MOCK_DAY })

export function useDevOpen(): boolean {
  return devStore.use((s) => s.devOpen)
}
export function setDevOpen(open: boolean) {
  if (!devEnabled) return
  devStore.set({ devOpen: open })
}
export function toggleDevOpen() {
  setDevOpen(!devStore.get().devOpen)
}
export function useDay(): number {
  return devStore.use((s) => s.day)
}
export function setDay(day: number) {
  if (!Number.isFinite(day)) return
  devStore.set({ day: Math.max(1, Math.round(day)) })
}
