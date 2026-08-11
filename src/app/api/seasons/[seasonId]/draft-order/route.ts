import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { setSeasonDraftOrder } from '@/lib/seasons/participants'

export async function PUT(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    if (!Array.isArray(body.participantIds) || body.participantIds.some((id: unknown) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'participantIds must be a string array' }, { status: 400 })
    }
    const result = await setSeasonDraftOrder({
      seasonId,
      participantIds: body.participantIds,
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
