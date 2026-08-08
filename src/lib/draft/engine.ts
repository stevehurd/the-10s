export const LEAGUES = {
  NFL: 'NFL',
  COLLEGE: 'COLLEGE',
} as const

export type League = (typeof LEAGUES)[keyof typeof LEAGUES]

export const ROSTER_SIZE = 10

export const ROSTER_LIMITS: Readonly<Record<League, number>> = {
  NFL: 2,
  COLLEGE: 8,
}

export type SlotState = 'KEEPER' | 'OPEN' | 'PICKED'

export interface TeamRecord {
  wins: number
  losses: number
  ties: number
}

export interface DraftTeam {
  id: string
  name: string
  league: League
  priorRecord: TeamRecord | null
}

export function seasonStatusForDraftSession(
  mode: string,
  draftStatus: string,
): 'DRAFT' | 'ACTIVE' | null {
  if (mode !== 'OFFICIAL') return null
  if (draftStatus === 'LIVE' || draftStatus === 'PAUSED') return 'DRAFT'
  if (draftStatus === 'COMPLETED') return 'ACTIVE'
  return null
}

export function shouldRunServerAutopick(input: {
  sessionMode: string
  sessionStatus: string
  turnStatus: string
  deadlineAt: Date | null
  now: Date
}) {
  return Boolean(
    input.sessionMode === 'OFFICIAL' &&
      input.sessionStatus === 'LIVE' &&
      input.turnStatus === 'ACTIVE' &&
      input.deadlineAt &&
      input.deadlineAt.getTime() <= input.now.getTime(),
  )
}

export interface RosterSlot {
  number: number
  state: SlotState
  team: DraftTeam | null
}

export interface DraftSeat {
  id: string
  name: string
  baseOrder: number
  slots: RosterSlot[]
}

export interface DraftTurn {
  index: number
  round: number
  orderInRound: number
  seatId: string
  slotNumber: number
}

export interface RewindableTurn {
  index: number
  status: string
  selected: boolean
}

export interface DraftUndoPlan {
  reopenedTurnIndex: number
  demotedActiveTurnIndex: number | null
}

export interface StandingSeed {
  seatId: string
  name: string
  totalWins: number
  nflWins: number
  collegeWins: number
  commissionerOrder?: number
}

export interface ReleaseValidation {
  valid: boolean
  releasedNFL: number
  releasedCollege: number
  errors: string[]
}

function assertRosterSlots(slots: RosterSlot[]): void {
  if (slots.length !== ROSTER_SIZE) {
    throw new Error(`A roster must contain exactly ${ROSTER_SIZE} slots`)
  }

  const numbers = new Set(slots.map((slot) => slot.number))
  if (numbers.size !== ROSTER_SIZE) {
    throw new Error('Roster slot numbers must be unique')
  }

  for (let number = 1; number <= ROSTER_SIZE; number += 1) {
    if (!numbers.has(number)) throw new Error(`Roster is missing slot ${number}`)
  }
}

export function seedDraftOrder(standings: StandingSeed[]): StandingSeed[] {
  return [...standings].sort((left, right) => {
    // Lower-ranked seats draft first. A stronger category record ranks later.
    return (
      left.totalWins - right.totalWins ||
      left.nflWins - right.nflWins ||
      left.collegeWins - right.collegeWins ||
      (left.commissionerOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.commissionerOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.name.localeCompare(right.name) ||
      left.seatId.localeCompare(right.seatId)
    )
  })
}

export function generateDraftTurns(seats: DraftSeat[]): DraftTurn[] {
  if (seats.length === 0) return []

  const baseOrderValues = new Set(seats.map((seat) => seat.baseOrder))
  if (baseOrderValues.size !== seats.length) {
    throw new Error('Every draft seat must have a unique base order')
  }

  const orderedSeats = [...seats].sort(
    (left, right) => left.baseOrder - right.baseOrder || left.id.localeCompare(right.id),
  )

  for (const seat of orderedSeats) assertRosterSlots(seat.slots)

  const turns: DraftTurn[] = []

  for (let round = 1; round <= ROSTER_SIZE; round += 1) {
    const roundSeats = round % 2 === 1 ? orderedSeats : [...orderedSeats].reverse()
    let orderInRound = 0

    for (const seat of roundSeats) {
      const slot = seat.slots.find((candidate) => candidate.number === round)
      if (!slot || slot.state !== 'OPEN') continue

      orderInRound += 1
      turns.push({
        index: turns.length,
        round,
        orderInRound,
        seatId: seat.id,
        slotNumber: slot.number,
      })
    }
  }

  return turns
}

export function validateReleaseMinimums(
  priorSlots: RosterSlot[],
  releasedSlotNumbers: ReadonlySet<number>,
  commissionerOverride = false,
): ReleaseValidation {
  assertRosterSlots(priorSlots)

  let releasedNFL = 0
  let releasedCollege = 0
  const errors: string[] = []

  for (const slot of priorSlots) {
    if (!releasedSlotNumbers.has(slot.number)) continue
    if (!slot.team) {
      errors.push(`Slot ${slot.number} cannot be released because it has no team`)
      continue
    }

    if (slot.team.league === LEAGUES.NFL) releasedNFL += 1
    if (slot.team.league === LEAGUES.COLLEGE) releasedCollege += 1
  }

  if (!commissionerOverride) {
    if (releasedNFL < 1) errors.push('At least 1 NFL team must be released')
    if (releasedCollege < 2) errors.push('At least 2 college teams must be released')
  }

  return {
    valid: errors.length === 0,
    releasedNFL,
    releasedCollege,
    errors,
  }
}

export function canSelectLeague(slots: RosterSlot[], candidateLeague: League): boolean {
  assertRosterSlots(slots)

  const assigned = slots.filter((slot) => slot.team !== null)
  const assignedNFL = assigned.filter((slot) => slot.team?.league === LEAGUES.NFL).length
  const assignedCollege = assigned.filter(
    (slot) => slot.team?.league === LEAGUES.COLLEGE,
  ).length

  const nextNFL = assignedNFL + (candidateLeague === LEAGUES.NFL ? 1 : 0)
  const nextCollege = assignedCollege + (candidateLeague === LEAGUES.COLLEGE ? 1 : 0)

  if (nextNFL > ROSTER_LIMITS.NFL || nextCollege > ROSTER_LIMITS.COLLEGE) return false

  const remainingSlots = ROSTER_SIZE - (assigned.length + 1)
  const nflStillNeeded = ROSTER_LIMITS.NFL - nextNFL
  const collegeStillNeeded = ROSTER_LIMITS.COLLEGE - nextCollege

  return nflStillNeeded >= 0 && collegeStillNeeded >= 0 && nflStillNeeded + collegeStillNeeded === remainingSlots
}

export function eligibleTeamsForRoster(slots: RosterSlot[], teams: DraftTeam[]): DraftTeam[] {
  return teams.filter((team) => canSelectLeague(slots, team.league))
}

export function rankAutopickCandidates(teams: DraftTeam[]): DraftTeam[] {
  return [...teams].sort((left, right) => {
    const leftRecord = left.priorRecord ?? { wins: 0, losses: Number.MAX_SAFE_INTEGER, ties: 0 }
    const rightRecord = right.priorRecord ?? {
      wins: 0,
      losses: Number.MAX_SAFE_INTEGER,
      ties: 0,
    }

    return (
      rightRecord.wins - leftRecord.wins ||
      leftRecord.losses - rightRecord.losses ||
      rightRecord.ties - leftRecord.ties ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    )
  })
}

export function selectAutopick(slots: RosterSlot[], availableTeams: DraftTeam[]): DraftTeam | null {
  const eligibleTeams = eligibleTeamsForRoster(slots, availableTeams)
  return rankAutopickCandidates(eligibleTeams)[0] ?? null
}

export function nextUnfilledTurn(
  turns: DraftTurn[],
  filledTurnIndexes: ReadonlySet<number>,
): DraftTurn | null {
  return turns.find((turn) => !filledTurnIndexes.has(turn.index)) ?? null
}

export function planLastPickUndo(turns: RewindableTurn[]): DraftUndoPlan | null {
  const lastSelected = [...turns]
    .filter((turn) => turn.selected)
    .sort((left, right) => right.index - left.index)[0]
  if (!lastSelected) return null

  const activeTurns = turns.filter((turn) => turn.status === 'ACTIVE')
  if (activeTurns.length > 1) throw new Error('A draft cannot have multiple active turns')
  const active = activeTurns[0] ?? null
  if (active && active.index <= lastSelected.index) {
    throw new Error('The active turn must follow the last selected turn')
  }

  return {
    reopenedTurnIndex: lastSelected.index,
    demotedActiveTurnIndex: active?.index ?? null,
  }
}
