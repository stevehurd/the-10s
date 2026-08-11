import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canActorMakeDraftSelection,
  canSelectLeague,
  generateDraftTurns,
  LEAGUES,
  planLastPickUndo,
  rankAutopickCandidates,
  seedDraftOrder,
  selectAutopick,
  seasonStatusForDraftSession,
  shouldRunServerAutopick,
  validateReleaseMinimums,
  type DraftSeat,
  type DraftTeam,
  type League,
  type RosterSlot,
} from './engine.ts'

test('only the on-clock player, a commissioner, or the server autopick may select', () => {
  assert.equal(canActorMakeDraftSelection({
    actorUserId: 'on-clock',
    onClockUserId: 'on-clock',
    actorIsCommissioner: false,
    selectionType: 'MANUAL',
  }), true)
  assert.equal(canActorMakeDraftSelection({
    actorUserId: 'other-member',
    onClockUserId: 'on-clock',
    actorIsCommissioner: false,
    selectionType: 'MANUAL',
  }), false)
  assert.equal(canActorMakeDraftSelection({
    actorUserId: 'commissioner',
    onClockUserId: 'on-clock',
    actorIsCommissioner: true,
    selectionType: 'COMMISSIONER',
  }), true)
  assert.equal(canActorMakeDraftSelection({
    actorUserId: null,
    onClockUserId: 'on-clock',
    actorIsCommissioner: true,
    selectionType: 'AUTOPICK',
  }), true)
  assert.equal(canActorMakeDraftSelection({
    actorUserId: null,
    onClockUserId: 'on-clock',
    actorIsCommissioner: false,
    selectionType: 'MANUAL',
  }), false)
})

test('server autopick only claims expired active turns in an official live draft', () => {
  const now = new Date('2026-08-08T12:00:00.000Z')
  const expired = new Date('2026-08-08T11:59:59.000Z')
  const future = new Date('2026-08-08T12:00:01.000Z')

  assert.equal(shouldRunServerAutopick({ sessionMode: 'OFFICIAL', sessionStatus: 'LIVE', turnStatus: 'ACTIVE', deadlineAt: expired, now }), true)
  assert.equal(shouldRunServerAutopick({ sessionMode: 'REHEARSAL', sessionStatus: 'LIVE', turnStatus: 'ACTIVE', deadlineAt: expired, now }), false)
  assert.equal(shouldRunServerAutopick({ sessionMode: 'OFFICIAL', sessionStatus: 'PAUSED', turnStatus: 'ACTIVE', deadlineAt: expired, now }), false)
  assert.equal(shouldRunServerAutopick({ sessionMode: 'OFFICIAL', sessionStatus: 'LIVE', turnStatus: 'PENDING', deadlineAt: expired, now }), false)
  assert.equal(shouldRunServerAutopick({ sessionMode: 'OFFICIAL', sessionStatus: 'LIVE', turnStatus: 'ACTIVE', deadlineAt: future, now }), false)
  assert.equal(shouldRunServerAutopick({ sessionMode: 'OFFICIAL', sessionStatus: 'LIVE', turnStatus: 'ACTIVE', deadlineAt: null, now }), false)
})

function team(id: string, league: League, wins = 0, losses = 0, ties = 0): DraftTeam {
  return { id, name: id, league, priorRecord: { wins, losses, ties } }
}

function rosterSlot(number: number, state: RosterSlot['state'], league?: League): RosterSlot {
  return {
    number,
    state,
    team: league ? team(`${league}-${number}`, league) : null,
  }
}

function seat(id: string, baseOrder: number, keeperRounds: number[] = []): DraftSeat {
  return {
    id,
    name: id,
    baseOrder,
    slots: Array.from({ length: 10 }, (_, index) => {
      const number = index + 1
      return keeperRounds.includes(number)
        ? rosterSlot(number, 'KEEPER', number <= 2 ? LEAGUES.NFL : LEAGUES.COLLEGE)
        : rosterSlot(number, 'OPEN')
    }),
  }
}

function rosterWithCounts(nfl: number, college: number): RosterSlot[] {
  const slots: RosterSlot[] = []
  for (let index = 0; index < 10; index += 1) {
    const number = index + 1
    if (index < nfl) slots.push(rosterSlot(number, 'PICKED', LEAGUES.NFL))
    else if (index < nfl + college) slots.push(rosterSlot(number, 'PICKED', LEAGUES.COLLEGE))
    else slots.push(rosterSlot(number, 'OPEN'))
  }
  return slots
}

test('seeds the lowest standing first with category and commissioner fallbacks', () => {
  const order = seedDraftOrder([
    { seatId: 'a', name: 'Alex', totalWins: 100, nflWins: 20, collegeWins: 80 },
    { seatId: 'b', name: 'Blair', totalWins: 90, nflWins: 22, collegeWins: 68 },
    { seatId: 'c', name: 'Casey', totalWins: 90, nflWins: 18, collegeWins: 72 },
    { seatId: 'd', name: 'Drew', totalWins: 90, nflWins: 18, collegeWins: 72, commissionerOrder: 1 },
  ])

  assert.deepEqual(order.map((standing) => standing.seatId), ['d', 'c', 'b', 'a'])
})

test('snakes each round and skips seats whose same-numbered slot is kept', () => {
  const turns = generateDraftTurns([
    seat('last-place', 1, [2]),
    seat('middle', 2, [1, 3]),
    seat('first-place', 3, [3]),
  ])

  assert.deepEqual(
    turns.filter((turn) => turn.round <= 3).map((turn) => [turn.round, turn.seatId]),
    [
      [1, 'last-place'],
      [1, 'first-place'],
      [2, 'first-place'],
      [2, 'middle'],
      [3, 'last-place'],
    ],
  )
})

test('validates the minimum one NFL and two college releases', () => {
  const roster = [
    rosterSlot(1, 'KEEPER', LEAGUES.NFL),
    rosterSlot(2, 'KEEPER', LEAGUES.NFL),
    ...Array.from({ length: 8 }, (_, index) => rosterSlot(index + 3, 'KEEPER', LEAGUES.COLLEGE)),
  ]

  const invalid = validateReleaseMinimums(roster, new Set([1, 3]))
  assert.equal(invalid.valid, false)
  assert.match(invalid.errors.join(' '), /2 college/)

  const valid = validateReleaseMinimums(roster, new Set([1, 3, 4]))
  assert.equal(valid.valid, true)
  assert.equal(valid.releasedNFL, 1)
  assert.equal(valid.releasedCollege, 2)

  assert.equal(validateReleaseMinimums(roster, new Set(), true).valid, true)
})

test('enforces an exact two NFL and eight college final roster', () => {
  assert.equal(canSelectLeague(rosterWithCounts(1, 7), LEAGUES.NFL), true)
  assert.equal(canSelectLeague(rosterWithCounts(1, 7), LEAGUES.COLLEGE), true)
  assert.equal(canSelectLeague(rosterWithCounts(2, 7), LEAGUES.NFL), false)
  assert.equal(canSelectLeague(rosterWithCounts(2, 7), LEAGUES.COLLEGE), true)
  assert.equal(canSelectLeague(rosterWithCounts(1, 8), LEAGUES.NFL), true)
  assert.equal(canSelectLeague(rosterWithCounts(1, 8), LEAGUES.COLLEGE), false)
})

test('ranks autopicks by wins, losses, ties, and name', () => {
  const ranked = rankAutopickCandidates([
    team('Beta', LEAGUES.COLLEGE, 10, 2, 0),
    team('Delta', LEAGUES.COLLEGE, 11, 3, 0),
    team('Charlie', LEAGUES.COLLEGE, 10, 1, 0),
    team('Alpha', LEAGUES.COLLEGE, 10, 1, 1),
  ])

  assert.deepEqual(ranked.map((candidate) => candidate.id), ['Delta', 'Alpha', 'Charlie', 'Beta'])
})

test('autopick ignores a higher-ranked team that would violate roster quotas', () => {
  const selected = selectAutopick(rosterWithCounts(2, 7), [
    team('NFL favorite', LEAGUES.NFL, 17, 0),
    team('College choice', LEAGUES.COLLEGE, 12, 1),
  ])

  assert.equal(selected?.id, 'College choice')
})

test('generates every turn for a fifteen-seat draft without keepers', () => {
  const seats = Array.from({ length: 15 }, (_, index) => seat(`seat-${index + 1}`, index + 1))
  const turns = generateDraftTurns(seats)

  assert.equal(turns.length, 150)
  assert.deepEqual(turns.slice(0, 15).map((turn) => turn.seatId), seats.map((draftSeat) => draftSeat.id))
  assert.deepEqual(
    turns.slice(15, 30).map((turn) => turn.seatId),
    [...seats].reverse().map((draftSeat) => draftSeat.id),
  )
})

test('undo rewinds the last selected turn and demotes the following active turn', () => {
  assert.deepEqual(
    planLastPickUndo([
      { index: 0, status: 'COMPLETED', selected: true },
      { index: 1, status: 'COMPLETED', selected: true },
      { index: 2, status: 'ACTIVE', selected: false },
      { index: 3, status: 'PENDING', selected: false },
    ]),
    { reopenedTurnIndex: 1, demotedActiveTurnIndex: 2 },
  )
})

test('undo supports a completed draft and refuses an invalid active position', () => {
  assert.deepEqual(
    planLastPickUndo([{ index: 0, status: 'COMPLETED', selected: true }]),
    { reopenedTurnIndex: 0, demotedActiveTurnIndex: null },
  )
  assert.equal(planLastPickUndo([{ index: 0, status: 'PENDING', selected: false }]), null)
  assert.throws(
    () =>
      planLastPickUndo([
        { index: 0, status: 'ACTIVE', selected: false },
        { index: 1, status: 'COMPLETED', selected: true },
      ]),
    /must follow/,
  )
})

test('official draft lifecycle advances the season while rehearsals remain isolated', () => {
  assert.equal(seasonStatusForDraftSession('OFFICIAL', 'LIVE'), 'DRAFT')
  assert.equal(seasonStatusForDraftSession('OFFICIAL', 'PAUSED'), 'DRAFT')
  assert.equal(seasonStatusForDraftSession('OFFICIAL', 'COMPLETED'), 'ACTIVE')
  assert.equal(seasonStatusForDraftSession('OFFICIAL', 'SCHEDULED'), null)
  assert.equal(seasonStatusForDraftSession('REHEARSAL', 'LIVE'), null)
  assert.equal(seasonStatusForDraftSession('REHEARSAL', 'COMPLETED'), null)
})
