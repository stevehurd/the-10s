import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDevelopmentSportsDataset } from './development-sportsdata.mjs'

const nflTeams = Array.from({ length: 32 }, (_, index) => ({
  Active: true,
  TeamID: index + 1,
  GlobalTeamID: index + 1001,
  FullName: `NFL Team ${index + 1}`,
  Key: `N${index + 1}`,
  Conference: index < 16 ? 'AFC' : 'NFC',
  Division: 'Test',
}))
const nflRegular = nflTeams.map((team) => ({ TeamID: team.TeamID, Wins: 10, Losses: 7, Ties: 0 }))
const nflPostseason = [{ TeamID: 1, Wins: 3, Losses: 1, Ties: 0 }]
const collegeTeams = Array.from({ length: 130 }, (_, index) => ({
  Active: true,
  TeamID: index + 101,
  GlobalTeamID: index + 2001,
  School: `College ${index + 1}`,
  Name: 'Team',
  Key: `C${index + 1}`,
  ShortDisplayName: `C${index + 1}`,
  Conference: 'Test Conference',
  Wins: 8,
  Losses: 5,
  Ties: 0,
}))

test('builds an NFL and FBS-only dataset with actual aggregate totals', () => {
  const dataset = buildDevelopmentSportsDataset({
    nflTeams,
    nflRegular,
    nflPostseason,
    collegeHierarchy: [{ Teams: collegeTeams }],
  })

  assert.equal(dataset.filter((team) => team.league === 'NFL').length, 32)
  assert.equal(dataset.filter((team) => team.league === 'COLLEGE').length, 130)
  assert.deepEqual(dataset.find((team) => team.sportsDataTeamId === '1')?.record, {
    wins: 13,
    losses: 8,
    ties: 0,
    regularWins: 10,
    regularLosses: 7,
    postseasonWins: 3,
    postseasonLosses: 1,
  })
  assert.equal(dataset.find((team) => team.sportsDataTeamId === '101')?.record.wins, 8)
})

test('rejects an incomplete NFL feed before a seed can mutate data', () => {
  assert.throws(
    () => buildDevelopmentSportsDataset({
      nflTeams: nflTeams.slice(0, 31),
      nflRegular,
      nflPostseason,
      collegeHierarchy: [{ Teams: collegeTeams }],
    }),
    /Expected 32 active NFL teams/,
  )
})
