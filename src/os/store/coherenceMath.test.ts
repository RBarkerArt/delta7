import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ABSENCE_FLOOR,
  BAD_STRETCH_FLOOR,
  RECOVERY_MS,
  applyAbsenceDecay,
  floorFor,
  levelFor,
  recoveryValue,
} from './coherenceMath.ts'

test('levelFor keeps the owner’s boundaries', () => {
  assert.equal(levelFor(1), 'stable')
  assert.equal(levelFor(0.9), 'stable')
  assert.equal(levelFor(0.8999), 'recovering')
  assert.equal(levelFor(0.75), 'recovering')
  assert.equal(levelFor(0.7499), 'fraying')
  assert.equal(levelFor(0.55), 'fraying')
  assert.equal(levelFor(0.5499), 'fragmented')
  assert.equal(levelFor(0), 'fragmented')
})

test('floorFor: 0.70 normally, 0.75 in a bad stretch', () => {
  assert.equal(ABSENCE_FLOOR, 0.7)
  assert.equal(BAD_STRETCH_FLOOR, 0.75)
  assert.equal(floorFor(false), 0.7)
  assert.equal(floorFor(true), 0.75)
})

test('absence decay never goes below the floor', () => {
  for (const bad of [false, true]) {
    const floor = floorFor(bad)
    for (const hours of [0.5, 1, 5, 24, 24 * 30, 1e6]) {
      const v = applyAbsenceDecay(1, hours, floor)
      assert.ok(v >= floor, `bad=${bad} hours=${hours} → ${v}`)
    }
    assert.equal(applyAbsenceDecay(1, 1e6, floor), floor)
  }
})

test('absence decay is linear above the floor and leaves values already below it alone', () => {
  assert.equal(applyAbsenceDecay(1, 2, 0.7, 0.02), 0.96)
  assert.equal(applyAbsenceDecay(0.6, 10, 0.7), 0.6)
  assert.equal(applyAbsenceDecay(0.72, 0, 0.75), 0.72)
  // A bad stretch does not yank a value up: it only limits absence decay.
  assert.equal(applyAbsenceDecay(0.72, 5, floorFor(true)), 0.72)
})

test('recovery reaches 1.0 at RECOVERY_MS (about one minute) and never goes backwards', () => {
  assert.equal(RECOVERY_MS, 60_000)
  for (const start of [0, 0.2, 0.5, 0.7, 0.75, 0.95]) {
    assert.equal(recoveryValue(start, 0), start)
    assert.equal(recoveryValue(start, RECOVERY_MS), 1)
    assert.equal(recoveryValue(start, RECOVERY_MS * 3), 1)
    let prev = start
    for (let t = 0; t <= RECOVERY_MS; t += 1000) {
      const v = recoveryValue(start, t)
      assert.ok(v >= prev - 1e-12, `start=${start} t=${t}`)
      assert.ok(v <= 1)
      prev = v
    }
  }
  // Most of the way back well before the minute is up (ease-out).
  assert.ok(recoveryValue(0.7, 30_000) > 0.95)
  assert.ok(recoveryValue(0.7, 30_000) < 1)
})
