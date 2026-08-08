import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { legacyInvitationState } from '@/lib/legacy-invitation-rules'

const MEMBER_ROLES = new Set(['MEMBER', 'COMMISSIONER'])

export async function GET() {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response

  const memberships = await prisma.poolMembership.findMany({
    where: { poolId: authorization.membership.poolId },
    orderBy: { user: { name: 'asc' } },
    include: {
      user: { select: { id: true, name: true, email: true, authUserId: true } },
    },
  })

  return NextResponse.json(
    memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      status: membership.status,
      hasSignedIn: Boolean(membership.user.authUserId),
      invitationState: legacyInvitationState(membership.user),
    })),
  )
}

export async function POST(request: Request) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = MEMBER_ROLES.has(body.role) ? body.role : 'MEMBER'
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })

  const result = await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { name, email } })
      : await tx.user.create({ data: { name, email } })
    const membership = await tx.poolMembership.upsert({
      where: {
        poolId_userId: { poolId: authorization.membership.poolId, userId: user.id },
      },
      update: { role, status: 'ACTIVE' },
      create: {
        poolId: authorization.membership.poolId,
        userId: user.id,
        role,
        status: 'ACTIVE',
      },
    })
    await tx.auditEvent.create({
      data: {
        poolId: authorization.membership.poolId,
        actorUserId: authorization.appUser.id,
        action: existing ? 'POOL_MEMBER_REACTIVATED' : 'POOL_MEMBER_INVITED',
        entityType: 'PoolMembership',
        entityId: membership.id,
        data: { userId: user.id, role },
      },
    })
    return { user, membership }
  })

  return NextResponse.json(
    {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.membership.role,
      status: result.membership.status,
      hasSignedIn: Boolean(result.user.authUserId),
      invitationState: legacyInvitationState(result.user),
    },
    { status: 201 },
  )
}
