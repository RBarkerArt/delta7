import { mulberry32, hashString } from '../lib/seeded'

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
