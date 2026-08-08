import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { seedDashboardStressTestSeasons } from '@/lib/development/seed-dashboard-states'

export async function POST(request: Request) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response
  if (authorization.membership.pool.slug !== 'the-10s-development') {
    return NextResponse.json({ error: 'Stress-test seeding is restricted to the development pool' }, { status: 403 })
  }

  try {
    const result = await seedDashboardStressTestSeasons({
      poolId: authorization.membership.poolId,
      actorUserId: authorization.appUser.id,
    })
    return NextResponse.redirect(new URL(`/?season=${result.preseasonId}&seeded=dashboard-states`, request.url), 303)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to seed dashboard stress-test seasons' },
      { status: 400 },
    )
  }
}
