import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

import HarnessLab from './harness-lab'

export default async function DraftHarnessPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const commissionerPoolIds = context.appUser.memberships
    .filter((membership) => membership.role === 'COMMISSIONER' && membership.pool.slug === 'the-10s-development')
    .map((membership) => membership.poolId)

  const seasons = await prisma.season.findMany({
    where: { poolId: { in: commissionerPoolIds }, status: { in: ['SETUP', 'DRAFT'] } },
    orderBy: { year: 'desc' },
    include: {
      participants: { select: { decisionsSubmittedAt: true, rosterSlots: { select: { inheritedTeamId: true, retentionChoice: true } } } },
      teamEligibility: { select: { leagueSnapshot: true, status: true } },
      draftSessions: {
        where: { mode: 'REHEARSAL', name: { startsWith: 'Harness run' } },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { turns: true, selections: true } },
          auditEvents: {
            where: { action: 'DRAFT_HARNESS_SCENARIO_COMPLETED' },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })

  const data = seasons.map((season) => {
    const inherited = season.participants.filter((participant) => participant.rosterSlots.some((slot) => slot.inheritedTeamId))
    const choicesReady = inherited.every((participant) => participant.decisionsSubmittedAt && participant.rosterSlots.every((slot) => !slot.inheritedTeamId || slot.retentionChoice !== 'PENDING'))
    const eligibilityReady = !season.teamEligibility.some((entry) => entry.leagueSnapshot === 'COLLEGE' && ['PENDING', 'REVIEW'].includes(entry.status))
    return {
      id: season.id,
      name: season.name,
      year: season.year,
      ready: season.participants.length > 0 && choicesReady && eligibilityReady,
      participantCount: season.participants.length,
      sessions: season.draftSessions.map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        pickSeconds: session.pickSeconds,
        turnCount: session._count.turns,
        selectionCount: session._count.selections,
        createdAt: session.createdAt.toISOString(),
        reports: session.auditEvents.flatMap((event) => {
          const data = event.data as { scenario?: string; passed?: boolean; checks?: Array<{ label: string; passed: boolean; detail?: string }> } | null
          return data?.scenario && typeof data.passed === 'boolean' && data.checks
            ? [{ scenario: data.scenario, passed: data.passed, checks: data.checks, sessionId: session.id }]
            : []
        }),
      })),
    }
  })

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link className="text-sm font-bold text-blue-600 hover:underline" href="/admin/draft">← Draft control</Link>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-orange-600">Development tools</p>
          <h1 className="mt-2 text-3xl font-black">Draft rehearsal</h1>
          <p className="mt-2 max-w-3xl text-slate-500">Walk through the draft as a commissioner, then use the automated safety checks to verify concurrency, roster quotas, and official-data isolation.</p>
        </div>
        <HarnessLab seasons={data} />
      </div>
    </main>
  )
}
