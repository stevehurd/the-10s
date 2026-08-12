import assert from 'node:assert/strict'
import test from 'node:test'

import { canMemberEnterDraftRoom, isOfficialDraftDue } from './lifecycle.ts'

const now = new Date('2026-08-12T20:00:00.000Z')

test('an official scheduled draft opens only when its start time arrives', () => {
  const future = { mode: 'OFFICIAL', status: 'SCHEDULED', startsAt: '2026-08-12T20:01:00.000Z' }
  const due = { mode: 'OFFICIAL', status: 'SCHEDULED', startsAt: '2026-08-12T20:00:00.000Z' }

  assert.equal(isOfficialDraftDue(future, now), false)
  assert.equal(canMemberEnterDraftRoom(future, now), false)
  assert.equal(isOfficialDraftDue(due, now), true)
  assert.equal(canMemberEnterDraftRoom(due, now), true)
})

test('live official drafts and rehearsals are not held behind the official schedule gate', () => {
  assert.equal(
    canMemberEnterDraftRoom({ mode: 'OFFICIAL', status: 'LIVE', startsAt: null }, now),
    true,
  )
  assert.equal(
    canMemberEnterDraftRoom({ mode: 'REHEARSAL', status: 'SCHEDULED', startsAt: null }, now),
    true,
  )
})
