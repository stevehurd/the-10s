import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { setDraftPaused, startDraftSession } from '@/lib/draft/service'

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: { select: { poolId: true } } },
    })
    if (!session?.season.poolId) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const authorization = await authorizeApi('COMMISSIONER', session.season.poolId)
    if (!authorization.authorized) return authorization.response

    const body = await request.json()
    let updated
    if (body.action === 'START') {
      updated = await startDraftSession(sessionId, authorization.appUser.id)
    } else if (body.action === 'PAUSE') {
      updated = await setDraftPaused(sessionId, true, authorization.appUser.id)
    } else if (body.action === 'RESUME') {
      updated = await setDraftPaused(sessionId, false, authorization.appUser.id)
    } else {
      return NextResponse.json({ error: 'Action must be START, PAUSE, or RESUME' }, { status: 400 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
