import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  calculateCollegeStandingsFromGames,
  combineRegularAndPostseasonStandings,
  type CollegeStandingTeam,
  standingsMatchPreviousSeason,
  validateAndCombineCollegeStandings,
  validateAndCombineNFLStandings,
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

const nflFixture = JSON.parse(
  readFileSync(new URL('./fixtures/nfl-scoring-cases.json', import.meta.url), 'utf8'),
) as {
  season: number
  expectedTeamCount: number
  regular: SportsDataStanding[]
  postseason: SportsDataStanding[]
}

test('validates the complete NFL feed and preserves regular/postseason scoring splits', () => {
  const combined = validateAndCombineNFLStandings(
    nflFixture.season,
    nflFixture.regular,
    nflFixture.postseason,
    nflFixture.expectedTeamCount,
  )
  assert.deepEqual(combined.map((record) => ({
    id: record.TeamID,
    wins: record.Wins,
    losses: record.Losses,
    ties: record.Ties,
    regularWins: record.regularWins,
    postseasonWins: record.postseasonWins,
  })), [
    { id: 11, wins: 15, losses: 6, ties: 0, regularWins: 12, postseasonWins: 3 },
    { id: 12, wins: 10, losses: 7, ties: 1, regularWins: 10, postseasonWins: 0 },
    { id: 13, wins: 8, losses: 9, ties: 0, regularWins: 8, postseasonWins: 0 },
  ])
})

test('refuses incomplete, duplicate, wrong-season, and negative NFL records', () => {
  assert.throws(
    () => validateAndCombineNFLStandings(2026, [], [], 32),
    /not available yet for 2026/,
  )
  assert.throws(
    () => validateAndCombineNFLStandings(2025, nflFixture.regular.slice(0, 2), [], 3),
    /returned 2 teams; expected 3/,
  )
  assert.throws(
    () => validateAndCombineNFLStandings(2025, [nflFixture.regular[0], nflFixture.regular[0], nflFixture.regular[2]], [], 3),
    /duplicate team ID 11/,
  )
  assert.throws(
    () => validateAndCombineNFLStandings(2025, [{ ...nflFixture.regular[0], Season: 2024 }, ...nflFixture.regular.slice(1)], [], 3),
    /from season 2024/,
  )
  assert.throws(
    () => validateAndCombineNFLStandings(2025, [{ ...nflFixture.regular[0], Wins: -1 }, ...nflFixture.regular.slice(1)], [], 3),
    /invalid wins/,
  )
})

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

test('detects an unchanged prior-season standings snapshot', () => {
  const previous = [
    { teamId: '1', wins: 12, losses: 2, ties: 0 },
    { teamId: '2', wins: 9, losses: 4, ties: 0 },
    { teamId: '3', wins: 6, losses: 6, ties: 0 },
  ]
  assert.equal(standingsMatchPreviousSeason(previous, previous), true)
  assert.equal(
    standingsMatchPreviousSeason(
      previous.map((row, index) => index === 0 ? { ...row, wins: row.wins + 1 } : row),
      previous,
    ),
    false,
  )
})

test('validates and combines college regular and postseason standings', () => {
  const regular = [
    standing(1, 11, 2),
    standing(2, 9, 3),
    standing(3, 6, 6),
  ]
  const postseason = [
    { ...standing(1, 2, 1), SeasonType: 3 },
    { ...standing(2, 0, 1), SeasonType: 3 },
  ]
  const combined = validateAndCombineCollegeStandings(2025, regular, postseason, [3, 3])

  assert.deepEqual(combined.map((record) => ({
    id: record.TeamID,
    wins: record.Wins,
    losses: record.Losses,
    regularWins: record.regularWins,
    postseasonWins: record.postseasonWins,
  })), [
    { id: 1, wins: 13, losses: 3, regularWins: 11, postseasonWins: 2 },
    { id: 2, wins: 9, losses: 4, regularWins: 9, postseasonWins: 0 },
    { id: 3, wins: 6, losses: 6, regularWins: 6, postseasonWins: 0 },
  ])
})

test('refuses partial or inconsistent college standings feeds', () => {
  assert.throws(
    () => validateAndCombineCollegeStandings(2025, [standing(1, 10, 2)], [], [3, 3]),
    /returned 1 teams; expected 3-3/,
  )
  assert.throws(
    () => validateAndCombineCollegeStandings(
      2025,
      [standing(1, 10, 2), standing(2, 8, 4), standing(3, 6, 6)],
      [{ ...standing(4, 1, 0), SeasonType: 3 }],
      [3, 3],
    ),
    /postseason standings contained unknown team Team 4/,
  )
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
