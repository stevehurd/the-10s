import assert from 'node:assert/strict'
import test from 'node:test'

import { standingsSyncStatus } from './standings-calculation.ts'

test('classifies successful, partial, and failed standings sync runs', () => {
  assert.equal(standingsSyncStatus(160, 0), 'SUCCEEDED')
  assert.equal(standingsSyncStatus(32, 1), 'PARTIAL')
  assert.equal(standingsSyncStatus(0, 1), 'FAILED')
})
