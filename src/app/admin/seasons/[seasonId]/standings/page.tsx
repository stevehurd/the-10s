import { redirect } from 'next/navigation'

import AdminPageHeader from '@/components/admin-page-header'
import { getCurrentAppUser } from '@/lib/auth/authorization'
import { prisma } from '@/lib/db'

import StandingsSyncControls from './standings-sync-controls'

export default async function StandingsAdminPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const { seasonId } = await params
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      pool: { select: { name: true } },
      teamRecords: {
        select: {
          sourceUpdatedAt: true,
          team: { select: { league: true } },
        },
      },
      standingsSyncRuns: {
        orderBy: { startedAt: 'desc' },
        take: 12,
        include: { requestedBy: { select: { name: true } } },
      },
      _count: { select: { standingsSyncRuns: true } },
    },
  })
  if (!season?.poolId) redirect('/admin/seasons')
  const commissioner = context.appUser.memberships.some((membership) => (
    membership.poolId === season.poolId && membership.role === 'COMMISSIONER'
  ))
  if (!commissioner) redirect('/')

  const nflRecords = season.teamRecords.filter((record) => record.team.league === 'NFL')
  const collegeRecords = season.teamRecords.filter((record) => record.team.league === 'COLLEGE')
  const latestSourceUpdate = season.teamRecords.reduce<Date | null>((latest, record) => {
    if (!record.sourceUpdatedAt) return latest
    return !latest || record.sourceUpdatedAt > latest ? record.sourceUpdatedAt : latest
  }, null)
  const disabledReason = season.finalizedAt
    ? 'This season is finalized, so live synchronization is disabled. The read-only historical check below remains available.'
    : null

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader
          description={`Validate and synchronize SportsDataIO records for ${season.pool?.name ?? 'this pool'}. Every attempt is retained below, including failures.`}
          title={`${season.name} standings`}
        />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric detail="Expected complete league: 32" label="NFL records" value={nflRecords.length} />
          <Metric detail="Active FBS records returned" label="College records" value={collegeRecords.length} />
          <Metric detail="Syncs and read-only validations" label="Data checks" value={season._count.standingsSyncRuns} />
          <Metric detail="Most recent source timestamp" label="Last updated" value={latestSourceUpdate ? formatShortDate(latestSourceUpdate) : 'Never'} />
        </section>

        <StandingsSyncControls
          allowHistoricalValidation={Boolean(season.finalizedAt)}
          disabledReason={disabledReason}
          seasonId={season.id}
          seasonYear={season.year}
        />

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Operational history</p>
            <h2 className="mt-1 text-xl font-black">Recent data checks</h2>
          </div>
          <div className="divide-y divide-white/10">
            {season.standingsSyncRuns.map((run) => {
              const messages = stringList(run.messages)
              const errors = stringList(run.errors)
              return (
                <article className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[10rem_1fr_auto]" key={run.id}>
                  <div>
                    <StatusBadge status={run.status} />
                    <p className="mt-2 text-xs text-slate-500">{formatLongDate(run.startedAt)}</p>
                  </div>
                  <div>
                    <p className="font-bold">{run.trigger === 'VALIDATION' ? `Read-only ${season.year} validation` : `${friendlyLeague(run.requestedLeague)} · ${run.updatedTeams} teams`}</p>
                    <p className="mt-1 text-xs text-slate-500">{run.trigger === 'CRON' ? 'Scheduled update' : `${run.trigger === 'VALIDATION' ? 'Validated' : 'Started'} by ${run.requestedBy?.name ?? 'Commissioner'}`}</p>
                    {run.trigger === 'VALIDATION' ? <p className="mt-2 text-sm font-bold text-emerald-200">✓ Read-only · 0 standings records changed</p> : null}
                    {messages.map((message) => <p className="mt-2 text-sm text-slate-300" key={message}>{message}</p>)}
                    {errors.map((message) => <p className="mt-2 text-sm font-semibold text-red-200" key={message}>{message}</p>)}
                  </div>
                  <div className="flex gap-4 text-right text-xs text-slate-500 lg:block">
                    <p><span className="font-black text-slate-200">{run.nflRecords}</span> NFL</p>
                    <p className="lg:mt-1"><span className="font-black text-slate-200">{run.collegeRecords}</span> college</p>
                  </div>
                </article>
              )
            })}
            {season.standingsSyncRuns.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">No standings sync or historical validation has been attempted for this season.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 text-sm leading-6 text-slate-400 sm:p-6">
          <p className="font-black text-slate-100">Safety rules</p>
          <p className="mt-2">A malformed or incomplete feed is rejected before that league writes records. NFL requires all 32 teams. College requires a plausible active FBS catalog with valid aggregate records, and a new season cannot sync while the provider still matches the prior year&apos;s snapshot. Finalized seasons remain frozen.</p>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
}

function StatusBadge({ status }: { status: string }) {
  const style = status === 'SUCCEEDED'
    ? 'bg-emerald-400/15 text-emerald-200'
    : status === 'PARTIAL'
      ? 'bg-amber-400/15 text-amber-200'
      : status === 'RUNNING'
        ? 'bg-blue-400/15 text-blue-200'
        : 'bg-red-500/15 text-red-200'
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${style}`}>{status.toLowerCase()}</span>
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function friendlyLeague(league: string) {
  if (league === 'BOTH') return 'NFL + college'
  return league === 'COLLEGE' ? 'College' : 'NFL'
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatLongDate(value: Date) {
  return value.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
