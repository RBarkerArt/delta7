import { mulberry32, hashString } from '../lib/seeded.ts'
import {
  BAD_STRETCH_HOLD_MS,
  CLARITY_CLEAR,
  CLARITY_CLEARER,
  CLARITY_CORE_SIGMA,
  CLARITY_FAINT,
  CLARITY_WIDE_SIGMA,
  CLARITY_WIDE_WEIGHT,
  FREQ_MAX,
  FREQ_MIN,
  HOLD_MS,
  LOCK_WINDOW,
  NOTCH_RANGE,
  SIGNAL_TARGET,
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
  SIGNAL_TARGET,
  START_VALUE,
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

/**
 * How clear the signal is at `value`, 0..1: exactly 1 at the target, smooth and symmetric, a faint wide shoulder plus
 * a narrow core (see signalConfig). The ONE source for every soft hint: the trace, the audio, the icon's heartbeat,
 * the screen-reader words and the message line.
 */
export function clarity(value: number): number {
  const d = value - SIGNAL_TARGET
  const wide = Math.exp(-((d / CLARITY_WIDE_SIGMA) ** 2))
  const core = Math.exp(-((d / CLARITY_CORE_SIGMA) ** 2))
  return CLARITY_WIDE_WEIGHT * wide + (1 - CLARITY_WIDE_WEIGHT) * core
}

/** Kept for existing callers: lock strength IS clarity. */
export const lockStrength = clarity

export type ClarityBucket = 'none' | 'faint' | 'clearer' | 'clear' | 'locked'

/** Coarse clarity, for words. Never says which way to go. */
export function clarityBucket(c: number, locked: boolean): ClarityBucket {
  if (locked) return 'locked'
  if (c >= CLARITY_CLEAR) return 'clear'
  if (c >= CLARITY_CLEARER) return 'clearer'
  if (c >= CLARITY_FAINT) return 'faint'
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
  return Math.abs(value - SIGNAL_TARGET) <= LOCK_WINDOW + 1e-9
}

/**
 * Sticky notch around the target for pointer / wheel input: `raw` is where the hand is, the return value is
 * the tuned frequency. Inside ±NOTCH_RANGE the frequency moves quadratically slower near the centre, so
 * the lock window is ~2.4× wider for the hand. Continuous at the edges; identity outside.
 */
export function notch(raw: number): number {
  const d = raw - SIGNAL_TARGET
  const a = Math.abs(d)
  if (a >= NOTCH_RANGE) return raw
  return SIGNAL_TARGET + Math.sign(d) * NOTCH_RANGE * (a / NOTCH_RANGE) ** 2
}

/** Inverse of notch(): the hand position that produces `value`. */
export function unnotch(value: number): number {
  const d = value - SIGNAL_TARGET
  const a = Math.abs(d)
  if (a >= NOTCH_RANGE) return value
  return SIGNAL_TARGET + Math.sign(d) * NOTCH_RANGE * Math.sqrt(a / NOTCH_RANGE)
}

export type Decode = 'none' | 'partial' | 'clear'

export function decodeState(strength: number, locked: boolean): Decode {
  if (locked) return 'clear'
  return strength < 0.3 ? 'none' : 'partial'
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
