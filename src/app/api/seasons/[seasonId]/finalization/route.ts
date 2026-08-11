import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { finalizeSeason, reopenSeason } from '@/lib/seasons/finalization'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { poolId: true } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response

    const body = await request.json()
    if (body.action === 'finalize') {
      const result = await finalizeSeason(seasonId, authorization.appUser.id)
      return NextResponse.json(result)
    }
    if (body.action === 'reopen') {
      const result = await reopenSeason(seasonId, authorization.appUser.id)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Action must be finalize or reopen' }, { status: 400 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
