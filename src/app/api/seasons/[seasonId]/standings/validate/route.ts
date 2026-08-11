import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { validateHistoricalStandings } from '@/lib/standings-validation-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { poolId: true },
    })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const result = await validateHistoricalStandings(seasonId, authorization.appUser.id)
    return NextResponse.json({ success: result.status === 'SUCCEEDED', ...result })
  } catch (error) {
    console.error('Historical standings validation failed:', error)
    return NextResponse.json({ error: 'Historical validation failed' }, { status: 500 })
  }
}
