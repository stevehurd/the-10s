import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  fetchNFLStandings,
  fetchNFLPostseasonStandings,
  fetchCollegeStandings,
  fetchCollegePostseasonStandings,
  type SportsDataStanding
} from '@/lib/sportsdata'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { season = 2025, league } = body

    if (!league || !['NFL', 'COLLEGE', 'BOTH'].includes(league)) {
      return NextResponse.json(
        { error: 'League parameter required: NFL, COLLEGE, or BOTH' },
        { status: 400 }
      )
    }

    let updatedTeams = 0
    const errors: string[] = []

    // Sync NFL standings (regular + postseason)
    if (league === 'NFL' || league === 'BOTH') {
      try {
        console.log('Fetching NFL regular season standings from SportsData.IO...')
        const nflStandings = await fetchNFLStandings(season)

        console.log('Fetching NFL postseason standings from SportsData.IO...')
        const nflPostseasonStandings = await fetchNFLPostseasonStandings(season)

        // Create a map to combine regular + postseason wins
        const combinedStandings = new Map<number, SportsDataStanding>()

        // Add regular season standings
        for (const standing of nflStandings) {
          combinedStandings.set(standing.TeamID, { ...standing })
        }

        // Add postseason wins to the existing records
        for (const postseasonStanding of nflPostseasonStandings) {
          const existing = combinedStandings.get(postseasonStanding.TeamID)
          if (existing) {
            existing.Wins += postseasonStanding.Wins
            existing.Losses += postseasonStanding.Losses
          } else {
            // Team only has postseason data (shouldn't happen, but handle it)
            combinedStandings.set(postseasonStanding.TeamID, { ...postseasonStanding })
          }
        }

        // Sync all teams with combined wins
        for (const standing of combinedStandings.values()) {
          try {
            await syncTeamStanding(standing, 'NFL')
            updatedTeams++
          } catch (error) {
            const errorMsg = `Failed to sync NFL team ${standing.Team}: ${error}`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        }
      } catch (error) {
        const errorMsg = `Failed to fetch NFL standings: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // Sync College standings (regular + postseason including bowl games)
    if (league === 'COLLEGE' || league === 'BOTH') {
      try {
        console.log('Fetching College regular season standings from SportsData.IO...')
        const collegeStandings = await fetchCollegeStandings(season)

        console.log('Fetching College postseason standings (playoff & bowl games) from SportsData.IO...')
        const collegePostseasonStandings = await fetchCollegePostseasonStandings(season)

        // Create a map to combine regular + postseason wins
        const combinedStandings = new Map<number, SportsDataStanding>()

        // Add regular season standings
        for (const standing of collegeStandings) {
          combinedStandings.set(standing.TeamID, { ...standing })
        }

        // Add postseason wins to the existing records
        for (const postseasonStanding of collegePostseasonStandings) {
          const existing = combinedStandings.get(postseasonStanding.TeamID)
          if (existing) {
            existing.Wins += postseasonStanding.Wins
            existing.Losses += postseasonStanding.Losses
          } else {
            // Team only has postseason data (shouldn't happen, but handle it)
            combinedStandings.set(postseasonStanding.TeamID, { ...postseasonStanding })
          }
        }

        // Sync all teams with combined wins
        for (const standing of combinedStandings.values()) {
          try {
            await syncTeamStanding(standing, 'COLLEGE')
            updatedTeams++
          } catch (error) {
            const errorMsg = `Failed to sync College team ${standing.Team}: ${error}`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        }
      } catch (error) {
        const errorMsg = `Failed to fetch College standings: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      message: `Updated ${updatedTeams} team records successfully`,
      updatedTeams,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Standings sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync standings' },
      { status: 500 }
    )
  }
}

async function syncTeamStanding(standing: SportsDataStanding, league: string) {
  // Find team in our database by multiple possible matches
  const team = await prisma.team.findFirst({
    where: {
      AND: [
        { league },
        {
          OR: [
            { name: standing.Name },
            { name: standing.Team }, 
            { abbreviation: standing.Key },
            { externalId: standing.TeamID.toString() }
          ]
        }
      ]
    }
  })

  if (!team) {
    throw new Error(`Team not found in database: ${standing.Team} (${standing.Key})`)
  }

  // Update team's win/loss record
  await prisma.team.update({
    where: { id: team.id },
    data: {
      wins: standing.Wins,
      losses: standing.Losses
    }
  })

  console.log(`Updated ${team.name}: ${standing.Wins}-${standing.Losses}`)
}