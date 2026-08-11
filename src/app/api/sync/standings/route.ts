import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { syncSeasonStandings } from '@/lib/standings-sync'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const league = body.league
    if (league !== 'NFL' && league !== 'COLLEGE' && league !== 'BOTH') {
      return NextResponse.json(
        { error: 'League must be NFL, COLLEGE, or BOTH' },
        { status: 400 },
      )
    }

    const season = body.seasonId
      ? await prisma.season.findUnique({ where: { id: body.seasonId } })
      : await prisma.season.findFirst({
          where: { year: Number(body.season) },
          orderBy: { createdAt: 'desc' },
        })
    if (!season?.poolId) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    }

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response

    const result = await syncSeasonStandings(season.id, league, {
      actorUserId: authorization.appUser.id,
      trigger: 'MANUAL',
    })
    return NextResponse.json({
      success: result.errors.length === 0,
      season: season.year,
      ...result,
    })
  } catch (error) {
    console.error('Standings sync failed:', error)
    const message = error instanceof Error && [
      'Completed season standings are frozen',
      'Season not found',
    ].includes(error.message)
      ? error.message
      : 'Standings sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
