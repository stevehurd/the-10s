import type { CombinedStanding } from './standings-calculation.ts'

export interface StandingTeamIdentity {
  id: string
  name: string
  abbreviation: string
  sportsDataTeamId: string | null
  externalId: string | null
}

function lookupKey(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() || null
}

export function mapStandingsToTeams<T extends StandingTeamIdentity>(
  standings: CombinedStanding[],
  teams: T[],
) {
  const bySportsDataId = new Map<string, T>()
  const byAbbreviation = new Map<string, T>()
  const byName = new Map<string, T>()
  for (const team of teams) {
    if (team.sportsDataTeamId) bySportsDataId.set(team.sportsDataTeamId, team)
    if (team.externalId) bySportsDataId.set(team.externalId, team)
    const abbreviation = lookupKey(team.abbreviation)
    const name = lookupKey(team.name)
    if (abbreviation) byAbbreviation.set(abbreviation, team)
    if (name) byName.set(name, team)
  }

  const mapped = standings.map((standing) => {
    const team = bySportsDataId.get(standing.TeamID.toString())
      ?? byAbbreviation.get(lookupKey(standing.Key) ?? '')
      ?? byName.get(lookupKey(standing.Name) ?? '')
      ?? byName.get(lookupKey(standing.Team) ?? '')
    if (!team) throw new Error(`Team not found: ${standing.Team} (${standing.Key})`)
    return { standing, team }
  })
  const duplicateTeam = mapped.find((entry, index) => (
    mapped.findIndex((candidate) => candidate.team.id === entry.team.id) !== index
  ))
  if (duplicateTeam) {
    throw new Error(`Multiple SportsDataIO records mapped to ${duplicateTeam.team.name}`)
  }
  return mapped
}
