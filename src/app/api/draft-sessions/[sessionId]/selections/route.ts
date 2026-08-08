import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { makeDraftSelection } from '@/lib/draft/service'

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

    const authorization = await authorizeApi('MEMBER', session.season.poolId)
    if (!authorization.authorized) return authorization.response

    const body = await request.json()
    if (typeof body.teamId !== 'string' || !Number.isInteger(body.expectedRevision)) {
      return NextResponse.json(
        { error: 'teamId and integer expectedRevision are required' },
        { status: 400 },
      )
    }

    const isCommissioner = authorization.membership.role === 'COMMISSIONER'
    const selection = await makeDraftSelection({
      draftSessionId: sessionId,
      teamId: body.teamId,
      actorUserId: authorization.appUser.id,
      actorIsCommissioner: isCommissioner,
      expectedRevision: body.expectedRevision,
      selectionType: isCommissioner && body.forParticipant ? 'COMMISSIONER' : 'MANUAL',
    })

    return NextResponse.json(selection, { status: 201 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
