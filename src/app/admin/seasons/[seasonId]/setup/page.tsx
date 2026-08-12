import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

import SeasonSetup from './season-setup'

export default async function SeasonSetupPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      pool: { select: { id: true, name: true } },
      participants: {
        orderBy: { baseDraftOrder: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          poolSeat: { select: { id: true, label: true } },
          rosterSlots: {
            orderBy: { number: 'asc' },
            include: { inheritedTeam: { select: { name: true, league: true } } },
          },
        },
      },
      teamEligibility: { select: { status: true, leagueSnapshot: true } },
      draftSessions: { where: { status: { not: 'CANCELED' } }, select: { id: true, mode: true, status: true } },
    },
  })
  if (!season?.pool) notFound()
  const isCommissioner = context.appUser.memberships.some(
    (membership) => membership.poolId === season.pool!.id && membership.role === 'COMMISSIONER',
  )
  if (!isCommissioner) redirect('/')
  const memberships = await prisma.poolMembership.findMany({
    where: { poolId: season.pool.id, status: 'ACTIVE' },
    orderBy: { user: { name: 'asc' } },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const participantUserIds = new Set(season.participants.map((participant) => participant.userId))
  const availableMembers = memberships
    .filter((membership) => !participantUserIds.has(membership.userId))
    .map((membership) => membership.user)
  const unresolvedEligibility = season.teamEligibility.filter(
    (entry) => entry.leagueSnapshot === 'COLLEGE' && ['PENDING', 'REVIEW'].includes(entry.status),
  ).length

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin/seasons" className="text-sm font-semibold text-blue-700 hover:underline">← Seasons</Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-700">{season.pool.name}</p>
          <h1 className="mt-1 text-3xl font-bold">{season.name} setup</h1>
        </div>
        <SeasonSetup
          key={season.participants.map((participant) => `${participant.id}:${participant.userId}:${participant.baseDraftOrder}:${participant.updatedAt.toISOString()}`).join('|')}
          availableMembers={availableMembers}
          draftConfigured={season.draftSessions.length > 0}
          keeperReopenAllowed={season.draftSessions.every((session) => session.mode === 'OFFICIAL' && session.status === 'SCHEDULED')}
          participants={season.participants.map((participant) => ({
            id: participant.id,
            userId: participant.userId,
            name: participant.user.name,
            email: participant.user.email,
            baseDraftOrder: participant.baseDraftOrder,
            isReplacement: participant.isReplacement,
            releaseOverride: participant.releaseOverride,
            decisionsSubmitted: Boolean(participant.decisionsSubmittedAt),
            decisionsLocked: Boolean(participant.decisionsLockedAt),
            inheritedCount: participant.rosterSlots.filter((slot) => slot.inheritedTeamId).length,
            releasedNFL: participant.rosterSlots.filter((slot) => slot.retentionChoice === 'RELEASE' && slot.inheritedTeam?.league === 'NFL').length,
            releasedCollege: participant.rosterSlots.filter((slot) => slot.retentionChoice === 'RELEASE' && slot.inheritedTeam?.league === 'COLLEGE').length,
          }))}
          seasonId={season.id}
          unresolvedEligibility={unresolvedEligibility}
        />
      </div>
    </main>
  )
}
