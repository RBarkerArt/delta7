import { createStore } from './createStore'

export interface OSNotification {
  id: number
  text: string
}

interface SignalState {
  /** Drives the Delta7 icon heartbeat. */
  hasNew: boolean
  notification: OSNotification | null
  /** Bumped by triggerPulse so the heartbeat can restart its cycle. */
  pulseNonce: number
}

// Phase 1: hasNew starts true so the heartbeat is visible on first load. Opening Delta7 clears it.
export const signalStore = createStore<SignalState>({ hasNew: true, notification: null, pulseNonce: 0 })

let nextId = 1

export function useHasNew(): boolean {
  return signalStore.use((s) => s.hasNew)
}
export function usePulseNonce(): number {
  return signalStore.use((s) => s.pulseNonce)
}
export function triggerPulse() {
  signalStore.set((s) => ({ hasNew: true, pulseNonce: s.pulseNonce + 1 }))
}
export function clearNew() {
  signalStore.set({ hasNew: false })
}
export function useNotification(): OSNotification | null {
  return signalStore.use((s) => s.notification)
}
/** In-OS banner only — never the browser Notification API. */
export function showNotification() {
  // TODO(copy): notification text is placeholder.
  signalStore.set((s) => ({
    notification: { id: nextId++, text: 'Signal detected · 1.4? MHz' },
    hasNew: true,
    pulseNonce: s.pulseNonce + 1,
  }))
}
export function dismissNotification() {
  signalStore.set({ notification: null })
}
