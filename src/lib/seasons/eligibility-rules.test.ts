import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyEligibilityChange,
  normalizeEligibilityOverride,
  resolveCollegeEligibilitySync,
} from './eligibility-rules.ts'

const current = {
  name: 'Boise State Broncos',
  abbreviation: 'BOISE',
  conference: 'Pac-12',
  division: null,
  league: 'COLLEGE' as const,
  externalId: '1',
  sportsDataTeamId: '2',
  sportsDataGlobalTeamId: '1',
  logoUrl: null,
}

test('unchanged FBS teams are approved automatically', () => {
  assert.deepEqual(classifyEligibilityChange({
    nameSnapshot: current.name,
    abbreviationSnapshot: current.abbreviation,
    conferenceSnapshot: current.conference,
    divisionSnapshot: current.division,
  }, current), { kind: 'UNCHANGED', status: 'APPROVED', reason: null })
})

test('new and realigned teams become concise review exceptions', () => {
  assert.equal(classifyEligibilityChange(null, current).kind, 'ADDED')
  const realigned = classifyEligibilityChange({
    nameSnapshot: current.name,
    abbreviationSnapshot: current.abbreviation,
    conferenceSnapshot: 'Mountain West',
    divisionSnapshot: null,
  }, current)
  assert.equal(realigned.kind, 'CHANGED')
  assert.equal(realigned.status, 'REVIEW')
  assert.match(realigned.reason ?? '', /Mountain West → Pac-12/)
})

test('commissioner corrections require a bounded conference and audit reason', () => {
  assert.deepEqual(normalizeEligibilityOverride({
    status: 'APPROVED',
    conference: ' Pac-12 ',
    note: ' Official 2026 alignment ',
  }), {
    status: 'APPROVED',
    conference: 'Pac-12',
    note: 'Official 2026 alignment',
  })
  assert.throws(
    () => normalizeEligibilityOverride({ status: 'APPROVED', conference: '', note: 'ok' }),
    /Conference/,
  )
})

test('later provider syncs preserve a season-specific commissioner correction', () => {
  const decision = resolveCollegeEligibilitySync({
    previous: null,
    current,
    existing: {
      status: 'APPROVED',
      source: 'COMMISSIONER_OVERRIDE',
      reviewReason: 'Commissioner correction: Official alignment',
      nameSnapshot: current.name,
      abbreviationSnapshot: current.abbreviation,
      conferenceSnapshot: 'Corrected Conference',
      divisionSnapshot: null,
    },
  })

  assert.equal(decision.kind, 'OVERRIDDEN')
  assert.equal(decision.status, 'APPROVED')
  assert.equal(decision.conferenceSnapshot, 'Corrected Conference')
  assert.equal(decision.source, 'COMMISSIONER_OVERRIDE')
})
