import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { approveEligibilityBatch, syncSeasonEligibility } from '@/lib/seasons/eligibility'

export async function GET(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response

    const eligibility = await prisma.seasonTeamEligibility.findMany({
      where: { seasonId },
      include: { team: true },
      orderBy: [{ leagueSnapshot: 'asc' }, { conferenceSnapshot: 'asc' }, { nameSnapshot: 'asc' }],
    })
    return NextResponse.json({ season, eligibility })
  } catch (error) {
    return draftErrorResponse(error)
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const result = await syncSeasonEligibility(seasonId, authorization.appUser.id)
    return NextResponse.json(result)
  } catch (error) {
    return draftErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string }> },
) {
  try {
    const { seasonId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    const eligibilityIds = Array.isArray(body.eligibilityIds)
      ? body.eligibilityIds.filter((id: unknown): id is string => typeof id === 'string')
      : []
    const result = await approveEligibilityBatch({
      seasonId,
      eligibilityIds,
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.json(result)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
