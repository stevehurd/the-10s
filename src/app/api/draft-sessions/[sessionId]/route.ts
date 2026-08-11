import { revalidatePath } from 'next/cache'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { getDraftRoomState, updateDraftLogistics } from '@/lib/draft/service'

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: { select: { poolId: true } } },
    })
    if (!session?.season.poolId) return Response.json({ error: 'Draft not found' }, { status: 404 })

    const authorization = await authorizeApi('MEMBER', session.season.poolId)
    if (!authorization.authorized) return authorization.response

    const state = await getDraftRoomState(sessionId, authorization.appUser.id)
    return Response.json({
      ...state,
      viewerIsCommissioner: authorization.membership.role === 'COMMISSIONER',
    })
  } catch (error) {
    return draftErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: { select: { poolId: true } } },
    })
    if (!session?.season.poolId) return Response.json({ error: 'Draft not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', session.season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    const startsAt = typeof body.startsAt === 'string' && body.startsAt ? new Date(body.startsAt) : null
    const meetingUrl = typeof body.meetingUrl === 'string' && body.meetingUrl.trim()
      ? body.meetingUrl.trim()
      : null
    const updated = await updateDraftLogistics({
      sessionId,
      startsAt,
      meetingUrl,
      pickSeconds: Number(body.pickSeconds ?? session.pickSeconds),
      actorUserId: authorization.appUser.id,
    })
    revalidatePath('/')
    revalidatePath('/admin/draft')
    return Response.json(updated)
  } catch (error) {
    return draftErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params
    const session = await prisma.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: { select: { poolId: true } } },
    })
    if (!session?.season.poolId) return Response.json({ error: 'Draft not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', session.season.poolId)
    if (!authorization.authorized) return authorization.response
    if (session.mode !== 'REHEARSAL') {
      return Response.json({ error: 'Official drafts cannot be deleted' }, { status: 400 })
    }
    if (session.status === 'LIVE') {
      return Response.json({ error: 'Pause the rehearsal before deleting it' }, { status: 409 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditEvent.create({
        data: {
          poolId: session.season.poolId!,
          seasonId: session.seasonId,
          actorUserId: authorization.appUser.id,
          action: 'DRAFT_REHEARSAL_DELETED',
          entityType: 'DraftSession',
          entityId: session.id,
          data: { name: session.name, status: session.status },
        },
      })
      await tx.draftSession.delete({ where: { id: session.id } })
    })

    return new Response(null, { status: 204 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
