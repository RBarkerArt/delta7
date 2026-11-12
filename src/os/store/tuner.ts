import { createStore } from './createStore'
import { coherenceStore, setTunerLocked } from './coherence'
import { haptic } from './settings'
import { readJSON, removeKey, writeJSON } from '../lib/storage'
import {
  HOLD_MS,
  START_VALUE,
  TARGET,
  clampFreq,
  holdComplete,
  holdMsFor,
  isInLockWindow,
  nextTransport,
  roundFreq,
  transportInputOpen,
} from '../tuner/tunerMath'
import type { Transport } from '../tuner/tunerMath'

/**
 * Tuner state, shared by every mounted tuner (the tuner app and Delta7's tuner view).
 * Module-level on purpose: the lock keeps holding while the window is closed or minimised.
 *
 * Transport: `open` (the tuner starts this way: trace live, input open, silent, no transport button pressed),
 * `playing` (Play tapped: the same, with sound if the Sound setting is on), `paused` (trace frozen, input still open)
 * or `stopped` (lock released, input closed, silent, trace idle). Tuning input re-opens a stopped tuner to `open`
 * (sound needs Play again); Play from anywhere → `playing`.
 */
export type { Transport }

interface TunerState {
  value: number
  locked: boolean
  /** In the lock window and counting towards the lock. */
  holding: boolean
  /** Date.now() when the current hold started (0 when not holding). */
  holdSince: number
  /** Length of the current hold (longer during a bad stretch). */
  holdMs: number
  transport: Transport
  /** Bumped on every lock, so the readout / lock icon can play their small bounce. */
  lockNonce: number
  /** The player has tuned at least once this session. */
  touched: boolean
  /** Tuning input in the last few seconds (the Delta7 icon beats while the dial is being worked). */
  adjusting: boolean
  /** The signal has been found at least once, ever (persisted). Until then the UI never shows the target. */
  everLocked: boolean
}

/* ---------- remembered first find ---------- */

// Stored as `d7os:signal`. TODO(engine): later this comes from the player's saved progress, not local storage.
const SIGNAL_KEY = 'signal'
interface SignalMemory {
  everLocked: boolean
}
function loadEverLocked(): boolean {
  return readJSON<Partial<SignalMemory>>(SIGNAL_KEY, {}).everLocked === true
}

export const tunerStore = createStore<TunerState>({
  value: START_VALUE,
  locked: false,
  holding: false,
  holdSince: 0,
  holdMs: HOLD_MS,
  transport: 'open',
  lockNonce: 0,
  touched: false,
  adjusting: false,
  everLocked: loadEverLocked(),
})

let holdTimer: ReturnType<typeof setTimeout> | null = null

/** Input is open (the lock can be found) unless the tuner is stopped. */
function inputOpen(): boolean {
  return transportInputOpen(tunerStore.get().transport)
}

/** Tuning input re-opens a stopped tuner. */
function reopen() {
  const s = tunerStore.get().transport
  const next = nextTransport(s, 'tune')
  if (next !== s) tunerStore.set({ transport: next })
}

function clearHold() {
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
}

function lock() {
  clearHold()
  if (!tunerStore.get().everLocked) writeJSON(SIGNAL_KEY, { everLocked: true } satisfies SignalMemory)
  tunerStore.set((s) => ({ value: TARGET, locked: true, holding: false, holdSince: 0, lockNonce: s.lockNonce + 1, everLocked: true }))
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
  if (inWindow && inputOpen()) {
    if (s.holding) return
    const holdMs = holdMsFor(coherenceStore.get().badStretch)
    tunerStore.set({ holding: true, holdSince: Date.now(), holdMs })
    clearHold()
    holdTimer = setTimeout(() => {
      holdTimer = null
      const now = tunerStore.get()
      // +5ms: timers and Date.now() can disagree by a tick.
      if (!now.locked && inputOpen() && isInLockWindow(now.value) && holdComplete(now.holdSince, Date.now() + 5, now.holdMs)) lock()
    }, holdMs)
  } else if (s.holding) {
    clearHold()
    tunerStore.set({ holding: false, holdSince: 0 })
  }
}

function apply(v: number) {
  tunerStore.set({ value: clampFreq(roundFreq(v)) })
  evaluate()
}

/* ---------- "being tuned right now" ---------- */

const ADJUSTING_MS = 5000
let adjustTimer: ReturnType<typeof setTimeout> | null = null

function markInput() {
  const s = tunerStore.get()
  if (!s.touched || !s.adjusting) tunerStore.set({ touched: true, adjusting: true })
  if (adjustTimer) clearTimeout(adjustTimer)
  adjustTimer = setTimeout(() => {
    adjustTimer = null
    tunerStore.set({ adjusting: false })
  }, ADJUSTING_MS)
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
  reopen()
  markInput()
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

/** Direct tuning input (drag, wheel, keyboard). Cancels any glide and re-opens input after Stop. */
export function setTunerValue(v: number) {
  cancelGlide()
  reopen()
  markInput()
  apply(v)
}

export function nudgeTuner(delta: number) {
  setTunerValue(tunerStore.get().value + delta)
}

export function playTuner() {
  tunerStore.set((s) => ({ transport: nextTransport(s.transport, 'play') }))
  evaluate()
}

export function pauseTuner() {
  tunerStore.set((s) => ({ transport: nextTransport(s.transport, 'pause') }))
}

/** Releases the lock, closes input and silences. Tuning again re-opens input (silent); Play re-opens and plays. */
export function stopTuner() {
  cancelGlide()
  tunerStore.set((s) => ({ transport: nextTransport(s.transport, 'stop') }))
  if (tunerStore.get().locked) unlock()
  else evaluate()
}

/** Has the signal ever been found? (Non-React read.) */
export function getEverLocked(): boolean {
  return tunerStore.get().everLocked
}

/**
 * Dev only: forget the first find and reset the dial, so the target is hidden again everywhere.
 * Releases any lock and puts the dial back where a new player starts.
 */
export function forgetFirstLock() {
  cancelGlide()
  clearHold()
  removeKey(SIGNAL_KEY)
  const wasLocked = tunerStore.get().locked
  tunerStore.set({
    everLocked: false,
    touched: false,
    value: START_VALUE,
    locked: false,
    holding: false,
    holdSince: 0,
    transport: 'open',
  })
  if (wasLocked) setTunerLocked(false)
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
export function useTunerHoldMs(): number {
  return tunerStore.use((s) => s.holdMs)
}
export function useTransport(): Transport {
  return tunerStore.use((s) => s.transport)
}
export function useLockNonce(): number {
  return tunerStore.use((s) => s.lockNonce)
}
/** True once the player has tuned at least once this session. */
export function useTunerTouched(): boolean {
  return tunerStore.use((s) => s.touched)
}
/** True while the dial has had input in the last few seconds. */
export function useTunerAdjusting(): boolean {
  return tunerStore.use((s) => s.adjusting)
}
/** True once the signal has ever been locked (persisted across reloads). */
export function useEverLocked(): boolean {
  return tunerStore.use((s) => s.everLocked)
}
