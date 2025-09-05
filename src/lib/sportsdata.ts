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
  AwayScore: number | null
  HomeScore: number | null
  Winner: string | null
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

// College Football League Hierarchy API calls (includes standings data)
export async function fetchCollegeStandings(season: number = 2025): Promise<SportsDataStanding[]> {
  if (!SPORTSDATA_API_KEY) {
    throw new Error('SportsData.IO API key not configured')
  }

  console.log('Fetching college standings from SportsData.IO...')
  
  // For 2025, use the LeagueHierarchy endpoint to get current data
  const response = await fetch(
    `${BASE_URL}/cfb/scores/json/LeagueHierarchy`,
    {
      headers: {
        'Ocp-Apim-Subscription-Key': SPORTSDATA_API_KEY,
        'Accept': 'application/json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch college standings: ${response.status} ${response.statusText}`)
  }

  const conferences = await response.json()
  
  // Flatten all teams from all conferences into a single array
  const teams: SportsDataStanding[] = []
  for (const conference of conferences) {
    for (const team of conference.Teams) {
      teams.push({
        Season: season,
        SeasonType: 1, // Regular season
        TeamID: team.TeamID,
        Key: team.Key,
        Name: team.Name,
        Team: `${team.School} ${team.Name}`,
        Wins: team.Wins || 0,
        Losses: team.Losses || 0,
        ConferenceWins: team.ConferenceWins || 0,
        ConferenceLosses: team.ConferenceLosses || 0,
        GlobalTeamID: team.GlobalTeamID,
        ConferenceRank: team.ApRank,
        DivisionRank: team.CoachesRank
      })
    }
  }
  
  return teams
}

// Helper function to determine game winner
export function determineWinner(game: SportsDataGame): string | null {
  if (!game.HomeScore || !game.AwayScore) return null
  if (game.Status !== 'Final') return null
  
  if (game.HomeScore > game.AwayScore) {
    return game.HomeTeam
  } else if (game.AwayScore > game.HomeScore) {
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
      return 'COMPLETED'
    default:
      return 'SCHEDULED'
  }
}