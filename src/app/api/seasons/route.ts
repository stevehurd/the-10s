import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

export async function GET() {
  const authorization = await authorizeApi()
  if (!authorization.authorized) return authorization.response
  const seasons = await prisma.season.findMany({
    where: { poolId: authorization.membership.poolId },
    orderBy: { year: 'desc' },
  })
  return NextResponse.json(seasons)
}

export async function POST(request: Request) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response
  const body = await request.json()
  const year = Number(body.year)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!Number.isInteger(year) || !name) {
    return NextResponse.json({ error: 'A valid year and name are required' }, { status: 400 })
  }

  try {
    const season = await prisma.$transaction(async (tx) => {
      const created = await tx.season.create({
        data: {
          poolId: authorization.membership.poolId,
          year,
          name,
          status: 'SETUP',
        },
      })
      await tx.auditEvent.create({
        data: {
          poolId: authorization.membership.poolId,
          seasonId: created.id,
          actorUserId: authorization.appUser.id,
          action: 'INITIAL_SEASON_CREATED',
          entityType: 'Season',
          entityId: created.id,
        },
      })
      return created
    })
    return NextResponse.json(season, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to create season; verify the year is unique' }, { status: 409 })
  }
}
