import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateConcurrentPick, validateHarnessRosters } from './harness-rules.ts'

test('concurrency harness requires one winner and one stale request', () => {
  const checks = evaluateConcurrentPick({
    beforeSelections: 4,
    afterSelections: 5,
    beforeRevision: 4,
    afterRevision: 5,
    fulfilled: 1,
    rejected: 1,
  })
  assert.ok(checks.every((check) => check.passed))

  const unsafe = evaluateConcurrentPick({
    beforeSelections: 4,
    afterSelections: 6,
    beforeRevision: 4,
    afterRevision: 6,
    fulfilled: 2,
    rejected: 0,
  })
  assert.ok(unsafe.some((check) => !check.passed))
})

test('completed harness rosters require exactly two NFL and eight college teams', () => {
  assert.deepEqual(validateHarnessRosters([{
    participantId: 'one',
    participantName: 'Complete Player',
    keptLeagues: ['NFL'],
    selectedLeagues: ['NFL', ...Array<string>(8).fill('COLLEGE')],
  }]), [])

  const issues = validateHarnessRosters([{
    participantId: 'two',
    participantName: 'Invalid Player',
    keptLeagues: ['NFL'],
    selectedLeagues: ['NFL', ...Array<string>(7).fill('COLLEGE')],
  }])
  assert.ok(issues.some((issue) => issue.includes('9 teams')))
  assert.ok(issues.some((issue) => issue.includes('7 college')))
})
