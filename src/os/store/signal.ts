import { createStore } from './createStore'

export interface OSNotification {
  id: number
  text: string
}

interface SignalState {
  /** Drives the Delta7 icon heartbeat. */
  hasNew: boolean
  notification: OSNotification | null
  /**
   * Bumped to ask for a beat right away: restarts a running heartbeat's cycle, or (heartbeat idle) plays one single
   * beat. Bumped by triggerPulse, showNotification and showHeldNotification.
   */
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
/**
 * The banner texts, all in one place. None ever carries a digit or a partial frequency, before or after the first
 * lock: the dial is the only place the player reads numbers.
 * - `NOTIFICATION_TEXT`: the "something on the dial" banner. Keep the `Signal detected` prefix (scripts look for it). TODO(copy)
 * - `HELD_NOTIFICATION_TEXT`: shown once, the first time ever the signal locks (owner's copy).
 */
export const NOTIFICATION_TEXT = 'Signal detected · something on the dial'
export const HELD_NOTIFICATION_TEXT = 'delta7: signal held.'

/** In-OS banner only — never the browser Notification API. Wakes the Delta7 icon's heartbeat. */
export function showNotification() {
  signalStore.set((s) => ({
    notification: { id: nextId++, text: NOTIFICATION_TEXT },
    hasNew: true,
    pulseNonce: s.pulseNonce + 1,
  }))
}

/**
 * The quiet first-lock banner (same in-OS banner, other text). It gives the Delta7 icon exactly one soft beat (the
 * pulse nonce) but leaves `hasNew` as it is, so no continuous heartbeat starts (the lock itself already steadies it).
 */
export function showHeldNotification() {
  signalStore.set((s) => ({ notification: { id: nextId++, text: HELD_NOTIFICATION_TEXT }, pulseNonce: s.pulseNonce + 1 }))
}
export function dismissNotification() {
  signalStore.set({ notification: null })
}
