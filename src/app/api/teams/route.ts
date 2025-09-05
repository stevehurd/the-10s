import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { syncTeamsToDatabase } from '@/lib/team-data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league')
    
    // Check if we have any teams in the database
    const teamCount = await prisma.team.count()
    
    // If no teams exist, auto-sync them
    if (teamCount === 0) {
      console.log('No teams found in database, auto-syncing...')
      await syncTeamsToDatabase()
    }
    
    const teams = await prisma.team.findMany({
      where: league ? { league: league.toUpperCase() } : undefined,
      orderBy: [
        { league: 'asc' },
        { conference: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(teams)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}