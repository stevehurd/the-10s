import Link from 'next/link'

export default function KeeperStatusCallout({
  seasonId,
  submitted,
  locked = false,
}: {
  seasonId: string
  submitted: boolean
  locked?: boolean
}) {
  const complete = submitted

  return (
    <Link
      className={`group block rounded-2xl border p-5 transition sm:p-6 ${
        complete
          ? 'border-emerald-300/30 bg-emerald-300/10 hover:bg-emerald-300/15'
          : 'border-amber-300/40 bg-amber-300/10 hover:bg-amber-300/15'
      }`}
      href={`/seasons/${seasonId}/keepers`}
    >
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl font-black ${complete ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-amber-950'}`}>
            {complete ? '✓' : '!'}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs font-bold uppercase tracking-[0.16em] ${complete ? 'text-emerald-300' : 'text-amber-300'}`}>Keep/Release</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${complete ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>
                {locked
                  ? submitted
                    ? 'Complete · Locked'
                    : 'Locked · Not submitted'
                  : submitted
                    ? 'Complete'
                    : 'Not submitted'}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">
              {submitted
                ? 'Your keeper choices are submitted'
                : locked
                  ? 'Keeper choices were not submitted'
                  : 'Complete your keeper choices'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              {locked
                ? 'The draft has started, so your choices are now locked.'
                : submitted
                  ? 'Review or update your choices any time before the official draft starts.'
                  : 'Choose which teams to keep and release before the official draft begins.'}
            </p>
          </div>
        </div>
        <span className={`shrink-0 self-start rounded-xl px-4 py-2.5 text-sm font-black sm:self-auto ${complete ? 'bg-emerald-300 text-slate-950' : 'bg-amber-300 text-amber-950'}`}>
          {locked ? 'Review choices' : submitted ? 'Review or update' : 'Choose Keep or Release'} <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  )
}
