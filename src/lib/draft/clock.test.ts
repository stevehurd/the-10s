import assert from 'node:assert/strict'
import test from 'node:test'

import {
  displayedDraftSeconds,
  localDraftDeadline,
  serverDraftDeadline,
} from './clock.ts'

test('server and visible clocks use the configured duration', () => {
  const now = Date.UTC(2026, 7, 9, 12)
  const deadline = serverDraftDeadline(10, now)

  assert.equal(deadline.getTime() - now, 10_000)
  assert.equal(displayedDraftSeconds(deadline, 10, now), 10)
  assert.equal(displayedDraftSeconds(deadline, 10, now + 1_000), 9)
})

test('the submitting browser receives a full local clock when the response arrives', () => {
  const now = Date.UTC(2026, 7, 9, 12)
  const deadline = localDraftDeadline(90, now)

  assert.equal(displayedDraftSeconds(deadline, 90, now), 90)
  assert.equal(displayedDraftSeconds(deadline, 90, now + 1_000), 89)
})
