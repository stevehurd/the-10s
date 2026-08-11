export function isSyntheticDevelopmentTeam(team) {
  const expectedPrefix = team.league === 'NFL' ? 'Demo NFL ' : 'Demo College '

  return (
    team.name.startsWith(expectedPrefix) &&
    team.externalId == null &&
    team.sportsDataTeamId == null &&
    team.sportsDataGlobalTeamId == null
  )
}

export function assertSeedModeTransition({ existingSportsDataEntries, useSportsData, allowDemoDowngrade }) {
  if (existingSportsDataEntries > 0 && !useSportsData && !allowDemoDowngrade) {
    throw new Error(
      'Refusing to replace a SportsDataIO development pool with synthetic teams. ' +
      'Use the SportsDataIO seed, or pass --allow-demo-downgrade for an intentional reset.',
    )
  }
}

export function assertSyntheticTeamCleanupSafe(teams) {
  const referencedTeams = teams.filter((team) =>
    Object.values(team._count).some((count) => count > 0),
  )

  if (referencedTeams.length > 0) {
    const names = referencedTeams.slice(0, 5).map((team) => team.name).join(', ')
    const remainder = referencedTeams.length > 5 ? ` and ${referencedTeams.length - 5} more` : ''
    throw new Error(
      `Refusing to delete synthetic teams referenced outside the development pool: ${names}${remainder}`,
    )
  }
}
