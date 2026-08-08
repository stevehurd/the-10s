import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { validateEmail } from '@/lib/player-settings-rules'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const poolId = typeof body?.poolId === 'string' ? body.poolId : undefined
  const authorization = await authorizeApi('MEMBER', poolId)
  if (!authorization.authorized) return authorization.response

  try {
    const email = validateEmail(typeof body?.email === 'string' ? body.email : '')
    if (email === authorization.authUser.email?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'That is already your sign-in email' }, { status: 400 })
    }
    const existing = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        id: { not: authorization.appUser.id },
      },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'That email is already used by another player' }, { status: 409 })
    }

    const supabase = await createClient()
    const confirmationUrl = new URL('/auth/confirm', request.url)
    confirmationUrl.searchParams.set('next', '/settings?email=confirmed')
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: confirmationUrl.toString() },
    )
    if (error) throw error

    await prisma.auditEvent.create({
      data: {
        poolId: authorization.membership.poolId,
        actorUserId: authorization.appUser.id,
        action: 'PLAYER_EMAIL_CHANGE_REQUESTED',
        entityType: 'User',
        entityId: authorization.appUser.id,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to request the email change' },
      { status: 400 },
    )
  }
}
