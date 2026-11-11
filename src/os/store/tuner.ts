import { createStore } from './createStore'
import { setTunerLocked } from './coherence'
import { haptic } from './settings'
import { HOLD_MS, TARGET, clampFreq, isInLockWindow, roundFreq } from '../tuner/tunerMath'

/**
 * Tuner state, shared by every mounted tuner (the tuner app and Delta7's tuner view).
 * Module-level on purpose: the lock keeps holding while the window is closed or minimised.
 */
export type Transport = 'stopped' | 'playing' | 'paused'

interface TunerState {
  value: number
  locked: boolean
  /** In the lock window and counting towards the lock. */
  holding: boolean
  /** Date.now() when the current hold started (0 when not holding). */
  holdSince: number
  transport: Transport
  /** Bumped on every lock, so the readout / lock icon can play their small bounce. */
  lockNonce: number
}

// TODO(engine): the starting frequency could come from the day script later.
export const tunerStore = createStore<TunerState>({
  value: 1.1,
  locked: false,
  holding: false,
  holdSince: 0,
  transport: 'stopped',
  lockNonce: 0,
})

let holdTimer: ReturnType<typeof setTimeout> | null = null
/** After Stop the lock stays released until the next tuning input (or Play). */
let armed = true

function clearHold() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
}

function lock() {
  clearHold()
  tunerStore.set((s) => ({ value: TARGET, locked: true, holding: false, holdSince: 0, lockNonce: s.lockNonce + 1 }))
  setTunerLocked(true)
  haptic(8)
}

function unlock() {
  clearHold()
  tunerStore.set({ locked: false, holding: false, holdSince: 0 })
  setTunerLocked(false)
}

/** Runs after every value change: start / cancel the hold, or release the lock. */
function evaluate() {
  const s = tunerStore.get()
  const inWindow = isInLockWindow(s.value)
  if (s.locked) {
    if (!inWindow) unlock()
    return
  }
  if (inWindow && armed) {
    if (s.holding) return
    tunerStore.set({ holding: true, holdSince: Date.now() })
    clearHold()
    holdTimer = setTimeout(() => {
      holdTimer = null
      const now = tunerStore.get()
      if (!now.locked && armed && isInLockWindow(now.value)) lock()
    }, HOLD_MS)
  } else if (s.holding) {
    clearHold()
    tunerStore.set({ holding: false, holdSince: 0 })
  }
}

function apply(v: number) {
  tunerStore.set({ value: clampFreq(roundFreq(v)) })
  evaluate()
}

/* ---------- glide (magnet / tap-to-tune), one rAF tween at a time ---------- */

let glideRaf = 0

export function cancelGlide() {
  if (glideRaf) cancelAnimationFrame(glideRaf)
  glideRaf = 0
}

/** Eases the value to `target` (ease-out cubic). New input cancels it. */
export function glideTo(target: number, ms = 420) {
  cancelGlide()
  armed = true
  const from = tunerStore.get().value
  const to = clampFreq(target)
  if (Math.abs(to - from) < 1e-4) {
    apply(to)
    return
  }
  const t0 = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    const e = 1 - Math.pow(1 - t, 3)
    apply(from + (to - from) * e)
    glideRaf = t < 1 ? requestAnimationFrame(step) : 0
  }
  glideRaf = requestAnimationFrame(step)
}

/* ---------- public API ---------- */

export function getTuner(): TunerState {
  return tunerStore.get()
}

/** Direct tuning input (drag, wheel, keyboard). Cancels any glide and re-arms the lock after Stop. */
export function setTunerValue(v: number) {
  cancelGlide()
  armed = true
  apply(v)
}

export function nudgeTuner(delta: number) {
  setTunerValue(tunerStore.get().value + delta)
}

export function playTuner() {
  armed = true
  tunerStore.set({ transport: 'playing' })
  evaluate()
}

export function pauseTuner() {
  tunerStore.set({ transport: 'paused' })
}

/** Releases the lock and silences. Tuning again (or Play) re-arms the lock. */
export function stopTuner() {
  cancelGlide()
  armed = false
  if (tunerStore.get().locked) unlock()
  else evaluate()
  tunerStore.set({ transport: 'stopped' })
}

export function useTunerValue(): number {
  return tunerStore.use((s) => s.value)
}
export function useTunerLock(): boolean {
  return tunerStore.use((s) => s.locked)
}
export function useTunerHolding(): boolean {
  return tunerStore.use((s) => s.holding)
}
export function useTunerHoldSince(): number {
  return tunerStore.use((s) => s.holdSince)
}
export function useTransport(): Transport {
  return tunerStore.use((s) => s.transport)
}
export function useLockNonce(): number {
  return tunerStore.use((s) => s.lockNonce)
}
