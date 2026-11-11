import { useSyncExternalStore } from 'react'
import { createStore } from './createStore'
import { urlParam } from '../lib/url'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function isHHMM(v: string | null): v is string {
  return v != null && HHMM.test(v)
}

const urlTime = urlParam('time')
const clockStore = createStore<{ override: string | null }>({ override: isHHMM(urlTime) ? urlTime : null })

/** Dev override; `null` (or an invalid string) returns to the real clock. */
export function setClockOverride(value: string | null) {
  clockStore.set({ override: isHHMM(value) ? value : null })
}
export function useClockOverride(): string | null {
  return clockStore.use((s) => s.override)
}

function formatNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* A minute ticker shared by all subscribers; aligned to the minute boundary. */
let current = typeof window === 'undefined' ? '00:00' : formatNow()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

function schedule() {
  const now = new Date()
  const ms = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20
  timer = setTimeout(() => {
    const next = formatNow()
    if (next !== current) {
      current = next
      listeners.forEach((l) => l())
    }
    schedule()
  }, ms)
}

function subscribeMinute(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    current = formatNow()
    schedule()
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}

/** `HH:MM`, 24h. Re-renders once a minute (or when the dev override changes). */
export function useClock(): string {
  const override = useClockOverride()
  const real = useSyncExternalStore(subscribeMinute, () => current, () => current)
  return override ?? real
}
