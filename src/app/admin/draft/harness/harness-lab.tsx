'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface HarnessCheck {
  label: string
  passed: boolean
  detail?: string
}

interface HarnessReport {
  scenario: string
  passed: boolean
  checks: HarnessCheck[]
  sessionId: string
}

interface HarnessSession {
  id: string
  name: string
  status: string
  pickSeconds: number
  turnCount: number
  selectionCount: number
  createdAt: string
  reports: HarnessReport[]
}

interface HarnessProgress {
  inProgress: true
  remainingTurns: number
  selectionCount: number
}

interface HarnessSeason {
  id: string
  name: string
  year: number
  ready: boolean
  participantCount: number
  sessions: HarnessSession[]
}

const HUMAN_REHEARSAL_STEPS = [
  { id: 'orientation', label: 'Confirm the room clearly shows the current drafter, round, pick, and timer.' },
  { id: 'second-window', label: 'Open the room in a second window and confirm both views show the same turn.' },
  { id: 'manual-pick', label: 'Make a manual pick and confirm the board, activity, and roster update in both windows.' },
  { id: 'pause-resume', label: 'Pause and resume the draft; confirm picks are blocked while paused.' },
  { id: 'autopick', label: 'Let the 10-second clock expire and confirm exactly one eligible team is autopicked.' },
  { id: 'undo', label: 'Undo the latest pick and confirm the same turn becomes active again.' },
  { id: 'mobile', label: 'Narrow one window to phone width and complete a pick without using the desktop board.' },
  { id: 'video', label: 'If a video URL is configured, confirm the header icon opens the correct call.' },
] as const

export default function HarnessLab({ seasons }: { seasons: HarnessSeason[] }) {
  const router = useRouter()
  const [seasonId, setSeasonId] = useState(seasons.find((season) => season.ready)?.id ?? seasons[0]?.id ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [latestReport, setLatestReport] = useState<HarnessReport | null>(null)
  const season = useMemo(() => seasons.find((entry) => entry.id === seasonId) ?? seasons[0], [seasonId, seasons])
  const guidedSession = season?.sessions.find((session) => session.status !== 'COMPLETED') ?? null

  async function run(action: 'CREATE' | 'CONCURRENCY' | 'LIFECYCLE' | 'COMPLETE', sessionId?: string) {
    if (!season) return
    setBusy(`${action}-${sessionId ?? season.id}`)
    setMessage(null)
    setLatestReport(null)
    try {
      let response: Response
      let payload: HarnessReport | HarnessProgress | { sessionId: string; error?: string }
      do {
        response = await fetch('/api/admin/draft-harness', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, seasonId: season.id, sessionId }),
        })
        payload = await response.json()
        if (!response.ok && response.status !== 202) {
          throw new Error('error' in payload && payload.error ? payload.error : 'Harness scenario failed')
        }
        if (response.status === 202 && 'inProgress' in payload) {
          setMessage(`Completing rehearsal… ${payload.selectionCount} picks made, ${payload.remainingTurns} turns remaining.`)
        }
      } while (action === 'COMPLETE' && response.status === 202)

      if (action === 'CREATE') setMessage('Fresh isolated rehearsal created. Work through the guided checklist below.')
      else {
        setMessage(null)
        setLatestReport(payload as HarnessReport)
      }
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Harness scenario failed')
    } finally {
      setBusy(null)
    }
  }

  async function remove(session: HarnessSession) {
    if (!window.confirm(`Delete “${session.name}” and all of its isolated test picks?`)) return
    setBusy(`DELETE-${session.id}`)
    setMessage(null)
    try {
      if (session.status === 'LIVE') {
        const pauseResponse = await fetch(`/api/draft-sessions/${session.id}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'PAUSE' }),
        })
        if (!pauseResponse.ok) {
          const payload = await pauseResponse.json().catch(() => null)
          throw new Error(payload?.error || 'Unable to pause harness run for deletion')
        }
      }
      const response = await fetch(`/api/draft-sessions/${session.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Unable to delete harness run')
      }
      setMessage('Harness run deleted.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete harness run')
    } finally {
      setBusy(null)
    }
  }

  if (!season) {
    return <p className="border border-orange-500/30 bg-orange-500/10 p-5">No synthetic development season is available.</p>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <label className="block max-w-xl flex-1 text-sm font-bold">
            Season under test
            <select className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-900 px-3 py-2.5" onChange={(event) => setSeasonId(event.target.value)} value={season.id}>
              {seasons.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          <button
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!season.ready || busy !== null}
            onClick={() => void run('CREATE')}
            type="button"
          >
            {busy?.startsWith('CREATE') ? 'Creating…' : 'Start guided rehearsal'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>{season.participantCount} participants</span>
          <span>{season.ready ? '✓ Draft inputs ready' : 'Keeper or eligibility setup is incomplete'}</span>
          <span>Rehearsal data only</span>
        </div>
      </section>

      {message ? <p className="border-l-4 border-orange-500 bg-orange-500/10 px-4 py-3 text-sm font-semibold">{message}</p> : null}
      {latestReport ? <Report report={latestReport} /> : null}

      <GuidedRehearsal
        busy={busy !== null}
        key={guidedSession?.id ?? 'no-guided-session'}
        onComplete={() => guidedSession && void run('COMPLETE', guidedSession.id)}
        session={guidedSession}
      />

      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Automated verification</p>
            <h2 className="mt-1 text-2xl font-black">Safety checks and prior runs</h2>
          </div>
          <span className="text-sm text-slate-500">{season.sessions.length} run{season.sessions.length === 1 ? '' : 's'}</span>
        </div>
        <div className="mt-4 space-y-4">
          {season.sessions.length === 0 ? (
            <div className="border border-dashed border-slate-400 p-6 text-sm text-slate-500">Create a fresh run to begin.</div>
          ) : season.sessions.map((session) => (
            <article className="rounded-2xl border border-white/10 bg-slate-900 p-5" key={session.id}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black">{session.name}</h3>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black">{session.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{session.selectionCount}/{session.turnCount} picks · created {new Date(session.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg border border-blue-500/40 px-3 py-2 text-sm font-bold text-blue-600 disabled:opacity-40" disabled={busy !== null || session.status === 'COMPLETED'} onClick={() => void run('CONCURRENCY', session.id)}>Concurrent-pick check</button>
                  <button className="rounded-lg border border-orange-500/40 px-3 py-2 text-sm font-bold text-orange-600 disabled:opacity-40" disabled={busy !== null || session.status === 'COMPLETED'} onClick={() => void run('LIFECYCLE', session.id)}>Lifecycle check</button>
                  <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busy !== null || session.status === 'COMPLETED'} onClick={() => void run('COMPLETE', session.id)}>Final roster check</button>
                  <Link className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-bold" href={`/draft/${session.id}`}>Open room</Link>
                  <button className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-40" disabled={busy !== null} onClick={() => void remove(session)}>Delete run</button>
                </div>
              </div>
              {session.reports.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {session.reports.map((report, index) => (
                    <div className={`border-l-4 px-3 py-2 text-sm ${report.passed ? 'border-blue-500 bg-blue-500/10' : 'border-red-500 bg-red-500/10'}`} key={`${report.scenario}-${index}`}>
                      <p className="font-bold">{report.passed ? 'PASS' : 'FAIL'} · {report.scenario}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function GuidedRehearsal({
  busy,
  onComplete,
  session,
}: {
  busy: boolean
  onComplete: () => void
  session: HarnessSession | null
}) {
  const [completed, setCompleted] = useState<string[]>([])

  function toggle(stepId: string) {
    setCompleted((current) => {
      return current.includes(stepId)
        ? current.filter((value) => value !== stepId)
        : [...current, stepId]
    })
  }

  if (!session) {
    return (
      <section className="rounded-2xl border border-dashed border-blue-500/40 bg-blue-500/5 p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Recommended next</p>
        <h2 className="mt-2 text-2xl font-black">Run a human draft rehearsal</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Start a guided rehearsal above. It creates an isolated 10-second draft that cannot change official rosters.</p>
      </section>
    )
  }

  const completedCount = HUMAN_REHEARSAL_STEPS.filter((step) => completed.includes(step.id)).length
  return (
    <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Guided human rehearsal</p>
          <h2 className="mt-2 text-2xl font-black">Test the experience, not just the engine</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Use the checklist in order. Progress remains available while this rehearsal page is open.</p>
        </div>
        <div className="shrink-0 rounded-xl bg-slate-950 px-4 py-3 text-center">
          <p className="text-2xl font-black">{completedCount}/{HUMAN_REHEARSAL_STEPS.length}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">observations complete</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {HUMAN_REHEARSAL_STEPS.map((step, index) => {
          const checked = completed.includes(step.id)
          return (
            <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition ${checked ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/10 bg-slate-900 hover:border-white/20'}`} key={step.id}>
              <input checked={checked} className="mt-1 size-4 accent-blue-600" onChange={() => toggle(step.id)} type="checkbox" />
              <span><strong className="mr-1">{index + 1}.</strong>{step.label}</span>
            </label>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
        <Link className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white" href={`/draft/${session.id}`} target="_blank">Open rehearsal room ↗</Link>
        <button className="rounded-lg border border-white/15 px-5 py-3 text-sm font-black disabled:opacity-40" disabled={busy || session.status === 'COMPLETED'} onClick={onComplete} type="button">Finish picks + verify rosters</button>
        <button className="px-3 py-3 text-sm font-bold text-slate-400 hover:text-white" onClick={() => setCompleted([])} type="button">Reset checklist</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">The final check may complete remaining picks automatically. Because this is rehearsal mode, the dashboard and official roster assignments remain unchanged.</p>
    </section>
  )
}

function Report({ report }: { report: HarnessReport }) {
  return (
    <section className={`rounded-2xl border p-5 ${report.passed ? 'border-blue-500 bg-blue-500/10' : 'border-red-500 bg-red-500/10'}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em]">Latest result</p>
      <h2 className="mt-1 text-xl font-black">{report.passed ? 'PASS' : 'FAIL'} · {report.scenario}</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {report.checks.map((check) => (
          <div className="bg-slate-900 px-3 py-3 text-sm" key={check.label}>
            <p className="font-bold">{check.passed ? '✓' : '✕'} {check.label}</p>
            {check.detail ? <p className="mt-1 text-xs text-slate-500">{check.detail}</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
