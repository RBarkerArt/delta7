import { mulberry32, hashString, seededValue } from '../lib/seeded.ts'

/** Heartbeat timing — pure, deterministic. */

export const NORMAL_BPM = 60
export const BAD_STRETCH_BPM = 42

/** Beats per minute for the Delta7 icon heartbeat. */
export function pulseRate(badStretch: boolean): number {
  return badStretch ? BAD_STRETCH_BPM : NORMAL_BPM
}

/** Milliseconds between beats. */
export function pulsePeriodMs(badStretch: boolean): number {
  return 60_000 / pulseRate(badStretch)
}

const CYCLE = 600

/**
 * In a bad stretch, roughly one beat in 5–7 is skipped. Beats are grouped into blocks of 5–7
 * (length from a seeded RNG) and one beat per block is dropped. Same seed + index → same answer.
 */
export function isSkippedBeat(index: number, badStretch: boolean, seed = 'delta7'): boolean {
  if (!badStretch || index < 1) return false
  const i = index % CYCLE
  const rng = mulberry32(hashString(seed))
  let pos = 0
  while (pos <= i) {
    const len = 5 + Math.floor(rng() * 3)
    const skipAt = pos + 1 + Math.floor(rng() * (len - 1))
    if (i < pos + len) return i === skipAt
    pos += len
  }
  return false
}

/* ---------- the beat steadies as the tuner's signal clears ---------- */

/** Most an interval strays from the period when the signal is nowhere (±fraction). */
const MAX_JITTER = 0.2
/** Most often a beat lands as a soft half-beat when the signal is nowhere. */
const MAX_SOFT = 0.22

/**
 * How unsteady the beat is, 0..1, from the tuner's clarity: 1 with no signal, easing to 0 as clarity rises,
 * exactly 0 while locked.
 */
export function beatIrregularity(clarity: number, locked: boolean): number {
  if (locked) return 0
  const c = clarity < 0 ? 0 : clarity > 1 ? 1 : clarity
  return (1 - c) ** 1.5
}

/** Wait before the beat after beat `index`: the period, stretched or shortened by a seeded amount × irregularity. */
export function beatIntervalMs(index: number, periodMs: number, irregularity: number, seed = 'delta7'): number {
  const r = seededValue(`${seed}:beat:${index}`) * 2 - 1
  return periodMs * (1 + MAX_JITTER * irregularity * r)
}

/** The odd soft half-beat (just a faint "lub"). Never while steady. */
export function isSoftBeat(index: number, irregularity: number, seed = 'delta7'): boolean {
  return irregularity > 0 && seededValue(`${seed}:soft:${index}`) < MAX_SOFT * irregularity
}
