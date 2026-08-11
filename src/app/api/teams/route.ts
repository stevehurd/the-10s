import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeApi } from '@/lib/auth/authorization'

export async function GET(request: Request) {
  const authorization = await authorizeApi()
  if (!authorization.authorized) return authorization.response

  try {
    const { searchParams } = new URL(request.url)
    const league = searchParams.get('league')
    
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
