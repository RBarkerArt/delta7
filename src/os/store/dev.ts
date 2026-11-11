import { createStore } from './createStore'
import { urlFlag } from '../lib/url'
import { MOCK_DAY } from '../mock/engine'

const fromUrl = urlFlag('dev')

/** Dev tools are available in `vite dev`, or anywhere with `?dev=1`. Never in prod without the param. */
export const devEnabled: boolean = fromUrl || import.meta.env.DEV

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
