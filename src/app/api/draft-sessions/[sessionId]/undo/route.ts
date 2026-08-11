import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { undoLastDraftSelection } from '@/lib/draft/service'

export async function POST(
  _request: Request,
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
    const updated = await undoLastDraftSelection(session.id, authorization.appUser.id)
    return NextResponse.json(updated)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
