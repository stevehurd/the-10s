'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

function remainingLabel(startsAt: string, now: number) {
  const remaining = new Date(startsAt).getTime() - now
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  return `${hours}h ${minutes}m ${seconds}s`
}

export default function DraftCountdown({
  startsAt,
  draftHref,
  meetingUrl,
  status,
}: {
  startsAt: string | null
  draftHref: string
  meetingUrl: string | null
  status: string
}) {
  const [now, setNow] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const hasStarted = status === 'LIVE' || status === 'PAUSED'
  const hasArrived = Boolean(now && startsAt && new Date(startsAt).getTime() <= now)

  if (hasStarted || hasArrived) {
    return (
      <div className="mt-4">
        <p className="text-2xl font-black text-orange-300">
          {status === 'LIVE' ? 'The draft is live!' : status === 'PAUSED' ? 'The draft room is open' : 'It’s draft time!'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-base font-black text-white transition hover:bg-blue-500"
            href={draftHref}
          >
            Enter Draft <span aria-hidden="true" className="ml-2">→</span>
          </Link>
          {meetingUrl ? (
            <a
              className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-base font-bold text-white transition hover:border-orange-300/40 hover:bg-white/10"
              href={meetingUrl}
              rel="noreferrer"
              target="_blank"
            >
              Join Video Call
            </a>
          ) : null}
        </div>
      </div>
    )
  }

  if (!startsAt) {
    return (
      <div className="mt-2">
        <p className="text-xl font-bold">Time not scheduled</p>
        <p className="mt-2 text-sm text-slate-400">The commissioner will add the official date and time.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="mt-4 text-3xl font-black tabular-nums text-orange-300">
        {now ? remainingLabel(startsAt, now) : 'Calculating…'}
      </p>
      <p className="mt-1 text-xs text-slate-500">Countdown updates in your browser</p>
    </div>
  )
}
