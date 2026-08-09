import { redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'
import { invitationDeliveryAvailability } from '@/lib/invitation-delivery'
import { legacyInvitationState } from '@/lib/legacy-invitation-rules'

import MemberManager from './member-manager'

export default async function UsersPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const membership = context.appUser.memberships.find((candidate) => candidate.role === 'COMMISSIONER')
  if (!membership) redirect('/')

  const memberships = await prisma.poolMembership.findMany({
    where: { poolId: membership.poolId },
    orderBy: { user: { name: 'asc' } },
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

  return (
    <MemberManager
      initialInvitationDelivery={invitationDeliveryAvailability()}
      initialMembers={memberships.map(({ role, status, user }) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: role as 'MEMBER' | 'COMMISSIONER',
        status,
        hasSignedIn: Boolean(user.authUserId),
        invitationState: legacyInvitationState(user),
        invitationSentAt: user.invitationSentAt?.toISOString() ?? null,
        invitationFailedAt: user.invitationFailedAt?.toISOString() ?? null,
        invitationClaimedAt: user.invitationClaimedAt?.toISOString() ?? null,
        invitationSendAttempts: user.invitationSendAttempts,
      }))}
    />
  )
}
