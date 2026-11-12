import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAD_STRETCH_HOLD_MS, FREQ_MAX, FREQ_MIN, HOLD_MS, LOCK_WINDOW, SIGNAL_TARGET } from './signalConfig.ts'
import {
  clarity,
  clarityBucket,
  clarityWords,
  degradeMessage,
  holdComplete,
  holdMsFor,
  isInLockWindow,
  lockStrength,
  notch,
  roundFreq,
  unnotch,
} from './tunerMath.ts'

const T = SIGNAL_TARGET

test('clarity and lockStrength peak at the target and fall off symmetrically', () => {
  assert.equal(clarity(T), 1)
  assert.equal(lockStrength(T), 1)
  for (const d of [0.005, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5]) {
    const lo = clarity(T - d)
    const hi = clarity(T + d)
    assert.ok(Math.abs(lo - hi) < 1e-12, `asymmetric at ±${d}`)
    assert.ok(lo < 1 && lo > 0)
    assert.equal(lockStrength(T + d), hi)
  }
  // Monotonic away from the target, both ways.
  let prev = 1
  for (let d = 0.005; d < 0.8; d += 0.005) {
    const c = clarity(T + d)
    assert.ok(c < prev, `not falling at +${d}`)
    prev = c
  }
})

test('clarity: a faint zone a sweep can notice, but nothing at the far ends of the dial', () => {
  assert.ok(clarity(T + 0.2) > 0.08, 'the faint zone reaches ±0.2')
  assert.ok(clarity(T + 0.1) < 0.4, 'still only “clearer” at ±0.1')
  assert.ok(clarity(FREQ_MIN) < 0.02)
  assert.ok(clarity(FREQ_MAX) < 1e-6)
})

test('clarity buckets: none → faint → clearer → clear on a sweep from the low end, locked only at the lock', () => {
  const seen: string[] = []
  for (let v = FREQ_MIN; v <= T + 1e-9; v = roundFreq(v + 0.01)) {
    const b = clarityBucket(clarity(v), false)
    if (seen[seen.length - 1] !== b) seen.push(b)
  }
  assert.deepEqual(seen, ['none', 'faint', 'clearer', 'clear'])
  assert.equal(clarityBucket(1, true), 'locked')
  assert.equal(clarityBucket(clarity(T), false), 'clear')
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

test('notch and unnotch are inverses and leave the target fixed', () => {
  assert.equal(notch(T), T)
  for (const d of [-0.05, -0.02, -0.004, 0.003, 0.01, 0.029, 0.04]) {
    const v = notch(T + d)
    assert.ok(Math.abs(unnotch(v) - (T + d)) < 1e-9)
  }
})

const MSG = 'you came back. the signal [▒▒▒▒] steadier when you stay.'

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
