import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { createDraftSession } from '@/lib/draft/service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const seasonId = typeof body.seasonId === 'string' ? body.seasonId : ''
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    }

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response

    const mode = body.mode === 'REHEARSAL' ? 'REHEARSAL' : 'OFFICIAL'
    const startsAt = typeof body.startsAt === 'string' && body.startsAt ? new Date(body.startsAt) : null
    const meetingUrl = typeof body.meetingUrl === 'string' && body.meetingUrl.trim()
      ? body.meetingUrl.trim()
      : null
    const session = await createDraftSession({
      seasonId,
      name:
        typeof body.name === 'string' && body.name.trim()
          ? body.name
          : mode === 'REHEARSAL'
            ? 'Draft rehearsal'
            : `${season.year} Draft`,
      mode,
      pickSeconds: Number(body.pickSeconds ?? 90),
      startsAt,
      meetingUrl,
      actorUserId: authorization.appUser.id,
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
