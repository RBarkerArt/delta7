import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketOf, decayPlan, depthOf, moodOf } from './decay.ts'
import { levelFor } from '../store/coherenceMath.ts'

const SEED = 'd7:1'

test('buckets are 0.025 steps and keep the store’s level', () => {
  assert.equal(bucketOf(1), 1)
  assert.equal(bucketOf(0.93), 0.925)
  assert.equal(bucketOf(0.7), 0.7)
  assert.equal(bucketOf(0.749), 0.725)
  for (let c = 0; c <= 1; c += 0.0137) assert.equal(levelFor(bucketOf(c)), levelFor(c), `c=${c}`)
})

test('the visible range is 1.0 → 0.70; heavier effects only below', () => {
  assert.equal(moodOf(1), 0)
  assert.equal(moodOf(0.7), 1)
  assert.equal(depthOf(0.7), 0)
  assert.ok(depthOf(0.5) > 0 && depthOf(0.2) > depthOf(0.5))
  const p100 = decayPlan(1, SEED)
  assert.equal(p100.misspelt.length, 0)
  assert.equal(p100.blurPx, 0)
  const p70 = decayPlan(0.7, SEED)
  assert.ok(p70.misspelt.length >= 2 && p70.misspelt.length <= 4)
  assert.ok(p70.blurPx <= 0.4)
  assert.equal(Object.values(p70.panels).filter((p) => p.tear).length, 1)
  assert.equal(p70.logRewrite, null)
  const p20 = decayPlan(0.2, SEED)
  assert.ok(Object.values(p20.panels).filter((p) => p.tear).length > 1)
  assert.ok(p20.misspelt.length > decayPlan(0.5, SEED).misspelt.length)
})

test('every 0.025 step down from 0.95 changes something, deterministically', () => {
  let prev = JSON.stringify(decayPlan(0.95, SEED))
  for (let c = 0.925; c >= 0.69; c -= 0.025) {
    const now = JSON.stringify(decayPlan(c, SEED))
    assert.notEqual(now, prev, `no change at ${c}`)
    assert.equal(now, JSON.stringify(decayPlan(c, SEED)))
    prev = now
  }
})

test('a bad stretch adds 2–3 misspellings at the same coherence', () => {
  for (const c of [1, 0.85, 0.75]) {
    const extra = decayPlan(c, SEED, true).misspelt.length - decayPlan(c, SEED, false).misspelt.length
    assert.ok(extra >= 2 && extra <= 3, `c=${c} extra=${extra}`)
  }
})

test('nav items stay legible and the tuner is never touched', () => {
  for (const c of [1, 0.75, 0.7, 0.5, 0.2, 0]) {
    const p = decayPlan(c, SEED, true)
    for (const o of Object.values(p.navOpacity)) assert.ok(o >= 0.4, `c=${c} opacity ${o}`)
    assert.ok(!('tuner' in p.nav))
    for (const panel of Object.values(p.panels)) assert.ok(panel.opacity >= 0.75)
  }
})
