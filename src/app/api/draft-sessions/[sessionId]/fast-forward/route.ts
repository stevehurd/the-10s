import { revalidatePath } from 'next/cache'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { fastForwardRehearsalToFinalPick } from '@/lib/draft/service'

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
    if (!session?.season.poolId) return Response.json({ error: 'Draft not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', session.season.poolId)
    if (!authorization.authorized) return authorization.response

    const result = await fastForwardRehearsalToFinalPick(sessionId, authorization.appUser.id)
    revalidatePath('/admin/draft')
    return Response.json(result)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
