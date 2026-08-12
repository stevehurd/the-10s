import Link from 'next/link'
import { redirect } from 'next/navigation'

import AdminPageHeader from '@/components/admin-page-header'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

import CreateNextSeason from './create-next-season'

export default async function SeasonsAdminPage() {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const commissionerPoolIds = context.appUser.memberships
    .filter((membership) => membership.role === 'COMMISSIONER')
    .map((membership) => membership.poolId)
  const seasons = await prisma.season.findMany({
    where: { poolId: { in: commissionerPoolIds } },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
    include: {
      pool: { select: { name: true } },
      _count: { select: { participants: true, draftSessions: true } },
      participants: { select: { decisionsLockedAt: true } },
      teamEligibility: { select: { status: true, leagueSnapshot: true } },
    },
  })

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader
          description="Create the next season, then manage participants, eligibility, and readiness from one place."
          title="Seasons"
        />

        <CreateNextSeason seasons={seasons.map((season) => ({ id: season.id, year: season.year, name: season.name, poolName: season.pool?.name ?? 'Pool' }))} />

        <section className="grid gap-4 md:grid-cols-2">
          {seasons.map((season) => {
            const locked = season.participants.filter((participant) => participant.decisionsLockedAt).length
            const eligibilityRemaining = season.teamEligibility.filter(
              (entry) => entry.leagueSnapshot === 'COLLEGE' && ['PENDING', 'REVIEW'].includes(entry.status),
            ).length
            return (
              <article className="rounded-2xl border border-white/10 bg-slate-900 p-5" key={season.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{season.pool?.name}</p>
                    <h2 className="mt-1 text-xl font-bold">{season.name}</h2>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">{friendlyStatus(season.status)}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Participants" value={season._count.participants} />
                  <Metric label="Keepers locked" value={`${locked}/${season._count.participants}`} />
                  <Metric label="Reviews" value={eligibilityRemaining} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold" href={`/admin/seasons/${season.id}/setup`}>Manage season</Link>
                  <Link className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold" href={`/admin/seasons/${season.id}/eligibility`}>College team pool</Link>
                  <Link className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold" href={`/admin/seasons/${season.id}/standings`}>Standings data</Link>
                  <Link className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold" href="/admin/draft">Draft</Link>
                  {(season.status === 'ACTIVE' || season.status === 'FINALIZED') ? (
                    <Link className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 underline decoration-slate-600 underline-offset-4" href={`/admin/seasons/${season.id}/finalize`}>
                      {season.status === 'FINALIZED' ? 'Review final results' : 'Close season'}
                    </Link>
                  ) : null}
                </div>
              </article>
            )
          })}
          {seasons.length === 0 && <p className="text-slate-500">No seasons exist for your pools yet.</p>}
        </section>
      </div>
    </main>
  )
}

function friendlyStatus(status: string) {
  return status.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg bg-white/5 px-2 py-3"><p className="text-lg font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p></div>
}
