import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFinalizationReview } from './finalization-rules.ts'

function participant(input: {
  id: string
  name: string
  nflWins: [number, number]
  collegeWins: number[]
}) {
  const teams = [
    ...input.nflWins.map((wins, index) => ({ id: `${input.id}-nfl-${index}`, league: 'NFL', wins })),
    ...input.collegeWins.map((wins, index) => ({ id: `${input.id}-college-${index}`, league: 'COLLEGE', wins })),
  ]
  return {
    participant: {
      id: input.id,
      user: { name: input.name },
      rosterSlots: teams.map((team, index) => ({
        number: index + 1,
        teamId: team.id,
        team: { league: team.league },
      })),
    },
    records: teams.map((team) => ({ teamId: team.id, wins: team.wins })),
  }
}

test('finalization preview calculates ranks and the approved team-level tiebreakers', () => {
  const first = participant({
    id: 'one',
    name: 'NFL tiebreak winner',
    nflWins: [12, 2],
    collegeWins: [10, 10, 10, 10, 10, 10, 6, 0],
  })
  const second = participant({
    id: 'two',
    name: 'Higher college team',
    nflWins: [10, 8],
    collegeWins: [12, 10, 10, 10, 10, 6, 4, 0],
  })

  const review = buildFinalizationReview({
    seasonStatus: 'ACTIVE',
    participants: [second.participant, first.participant],
    records: [...first.records, ...second.records],
    officialDraftStatus: 'COMPLETED',
  })

  assert.deepEqual(review.issues, [])
  assert.equal(review.standings[0].participantId, 'one')
  assert.equal(review.standings[0].totalWins, review.standings[1].totalWins)
})

test('finalization preview blocks incomplete rosters, missing records, and unfinished drafts', () => {
  const entry = participant({
    id: 'one',
    name: 'Incomplete Player',
    nflWins: [8, 7],
    collegeWins: [10, 9, 8, 7, 6, 5, 4, 3],
  })
  entry.participant.rosterSlots.pop()

  const review = buildFinalizationReview({
    seasonStatus: 'ACTIVE',
    participants: [entry.participant],
    records: entry.records.slice(1),
    officialDraftStatus: 'PAUSED',
  })

  assert.ok(review.issues.some((issue) => issue.includes('official draft')))
  assert.ok(review.issues.some((issue) => issue.includes('10 assigned roster slots')))
  assert.ok(review.issues.some((issue) => issue.includes('2 NFL and 8 college')))
  assert.ok(review.issues.some((issue) => issue.includes('without a season record')))
})
