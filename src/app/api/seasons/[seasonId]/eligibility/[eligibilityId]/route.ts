import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { draftErrorResponse } from '@/lib/draft/http'
import { setEligibilityStatus } from '@/lib/seasons/eligibility'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string; eligibilityId: string }> },
) {
  try {
    const { seasonId, eligibilityId } = await context.params
    const season = await prisma.season.findUnique({ where: { id: seasonId } })
    if (!season?.poolId) return NextResponse.json({ error: 'Season not found' }, { status: 404 })

    const authorization = await authorizeApi('COMMISSIONER', season.poolId)
    if (!authorization.authorized) return authorization.response
    const body = await request.json()
    if (body.status !== 'APPROVED' && body.status !== 'INACTIVE') {
      return NextResponse.json({ error: 'Status must be APPROVED or INACTIVE' }, { status: 400 })
    }

    const eligibility = await setEligibilityStatus({
      seasonId,
      eligibilityId,
      status: body.status,
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.json(eligibility)
  } catch (error) {
    return draftErrorResponse(error)
  }
}
