import { test } from 'node:test'
import assert from 'node:assert/strict'
import { D7_LOGS, D7_MESSAGE, D7_MESSAGES_LIST, D7_NUDGE, d7Logs } from './delta7Content.ts'

const FOUND = '9.99' // any stand-in value: these tests never need the real one

test('logs before the first lock: every line keeps hold=? and the nudge is the newest line', () => {
  const logs = d7Logs('?', false)
  assert.equal(logs.length, D7_LOGS.length + 1)
  assert.equal(logs[logs.length - 1], D7_NUDGE)
  assert.ok(logs.some((l) => l.includes('hold=?')))
  assert.ok(logs.every((l) => !l.includes('{hold}')))
})

test('logs after the first lock: older lines are not rewritten; one newest line carries the found value', () => {
  const before = d7Logs('?', false)
  const after = d7Logs(FOUND, true)
  assert.deepEqual(after.slice(0, before.length), before, 'history before the lock is unchanged')
  assert.equal(after.length, before.length + 1)
  const newest = after[after.length - 1]
  assert.match(newest, /^\d\d:\d\d:\d\d {2}rk: hold=/)
  assert.ok(newest.endsWith(`hold=${FOUND}`))
  assert.equal(after.filter((l) => l.includes(FOUND)).length, 1)
  // Dated after every older line.
  assert.ok(newest.slice(0, 8) > before[before.length - 1].slice(0, 8))
})

test('the latest message is only the neutral first sentence (true before and after a lock)', () => {
  assert.equal(D7_MESSAGE.body, 'nothing new since the last check.')
  assert.equal(D7_MESSAGES_LIST[0].body, D7_MESSAGE.body)
  for (const m of D7_MESSAGES_LIST) assert.ok(m.body.length > 0)
})
