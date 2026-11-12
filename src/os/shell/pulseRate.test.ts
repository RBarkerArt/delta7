import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatIntervalMs, beatIrregularity, isSkippedBeat, isSoftBeat, pulsePeriodMs } from './pulseRate.ts'

test('a bad stretch slows the beat and skips about one in 5–7', () => {
  assert.ok(pulsePeriodMs(true) > pulsePeriodMs(false))
  let skipped = 0
  for (let i = 0; i < 600; i++) if (isSkippedBeat(i, true)) skipped++
  assert.ok(skipped >= 600 / 7 - 2 && skipped <= 600 / 5 + 2, `skipped ${skipped}`)
  for (let i = 0; i < 100; i++) assert.equal(isSkippedBeat(i, false), false)
})

test('the beat steadies as clarity rises and is perfectly even while locked', () => {
  assert.equal(beatIrregularity(1, false), 0)
  assert.equal(beatIrregularity(0.3, true), 0)
  assert.ok(beatIrregularity(0, false) > beatIrregularity(0.5, false))
  assert.ok(beatIrregularity(0.5, false) > beatIrregularity(0.9, false))
  const period = 1000
  for (let i = 0; i < 50; i++) {
    assert.equal(beatIntervalMs(i, period, 0), period)
    assert.equal(isSoftBeat(i, 0), false)
    const far = beatIntervalMs(i, period, 1)
    assert.ok(far >= period * 0.8 - 1e-9 && far <= period * 1.2 + 1e-9)
    assert.equal(far, beatIntervalMs(i, period, 1), 'seeded, deterministic')
  }
  const uneven = Array.from({ length: 40 }, (_, i) => beatIntervalMs(i, period, 1))
  assert.ok(Math.max(...uneven) - Math.min(...uneven) > 100, 'irregular when far off')
  const soft = Array.from({ length: 200 }, (_, i) => isSoftBeat(i, 1)).filter(Boolean).length
  assert.ok(soft > 10 && soft < 80, `soft half-beats ${soft}`)
})
