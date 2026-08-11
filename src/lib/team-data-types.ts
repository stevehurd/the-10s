export interface TeamSyncData {
  name: string
  abbreviation: string
  conference: string | null
  division: string | null
  league: 'NFL' | 'COLLEGE'
  externalId: string | null
  sportsDataTeamId: string | null
  sportsDataGlobalTeamId: string | null
  logoUrl: string | null
}
