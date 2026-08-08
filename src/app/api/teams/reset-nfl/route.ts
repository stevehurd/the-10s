import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeApi } from '@/lib/auth/authorization'

export async function POST() {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response

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
