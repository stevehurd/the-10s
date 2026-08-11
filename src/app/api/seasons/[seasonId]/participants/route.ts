import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { addNewSeasonSeat } from '@/lib/seasons/participants'

export async function POST(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    const participant = await addNewSeasonSeat({
      seasonId,
      userId: typeof body.userId === 'string' ? body.userId : '',
      baseDraftOrder: Number(body.baseDraftOrder),
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.json(participant, { status: 201 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
