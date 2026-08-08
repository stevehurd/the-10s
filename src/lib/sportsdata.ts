import {
  calculateCollegeStandingsFromGames,
  type CombinedStanding,
  type CollegeStandingTeam,
} from './standings-calculation.ts'

// SportsData.IO API integration
const SPORTSDATA_API_KEY = process.env.SPORTSDATA_API_KEY
const BASE_URL = 'https://api.sportsdata.io/v3'

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
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch NFL standings: ${response.status} ${response.statusText}`)
  }

  const standings = await response.json()

  // Return actual standings data without modification


  return standings
}

// NFL Postseason Standings API calls
export async function fetchNFLPostseasonStandings(season: number = 2025): Promise<SportsDataStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  const url = `${BASE_URL}/nfl/scores/json/Standings/${season}POST`

  console.log('Fetching NFL postseason standings from:', url)

  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY,
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    // If postseason hasn't started yet, the API might return 404
    if (response.status === 404) {
      console.log('Postseason standings not available yet (404)')
      return []
    }
    throw new Error(`Failed to fetch NFL postseason standings: ${response.status} ${response.statusText}`)
  }

  const standings = await response.json()

  return standings
}

// College Football League Hierarchy API calls (includes standings data)
export async function fetchCollegeStandings(season: number = 2025): Promise<CombinedStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  console.log(`Fetching college ${season} schedule and current FBS hierarchy from SportsDataIO...`)
  const [conferences, games] = await Promise.all([
    fetchSportsDataJson<Array<{ Teams?: CollegeStandingTeam[] }>>('/cfb/scores/json/LeagueHierarchy', 'college hierarchy'),
    fetchSportsDataJson<SportsDataGame[]>(`/cfb/scores/json/Schedules/${season}`, `college ${season} schedule`),
  ])
  const teams = conferences.flatMap((conference) => conference.Teams ?? []).filter((team) => team.Active !== false)
  if (teams.length < 120 || teams.length > 160) {
    throw new Error(`SportsDataIO returned an implausible active FBS field (${teams.length} teams); no standings were changed`)
  }
  if (games.length < 500 || games.length > 2000) {
    throw new Error(`SportsDataIO returned an implausible ${season} college schedule (${games.length} games); no standings were changed`)
  }
  return calculateCollegeStandingsFromGames(season, teams, games)
}

async function fetchSportsDataJson<T>(path: string, label: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY!,
      'Accept': 'application/json',
    },
  })
  if (!response.ok) {
    const entitlement = response.status === 401 || response.status === 403
      ? ' The configured SportsDataIO subscription may not include this feed.'
      : ''
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}.${entitlement}`)
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
