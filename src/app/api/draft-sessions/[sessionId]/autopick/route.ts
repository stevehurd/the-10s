import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { autopickExpiredTurn } from '@/lib/draft/service'

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

    const authorization = await authorizeApi('MEMBER', session.season.poolId)
    if (!authorization.authorized) return authorization.response
    const selection = await autopickExpiredTurn(sessionId)
    return NextResponse.json(selection, { status: 201 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
