import assert from 'node:assert/strict'
import test from 'node:test'

import { combineRegularAndPostseasonStandings } from './standings-calculation.ts'
import type { SportsDataStanding } from './sportsdata.ts'

function standing(teamId: number, wins: number, losses: number, ties = 0): SportsDataStanding {
  return {
    Season: 2025,
    SeasonType: 1,
    TeamID: teamId,
    Key: `T${teamId}`,
    Name: `Team ${teamId}`,
    Team: `Team ${teamId}`,
    Wins: wins,
    Losses: losses,
    Ties: ties,
    ConferenceWins: 0,
    ConferenceLosses: 0,
    GlobalTeamID: teamId + 1000,
  }
}

test('preserves regular totals and adds postseason wins, losses, and ties', () => {
  const combined = combineRegularAndPostseasonStandings(
    [standing(1, 12, 5), standing(2, 10, 6, 1)],
    [standing(1, 3, 1), standing(2, 0, 1)],
  )

  assert.deepEqual(
    combined.map((record) => ({
      id: record.TeamID,
      wins: record.Wins,
      losses: record.Losses,
      ties: record.Ties,
      regularWins: record.regularWins,
      postseasonWins: record.postseasonWins,
    })),
    [
      { id: 1, wins: 15, losses: 6, ties: 0, regularWins: 12, postseasonWins: 3 },
      { id: 2, wins: 10, losses: 7, ties: 1, regularWins: 10, postseasonWins: 0 },
    ],
  )
})

test('retains a postseason-only record without inventing regular wins', () => {
  const [combined] = combineRegularAndPostseasonStandings([], [standing(3, 1, 0)])
  assert.equal(combined.Wins, 1)
  assert.equal(combined.regularWins, 0)
  assert.equal(combined.postseasonWins, 1)
})
