export function buildLegacy2025Fixture() {
  const users = Array.from({ length: 3 }, (_, index) => ({
    id: `user-${index + 1}`,
    name: `Synthetic Player ${index + 1}`,
    email: `player${index + 1}@example.test`,
    drafts: [],
  }))
  const teams = []

  for (const [userIndex, user] of users.entries()) {
    for (let round = 1; round <= 10; round += 1) {
      const league = round <= 2 ? 'NFL' : 'COLLEGE'
      const teamNumber = userIndex * 10 + round
      const team = {
        id: `team-${teamNumber}`,
        name: `Synthetic ${league} Team ${teamNumber}`,
        abbreviation: `T${teamNumber}`,
        league,
        wins: (teamNumber * 3) % 13,
        losses: (teamNumber * 2) % 8,
        ties: teamNumber % 11 === 0 ? 1 : 0,
        active: true,
        conference: league === 'COLLEGE' ? 'Synthetic Conference' : null,
        division: league === 'NFL' ? 'Synthetic Division' : null,
      }
      teams.push(team)
      user.drafts.push({
        id: `draft-${userIndex + 1}-${round}`,
        userId: user.id,
        teamId: team.id,
        round,
        pickNumber: userIndex * 10 + round,
        isKeeper: false,
        team,
      })
    }
  }

  return {
    season: { id: 'season-2025', year: 2025, name: 'Synthetic 2025 Season', finalizedAt: null },
    users,
    teams,
  }
}

export function buildMigratedSnapshot(legacy, commissionerEmail = 'player1@example.test') {
  const rankedUserIds = new Map(
    [...legacy.users]
      .map((user) => ({
        user,
        totalWins: user.drafts.reduce((sum, draft) => sum + draft.team.wins, 0),
        bestNflWins: Math.max(...user.drafts.filter((draft) => draft.team.league === 'NFL').map((draft) => draft.team.wins)),
        bestCollegeWins: Math.max(...user.drafts.filter((draft) => draft.team.league === 'COLLEGE').map((draft) => draft.team.wins)),
      }))
      .sort((left, right) => right.totalWins - left.totalWins || right.bestNflWins - left.bestNflWins || right.bestCollegeWins - left.bestCollegeWins || left.user.name.localeCompare(right.user.name))
      .map((standing, index) => [standing.user.id, index + 1]),
  )
  return {
    season: { status: 'FINALIZED', finalizedAt: new Date('2026-02-01T00:00:00Z') },
    participants: legacy.users.map((user) => {
      const nflWins = user.drafts.filter((draft) => draft.team.league === 'NFL').reduce((sum, draft) => sum + draft.team.wins, 0)
      const collegeWins = user.drafts.filter((draft) => draft.team.league === 'COLLEGE').reduce((sum, draft) => sum + draft.team.wins, 0)
      return {
        userId: user.id,
        totalWins: nflWins + collegeWins,
        nflWins,
        collegeWins,
        finalRank: rankedUserIds.get(user.id),
        rosterSlots: user.drafts.map((draft) => ({ number: draft.round, teamId: draft.teamId })),
      }
    }),
    memberships: legacy.users.map((user) => ({
      userId: user.id,
      status: 'ACTIVE',
      role: user.email === commissionerEmail ? 'COMMISSIONER' : 'MEMBER',
    })),
    teamRecords: legacy.teams.map((team) => ({
      teamId: team.id,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      finalizedAt: new Date('2026-02-01T00:00:00Z'),
    })),
  }
}
