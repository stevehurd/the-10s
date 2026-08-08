import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { updatePlayerProfile } from '@/lib/player-settings'

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  const poolId = typeof body?.poolId === 'string' ? body.poolId : undefined
  const authorization = await authorizeApi('MEMBER', poolId)
  if (!authorization.authorized) return authorization.response

  try {
    const profile = await updatePlayerProfile({
      actorUserId: authorization.appUser.id,
      poolId: authorization.membership.poolId,
      name: typeof body?.name === 'string' ? body.name : '',
      rosterNickname: typeof body?.rosterNickname === 'string' ? body.rosterNickname : null,
    })
    return NextResponse.json(profile)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update your profile' },
      { status: 400 },
    )
  }
}
