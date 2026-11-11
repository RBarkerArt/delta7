import { createStore } from './createStore'
import { applyAbsenceDecay, clamp01, floorFor, levelFor, recoveryValue } from './coherenceMath'
import { readJSON, writeJSON } from '../lib/storage'
import { MOCK_DECAY_PER_HOUR } from '../mock/engine'
import type { DecayLevel } from '../types'

/**
 * The single decay value for the Delta7 program (0–1). Only Delta7 reads this; the OS never decays.
 * Published to React at most ~4×/s; `getCoherence()` gives the exact value.
 */
interface CoherenceState {
  coherence: number
  badStretch: boolean
  tunerLocked: boolean
}

interface Persisted {
  c: number
  lastSeen: number
}

const KEY = 'coherence'
const PUBLISH_MS = 250
const PERSIST_MS = 2000
const TICK_MS = 250

// TODO(engine): the real coherence from `CoherenceContext` plugs in here instead of the mocked absence decay.
function loadInitial(): number {
  const saved = readJSON<Partial<Persisted>>(KEY, {})
  const c = typeof saved.c === 'number' && Number.isFinite(saved.c) ? clamp01(saved.c) : 1
  const lastSeen = typeof saved.lastSeen === 'number' ? saved.lastSeen : Date.now()
  const hoursAway = Math.max(0, (Date.now() - lastSeen) / 3_600_000)
  return applyAbsenceDecay(c, hoursAway, floorFor(false), MOCK_DECAY_PER_HOUR)
}

let exact = loadInitial()

export const coherenceStore = createStore<CoherenceState>({
  coherence: exact,
  badStretch: false,
  tunerLocked: false,
})

/* ---------- throttled publish + persist ---------- */

let lastPublish = 0
let publishTimer: ReturnType<typeof setTimeout> | null = null
function publish() {
  const now = Date.now()
  const wait = PUBLISH_MS - (now - lastPublish)
  if (wait <= 0) {
    lastPublish = now
    coherenceStore.set({ coherence: exact })
    return
  }
  if (publishTimer) return
  publishTimer = setTimeout(() => {
    publishTimer = null
    lastPublish = Date.now()
    coherenceStore.set({ coherence: exact })
  }, wait)
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  writeJSON(KEY, { c: exact, lastSeen: Date.now() } satisfies Persisted)
}
function persistSoon() {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    persistNow()
  }, PERSIST_MS)
}

function update(v: number) {
  const next = clamp01(v)
  if (next === exact) return
  exact = next
  publish()
  persistSoon()
}

if (typeof window !== 'undefined') {
  persistNow()
  window.addEventListener('pagehide', persistNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistNow()
  })
}

/* ---------- recovery ticker (while the tuner is locked) ---------- */

let recStart = exact
let recT0 = 0
let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
}
function startTicker() {
  recStart = exact
  recT0 = Date.now()
  if (ticker) return
  ticker = setInterval(() => {
    const v = recoveryValue(recStart, Date.now() - recT0)
    update(v)
    if (v >= 1) stopTicker()
  }, TICK_MS)
}

/* ---------- public API ---------- */

export function getCoherence(): number {
  return exact
}

/** Dev slider: full 0–1 range, no floor. Restarts the recovery curve if the tuner is locked. */
export function setCoherence(v: number) {
  update(v)
  if (coherenceStore.get().tunerLocked) startTicker()
}

/** Lowers the absence floor; also read by the heartbeat. */
export function setBadStretch(on: boolean) {
  coherenceStore.set({ badStretch: on })
}

/** While true, a ~4Hz ticker eases coherence toward 1.0 via recoveryValue. */
export function setTunerLocked(on: boolean) {
  coherenceStore.set({ tunerLocked: on })
  if (on) startTicker()
  else stopTicker()
}

export function useCoherence(): number {
  return coherenceStore.use((s) => s.coherence)
}
export function useDecayLevel(): DecayLevel {
  return coherenceStore.use((s) => levelFor(s.coherence))
}
export function useBadStretch(): boolean {
  return coherenceStore.use((s) => s.badStretch)
}
export function useTunerLocked(): boolean {
  return coherenceStore.use((s) => s.tunerLocked)
}
/** Current absence floor (0.70, or 0.50 in a bad stretch). */
export function getAbsenceFloor(): number {
  return floorFor(coherenceStore.get().badStretch)
}

/** Hook only: future "bleeds" of Delta7 into normal apps. Always 0 for now. TODO(story) */
export const bleedLevel = 0
export function useBleedLevel(): number {
  return bleedLevel
}
