import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getCurrentAppUser } from '@/lib/auth/authorization'
import { getSeasonFinalizationReview } from '@/lib/seasons/finalization'

import FinalizationActions from './finalization-actions'

export default async function SeasonFinalizationPage({
  params,
}: {
  params: Promise<{ seasonId: string }>
}) {
  const context = await getCurrentAppUser()
  if (!context) redirect('/login')
  const { seasonId } = await params
  const review = await getSeasonFinalizationReview(seasonId).catch(() => null)
  if (!review) notFound()
  const commissioner = context.appUser.memberships.find(
    (membership) => membership.poolId === review.season.poolId && membership.role === 'COMMISSIONER',
  )
  if (!commissioner) notFound()

  const finalized = review.season.status === 'FINALIZED'
  const ready = review.issues.length === 0 && review.season.status === 'ACTIVE'

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link className="text-sm font-bold text-blue-600 hover:underline" href="/admin/seasons">← Seasons</Link>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Season closeout</p>
              <h1 className="mt-2 text-3xl font-black">{review.season.name}</h1>
              <p className="mt-2 text-slate-500">Review the final table before publishing the champion.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${finalized ? 'bg-orange-500/15 text-orange-600' : ready ? 'bg-blue-500/15 text-blue-600' : 'bg-slate-500/15 text-slate-500'}`}>
              {finalized ? 'FINALIZED' : ready ? 'READY TO FINALIZE' : 'ACTION REQUIRED'}
            </span>
          </div>
        </div>

        <section className="border-t border-white/10 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Readiness</p>
              <h2 className="mt-1 text-xl font-black">{review.issues.length === 0 ? 'Every check passed' : `${review.issues.length} check${review.issues.length === 1 ? '' : 's'} need attention`}</h2>
            </div>
            <span className={`grid h-10 w-10 place-items-center rounded-full text-lg font-black ${review.issues.length === 0 ? 'bg-blue-600 text-white' : 'bg-orange-500/15 text-orange-600'}`}>
              {review.issues.length === 0 ? '✓' : '!'}
            </span>
          </div>
          {review.issues.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              {review.issues.map((issue) => <li key={issue}>• {issue}</li>)}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">All rosters contain 2 NFL and 8 college teams, every team has a season record, and any configured official draft is complete.</p>
          )}
        </section>

        <section className="overflow-hidden border-t border-white/10 bg-slate-900">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Final standings preview</p>
            <h2 className="mt-1 text-xl font-black">League table</h2>
            <p className="mt-1 text-sm text-slate-500">Ties use the best single NFL team, then the best single college team.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3 text-right">Total wins</th>
                  <th className="px-5 py-3 text-right">Best NFL</th>
                  <th className="px-5 py-3 text-right">Best college</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {review.standings.map((standing) => (
                  <tr key={standing.participantId}>
                    <td className="px-5 py-4 text-lg font-black">{standing.rank}</td>
                    <td className="px-5 py-4 font-bold">{standing.name}</td>
                    <td className="px-5 py-4 text-right text-xl font-black text-blue-500">{standing.totalWins}</td>
                    <td className="px-5 py-4 text-right font-semibold">{standing.bestNflTeamWins}</td>
                    <td className="px-5 py-4 text-right font-semibold">{standing.bestCollegeTeamWins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <FinalizationActions
          ready={ready}
          seasonId={seasonId}
          seasonYear={review.season.year}
          status={review.season.status}
          successorYear={review.season.successorYear}
        />
      </div>
    </main>
  )
}
