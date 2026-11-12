import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BAD_STRETCH_HOLD_MS,
  FREQ_MAX,
  FREQ_MIN,
  HOLD_MS,
  LOCK_WINDOW,
  PULL_MAX_SPEED,
  PULL_RANGE,
  SIGNAL_TARGET,
  START_VALUE,
  ZONE_CLEAR,
  ZONE_CLEARER,
  ZONE_FAINT,
} from './signalConfig.ts'
import {
  clarity,
  clarityBucket,
  clarityWords,
  degradeMessage,
  fineGain,
  holdComplete,
  holdMsFor,
  isInLockWindow,
  lockStrength,
  needleColor,
  needleTint,
  notch,
  pullTarget,
  roundFreq,
  stepOnGrid,
  unnotch,
  WHEEL_NOTCH_STEP,
  wheelNotches,
  nextTransport,
  transportAudible,
  transportInputOpen,
} from './tunerMath.ts'
import type { Transport } from './tunerMath.ts'

const T = SIGNAL_TARGET

test('clarity and lockStrength peak at the target and fall off symmetrically', () => {
  assert.equal(clarity(T), 1)
  assert.equal(lockStrength(T), 1)
  for (const d of [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.3]) {
    const lo = clarity(T - d)
    const hi = clarity(T + d)
    assert.ok(Math.abs(lo - hi) < 1e-12, `asymmetric at ±${d}`)
    assert.ok(lo < 1 && lo >= 0)
    assert.equal(lockStrength(T + d), hi)
  }
})

test('clarity: monotonic toward the target, strictly rising inside the faint zone, ≈0 outside it', () => {
  for (const sign of [-1, 1]) {
    let prev = 1
    for (let d = 0.0005; d < 0.8; d += 0.0005) {
      const c = clarity(T + sign * d)
      assert.ok(c <= prev + 1e-12, `rises with distance at ${sign * d}`)
      if (d < ZONE_FAINT - 1e-6) assert.ok(c < prev, `flat inside the faint zone at ${sign * d}`)
      prev = c
    }
  }
  for (const d of [ZONE_FAINT + 0.001, 0.1, 0.2, 0.3]) {
    assert.ok(clarity(T + d) < 0.01, `not ≈0 at +${d}`)
    assert.ok(clarity(T - d) < 0.01, `not ≈0 at -${d}`)
  }
  assert.equal(clarity(FREQ_MIN), 0)
  assert.equal(clarity(FREQ_MAX), 0)
  // Rising through the zones: each zone is clearly more than the last, and continuous at the edges.
  assert.ok(clarity(T + ZONE_FAINT - 0.005) > 0.05, 'entering the faint zone is perceptible')
  assert.ok(clarity(T + ZONE_CLEARER) > clarity(T + ZONE_FAINT - 0.005))
  assert.ok(clarity(T + ZONE_CLEAR) > clarity(T + ZONE_CLEARER))
  for (const edge of [ZONE_FAINT, ZONE_CLEARER, ZONE_CLEAR]) {
    assert.ok(Math.abs(clarity(T + edge - 1e-7) - clarity(T + edge + 1e-7)) < 1e-4, `jump at ${edge}`)
  }
})

test('clarity buckets switch exactly at ±0.08 / ±0.03 / ±0.01, both sides; locked only at the lock', () => {
  assert.equal(ZONE_FAINT, 0.08)
  assert.equal(ZONE_CLEARER, 0.03)
  assert.equal(ZONE_CLEAR, 0.01)
  const cases: [number, string, string][] = [
    [ZONE_FAINT, 'faint', 'none'],
    [ZONE_CLEARER, 'clearer', 'faint'],
    [ZONE_CLEAR, 'clear', 'clearer'],
  ]
  for (const [edge, inside, outside] of cases) {
    for (const sign of [-1, 1]) {
      assert.equal(clarityBucket(roundFreq(T + sign * edge), false), inside, `at ${sign}·${edge}`)
      assert.equal(clarityBucket(roundFreq(T + sign * (edge - 0.001)), false), inside, `just inside ${sign}·${edge}`)
      assert.equal(clarityBucket(roundFreq(T + sign * (edge + 0.001)), false), outside, `just outside ${sign}·${edge}`)
    }
  }
  assert.equal(clarityBucket(T, false), 'clear')
  assert.equal(clarityBucket(T + 0.3, true), 'locked')
  assert.equal(clarityBucket(FREQ_MIN, false), 'none')
  // A keyboard sweep from the low end: none until 0.08 away, then faint, clearer at 0.03, clear at 0.01.
  const seen: [string, number][] = []
  for (let v = FREQ_MIN; v <= T + 1e-9; v = roundFreq(v + 0.01)) {
    const b = clarityBucket(v, false)
    if (seen.length === 0 || seen[seen.length - 1][0] !== b) seen.push([b, roundFreq(T - v)])
  }
  assert.deepEqual(seen, [
    ['none', roundFreq(T - FREQ_MIN)],
    ['faint', ZONE_FAINT],
    ['clearer', ZONE_CLEARER],
    ['clear', ZONE_CLEAR],
  ])
  assert.equal(clarityWords('faint'), 'signal faint')
  assert.equal(clarityWords('locked'), 'signal locked')
  for (const b of ['none', 'faint', 'clearer', 'clear', 'locked'] as const) {
    assert.doesNotMatch(clarityWords(b), /up|down|higher|lower|left|right|warm|cold/)
  }
})

test('keyboard steps of 0.01 land exactly on the target', () => {
  let v = FREQ_MIN
  let hit = false
  for (let i = 0; i < 200 && v <= FREQ_MAX; i++) {
    if (v === roundFreq(T)) hit = true
    v = roundFreq(v + 0.01)
  }
  assert.ok(hit)
})

test('keyboard steps snap to a fixed grid, so keys can land on the target after any drag', () => {
  // from an off-grid value left by a drag, one step lands on the next round value in that direction
  assert.equal(stepOnGrid(1.174, 0.01, 1), 1.18)
  assert.equal(stepOnGrid(1.174, 0.01, -1), 1.17)
  // on-grid values move one whole step
  assert.equal(stepOnGrid(1.18, 0.01, 1), 1.19)
  assert.equal(stepOnGrid(1.18, 0.01, -1), 1.17)
  // from just beside the target, a single step lands exactly on it, from either side
  assert.equal(stepOnGrid(roundFreq(T - 0.006), 0.01, 1), roundFreq(T))
  assert.equal(stepOnGrid(roundFreq(T + 0.004), 0.01, -1), roundFreq(T))
  // stays inside the band
  assert.equal(stepOnGrid(FREQ_MAX, 0.01, 1), FREQ_MAX)
  assert.equal(stepOnGrid(FREQ_MIN, 0.01, -1), FREQ_MIN)
})

test('isInLockWindow edges', () => {
  assert.ok(isInLockWindow(T))
  assert.ok(isInLockWindow(roundFreq(T + LOCK_WINDOW)))
  assert.ok(isInLockWindow(roundFreq(T - LOCK_WINDOW)))
  assert.ok(!isInLockWindow(roundFreq(T + LOCK_WINDOW + 0.001)))
  assert.ok(!isInLockWindow(roundFreq(T - LOCK_WINDOW - 0.001)))
})

test('hold timing: ≈1.5s normally, ≈3s in a bad stretch', () => {
  assert.equal(holdMsFor(false), HOLD_MS)
  assert.equal(holdMsFor(true), BAD_STRETCH_HOLD_MS)
  assert.ok(Math.abs(HOLD_MS - 1500) <= 250)
  assert.ok(Math.abs(BAD_STRETCH_HOLD_MS - 2 * HOLD_MS) <= 500)
  const t0 = 10_000
  assert.ok(!holdComplete(t0, t0 + HOLD_MS - 1, holdMsFor(false)))
  assert.ok(holdComplete(t0, t0 + HOLD_MS, holdMsFor(false)))
  assert.ok(!holdComplete(t0, t0 + HOLD_MS, holdMsFor(true)))
  assert.ok(holdComplete(t0, t0 + BAD_STRETCH_HOLD_MS, holdMsFor(true)))
  assert.ok(!holdComplete(0, t0, HOLD_MS), 'no hold running')
})

test('notch and unnotch are inverses, leave the target fixed, and are identity outside the pull range', () => {
  assert.equal(notch(T), T)
  for (const d of [-0.0095, -0.007, -0.004, -0.001, 0.003, 0.0079, 0.0099]) {
    const v = notch(T + d)
    assert.ok(Math.abs(unnotch(v) - (T + d)) < 1e-9)
    assert.ok(Math.abs(v - T) < Math.abs(d), 'slows towards the target inside the range')
  }
  for (const d of [PULL_RANGE, PULL_RANGE + 0.0001, 0.02, 0.03, 0.08, 0.3]) {
    assert.equal(notch(T + d), T + d, `notch tugs at +${d}`)
    assert.equal(notch(T - d), T - d, `notch tugs at -${d}`)
    assert.equal(unnotch(T + d), T + d)
  }
  // The lock window is still a little wider for the hand than for the dial, never wider than the pull range.
  const handWindow = unnotch(T + LOCK_WINDOW) - T
  assert.ok(handWindow > LOCK_WINDOW && handWindow <= PULL_RANGE)
})

test('the pull range IS the clear zone', () => {
  assert.equal(PULL_RANGE, ZONE_CLEAR)
  // Everywhere the signal reads "clear" (both sides) a calm hand is drawn in; one grid step further out it is not.
  for (const sign of [-1, 1]) {
    for (let d = 0; d <= ZONE_CLEAR + 1e-9; d = roundFreq(d + 0.001)) {
      const v = roundFreq(T + sign * d)
      assert.equal(clarityBucket(v, false), 'clear')
      assert.equal(pullTarget(v, 0), T, `clear but not pulled at ${sign * d}`)
    }
    const out = roundFreq(T + sign * (ZONE_CLEAR + 0.001))
    assert.equal(clarityBucket(out, false), 'clearer')
    assert.equal(pullTarget(out, 0), out)
  }
})

test('pullTarget: no assist outside ±PULL_RANGE, and only for a calm dial inside it', () => {
  for (const d of [PULL_RANGE + 0.001, 0.012, 0.02, 0.05, 0.3]) {
    for (const sign of [-1, 1]) {
      const v = roundFreq(T + sign * d)
      assert.equal(pullTarget(v, 0), v, `pulled from ${sign * d}`)
    }
  }
  for (const d of [0, 0.001, 0.005, 0.007, 0.009, PULL_RANGE]) {
    for (const sign of [-1, 1]) assert.equal(pullTarget(roundFreq(T + sign * d), 0), T, `not pulled at ${sign * d} at rest`)
  }
  // A slow, deliberate release inside the range is taken; a fast pass through it is not.
  assert.equal(pullTarget(T + 0.006, PULL_MAX_SPEED * 0.5), T)
  assert.equal(pullTarget(T - 0.003, -PULL_MAX_SPEED * 0.9), T)
  assert.equal(pullTarget(roundFreq(T + PULL_RANGE), PULL_MAX_SPEED * 0.5), T, 'a slow drag at the clear edge is drawn in')
  for (const speed of [PULL_MAX_SPEED * 1.5, 0.5, 2, -3]) {
    assert.equal(pullTarget(T + 0.002, speed), T + 0.002, `captured at ${speed} MHz/s`)
  }
})

test('a fast pass through the pull range is not captured, a slow one is', () => {
  // Simulate the hand crossing the range at a constant speed and letting go wherever it is inside it.
  const pass = (speed: number) => {
    const out: { value: number; to: number }[] = []
    for (let x = -PULL_RANGE; x <= PULL_RANGE + 1e-9; x += PULL_RANGE / 8) {
      const value = roundFreq(notch(T + x))
      out.push({ value, to: pullTarget(value, speed) })
    }
    return out
  }
  assert.ok(pass(1.5).every((p) => p.to === p.value), 'a quick drag across (≈1.5 MHz/s) was moved by an assist')
  assert.ok(pass(0.03).every((p) => p.to === T), 'a slow approach (≈0.03 MHz/s) was not taken to the target')
})

test('fine control: the hand gain is position-free, slower for an inching hand, 1:1 for a normal drag', () => {
  assert.ok(fineGain(0) < 1 && fineGain(0) > 0.2)
  assert.equal(fineGain(1), 1)
  let prev = 0
  for (let v = 0; v <= 1; v += 0.01) {
    const g = fineGain(v)
    assert.ok(g >= prev)
    assert.equal(g, fineGain(-v), 'same both ways')
    prev = g
  }
})

const MSG = 'holding. [▒▒▒▒] steadier the longer you stay.'

test('degradeMessage is deterministic and keeps the redaction block', () => {
  for (const s of [0, 0.2, 0.5, 0.9, 0.99, 1]) {
    const a = degradeMessage(MSG, s, 'seed')
    assert.equal(a, degradeMessage(MSG, s, 'seed'))
    assert.equal([...a].length, [...MSG].length)
    assert.ok(a.includes('[▒▒▒▒]'))
  }
})

test('degradeMessage is fully clear only at the lock', () => {
  assert.equal(degradeMessage(MSG, 1, 'seed'), MSG)
  for (const s of [0, 0.3, 0.6, 0.95, 0.999]) assert.notEqual(degradeMessage(MSG, s, 'seed'), MSG)
})

test('the dial starts in the upper band, outside every zone, so sweeping toward the low end passes the signal', () => {
  assert.ok(START_VALUE > T + ZONE_FAINT, 'start is above the faint zone')
  assert.ok(START_VALUE < FREQ_MAX && START_VALUE >= (FREQ_MIN + FREQ_MAX) / 2, 'start is in the upper part of the band')
  assert.equal(clarityBucket(START_VALUE, false), 'none')
  // A plain arrow-key / wheel-notch sweep down from the start lands exactly on the target.
  let v = START_VALUE
  let hit = false
  for (let i = 0; i < 200 && v > FREQ_MIN; i++) {
    v = stepOnGrid(v, WHEEL_NOTCH_STEP, -1)
    if (v === roundFreq(T)) hit = true
  }
  assert.ok(hit, 'a downward 0.01 sweep from the start passes through the target')
})

test('wheelNotches: a clicky wheel is whole notches, trackpad pixel scrolling is not', () => {
  assert.equal(WHEEL_NOTCH_STEP, 0.01)
  // Chromium mouse wheel: 100px with a legacy wheelDelta of ±120 per notch.
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 0, deltaY: 100, wheelDeltaY: -120 }), 1)
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 0, deltaY: -100, wheelDeltaY: 120 }), -1)
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 0, deltaY: 200, wheelDeltaY: -240 }), 2)
  // Firefox: line mode, 3 lines a notch.
  assert.equal(wheelNotches({ deltaMode: 1, deltaX: 0, deltaY: 3 }), 1)
  assert.equal(wheelNotches({ deltaMode: 1, deltaX: 0, deltaY: -3 }), -1)
  // Trackpad: small pixel deltas → proportional (0 notches).
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 0, deltaY: 4.5, wheelDeltaY: -13.5 }), 0)
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 12, deltaY: 1 }), 0)
  assert.equal(wheelNotches({ deltaMode: 0, deltaX: 0, deltaY: 0 }), 0)
})

// The one-off "first dial touch starts the sound" is a `play` the store sends itself (store/tuner.ts), so here only
// `play` ever makes sound; plain tuning never does.
test('transport: silent until played; tuning re-opens a stopped tuner without sound; stop closes input', () => {
  const all: Transport[] = ['open', 'playing', 'paused', 'stopped']
  // The start is `open`: input open, silent.
  assert.equal(transportInputOpen('open'), true)
  assert.equal(transportAudible('open', true), false)
  // Only Play makes sound, and only with the Sound setting on.
  for (const s of all) {
    assert.equal(nextTransport(s, 'play'), 'playing')
    assert.equal(transportAudible(s, false), false)
    assert.equal(transportAudible(nextTransport(s, 'tune'), true), s === 'playing', `tuning from ${s} must not start sound`)
    assert.equal(transportAudible(nextTransport(s, 'stop'), true), false)
    assert.equal(transportAudible(nextTransport(s, 'pause'), true), false)
  }
  assert.equal(transportAudible('playing', true), true)
  // Stop closes input; tuning re-opens it to the silent start state, not to playing.
  assert.equal(transportInputOpen(nextTransport('playing', 'stop')), false)
  assert.equal(nextTransport('stopped', 'tune'), 'open')
  assert.equal(nextTransport('paused', 'tune'), 'paused')
  assert.equal(nextTransport('playing', 'tune'), 'playing')
  assert.equal(transportInputOpen('paused'), true)
})

test('needle tint: plain outside the faint zone, warming by zone, never showing direction', () => {
  // Outside the faint zone (and stopped → 'none'): exactly the plain needle.
  assert.equal(needleTint('none'), 0)
  assert.equal(needleColor('none'), 'rgba(182, 90, 52, 0)')
  // Steps up through the zones; the lock keeps the clear tint.
  assert.ok(needleTint('faint') > 0)
  assert.ok(needleTint('clearer') > needleTint('faint'))
  assert.ok(needleTint('clear') > needleTint('clearer'))
  assert.equal(needleTint('clear'), 1)
  assert.equal(needleTint('locked'), needleTint('clear'))
  // Same tint at the same distance on both sides of the target, everywhere on the dial; none outside the faint zone.
  for (let d = 0; d <= 0.5; d = roundFreq(d + 0.001)) {
    const lo = needleTint(clarityBucket(roundFreq(T - d), false))
    const hi = needleTint(clarityBucket(roundFreq(T + d), false))
    assert.equal(lo, hi, `tint differs at ±${d}`)
    if (d > ZONE_FAINT + 1e-9) assert.equal(hi, 0, `hint outside the faint zone at ${d}`)
    else assert.ok(hi > 0, `no tint inside the faint zone at ${d}`)
  }
  // Never warmer further away.
  let prev = 1
  for (let d = 0; d <= 0.3; d = roundFreq(d + 0.001)) {
    const t = needleTint(clarityBucket(roundFreq(T + d), false))
    assert.ok(t <= prev)
    prev = t
  }
})
