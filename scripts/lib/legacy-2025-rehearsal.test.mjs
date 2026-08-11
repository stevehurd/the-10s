import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPreflightReport,
  legacyFingerprint,
  legacyRosterNickname,
  rankLegacyParticipants,
  rankLegacyStandings,
  reconcileMigrationSnapshot,
  selectLegacyCommissioner,
  validateLegacyData,
} from './legacy-2025-rehearsal.mjs'
import {
  buildLegacy2025Fixture,
  buildMigratedSnapshot,
} from '../fixtures/legacy-2025.fixture.mjs'

test('the production player name seeds the roster nickname', () => {
  assert.equal(legacyRosterNickname(' Steve '), 'Steve')
  assert.throws(() => legacyRosterNickname('  '), /player name is required/)
})

test('the commissioner can be selected uniquely by legacy display name', () => {
  const users = [
    { id: 'user-1', name: 'Steve', email: null },
    { id: 'user-2', name: 'Alex', email: 'alex@example.test' },
  ]

  assert.equal(selectLegacyCommissioner(users, { name: 'Steve' }).id, 'user-1')
  assert.equal(selectLegacyCommissioner(users, { userId: 'user-2' }).id, 'user-2')
  assert.equal(selectLegacyCommissioner(users, { email: ' ALEX@example.test ' }).id, 'user-2')
  assert.throws(
    () => selectLegacyCommissioner([...users, { id: 'user-3', name: 'Steve' }], { name: 'Steve' }),
    /found 2/,
  )
  assert.throws(() => selectLegacyCommissioner(users, {}), /exactly one commissioner/)
})

test('a complete synthetic legacy season passes preflight and reconciliation', () => {
  const legacy = buildLegacy2025Fixture()
  const report = createPreflightReport(legacy)
  assert.equal(report.passed, true)
  assert.deepEqual(report.counts, { users: 3, teams: 30, rosterAssignments: 30 })
  assert.equal(report.sourceFingerprint.length, 64)
  assert.deepEqual(reconcileMigrationSnapshot(
    legacy,
    buildMigratedSnapshot(legacy),
    { commissionerEmail: 'player1@example.test' },
  ), [])
})

test('the source fingerprint is stable under query ordering but changes with source evidence', () => {
  const legacy = buildLegacy2025Fixture()
  const reordered = structuredClone(legacy)
  reordered.users.reverse()
  reordered.teams.reverse()
  for (const user of reordered.users) user.drafts.reverse()
  assert.equal(legacyFingerprint(reordered), legacyFingerprint(legacy))

  const changed = structuredClone(legacy)
  changed.teams[0].wins += 1
  assert.notEqual(legacyFingerprint(changed), legacyFingerprint(legacy))
})

test('preflight blocks duplicate ownership, invalid quotas, rounds, and records', () => {
  const legacy = buildLegacy2025Fixture()
  legacy.users[1].drafts[0].teamId = legacy.users[0].drafts[0].teamId
  legacy.users[1].drafts[0].team = legacy.users[0].drafts[0].team
  legacy.users[2].drafts[0].teamId = legacy.users[2].drafts[2].teamId
  legacy.users[2].drafts[0].team = legacy.users[2].drafts[2].team
  legacy.users[2].drafts[2].round = 2
  legacy.teams[0].wins = -1
  const { errors } = validateLegacyData(legacy)
  assert.ok(errors.some((error) => error.includes('assigned to both')))
  assert.ok(errors.some((error) => error.includes('duplicate round')))
  assert.ok(errors.some((error) => error.includes('1 NFL and 9 college')))
  assert.ok(errors.some((error) => error.includes('invalid wins')))
})

test('a missing email is visible but does not discard historical roster data', () => {
  const legacy = buildLegacy2025Fixture()
  legacy.users[0].email = null
  const report = createPreflightReport(legacy)
  assert.equal(report.passed, true)
  assert.ok(report.warnings.some((warning) => warning.includes('cannot sign in')))
})

test('reconciliation can identify the commissioner by immutable user ID when emails are absent', () => {
  const legacy = buildLegacy2025Fixture()
  legacy.users[0].email = null
  const migrated = buildMigratedSnapshot(legacy)
  migrated.memberships[0].role = 'COMMISSIONER'
  assert.deepEqual(
    reconcileMigrationSnapshot(legacy, migrated, { commissionerUserId: legacy.users[0].id }),
    [],
  )
})

test('legacy final ranks use best single NFL team, then best single college team', () => {
  const user = (name, nflWins, collegeWins) => ({
    id: name,
    name,
    drafts: [
      ...nflWins.map((wins, index) => ({ team: { league: 'NFL', wins }, id: `${name}-n-${index}` })),
      ...collegeWins.map((wins, index) => ({ team: { league: 'COLLEGE', wins }, id: `${name}-c-${index}` })),
    ],
  })
  const strongerNfl = user('Stronger NFL', [10, 0], [2, 2, 1, 1, 1, 1, 1, 1])
  const weakerNfl = user('Weaker NFL', [9, 1], [2, 2, 1, 1, 1, 1, 1, 1])
  assert.equal(rankLegacyStandings([weakerNfl, strongerNfl])[0].user.name, 'Stronger NFL')

  const strongerCollege = user('Stronger college', [8, 2], [4, 1, 1, 1, 1, 1, 0, 0])
  const weakerCollege = user('Weaker college', [8, 2], [3, 2, 1, 1, 1, 1, 0, 0])
  assert.equal(rankLegacyStandings([weakerCollege, strongerCollege])[0].user.name, 'Stronger college')
})

test('migration participant ranks are one-based and follow the legacy standings order', () => {
  const legacy = buildLegacy2025Fixture()
  const participants = rankLegacyParticipants(legacy.users)

  assert.deepEqual(participants.map(({ finalRank }) => finalRank), [1, 2, 3])
  assert.deepEqual(
    participants.map(({ user }) => user.id),
    rankLegacyStandings(legacy.users).map(({ user }) => user.id),
  )
})

test('reconciliation reports roster, totals, team records, and finalization drift', () => {
  const legacy = buildLegacy2025Fixture()
  const migrated = buildMigratedSnapshot(legacy)
  migrated.participants[0].rosterSlots[0].teamId = 'wrong-team'
  migrated.participants[1].totalWins += 1
  migrated.participants[2].finalRank = migrated.participants[1].finalRank
  migrated.participants[0].poolSeat.label = '2025 seat 1'
  migrated.teamRecords[0].wins += 1
  migrated.memberships[0].role = 'MEMBER'
  migrated.season.status = 'ACTIVE'
  migrated.season.finalizedAt = null
  const errors = reconcileMigrationSnapshot(legacy, migrated, { commissionerEmail: 'player1@example.test' })
  assert.ok(errors.some((error) => error.includes('slot 1 team differs')))
  assert.ok(errors.some((error) => error.includes('total wins differ')))
  assert.ok(errors.some((error) => error.includes('final rank differs')))
  assert.ok(errors.some((error) => error.includes('roster nickname differs')))
  assert.ok(errors.some((error) => error.includes('W-L-T differs')))
  assert.ok(errors.some((error) => error.includes('intended 2025 user')))
  assert.ok(errors.some((error) => error.includes('season is not finalized')))
})
