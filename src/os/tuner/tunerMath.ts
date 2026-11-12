import { mulberry32, hashString } from '../lib/seeded.ts'
import {
  BAD_STRETCH_HOLD_MS,
  CLARITY_AT_CLEAR,
  CLARITY_AT_CLEARER,
  CLARITY_AT_FAINT,
  COARSE_SPEED,
  FINE_GAIN,
  FINE_SPEED,
  FREQ_MAX,
  FREQ_MIN,
  HOLD_MS,
  LOCK_WINDOW,
  NOTCH_POWER,
  PULL_MAX_SPEED,
  PULL_RANGE,
  PX_PER_UNIT_MAX,
  PX_PER_UNIT_MIN,
  PX_PER_UNIT_PER_WIDTH,
  SIGNAL_TARGET,
  ZONE_CLEAR,
  ZONE_CLEARER,
  ZONE_FAINT,
} from './signalConfig.ts'

/** Pure tuner helpers: no React, no DOM, deterministic. All constants live in `signalConfig.ts`. */

export {
  BAD_STRETCH_HOLD_MS,
  FREQ_MAX,
  FREQ_MIN,
  HOLD_MS,
  LOCKED_DETENT,
  LOCK_WINDOW,
  MAGNET_RANGE,
  NOTCH_RANGE,
  PULL_MAX_SPEED,
  PULL_RANGE,
  SIGNAL_TARGET,
  START_VALUE,
  ZONE_CLEAR,
  ZONE_CLEARER,
  ZONE_FAINT,
} from './signalConfig.ts'

/** Kept for existing imports: the same value as SIGNAL_TARGET. */
export const TARGET = SIGNAL_TARGET

/** Hold time before the lock lands, for the current mood. */
export function holdMsFor(badStretch: boolean): number {
  return badStretch ? BAD_STRETCH_HOLD_MS : HOLD_MS
}

/**
 * The hold-timer decision, pure: has a hold that started at `holdSince` lasted long enough to lock at `now`?
 * (The store runs a timeout for `holdMs` and then double-checks with this.)
 */
export function holdComplete(holdSince: number, now: number, holdMs: number): boolean {
  return holdSince > 0 && now - holdSince >= holdMs
}

export function clampFreq(v: number): number {
  return v < FREQ_MIN ? FREQ_MIN : v > FREQ_MAX ? FREQ_MAX : v
}

/** Rounds to 3 decimals so 0.01 keyboard steps land exactly on the target. */
export function roundFreq(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** Tiny tolerance so values that sit exactly on a zone edge (float noise) count as inside it. */
const EDGE_EPS = 1e-9

/**
 * How clear the signal is at `value`, 0..1, by distance from the target and the zones in signalConfig:
 * 0 outside ±ZONE_FAINT (nothing but static), rising quickly once inside it (a perceptible thinning), on through the
 * clearer zone, and smoothly to exactly 1 at the target. Continuous, symmetric, never rising with distance.
 * The ONE source for every soft hint: the trace, the audio, the icon's heartbeat and the message line.
 */
export function clarity(value: number): number {
  const d = Math.abs(value - SIGNAL_TARGET)
  if (d >= ZONE_FAINT) return CLARITY_AT_FAINT
  if (d >= ZONE_CLEARER) {
    // Ease-out: most of the faint zone's rise comes soon after entering it.
    const t = (ZONE_FAINT - d) / (ZONE_FAINT - ZONE_CLEARER)
    return CLARITY_AT_FAINT + (CLARITY_AT_CLEARER - CLARITY_AT_FAINT) * (1 - (1 - t) ** 2)
  }
  if (d >= ZONE_CLEAR) {
    const t = (ZONE_CLEARER - d) / (ZONE_CLEARER - ZONE_CLEAR)
    return CLARITY_AT_CLEARER + (CLARITY_AT_CLEAR - CLARITY_AT_CLEARER) * t
  }
  const u = d / ZONE_CLEAR
  return 1 - (1 - CLARITY_AT_CLEAR) * u * u
}

/** Kept for existing callers: lock strength IS clarity. */
export const lockStrength = clarity

export type ClarityBucket = 'none' | 'faint' | 'clearer' | 'clear' | 'locked'

/** Coarse clarity for words, by distance from the target (switches exactly at the zone edges). Never says which way. */
export function clarityBucket(value: number, locked: boolean): ClarityBucket {
  if (locked) return 'locked'
  const d = Math.abs(value - SIGNAL_TARGET)
  if (d <= ZONE_CLEAR + EDGE_EPS) return 'clear'
  if (d <= ZONE_CLEARER + EDGE_EPS) return 'clearer'
  if (d <= ZONE_FAINT + EDGE_EPS) return 'faint'
  return 'none'
}

const CLARITY_WORDS: Record<ClarityBucket, string> = {
  none: 'no signal',
  faint: 'signal faint',
  clearer: 'signal clearer',
  clear: 'signal clear',
  locked: 'signal locked',
}

/** `signal faint` / `signal clearer` / … for the live region and the slider's aria-valuetext. */
export function clarityWords(bucket: ClarityBucket): string {
  return CLARITY_WORDS[bucket]
}

export function isInLockWindow(value: number): boolean {
  // Small epsilon so the window's exact edges (float noise) still count.
  return Math.abs(value - SIGNAL_TARGET) <= LOCK_WINDOW + EDGE_EPS
}

/**
 * Sticky notch around the target for pointer / wheel input: `raw` is where the hand is, the return value is the
 * tuned frequency. Identity outside ±PULL_RANGE; inside it the frequency moves as (distance / range) ^ NOTCH_POWER,
 * so it slows to a stop at the target and the lock window is a little wider for the hand. Continuous at the edges.
 */
export function notch(raw: number): number {
  const d = raw - SIGNAL_TARGET
  const a = Math.abs(d)
  if (a >= PULL_RANGE) return raw
  return SIGNAL_TARGET + Math.sign(d) * PULL_RANGE * (a / PULL_RANGE) ** NOTCH_POWER
}

/** Inverse of notch(): the hand position that produces `value`. */
export function unnotch(value: number): number {
  const d = value - SIGNAL_TARGET
  const a = Math.abs(d)
  if (a >= PULL_RANGE) return value
  return SIGNAL_TARGET + Math.sign(d) * PULL_RANGE * (a / PULL_RANGE) ** (1 / NOTCH_POWER)
}

/**
 * The magnet decision, pure: where the dial should glide to when the hand lets go (release, wheel idle, a tap).
 * `speed` is the dial's speed at that moment in MHz/s. Only a dial that is within ±PULL_RANGE AND (nearly) at rest
 * goes to the target; anything else stays exactly where it is, so a flick or a quick pass sails past.
 */
export function pullTarget(value: number, speed: number): number {
  if (Math.abs(value - SIGNAL_TARGET) > PULL_RANGE + EDGE_EPS) return value
  if (Math.abs(speed) > PULL_MAX_SPEED) return value
  return SIGNAL_TARGET
}

/**
 * Hand → dial gain from hand speed (px/ms): FINE_GAIN for a slowly inching hand, 1 for a normal drag, linear between.
 * The same everywhere on the dial and in both directions, so it says nothing about where the signal is.
 */
export function fineGain(handSpeed: number): number {
  const v = Math.abs(handSpeed)
  if (v <= FINE_SPEED) return FINE_GAIN
  if (v >= COARSE_SPEED) return 1
  return FINE_GAIN + (1 - FINE_GAIN) * ((v - FINE_SPEED) / (COARSE_SPEED - FINE_SPEED))
}

/** Dial scale (px per MHz) for a tuner card `width` px wide. */
export function pxPerUnitFor(width: number): number {
  return Math.min(PX_PER_UNIT_MAX, Math.max(PX_PER_UNIT_MIN, width * PX_PER_UNIT_PER_WIDTH))
}

export type Decode = 'none' | 'partial' | 'clear'

/** `partial` from the clearer zone in, `clear` only at the lock. */
export function decodeState(strength: number, locked: boolean): Decode {
  if (locked) return 'clear'
  return strength < CLARITY_AT_CLEARER ? 'none' : 'partial'
}

const BLOCK = '▒'
/** The one redaction that never clears. */
const REDACTION = /\[▒+\]/g

/**
 * Message clarity tracks lock strength. Calm and deterministic: strength is quantised to 10 steps and
 * every character / word has a fixed seeded threshold, so the text only ever clears or fogs one step at a
 * time and never flickers between renders. Fully clear (except the `[▒▒▒▒]` block) only at strength 1.
 */
export function degradeMessage(text: string, strength: number, seed: string): string {
  const s = Math.max(0, Math.min(1, strength))
  const step = s >= 1 ? 10 : Math.min(9, Math.floor(s * 10))
  if (step === 10) return text
  const clarity = step / 10 // 0 … 0.9

  // Protect the redaction block(s): they stay exactly as written.
  const keep = new Set<number>()
  for (const m of text.matchAll(REDACTION)) {
    for (let i = m.index; i < m.index + m[0].length; i++) keep.add(i)
  }

  const rand = mulberry32(hashString(seed + '|' + text))
  const chars = [...text]
  // Word drop: far off, roughly a third of the words go missing (left as gaps so the line doesn't jump).
  let i = 0
  while (i < chars.length) {
    if (chars[i] === ' ' || keep.has(i)) {
      i++
      continue
    }
    let j = i
    while (j < chars.length && chars[j] !== ' ' && !keep.has(j)) j++
    const t = rand()
    const dropped = t > 0.62 + clarity * 0.6
    for (let k = i; k < j; k++) {
      const c = rand()
      if (dropped) chars[k] = ' '
      else if (c > 0.12 + clarity * 0.85) chars[k] = BLOCK
    }
    i = j
  }
  return chars.join('')
}
