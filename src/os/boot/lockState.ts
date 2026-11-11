import { createStore } from '../store/createStore'
import { haptic } from '../store/settings'
import { readJSON, removeKey, writeJSON } from '../lib/storage'
import { urlFlag } from '../lib/url'
import { ASLEEP_HOURS } from '../mock/engine'

/**
 * Boot → lock → unlock → home. `?skipboot=1` starts at `home` (no boot, no lock). `?lock=1` forces the password path.
 * The "only asleep" flag lives in `d7os:session` = `{ asleepAt: ms }`.
 */
export type LockPhase = 'boot' | 'lock' | 'unlocking' | 'home'

interface LockState {
  phase: LockPhase
  /** Lock screen auto-resumes (no password) because the session was only asleep. */
  autoResume: boolean
  /** The shell has been shown at least once (it stays mounted, inert, when re-locked). */
  shellMounted: boolean
}

const SESSION_KEY = 'session'

/** Total length of the boot animation before it hands over to the lock screen (ms). The fade-out follows. */
export const BOOT_MS = 1100
export const BOOT_MS_REDUCED = 260
/** How long the lock screen shows `resuming…` before it unlocks by itself. */
export const RESUME_BEAT_MS = 600
/** Unlock transition length (lock content lifts away, home eases in). */
export const UNLOCK_MS = 620
export const UNLOCK_MS_REDUCED = 220

export const skipBoot: boolean = urlFlag('skipboot')
const forceLock: boolean = urlFlag('lock')

/** Pure: was the session last awake within `hours` of `now`? */
export function isRecentlyAsleep(asleepAt: unknown, now: number, hours = ASLEEP_HOURS): boolean {
  return typeof asleepAt === 'number' && Number.isFinite(asleepAt) && now - asleepAt >= 0 && now - asleepAt < hours * 3_600_000
}

function sessionIsAsleep(): boolean {
  const raw = readJSON<{ asleepAt?: unknown } | null>(SESSION_KEY, null)
  return isRecentlyAsleep(raw?.asleepAt, Date.now())
}

/** Marks the session awake "now" (so a reload within ASLEEP_HOURS resumes without the password). */
export function markSession() {
  writeJSON(SESSION_KEY, { asleepAt: Date.now() })
}

export const lockStore = createStore<LockState>(
  skipBoot
    ? { phase: 'home', autoResume: false, shellMounted: true }
    : { phase: 'boot', autoResume: !forceLock && sessionIsAsleep(), shellMounted: false },
)

export function useLockPhase(): LockPhase {
  return lockStore.use((s) => s.phase)
}
export function useAutoResume(): boolean {
  return lockStore.use((s) => s.autoResume)
}
export function useShellMounted(): boolean {
  return lockStore.use((s) => s.shellMounted)
}
/** True while the home must not react to input (booting, locked, or mid-unlock). */
export function isLocked(): boolean {
  return lockStore.get().phase !== 'home'
}

export function finishBoot() {
  lockStore.set((s) => (s.phase === 'boot' ? { phase: 'lock' } : {}))
}

/** Any input unlocks — the password is not checked. TODO(auth): this becomes the Firebase login later. */
export function unlock() {
  if (lockStore.get().phase !== 'lock') return
  markSession()
  haptic()
  lockStore.set({ phase: 'unlocking', shellMounted: true })
}

export function finishUnlock() {
  lockStore.set((s) => (s.phase === 'unlocking' ? { phase: 'home' } : {}))
}

/** Dev: forget the "only asleep" flag and lock again (password path). */
export function relock() {
  removeKey(SESSION_KEY)
  haptic()
  lockStore.set({ phase: 'lock', autoResume: false })
}

/* Keep the "only asleep" flag fresh while the home is in use (tab hidden, page closed). Not with ?skipboot. */
if (typeof window !== 'undefined' && !skipBoot) {
  const refresh = () => {
    if (lockStore.get().phase === 'home') markSession()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') refresh()
  })
  window.addEventListener('pagehide', refresh)
}
