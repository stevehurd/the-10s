import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { createSeasonFromPrevious } from '@/lib/seasons/setup'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const previousSeasonId =
      typeof body.previousSeasonId === 'string' ? body.previousSeasonId : ''
    const previous = await prisma.season.findUnique({ where: { id: previousSeasonId } })
    if (!previous?.poolId) {
      return NextResponse.json({ error: 'Previous season not found' }, { status: 404 })
    }

    const authorization = await authorizeApi('COMMISSIONER', previous.poolId)
    if (!authorization.authorized) return authorization.response

    const year = Number(body.year)
    const season = await createSeasonFromPrevious({
      previousSeasonId,
      year,
      name: typeof body.name === 'string' ? body.name : `${year} Season`,
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.json(season, { status: 201 })
  } catch (error) {
    return draftErrorResponse(error)
  }
}
