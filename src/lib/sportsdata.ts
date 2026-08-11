import {
  type CombinedStanding,
  validateAndCombineCollegeStandings,
} from './standings-calculation.ts'

// SportsData.IO API integration
const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY
const BASE_URL = 'https://api.sportsdata.io/v3'
const REQUEST_TIMEOUT_MS = 20_000

if (!SPORTSDATA_API_KEY) {
  console.warn('SPORTSDATA_API_KEY not set in environment variables')
}

export interface SportsDataGame {
  GameID: number
  Season: number
  SeasonType: number
  Week: number
  Status: string
  DateTime: string
  AwayTeam: string
  HomeTeam: string
  AwayScore?: number | null
  HomeScore?: number | null
  AwayTeamScore?: number | null
  HomeTeamScore?: number | null
  Winner?: string | null
  Title?: string | null
  GameEndDateTime: string | null
  AwayTeamID: number
  HomeTeamID: number
}

export interface SportsDataTeam {
  TeamID: number
  Key: string
  Active: boolean
  School: string
  Name: string
  Conference: string
  ConferenceID: number
  Division?: string
  ShortDisplayName: string
  Color: string
  SecondaryColor: string
  TertiaryColor?: string
  LogoUrl: string
  Wins?: number | null
  Losses?: number | null
  ConferenceWins?: number | null
  ConferenceLosses?: number | null
  RankSeason?: number | null
}

export interface SportsDataStanding {
  Season: number
  SeasonType: number
  TeamID: number
  Key: string
  Name: string
  Team: string
  Wins: number
  Losses: number
  Ties?: number
  ConferenceWins: number
  ConferenceLosses: number
  GlobalTeamID: number
  ConferenceRank?: number
  DivisionRank?: number
}

// NFL Standings API calls
export async function fetchNFLStandings(season: number = 2025): Promise<SportsDataStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  // Use the current season
  const url = `${BASE_URL}/nfl/scores/json/Standings/${season}`

  console.log('Fetching NFL standings from:', url)

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY,
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch NFL standings: ${response.status} ${response.statusText}`)
  }

  const standings: unknown = await response.json()
  if (!Array.isArray(standings)) throw new Error('NFL standings returned an invalid payload')

  // Return actual standings data without modification


  return standings as SportsDataStanding[]
}

// NFL Postseason Standings API calls
export async function fetchNFLPostseasonStandings(season: number = 2025): Promise<SportsDataStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  const url = `${BASE_URL}/nfl/scores/json/Standings/${season}POST`

  console.log('Fetching NFL postseason standings from:', url)

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY,
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    // If postseason hasn't started yet, the API might return 404
    if (response.status === 404) {
      console.log('Postseason standings not available yet (404)')
      return []
    }
    throw new Error(`Failed to fetch NFL postseason standings: ${response.status} ${response.statusText}`)
  }

  const standings: unknown = await response.json()
  if (!Array.isArray(standings)) throw new Error('NFL postseason standings returned an invalid payload')

  return standings as SportsDataStanding[]
}

// College Football Team Season Stats & Standings API calls
export async function fetchCollegeStandings(season: number = 2025): Promise<CombinedStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  console.log(`Fetching college ${season} aggregate standings from SportsDataIO...`)
  const conferences = await fetchSportsDataJson<Array<{ Teams?: SportsDataTeam[] }>>(
    '/cfb/scores/json/LeagueHierarchy',
    'college hierarchy',
  )
  const teams = conferences
    .flatMap((conference) => conference.Teams ?? [])
    .filter((team) => team.Active !== false)
  if (teams.length < 120 || teams.length > 160) {
    throw new Error(`SportsDataIO returned an implausible active FBS field (${teams.length} teams); no standings were changed`)
  }
  const aggregate = teams.map((team): SportsDataStanding => {
    return {
      Season: season,
      SeasonType: 1,
      TeamID: team.TeamID,
      GlobalTeamID: team.TeamID,
      Key: team.Key,
      Name: team.Name || team.School || team.Key,
      Team: [team.School, team.Name].filter(Boolean).join(' ') || team.Key,
      Wins: team.Wins ?? 0,
      Losses: team.Losses ?? 0,
      Ties: 0,
      ConferenceWins: team.ConferenceWins ?? 0,
      ConferenceLosses: team.ConferenceLosses ?? 0,
    }
  })
  return validateAndCombineCollegeStandings(season, aggregate, [])
}

async function fetchSportsDataJson<T>(path: string, label: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    cache: 'no-store',
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY!,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`${label} is not available from the configured SportsDataIO feed`)
    }
    const entitlement = response.status === 401 || response.status === 403
      ? ' The configured SportsDataIO subscription may not include this feed.'
      : ''
    const status = response.statusText ? `${response.status} ${response.statusText}` : response.status.toString()
    throw new Error(`Failed to fetch ${label}: ${status}.${entitlement}`)
  }
  return response.json() as Promise<T>
}

// Helper function to determine game winner
export function determineWinner(game: SportsDataGame): string | null {
  const homeScore = game.HomeTeamScore ?? game.HomeScore
  const awayScore = game.AwayTeamScore ?? game.AwayScore
  if (homeScore == null || awayScore == null) return null
  if (!['Final', 'F/OT', 'Forfeit'].includes(game.Status)) return null
  
  if (homeScore > awayScore) {
    return game.HomeTeam
  } else if (awayScore > homeScore) {
    return game.AwayTeam
  }
  
  return null // Tie
}

// Map SportsData game status to our database status
export function mapGameStatus(sportsDataStatus: string): string {
  switch (sportsDataStatus) {
    case 'Scheduled':
    case 'Postponed':
      return 'SCHEDULED'
    case 'InProgress':
    case 'Halftime':
      return 'IN_PROGRESS'
    case 'Final':
    case 'F/OT':
    case 'Forfeit':
      return 'COMPLETED'
    default:
      return 'SCHEDULED'
  }
}
