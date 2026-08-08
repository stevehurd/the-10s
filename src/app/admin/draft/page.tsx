import { redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

import DraftManager from './draft-manager'

export default async function DraftAdminPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')

  const poolIds = context.appUser.memberships
    .filter((membership) => membership.role === 'COMMISSIONER')
    .map((membership) => membership.poolId)

  const seasons = await prisma.season.findMany({
    where: { poolId: { in: poolIds } },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
    include: {
      pool: { select: { name: true } },
      participants: {
        select: {
          decisionsSubmittedAt: true,
          rosterSlots: { select: { inheritedTeamId: true, retentionChoice: true } },
        },
      },
      teamEligibility: { select: { status: true, leagueSnapshot: true } },
      draftSessions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          mode: true,
          status: true,
          pickSeconds: true,
          startsAt: true,
          meetingUrl: true,
          currentTurnIndex: true,
          createdAt: true,
          _count: { select: { turns: true, selections: true } },
        },
      },
    },
  })

  const data = seasons.map((season) => {
    const inheritedParticipants = season.participants.filter((participant) =>
      participant.rosterSlots.some((slot) => slot.inheritedTeamId),
    )
    const unresolvedChoices = inheritedParticipants.filter(
      (participant) =>
        !participant.decisionsSubmittedAt ||
        participant.rosterSlots.some(
          (slot) => slot.inheritedTeamId && slot.retentionChoice === 'PENDING',
        ),
    ).length
    const unresolvedEligibility = season.teamEligibility.filter(
      (team) =>
        team.leagueSnapshot === 'COLLEGE' &&
        (team.status === 'PENDING' || team.status === 'REVIEW'),
    ).length

    return {
      id: season.id,
      year: season.year,
      name: season.name,
      status: season.status,
      poolName: season.pool?.name ?? 'Unassigned pool',
      participantCount: season.participants.length,
      unresolvedChoices,
      unresolvedEligibility,
      sessions: season.draftSessions.map((session) => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        startsAt: session.startsAt?.toISOString() ?? null,
        turnCount: session._count.turns,
        selectionCount: session._count.selections,
      })),
    }
  })

  return <DraftManager seasons={data} />
}
