import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    // Reset all NFL teams to 0-0
    const result = await prisma.team.updateMany({
      where: { league: 'NFL' },
      data: {
        wins: 0,
        losses: 0
      }
    })

    return NextResponse.json({
      message: `Reset ${result.count} NFL teams to 0-0`,
      updatedTeams: result.count
    })

  } catch (error) {
    console.error('NFL reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset NFL teams' },
      { status: 500 }
    )
  }
}