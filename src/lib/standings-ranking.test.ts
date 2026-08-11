import assert from 'node:assert/strict'
import test from 'node:test'

import { compareStandings, type RankedStanding } from './standings-ranking.ts'

function standing(overrides: Partial<RankedStanding>): RankedStanding {
  return {
    totalWins: 80,
    bestNflTeamWins: 10,
    bestCollegeTeamWins: 11,
    rankingName: 'Player A',
    ...overrides,
  }
}

test('ranks total wins before either team-level tiebreaker', () => {
  const standings = [
    standing({ totalWins: 80, bestNflTeamWins: 15, rankingName: 'Lower total' }),
    standing({ totalWins: 81, bestNflTeamWins: 8, rankingName: 'Higher total' }),
  ].sort(compareStandings)

  assert.equal(standings[0].rankingName, 'Higher total')
})

test('uses the best single NFL team when total wins are tied', () => {
  const standings = [
    standing({ bestNflTeamWins: 9, bestCollegeTeamWins: 13, rankingName: 'Player B' }),
    standing({ bestNflTeamWins: 12, bestCollegeTeamWins: 8, rankingName: 'Player A' }),
  ].sort(compareStandings)

  assert.equal(standings[0].rankingName, 'Player A')
})

test('uses the best single college team when total and NFL tiebreakers are tied', () => {
  const standings = [
    standing({ bestCollegeTeamWins: 10, rankingName: 'Player B' }),
    standing({ bestCollegeTeamWins: 12, rankingName: 'Player A' }),
  ].sort(compareStandings)

  assert.equal(standings[0].rankingName, 'Player A')
})

test('uses the player name only to make an exact competitive tie deterministic', () => {
  const standings = [
    standing({ rankingName: 'Player B' }),
    standing({ rankingName: 'Player A' }),
  ].sort(compareStandings)

  assert.deepEqual(standings.map((entry) => entry.rankingName), ['Player A', 'Player B'])
})
