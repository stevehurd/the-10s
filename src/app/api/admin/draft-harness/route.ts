import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import {
  createDraftHarnessRun,
  runCompleteDraftHarness,
  runConcurrentPickHarness,
  runLifecycleHarness,
} from '@/lib/draft/harness'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const action = String(body.action ?? '')
    const seasonId = typeof body.seasonId === 'string' ? body.seasonId : null
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null

    const target = action === 'CREATE'
      ? seasonId
        ? await prisma.season.findUnique({ where: { id: seasonId }, select: { poolId: true } })
        : null
      : sessionId
        ? await prisma.draftSession.findUnique({
            where: { id: sessionId },
            select: { season: { select: { poolId: true } } },
          })
        : null
    const poolId = action === 'CREATE'
      ? target && 'poolId' in target ? target.poolId : null
      : target && 'season' in target ? target.season.poolId : null
    if (!poolId) return Response.json({ error: 'Harness target not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', poolId)
    if (!authorization.authorized) return authorization.response

    if (action === 'CREATE' && seasonId) {
      const session = await createDraftHarnessRun(seasonId, authorization.appUser.id)
      return Response.json({ sessionId: session.id }, { status: 201 })
    }
    if (action === 'CONCURRENCY' && sessionId) {
      return Response.json(await runConcurrentPickHarness(sessionId, authorization.appUser.id))
    }
    if (action === 'LIFECYCLE' && sessionId) {
      return Response.json(await runLifecycleHarness(sessionId, authorization.appUser.id))
    }
    if (action === 'COMPLETE' && sessionId) {
      const result = await runCompleteDraftHarness(sessionId, authorization.appUser.id)
      return Response.json(result, { status: 'inProgress' in result ? 202 : 200 })
    }
    return Response.json({ error: 'Unsupported harness action' }, { status: 400 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
