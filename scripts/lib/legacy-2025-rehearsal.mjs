import { createHash } from 'node:crypto'

export function legacyRosterNickname(userName) {
  const nickname = userName?.trim()
  if (!nickname) throw new Error('A legacy player name is required for the roster nickname')
  return nickname
}

export function legacyFingerprint({ season, users, teams }) {
  const snapshot = {
    season: { id: season.id, year: season.year },
    users: users
      .map((user) => ({ id: user.id, name: user.name, email: user.email }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    drafts: users
      .flatMap((user) => user.drafts.map((draft) => ({
        id: draft.id,
        userId: draft.userId,
        teamId: draft.teamId,
        round: draft.round,
        pickNumber: draft.pickNumber,
        isKeeper: draft.isKeeper,
      })))
      .sort((left, right) => left.id.localeCompare(right.id)),
    teams: teams
      .map((team) => ({
        id: team.id,
        name: team.name,
        league: team.league,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  }
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function validateLegacyData({ users, teams }) {
  const errors = []
  const warnings = []
  const knownTeamIds = new Set(teams.map((team) => team.id))
  const normalizedEmails = new Map()

  for (const team of teams) {
    for (const [label, value] of [['wins', team.wins], ['losses', team.losses], ['ties', team.ties]]) {
      if (!Number.isInteger(value) || value < 0) errors.push(`${team.name} has invalid ${label}: ${value}`)
    }
    if (!['NFL', 'COLLEGE'].includes(team.league)) errors.push(`${team.name} has unsupported league ${team.league}`)
  }

  for (const user of users) {
    try {
      legacyRosterNickname(user.name)
    } catch (error) {
      errors.push(error.message)
    }
    const email = user.email?.trim().toLowerCase()
    if (!email) warnings.push(`${user.name} has no email and cannot sign in until one is assigned`)
    else if (normalizedEmails.has(email)) errors.push(`${user.name} and ${normalizedEmails.get(email)} share the same email`)
    else normalizedEmails.set(email, user.name)

    const rounds = new Set(user.drafts.map((draft) => draft.round))
    if (rounds.size !== user.drafts.length) errors.push(`${user.name} has duplicate round assignments`)
    if (user.drafts.length !== 10) errors.push(`${user.name} has ${user.drafts.length} teams instead of 10`)

    const nfl = user.drafts.filter((draft) => draft.team?.league === 'NFL').length
    const college = user.drafts.filter((draft) => draft.team?.league === 'COLLEGE').length
    if (nfl !== 2 || college !== 8) {
      errors.push(`${user.name} has ${nfl} NFL and ${college} college teams instead of 2 and 8`)
    }

    for (const draft of user.drafts) {
      if (draft.round < 1 || draft.round > 10) errors.push(`${user.name} has an invalid round ${draft.round}`)
      if (!draft.team || !knownTeamIds.has(draft.teamId)) {
        errors.push(`${user.name} round ${draft.round} references an unknown team ${draft.teamId}`)
      }
    }
  }

  const ownerByTeam = new Map()
  for (const user of users) {
    for (const draft of user.drafts) {
      const existingOwner = ownerByTeam.get(draft.teamId)
      if (existingOwner) errors.push(`A team is assigned to both ${existingOwner} and ${user.name}`)
      ownerByTeam.set(draft.teamId, user.name)
    }
  }

  return { errors, warnings }
}

export function calculateStanding(user) {
  let totalWins = 0
  let nflWins = 0
  let collegeWins = 0
  let bestNflWins = 0
  let bestCollegeWins = 0

  for (const draft of user.drafts) {
    totalWins += draft.team.wins
    if (draft.team.league === 'NFL') {
      nflWins += draft.team.wins
      bestNflWins = Math.max(bestNflWins, draft.team.wins)
    }
    if (draft.team.league === 'COLLEGE') {
      collegeWins += draft.team.wins
      bestCollegeWins = Math.max(bestCollegeWins, draft.team.wins)
    }
  }

  return { user, totalWins, nflWins, collegeWins, bestNflWins, bestCollegeWins }
}

export function rankLegacyStandings(users) {
  return users.map(calculateStanding).sort((left, right) => (
    right.totalWins - left.totalWins ||
    right.bestNflWins - left.bestNflWins ||
    right.bestCollegeWins - left.bestCollegeWins ||
    left.user.name.localeCompare(right.user.name)
  ))
}

export function createPreflightReport(data) {
  const { errors, warnings } = validateLegacyData(data)
  return {
    version: 1,
    passed: errors.length === 0,
    sourceFingerprint: legacyFingerprint(data),
    season: { id: data.season.id, name: data.season.name, year: data.season.year },
    counts: {
      users: data.users.length,
      teams: data.teams.length,
      rosterAssignments: data.users.reduce((total, user) => total + user.drafts.length, 0),
    },
    errors,
    warnings,
  }
}

export function reconcileMigrationSnapshot(legacy, migrated, options = {}) {
  const errors = []
  const expectedRankByUserId = new Map(rankLegacyStandings(legacy.users).map((standing, index) => [standing.user.id, index + 1]))
  const participantByUserId = new Map(migrated.participants.map((participant) => [participant.userId, participant]))
  if (migrated.participants.length !== legacy.users.length) {
    errors.push(`Expected ${legacy.users.length} participants, found ${migrated.participants.length}`)
  }

  for (const user of legacy.users) {
    const participant = participantByUserId.get(user.id)
    if (!participant) {
      errors.push(`${user.name} has no season participant`)
      continue
    }
    if (participant.rosterSlots.length !== user.drafts.length) {
      errors.push(`${user.name} roster slot count differs from legacy drafts`)
    }
    const legacyTeamByRound = new Map(user.drafts.map((draft) => [draft.round, draft.teamId]))
    for (const slot of participant.rosterSlots) {
      if (slot.teamId !== legacyTeamByRound.get(slot.number)) {
        errors.push(`${user.name} slot ${slot.number} team differs`)
      }
    }
    const standing = calculateStanding(user)
    if (participant.totalWins !== standing.totalWins) errors.push(`${user.name} total wins differ`)
    if (participant.nflWins !== standing.nflWins) errors.push(`${user.name} NFL wins differ`)
    if (participant.collegeWins !== standing.collegeWins) errors.push(`${user.name} college wins differ`)
    if (participant.finalRank !== expectedRankByUserId.get(user.id)) errors.push(`${user.name} final rank differs`)
    if (participant.poolSeat?.label !== legacyRosterNickname(user.name)) {
      errors.push(`${user.name} roster nickname differs from the legacy player name`)
    }
  }

  if (options.commissionerEmail || options.commissionerUserId) {
    const expectedCommissioner = options.commissionerUserId
      ? legacy.users.find((user) => user.id === options.commissionerUserId)
      : legacy.users.find(
        (user) => user.email?.trim().toLowerCase() === options.commissionerEmail.trim().toLowerCase(),
      )
    const activeMemberships = (migrated.memberships ?? []).filter((membership) => membership.status === 'ACTIVE')
    const commissioners = activeMemberships.filter((membership) => membership.role === 'COMMISSIONER')
    if (activeMemberships.length !== legacy.users.length) {
      errors.push(`Expected ${legacy.users.length} active memberships, found ${activeMemberships.length}`)
    }
    if (commissioners.length !== 1 || commissioners[0]?.userId !== expectedCommissioner?.id) {
      errors.push('Exactly the intended 2025 user must be commissioner')
    }
  }

  const recordByTeamId = new Map(migrated.teamRecords.map((record) => [record.teamId, record]))
  if (migrated.teamRecords.length !== legacy.teams.length) {
    errors.push(`Expected ${legacy.teams.length} team records, found ${migrated.teamRecords.length}`)
  }
  for (const team of legacy.teams) {
    const record = recordByTeamId.get(team.id)
    if (!record) {
      errors.push(`${team.name} has no 2025 team record`)
      continue
    }
    if (record.wins !== team.wins || record.losses !== team.losses || record.ties !== team.ties) {
      errors.push(`${team.name} W-L-T differs from the legacy source`)
    }
    if (!record.finalizedAt) errors.push(`${team.name} record is not finalized`)
  }
  if (migrated.season?.status !== 'FINALIZED' || !migrated.season.finalizedAt) {
    errors.push('The 2025 season is not finalized')
  }
  return errors
}
