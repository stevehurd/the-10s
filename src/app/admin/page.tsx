import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SeasonStageTracker } from '@/components/product-header'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

export default async function AdminPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const membership = context.appUser.memberships.find((candidate) => candidate.role === 'COMMISSIONER')
  if (!membership) redirect('/')

  const season = await prisma.season.findFirst({
    where: { poolId: membership.poolId },
    orderBy: { year: 'desc' },
    include: {
      participants: { select: { decisionsSubmittedAt: true } },
      teamEligibility: { select: { leagueSnapshot: true, status: true } },
      draftSessions: {
        where: { status: { not: 'CANCELED' } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  const [activeMembers, recentActivity] = await Promise.all([
    prisma.poolMembership.count({ where: { poolId: membership.poolId, status: 'ACTIVE' } }),
    prisma.auditEvent.findMany({
      where: { poolId: membership.poolId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { actor: { select: { name: true } } },
    }),
  ])
  const submitted = season?.participants.filter((participant) => participant.decisionsSubmittedAt).length ?? 0
  const unresolvedEligibility = season?.teamEligibility.filter(
    (entry) => entry.leagueSnapshot === 'COLLEGE' && ['PENDING', 'REVIEW'].includes(entry.status),
  ).length ?? 0
  const latestDraft = season?.draftSessions[0] ?? null
  const stage = !season
    ? 'SETUP'
    : season.status === 'ACTIVE' || season.status === 'FINALIZED'
      ? 'SEASON'
      : latestDraft
        ? 'DRAFT'
        : submitted > 0
          ? 'KEEPERS'
          : 'SETUP'

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-slate-100">
          <div className="grid gap-8 p-6 md:grid-cols-[1.25fr_.75fr] md:p-9">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-300">Commissioner HQ</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{season?.name ?? 'Build your first season'}</h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                {season
                  ? `${membership.pool.name} has ${activeMembers} active members. Complete the readiness checks below before opening the draft room.`
                  : 'Create a season to begin assigning seats, reviewing teams, and preparing the draft.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className="rounded-xl bg-blue-600 px-6 py-3 font-black" href={season ? `/admin/seasons/${season.id}/setup` : '/admin/seasons'}>{season ? 'Continue season setup' : 'Create season'}</Link>
                <Link className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold" href="/admin/draft">Open draft controls</Link>
              </div>
            </div>
            <div className="self-center"><SeasonStageTracker activeStage={stage} /></div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard detail="Active pool access" label="Members" value={activeMembers} />
          <StatCard detail="Keep/Release complete" label="Choices" value={season ? `${submitted}/${season.participants.length}` : '—'} warning={Boolean(season && submitted !== season.participants.length)} />
          <StatCard detail="College teams requiring action" label="Eligibility" value={unresolvedEligibility} warning={unresolvedEligibility > 0} />
          <StatCard detail={latestDraft ? `${latestDraft.mode.toLowerCase()} · ${latestDraft.status.toLowerCase()}` : 'Not created yet'} label="Draft" value={latestDraft ? latestDraft.status : 'Pending'} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Next actions</p><h2 className="mt-1 text-xl font-black">Get draft-ready</h2></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Commissioner</span></div>
            <div className="mt-5 space-y-3">
              <ActionRow done={Boolean(season && season.participants.length > 0)} href={season ? `/admin/seasons/${season.id}/setup` : '/admin/seasons'} label="Confirm participants and base draft order" />
              <ActionRow done={Boolean(season && submitted === season.participants.length && season.participants.length > 0)} href={season ? `/admin/seasons/${season.id}/setup` : '/admin/seasons'} label="Collect every Keep/Release submission" />
              <ActionRow done={Boolean(season && unresolvedEligibility === 0 && season.teamEligibility.length > 0)} href={season ? `/admin/seasons/${season.id}/eligibility` : '/admin/seasons'} label="Approve the season's FBS team pool" />
              <ActionRow done={Boolean(latestDraft)} href="/admin/draft" label="Create and run a rehearsal draft" />
              {season && (season.status === 'ACTIVE' || season.status === 'FINALIZED') ? (
                <ActionRow done={season.status === 'FINALIZED'} href={`/admin/seasons/${season.id}/standings`} label="Review and synchronize season standings" />
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Audit trail</p>
            <h2 className="mt-1 text-xl font-black">Recent activity</h2>
            <div className="mt-5 space-y-4">
              {recentActivity.map((event) => (
                <div className="flex gap-3" key={event.id}>
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 ring-4 ring-blue-500/15" />
                  <div><p className="text-sm font-bold">{friendlyAction(event.action)}</p><p className="text-xs text-slate-500">{event.actor?.name ?? 'System'} · {event.createdAt.toLocaleDateString()}</p></div>
                </div>
              ))}
              {recentActivity.length === 0 && <p className="text-sm text-slate-500">Activity will appear as setup begins.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function StatCard({ label, value, detail, warning = false }: { label: string; value: string | number; detail: string; warning?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-start justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${warning ? 'bg-amber-300' : 'bg-blue-500'}`} /></div><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function ActionRow({ done, href, label }: { done: boolean; href: string; label: string }) {
  return <Link className="flex items-center gap-3 border-b border-white/10 p-4 transition hover:bg-white/5" href={href}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${done ? 'bg-blue-600 text-white' : 'bg-orange-400/15 text-orange-300'}`}>{done ? '✓' : '→'}</span><span className={`font-bold ${done ? 'text-slate-500 line-through' : ''}`}>{label}</span></Link>
}

function friendlyAction(action: string) {
  return action.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}
