import type { DecayLevel } from '../types'

/** Pure coherence helpers (unit-testable, no React, no storage). */

export const ABSENCE_FLOOR = 0.7
export const BAD_STRETCH_FLOOR = 0.5
export const RECOVERY_MS = 60_000

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** ≥0.9 stable; ≥0.75 recovering; ≥0.55 fraying; else fragmented. */
export function levelFor(c: number): DecayLevel {
  if (c >= 0.9) return 'stable'
  if (c >= 0.75) return 'recovering'
  if (c >= 0.55) return 'fraying'
  return 'fragmented'
}

/**
 * Decay from being away. Linear at `ratePerHour`, never below `floor`.
 * If the value is already below the floor (dev slider), absence leaves it where it is.
 */
export function applyAbsenceDecay(c: number, hoursAway: number, floor: number, ratePerHour = 0.02): number {
  const start = clamp01(c)
  if (!(hoursAway > 0)) return start
  if (start <= floor) return start
  return Math.max(floor, start - hoursAway * ratePerHour)
}

/** Eases `start` → 1.0 over RECOVERY_MS (cubic ease-out), clamped. */
export function recoveryValue(start: number, elapsedMs: number): number {
  const s = clamp01(start)
  const t = clamp01(elapsedMs / RECOVERY_MS)
  const eased = 1 - Math.pow(1 - t, 3)
  return clamp01(s + (1 - s) * eased)
}

/** Floor for absence decay given the bad-stretch flag. */
export function floorFor(badStretch: boolean): number {
  return badStretch ? BAD_STRETCH_FLOOR : ABSENCE_FLOOR
}
