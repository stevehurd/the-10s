import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const seasonId = searchParams.get('seasonId')

    // Get all users with their drafts and teams
    const users = await prisma.user.findMany({
      include: {
        drafts: {
          where: seasonId ? { seasonId } : {},
          include: {
            team: true,
            season: true
          },
          orderBy: {
            round: 'asc'
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Calculate wins for each user based on their drafted teams' win records
    const leaderboard = users.map((user) => {
      let totalWins = 0

      // For each team the user drafted, add their wins to the total
      for (const draft of user.drafts) {
        totalWins += draft.team.wins || 0
      }

      return {
        ...user,
        totalWins
      }
    })

    // Sort by total wins (descending)
    leaderboard.sort((a, b) => b.totalWins - a.totalWins)

    return NextResponse.json(leaderboard)
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}