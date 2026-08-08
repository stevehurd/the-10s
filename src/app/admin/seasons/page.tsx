import Link from 'next/link'
import { redirect } from 'next/navigation'

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
      participants: { select: { decisionsSubmittedAt: true } },
      teamEligibility: { select: { status: true, leagueSnapshot: true } },
    },
  })

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-blue-700 hover:underline">← Admin</Link>
          <h1 className="mt-3 text-3xl font-bold">Season management</h1>
          <p className="mt-2 text-slate-600">Create the next season, prepare participants, and confirm draft readiness.</p>
        </div>

        <CreateNextSeason seasons={seasons.map((season) => ({ id: season.id, year: season.year, name: season.name, poolName: season.pool?.name ?? 'Pool' }))} />

        <section className="grid gap-4 md:grid-cols-2">
          {seasons.map((season) => {
            const submitted = season.participants.filter((participant) => participant.decisionsSubmittedAt).length
            const eligibilityRemaining = season.teamEligibility.filter(
              (entry) => entry.leagueSnapshot === 'COLLEGE' && ['PENDING', 'REVIEW'].includes(entry.status),
            ).length
            return (
              <article className="border-t border-white/10 bg-slate-900 p-5" key={season.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">{season.pool?.name}</p>
                    <h2 className="mt-1 text-xl font-bold">{season.name}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{season.status}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Participants" value={season._count.participants} />
                  <Metric label="Submitted" value={`${submitted}/${season._count.participants}`} />
                  <Metric label="Reviews" value={eligibilityRemaining} />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href={`/admin/seasons/${season.id}/setup`}>Open setup</Link>
                  <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" href={`/admin/seasons/${season.id}/eligibility`}>Eligibility</Link>
                  <Link className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" href="/admin/draft">Drafts</Link>
                  {(season.status === 'ACTIVE' || season.status === 'FINALIZED') ? (
                    <Link className="rounded-lg border border-orange-500/40 px-4 py-2 text-sm font-semibold text-orange-600" href={`/admin/seasons/${season.id}/finalize`}>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="bg-white/5 px-2 py-3"><p className="text-lg font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p></div>
}
