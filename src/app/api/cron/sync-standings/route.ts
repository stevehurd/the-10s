import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  fetchNFLStandings, 
  fetchCollegeStandings,
  type SportsDataStanding 
} from '@/lib/sportsdata'

// This endpoint is called by Vercel Cron Jobs
// It syncs both NFL and College standings automatically
export async function GET() {
  try {
    console.log('🕒 Cron job started: Syncing standings for both NFL and College')
    
    let totalUpdated = 0
    const errors: string[] = []
    const results: string[] = []

    // Sync NFL standings
    try {
      console.log('🏈 Fetching NFL standings...')
      const nflStandings = await fetchNFLStandings(2025)
      
      for (const standing of nflStandings) {
        try {
          await syncTeamStanding(standing, 'NFL')
          totalUpdated++
        } catch (error) {
          const errorMsg = `Failed to sync NFL team ${standing.Team}: ${error}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
      
      results.push(`✅ NFL: Updated ${nflStandings.length} teams`)
      console.log(`✅ NFL standings synced: ${nflStandings.length} teams`)
      
    } catch (error) {
      const errorMsg = `❌ Failed to fetch NFL standings: ${error}`
      console.error(errorMsg)
      errors.push(errorMsg)
      results.push('❌ NFL: Failed to fetch data')
    }

    // Sync College standings  
    try {
      console.log('🎓 Fetching College standings...')
      const collegeStandings = await fetchCollegeStandings(2025)
      
      for (const standing of collegeStandings) {
        try {
          await syncTeamStanding(standing, 'COLLEGE')
          totalUpdated++
        } catch (error) {
          const errorMsg = `Failed to sync College team ${standing.Team}: ${error}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }
      }
      
      results.push(`✅ College: Updated ${collegeStandings.length} teams`)
      console.log(`✅ College standings synced: ${collegeStandings.length} teams`)
      
    } catch (error) {
      const errorMsg = `❌ Failed to fetch College standings: ${error}`
      console.error(errorMsg)
      errors.push(errorMsg)
      results.push('❌ College: Failed to fetch data')
    }

    const summary = `🕒 Cron sync completed: ${totalUpdated} total teams updated`
    console.log(summary)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalUpdated,
      results,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    const errorMsg = `❌ Cron job failed: ${error}`
    console.error(errorMsg)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMsg,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Helper function to sync individual team standings
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

  console.log(`✅ Updated ${team.name}: ${standing.Wins}-${standing.Losses}`)
}