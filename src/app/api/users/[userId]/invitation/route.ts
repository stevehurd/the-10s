import { NextResponse } from 'next/server'

import { authorizeApi } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import {
  invitationDeliveryAvailability,
  sendPlayerInvitation,
} from '@/lib/invitation-delivery'
import {
  LegacyInvitationError,
  assertInvitationCanSend,
  legacyInvitationState,
} from '@/lib/legacy-invitation-rules'

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const authorization = await authorizeApi('COMMISSIONER')
  if (!authorization.authorized) return authorization.response

  const delivery = invitationDeliveryAvailability()
  if (!delivery.enabled) {
    return NextResponse.json({ error: delivery.message }, { status: 503 })
  }

  const { userId } = await context.params
  const membership = await prisma.poolMembership.findUnique({
    where: {
      poolId_userId: { poolId: authorization.membership.poolId, userId },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          authUserId: true,
          invitationSentAt: true,
          invitationFailedAt: true,
          invitationClaimedAt: true,
          invitationSendAttempts: true,
        },
      },
    },
  })
  if (!membership || membership.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Active pool member not found' }, { status: 404 })
  }

  let invitation: ReturnType<typeof assertInvitationCanSend>
  try {
    invitation = assertInvitationCanSend(membership.user)
  } catch (error) {
    if (error instanceof LegacyInvitationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const attempt = membership.user.invitationSendAttempts + 1
  try {
    await sendPlayerInvitation({
      playerName: membership.user.name,
      email: invitation.email,
      userId,
      attempt,
    })
  } catch {
    const failedAt = new Date()
    await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, email: invitation.email, authUserId: null },
        data: {
          invitationFailedAt: failedAt,
          invitationSendAttempts: attempt,
        },
      })
      if (result.count === 1) {
        await tx.auditEvent.create({
          data: {
            poolId: authorization.membership.poolId,
            actorUserId: authorization.appUser.id,
            action: 'PLAYER_INVITATION_SEND_FAILED',
            entityType: 'User',
            entityId: userId,
            data: { attempt },
          },
        })
      }
    })
    return NextResponse.json(
      { error: 'The invitation could not be sent. Check email delivery setup and try again.' },
      { status: 502 },
    )
  }

  try {
    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: { id: userId, email: invitation.email, authUserId: null },
        data: {
          invitationSentAt: now,
          invitationFailedAt: null,
          invitationSendAttempts: attempt,
        },
      })
      if (result.count !== 1) throw new Error('Invitation profile changed while sending')
      await tx.auditEvent.create({
        data: {
          poolId: authorization.membership.poolId,
          actorUserId: authorization.appUser.id,
          action: membership.user.invitationSentAt
            ? 'PLAYER_INVITATION_RESENT'
            : 'PLAYER_INVITATION_SENT',
          entityType: 'User',
          entityId: userId,
          data: { attempt },
        },
      })
      return tx.user.findUniqueOrThrow({ where: { id: userId } })
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      hasSignedIn: Boolean(updated.authUserId),
      invitationState: legacyInvitationState(updated),
      invitationSentAt: updated.invitationSentAt,
      invitationFailedAt: updated.invitationFailedAt,
      invitationClaimedAt: updated.invitationClaimedAt,
      invitationSendAttempts: updated.invitationSendAttempts,
    })
  } catch {
    return NextResponse.json(
      { error: 'The provider accepted the invitation, but its status was not saved. Retrying is safe.' },
      { status: 409 },
    )
  }
}
