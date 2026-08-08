import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { LegacyInvitationError, planLegacyInvitationChange } from '@/lib/legacy-invitation-rules'

async function scopedMembership(userId: string, poolId: string) {
  return prisma.poolMembership.findUnique({
    where: { poolId_userId: { poolId, userId } },
    include: { user: { select: { id: true, name: true, email: true, authUserId: true } } },
  })
}

async function protectsLastCommissioner(poolId: string, membership: { role: string; status: string }) {
  if (membership.role !== 'COMMISSIONER' || membership.status !== 'ACTIVE') return false
  const count = await prisma.poolMembership.count({
    where: { poolId, role: 'COMMISSIONER', status: 'ACTIVE' },
  })
  return count <= 1
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response
  const { userId } = await context.params
  const membership = await scopedMembership(userId, authorization.membership.poolId)
  if (!membership) return NextResponse.json({ error: 'Pool member not found' }, { status: 404 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Enter a valid request body' }, { status: 400 })
  if (Object.hasOwn(body, 'invitationEmail')) {
    try {
      const requestedEmail = body.invitationEmail
      const normalizedRequestedEmail = typeof requestedEmail === 'string'
        ? requestedEmail.trim().toLowerCase()
        : null
      const conflict = normalizedRequestedEmail
        ? await prisma.user.findFirst({
          where: {
            email: { equals: normalizedRequestedEmail, mode: 'insensitive' },
            id: { not: userId },
          },
          select: { id: true },
        })
        : null
      const change = planLegacyInvitationChange({
        profile: membership.user,
        requestedEmail,
        conflictingUserId: conflict?.id,
      })

      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: userId },
          data: { email: change.email },
          select: { id: true, name: true, email: true, authUserId: true },
        })
        await tx.auditEvent.create({
          data: {
            poolId: authorization.membership.poolId,
            actorUserId: authorization.appUser.id,
            action: change.action,
            entityType: 'User',
            entityId: userId,
            data: {
              previousState: change.previousState,
              nextState: change.nextState,
            },
          },
        })
        return user
      })
      return NextResponse.json({
        ...updated,
        hasSignedIn: Boolean(updated.authUserId),
        invitationState: change.nextState,
      })
    } catch (error) {
      if (error instanceof LegacyInvitationError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      if (error instanceof Error && error.message === 'Enter a valid email address') {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ error: 'Unable to update this invitation' }, { status: 409 })
    }
  }

  const role = body.role === 'COMMISSIONER' ? 'COMMISSIONER' : body.role === 'MEMBER' ? 'MEMBER' : null
  if (!role) return NextResponse.json({ error: 'Role must be MEMBER or COMMISSIONER' }, { status: 400 })
  if (role === 'MEMBER' && (await protectsLastCommissioner(authorization.membership.poolId, membership))) {
    return NextResponse.json({ error: 'A pool must retain at least one active commissioner' }, { status: 409 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.poolMembership.update({ where: { id: membership.id }, data: { role } })
    await tx.auditEvent.create({
      data: {
        poolId: authorization.membership.poolId,
        actorUserId: authorization.appUser.id,
        action: 'POOL_MEMBER_ROLE_CHANGED',
        entityType: 'PoolMembership',
        entityId: membership.id,
        data: { userId, previousRole: membership.role, role },
      },
    })
    return result
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response
  const { userId } = await context.params
  const membership = await scopedMembership(userId, authorization.membership.poolId)
  if (!membership) return NextResponse.json({ error: 'Pool member not found' }, { status: 404 })
  if (userId === authorization.appUser.id) {
    return NextResponse.json({ error: 'You cannot remove your own access' }, { status: 409 })
  }
  if (await protectsLastCommissioner(authorization.membership.poolId, membership)) {
    return NextResponse.json({ error: 'A pool must retain at least one active commissioner' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.poolMembership.update({ where: { id: membership.id }, data: { status: 'INACTIVE' } })
    await tx.auditEvent.create({
      data: {
        poolId: authorization.membership.poolId,
        actorUserId: authorization.appUser.id,
        action: 'POOL_MEMBER_ACCESS_REMOVED',
        entityType: 'PoolMembership',
        entityId: membership.id,
        data: { userId },
      },
    })
  })
  return NextResponse.json({ success: true })
}
