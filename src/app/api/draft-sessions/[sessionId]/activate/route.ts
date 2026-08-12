import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { DraftRuleError, startDraftSession } from '@/lib/draft/service'

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
      return Response.json({ error: 'Draft not found' }, { status: 404 })
    }
    const authorization = await authorizeApi('MEMBER', session.season.poolId)
    if (!authorization.authorized) return authorization.response

    if (session.status !== 'SCHEDULED') return Response.json(session)
    const activated = await startDraftSession(sessionId, authorization.appUser.id)
    return Response.json(activated)
  } catch (error) {
    if (error instanceof DraftRuleError && error.code === 'INVALID_STATUS') {
      return Response.json({ activated: true })
    }
    return draftErrorResponse(error)
  }
}
