import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { selectAuthorizedMembership } from './policy'

export type AppRole = 'MEMBER' | 'COMMISSIONER'

export async function getCurrentAppUser() {
  const supabase = await createClient()
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser()

  if (error || !authUser) return null

  const includeMemberships = {
    memberships: {
      where: { status: 'ACTIVE' },
      include: { pool: true },
    },
  } satisfies Prisma.UserInclude

  let appUser = await prisma.user.findUnique({
    where: { authUserId: authUser.id },
    include: includeMemberships,
  })

  // A successful email OTP proves control of the invited email address. This
  // atomically connects a migrated profile on its first Supabase sign-in.
  if (!appUser && authUser.email) {
    const invitedProfile = await prisma.user.findFirst({
      where: { email: { equals: authUser.email.trim(), mode: 'insensitive' } },
      select: { id: true },
    })
    if (invitedProfile) {
      await prisma.user.updateMany({
        where: { id: invitedProfile.id, authUserId: null },
        data: { authUserId: authUser.id },
      })
      appUser = await prisma.user.findUnique({
        where: { authUserId: authUser.id },
        include: includeMemberships,
      })
    }
  }

  if (!appUser) return null
  return { authUser, appUser }
}

export async function authorizeApi(
  requiredRole: AppRole = 'MEMBER',
  poolId?: string,
) {
  const context = await getCurrentAppUser()
  if (!context) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }

  const membership = selectAuthorizedMembership(context.appUser.memberships, requiredRole, poolId)

  if (!membership) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: 'You do not have permission for this action' }, { status: 403 }),
    }
  }

  return { authorized: true as const, ...context, membership }
}

export async function isCurrentUserCommissioner(): Promise<boolean> {
  const context = await getCurrentAppUser()
  return Boolean(
    context?.appUser.memberships.some((membership) => membership.role === 'COMMISSIONER'),
  )
}
