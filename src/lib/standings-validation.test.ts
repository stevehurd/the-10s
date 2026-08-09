import assert from 'node:assert/strict'
import test from 'node:test'

import { compareSeasonRecords, validationRunStatus } from './standings-validation.ts'

const calculated = [
  { teamId: 'one', teamName: 'One', league: 'NFL' as const, wins: 12, losses: 5, ties: 0 },
  { teamId: 'two', teamName: 'Two', league: 'COLLEGE' as const, wins: 10, losses: 3, ties: 0 },
  { teamId: 'three', teamName: 'Three', league: 'COLLEGE' as const, wins: 8, losses: 4, ties: 0 },
]

test('compares historical records without changing either input', () => {
  const stored = [
    { ...calculated[0] },
    { ...calculated[1], wins: 9 },
    { teamId: 'four', teamName: 'Four', league: 'NFL' as const, wins: 7, losses: 10, ties: 0 },
  ]
  const result = compareSeasonRecords(calculated, stored)

  assert.equal(result.matchedTeams, 1)
  assert.deepEqual(result.discrepancies.map((entry) => [entry.teamId, entry.kind]), [
    ['two', 'MISMATCH'],
    ['three', 'MISSING_STORED'],
    ['four', 'MISSING_PROVIDER'],
  ])
  assert.equal(calculated[1].wins, 10)
  assert.equal(stored[1].wins, 9)
})

test('classifies clean, mismatched, partial, and failed validation reports', () => {
  assert.equal(validationRunStatus({ comparedTeams: 162, errorCount: 0, discrepancyCount: 0 }), 'SUCCEEDED')
  assert.equal(validationRunStatus({ comparedTeams: 162, errorCount: 0, discrepancyCount: 2 }), 'MISMATCH')
  assert.equal(validationRunStatus({ comparedTeams: 32, errorCount: 1, discrepancyCount: 0 }), 'PARTIAL')
  assert.equal(validationRunStatus({ comparedTeams: 0, errorCount: 2, discrepancyCount: 0 }), 'FAILED')
})
