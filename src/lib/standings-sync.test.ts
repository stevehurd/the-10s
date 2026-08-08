import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  calculateCollegeStandingsFromGames,
  combineRegularAndPostseasonStandings,
  type CollegeStandingTeam,
} from './standings-calculation.ts'
import type { SportsDataGame, SportsDataStanding } from './sportsdata.ts'

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
      regularTies: record.regularTies,
      postseasonWins: record.postseasonWins,
      postseasonTies: record.postseasonTies,
    })),
    [
      { id: 1, wins: 15, losses: 6, ties: 0, regularWins: 12, regularTies: 0, postseasonWins: 3, postseasonTies: 0 },
      { id: 2, wins: 10, losses: 7, ties: 1, regularWins: 10, regularTies: 1, postseasonWins: 0, postseasonTies: 0 },
    ],
  )
})

test('retains a postseason-only record without inventing regular wins', () => {
  const [combined] = combineRegularAndPostseasonStandings([], [standing(3, 1, 0)])
  assert.equal(combined.Wins, 1)
  assert.equal(combined.regularWins, 0)
  assert.equal(combined.postseasonWins, 1)
})

const collegeFixture = JSON.parse(
  readFileSync(new URL('./fixtures/cfb-scoring-cases.json', import.meta.url), 'utf8'),
) as { season: number; teams: CollegeStandingTeam[]; games: SportsDataGame[] }

test('derives CFB totals from final regular, conference championship, bowl, and playoff games', () => {
  const records = calculateCollegeStandingsFromGames(
    collegeFixture.season,
    collegeFixture.teams,
    collegeFixture.games,
  )
  const alpha = records.find((record) => record.TeamID === 1)
  const delta = records.find((record) => record.TeamID === 4)
  const bravo = records.find((record) => record.TeamID === 2)
  const charlie = records.find((record) => record.TeamID === 3)

  assert.deepEqual(alpha && {
    wins: alpha.Wins,
    losses: alpha.Losses,
    regularWins: alpha.regularWins,
    postseasonLosses: alpha.postseasonLosses,
  }, { wins: 3, losses: 2, regularWins: 3, postseasonLosses: 2 })
  assert.deepEqual(delta && {
    wins: delta.Wins,
    losses: delta.Losses,
    postseasonWins: delta.postseasonWins,
  }, { wins: 3, losses: 0, postseasonWins: 3 })
  assert.equal(bravo?.regularTies, 1)
  assert.equal(charlie?.regularTies, 1)
  assert.equal(bravo?.Wins, 0, 'scheduled and preseason games do not count')
})

test('refuses a schedule containing a game from another season', () => {
  const wrongSeason = [{ ...collegeFixture.games[0], Season: 2024 }]
  assert.throws(
    () => calculateCollegeStandingsFromGames(2025, collegeFixture.teams, wrongSeason),
    /contained game 101 from 2024/,
  )
})

test('refuses a final game without a usable result', () => {
  const missingScore = [{
    ...collegeFixture.games[0],
    AwayTeamScore: null,
    HomeTeamScore: null,
  }]
  assert.throws(
    () => calculateCollegeStandingsFromGames(2025, collegeFixture.teams, missingScore),
    /missing a usable score/,
  )
})

test('refuses duplicate games before they can inflate a record', () => {
  const duplicate = [collegeFixture.games[0], collegeFixture.games[0]]
  assert.throws(
    () => calculateCollegeStandingsFromGames(2025, collegeFixture.teams, duplicate),
    /Duplicate SportsDataIO game 101/,
  )
})

test('counts a scoreless forfeit only when SportsDataIO identifies the winner', () => {
  const forfeit = [{
    ...collegeFixture.games[0],
    Status: 'Forfeit',
    AwayTeamScore: null,
    HomeTeamScore: null,
    Winner: 'ALP',
  }]
  const records = calculateCollegeStandingsFromGames(2025, collegeFixture.teams, forfeit)
  assert.equal(records.find((record) => record.TeamID === 1)?.Wins, 1)
  assert.equal(records.find((record) => record.TeamID === 2)?.Losses, 1)
})
