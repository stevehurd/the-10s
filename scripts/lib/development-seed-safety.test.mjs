import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertSeedModeTransition,
  assertSyntheticTeamCleanupSafe,
  isSyntheticDevelopmentTeam,
} from './development-seed-safety.mjs'

test('recognizes only unkeyed development placeholder teams', () => {
  const placeholder = {
    name: 'Demo NFL 01',
    league: 'NFL',
    externalId: null,
    sportsDataTeamId: null,
    sportsDataGlobalTeamId: null,
  }

  assert.equal(isSyntheticDevelopmentTeam(placeholder), true)
  assert.equal(isSyntheticDevelopmentTeam({ ...placeholder, name: 'Denver Broncos' }), false)
  assert.equal(isSyntheticDevelopmentTeam({ ...placeholder, sportsDataTeamId: '10' }), false)
})

test('refuses to downgrade a SportsDataIO development pool by accident', () => {
  assert.throws(
    () => assertSeedModeTransition({
      existingSportsDataEntries: 162,
      useSportsData: false,
      allowDemoDowngrade: false,
    }),
    /Refusing to replace a SportsDataIO development pool/,
  )

  assert.doesNotThrow(() => assertSeedModeTransition({
    existingSportsDataEntries: 162,
    useSportsData: false,
    allowDemoDowngrade: true,
  }))
  assert.doesNotThrow(() => assertSeedModeTransition({
    existingSportsDataEntries: 162,
    useSportsData: true,
    allowDemoDowngrade: false,
  }))
})

test('refuses to delete a synthetic team that still has references', () => {
  assert.throws(
    () => assertSyntheticTeamCleanupSafe([
      { name: 'Demo College 001', _count: { rosterSlots: 1, seasonRecords: 0 } },
    ]),
    /referenced outside the development pool/,
  )

  assert.doesNotThrow(() => assertSyntheticTeamCleanupSafe([
    { name: 'Demo College 001', _count: { rosterSlots: 0, seasonRecords: 0 } },
  ]))
})
