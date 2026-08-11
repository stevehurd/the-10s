import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { setRetentionChoice } from '@/lib/seasons/setup'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string; slotId: string }> },
) {
  try {
    const { seasonId, slotId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('MEMBER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    if (body.choice !== 'KEEP' && body.choice !== 'RELEASE') {
      return NextResponse.json({ error: 'Choice must be KEEP or RELEASE' }, { status: 400 })
    }

    const slot = await setRetentionChoice({
      seasonId,
      rosterSlotId: slotId,
      choice: body.choice,
      actorUserId: authorization.appUser.id,
      actorIsCommissioner: authorization.membership.role === 'COMMISSIONER',
    })
    revalidatePath('/')
    revalidatePath(`/seasons/${seasonId}/keepers`)
    return NextResponse.json(slot)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
