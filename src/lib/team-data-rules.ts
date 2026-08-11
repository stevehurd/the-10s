import type { TeamSyncData } from './team-data-types'

interface CollegeHierarchyTeam {
  TeamID?: number | null
  GlobalTeamID?: number | null
  Active?: boolean
  School?: string | null
  Name?: string | null
  ShortDisplayName?: string | null
  Key?: string | null
  Conference?: string | null
  LogoUrl?: string | null
  TeamLogoUrl?: string | null
}

interface CollegeHierarchyConference {
  Name?: string | null
  ConferenceName?: string | null
  Teams?: CollegeHierarchyTeam[] | null
}

export function mapCollegeHierarchyToTeams(
  hierarchy: CollegeHierarchyConference[],
): TeamSyncData[] {
  const teams = hierarchy.flatMap((conference) =>
    (conference.Teams ?? []).flatMap((team) => {
      if (team.Active === false) return []
      const conferenceName =
        team.Conference?.trim() ||
        conference.ConferenceName?.trim() ||
        conference.Name?.trim() ||
        null
      const school = team.School?.trim() ?? ''
      const mascot = team.Name?.trim() ?? ''
      const name = [school, mascot].filter(Boolean).join(' ')
      if (!team.TeamID || !conferenceName || !name) return []

      const abbreviation =
        team.ShortDisplayName?.trim() ||
        team.Key?.trim() ||
        school.slice(0, 4).toUpperCase()

      return [{
        name,
        abbreviation,
        conference: conferenceName,
        division: null,
        league: 'COLLEGE' as const,
        externalId: team.GlobalTeamID?.toString() ?? null,
        sportsDataTeamId: team.TeamID.toString(),
        sportsDataGlobalTeamId: team.GlobalTeamID?.toString() ?? null,
        logoUrl: team.TeamLogoUrl?.trim() || team.LogoUrl?.trim() || null,
      }]
    }),
  )

  const ids = new Set<string>()
  for (const team of teams) {
    if (!team.sportsDataTeamId || ids.has(team.sportsDataTeamId)) {
      throw new Error(`SportsDataIO returned duplicate college team ID ${team.sportsDataTeamId ?? 'unknown'}`)
    }
    ids.add(team.sportsDataTeamId)
  }
  if (teams.length < 120 || teams.length > 160) {
    throw new Error(`SportsDataIO returned an implausible active FBS field (${teams.length} teams)`)
  }
  return teams
}
