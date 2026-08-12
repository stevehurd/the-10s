import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import {
  reopenParticipantKeeperSelections,
  replaceSeasonParticipant,
  setParticipantReleaseOverride,
} from '@/lib/seasons/participants'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string; participantId: string }> },
) {
  try {
    const { seasonId, participantId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()

    if (typeof body.replacementUserId === 'string') {
      const participant = await replaceSeasonParticipant({
        seasonId,
        participantId,
        replacementUserId: body.replacementUserId,
        actorUserId: authorization.appUser.id,
      })
      return NextResponse.json(participant)
    }
    if (typeof body.releaseOverride === 'boolean') {
      const participant = await setParticipantReleaseOverride({
        seasonId,
        participantId,
        releaseOverride: body.releaseOverride,
        actorUserId: authorization.appUser.id,
      })
      return NextResponse.json(participant)
    }
    if (body.reopenKeeperSelections === true) {
      const participant = await reopenParticipantKeeperSelections({
        seasonId,
        participantId,
        actorUserId: authorization.appUser.id,
      })
      revalidatePath('/')
      revalidatePath('/admin/draft')
      revalidatePath(`/admin/seasons/${seasonId}/setup`)
      revalidatePath(`/seasons/${seasonId}/prep`)
      return NextResponse.json(participant)
    }
    return NextResponse.json(
      { error: 'Provide replacementUserId, releaseOverride, or reopenKeeperSelections' },
      { status: 400 },
    )
  } catch (error) {
    return draftErrorResponse(error)
  }
}
