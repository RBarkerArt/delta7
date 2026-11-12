import { mulberry32, hashString } from '../lib/seeded'

/** Pure tuner helpers: no React, no DOM, deterministic. */

export const FREQ_MIN = 0.8
export const FREQ_MAX = 2.2
export const TARGET = 1.42
/** |value − TARGET| ≤ this counts as "in the lock window". */
export const LOCK_WINDOW = 0.005
/** Time the value must stay in the window before it locks. */
export const HOLD_MS = 1500
/** During a bad stretch the lock takes about twice as long to land. */
export const BAD_STRETCH_HOLD_MS = 3000
/** On release / wheel idle, values this close to TARGET glide into it. */
export const MAGNET_RANGE = 0.02
/** Half-width of the sticky "notch" around TARGET while dragging (see notch()). */
export const NOTCH_RANGE = 0.03
/** While locked, a drag must travel this far (in raw units) before the lock lets go. */
export const LOCKED_DETENT = 0.02

const STRENGTH_SIGMA = 0.1

/** Hold time before the lock lands, for the current mood. */
export function holdMsFor(badStretch: boolean): number {
  return badStretch ? BAD_STRETCH_HOLD_MS : HOLD_MS
}

export function clampFreq(v: number): number {
  return v < FREQ_MIN ? FREQ_MIN : v > FREQ_MAX ? FREQ_MAX : v
}

/** Rounds to 3 decimals so keyboard steps land exactly on 1.42. */
export function roundFreq(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** 0..1, exactly 1 at 1.42, gaussian falloff (≈0.37 at ±0.1, ≈0.002 at ±0.25). */
export function lockStrength(value: number): number {
  const d = (value - TARGET) / STRENGTH_SIGMA
  return Math.exp(-d * d)
}

export function isInLockWindow(value: number): boolean {
  // Small epsilon so 1.415 / 1.425 (float noise) still count.
  return Math.abs(value - TARGET) <= LOCK_WINDOW + 1e-9
}

/**
 * Sticky notch around TARGET for pointer / wheel input: `raw` is where the hand is, the return value is
 * the tuned frequency. Inside ±NOTCH_RANGE the frequency moves quadratically slower near the centre, so
 * the ±0.005 lock window is ~2.4× wider for the hand. Continuous at the edges; identity outside.
 */
export function notch(raw: number): number {
  const d = raw - TARGET
  const a = Math.abs(d)
  if (a >= NOTCH_RANGE) return raw
  return TARGET + Math.sign(d) * NOTCH_RANGE * (a / NOTCH_RANGE) ** 2
}

/** Inverse of notch(): the hand position that produces `value`. */
export function unnotch(value: number): number {
  const d = value - TARGET
  const a = Math.abs(d)
  if (a >= NOTCH_RANGE) return value
  return TARGET + Math.sign(d) * NOTCH_RANGE * Math.sqrt(a / NOTCH_RANGE)
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
