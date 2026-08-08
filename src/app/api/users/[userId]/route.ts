import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

async function scopedMembership(userId: string, poolId: string) {
  return prisma.poolMembership.findUnique({
    where: { poolId_userId: { poolId, userId } },
    include: { user: { select: { name: true } } },
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

  const body = await request.json()
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
