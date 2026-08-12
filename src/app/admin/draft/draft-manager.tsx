'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import AdminPageHeader from '@/components/admin-page-header'
import { useMemo, useState } from 'react'

import { normalizeMeetingUrl } from '@/lib/draft/logistics'

interface SessionSummary {
  id: string
  name: string
  mode: string
  status: string
  pickSeconds: number
  startsAt: string | null
  meetingUrl: string | null
  currentTurnIndex: number
  createdAt: string
  turnCount: number
  selectionCount: number
}

interface SeasonSummary {
  id: string
  year: number
  name: string
  status: string
  poolName: string
  participantCount: number
  unresolvedChoices: number
  unresolvedEligibility: number
  sessions: SessionSummary[]
}

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? `Request failed (${response.status})`
}

export default function DraftManager({ seasons }: { seasons: SeasonSummary[] }) {
  const router = useRouter()
  const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? '')
  const [officialPickSeconds, setOfficialPickSeconds] = useState(90)
  const [demoPickSeconds, setDemoPickSeconds] = useState(90)
  const [draftStartsAt, setDraftStartsAt] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const season = useMemo(
    () => seasons.find((candidate) => candidate.id === seasonId) ?? seasons[0],
    [seasonId, seasons],
  )
  const officialSession = season?.sessions.find(
    (session) => session.mode === 'OFFICIAL' && session.status !== 'CANCELED',
  ) ?? null
  const demoSessions = season?.sessions.filter(
    (session) => session.mode === 'REHEARSAL',
  ) ?? []

  const ready = Boolean(
    season &&
      season.participantCount > 0 &&
      season.unresolvedChoices === 0 &&
      season.unresolvedEligibility === 0,
  )

  async function createSession(mode: 'REHEARSAL' | 'OFFICIAL') {
    if (!season) return
    if (mode === 'OFFICIAL' && !draftStartsAt) {
      setMessage('Choose the official draft date and time before scheduling it.')
      return
    }
    setBusy(`create-${mode}`)
    setMessage(null)
    const pickSeconds = mode === 'OFFICIAL' ? officialPickSeconds : demoPickSeconds
    const response = await fetch('/api/draft-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonId: season.id,
        mode,
        pickSeconds,
        startsAt: mode === 'OFFICIAL' && draftStartsAt ? new Date(draftStartsAt).toISOString() : null,
        meetingUrl: mode === 'OFFICIAL' ? meetingUrl : null,
      }),
    })
    if (!response.ok) {
      setMessage(await responseMessage(response))
      setBusy(null)
      return
    }
    const session = (await response.json()) as { id: string }
    router.push(`/draft/${session.id}`)
    router.refresh()
  }

  async function control(sessionId: string, action: 'START' | 'PAUSE' | 'RESUME') {
    setBusy(`${sessionId}-${action}`)
    setMessage(null)
    const response = await fetch(`/api/draft-sessions/${sessionId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) setMessage(await responseMessage(response))
    router.refresh()
    setBusy(null)
  }

  async function removeRehearsal(session: SessionSummary) {
    if (!window.confirm(`Delete “${session.name}” and all of its test picks?`)) return
    setBusy(`${session.id}-delete`)
    setMessage(null)
    const response = await fetch(`/api/draft-sessions/${session.id}`, { method: 'DELETE' })
    if (!response.ok) setMessage(await responseMessage(response))
    router.refresh()
    setBusy(null)
  }

  async function undoLastPick(session: SessionSummary) {
    if (!window.confirm(`Undo the last pick in “${session.name}”? The draft will remain paused for the corrected pick.`)) return
    setBusy(`${session.id}-undo`)
    setMessage(null)
    const response = await fetch(`/api/draft-sessions/${session.id}/undo`, { method: 'POST' })
    if (!response.ok) setMessage(await responseMessage(response))
    else setMessage('Last pick undone. Open the room, resume the draft, and make the corrected selection.')
    router.refresh()
    setBusy(null)
  }

  async function fastForwardDemo(session: SessionSummary) {
    if (!window.confirm(`Fast-forward “${session.name}” to its final pick? Earlier picks will be filled using the normal autopick rules.`)) return
    setBusy(`${session.id}-fast-forward`)
    setMessage(null)
    const response = await fetch(`/api/draft-sessions/${session.id}/fast-forward`, { method: 'POST' })
    if (!response.ok) {
      setMessage(await responseMessage(response))
      setBusy(null)
      return
    }
    router.push(`/draft/${session.id}`)
    router.refresh()
  }

  if (!season) {
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-100">No pool seasons exist yet.</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader
          description="Schedule the official draft, confirm readiness, and safely rehearse the full experience."
          title="Draft management"
        />

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-4 sm:p-5">
          <label className="block max-w-xl text-sm font-semibold">
            Season to manage
            <select
              className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-900 px-3 py-2.5"
              value={season.id}
              onChange={(event) => setSeasonId(event.target.value)}
            >
              {seasons.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.poolName} — {candidate.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          <div className="border-b border-white/10 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Official draft</p>
                <h2 className="mt-1 text-2xl font-bold">Upcoming {season.year} draft</h2>
                <p className="mt-1 text-sm text-slate-600">This is the draft your players will see and join.</p>
              </div>
              <Badge>{officialSession?.status ?? 'NOT CREATED'}</Badge>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">1. Track activation readiness</h3>
                  <p className="mt-1 text-sm text-slate-600">These items must be complete when the scheduled draft time arrives.</p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300`}>
                  <span className={`h-2 w-2 rounded-full ${ready ? 'bg-blue-500' : 'bg-amber-300'}`} />
                  {ready ? 'Ready to draft' : 'Action needed'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Readiness label="Participants" value={`${season.participantCount}`} ok={season.participantCount > 0} />
            <Readiness label="Keeper choices remaining" value={`${season.unresolvedChoices}`} ok={season.unresolvedChoices === 0} />
            <Readiness label="Eligibility reviews remaining" value={`${season.unresolvedEligibility}`} ok={season.unresolvedEligibility === 0} />
              </div>
              {!ready ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  The official draft can be scheduled now. Finish keeper locks and eligibility reviews before it starts.
                </p>
              ) : null}
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="font-bold">2. Set the official details</h3>
              {officialSession ? (
                officialSession.status === 'SCHEDULED' ? (
                  <ScheduleEditor key={officialSession.id} session={officialSession} />
                ) : (
                  <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
                    Schedule settings are locked because this draft has already started.
                  </p>
                )
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">Draft date and time<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="datetime-local" value={draftStartsAt} onInput={(event) => setDraftStartsAt(event.currentTarget.value)} /></label>
                  <label className="text-sm font-semibold">Video call link (optional)<input autoCapitalize="none" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" inputMode="url" placeholder="meet.google.com/..." spellCheck={false} type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} onBlur={(event) => setMeetingUrl(normalizeMeetingUrl(event.target.value) ?? '')} /><span className="mt-1 block text-xs font-normal text-slate-500">https:// is added automatically.</span></label>
                  <label className="text-sm font-semibold md:max-w-[180px]">Pick clock (seconds)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" max={900} min={10} type="number" value={officialPickSeconds} onChange={(event) => setOfficialPickSeconds(Number(event.target.value))} /></label>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="font-bold">3. Open and run the draft</h3>
              {officialSession ? (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{officialSession.name}</span>
                      <Badge>{officialSession.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {officialSession.selectionCount}/{officialSession.turnCount} picks · {officialSession.pickSeconds}s clock
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{officialSession.startsAt ? new Date(officialSession.startsAt).toLocaleString() : 'Draft time not scheduled'}{officialSession.meetingUrl ? ' · Video call configured' : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/draft/${officialSession.id}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold">
                      Open official draft room
                    </Link>
                    {officialSession.status === 'LIVE' && (
                      <ActionButton disabled={busy !== null} onClick={() => control(officialSession.id, 'PAUSE')}>Pause draft</ActionButton>
                    )}
                    {officialSession.status === 'PAUSED' && (
                      <ActionButton disabled={busy !== null} onClick={() => control(officialSession.id, 'RESUME')}>Resume draft</ActionButton>
                    )}
                    {(officialSession.status === 'PAUSED' || officialSession.status === 'COMPLETED') && officialSession.selectionCount > 0 && (
                      <button
                        className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                        disabled={busy !== null}
                        onClick={() => undoLastPick(officialSession)}
                      >
                        Undo last pick
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-600">Publish the date and time now; the draft board will be generated when the draft opens.</p>
                  <button className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={season.participantCount === 0 || busy !== null} onClick={() => createSession('OFFICIAL')}>
                    {busy === 'create-OFFICIAL' ? 'Scheduling…' : 'Schedule official draft'}
                  </button>
                </div>
              )}
            </div>
            {message ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Commissioner testing</p>
              <h2 className="mt-1 text-xl font-bold">Demo drafts</h2>
              <p className="mt-1 text-sm text-slate-600">Create an isolated draft using the current players and base order with a fresh set of randomly generated keepers. Demo picks never affect official rosters or keeper choices.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Demo pick clock<input className="mt-1 block w-36 rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-100" max={900} min={10} type="number" value={demoPickSeconds} onChange={(event) => setDemoPickSeconds(Number(event.target.value))} /></label>
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={season.participantCount === 0 || busy !== null} onClick={() => createSession('REHEARSAL')}>
                {busy === 'create-REHEARSAL' ? 'Seeding demo…' : 'Create randomized demo'}
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {demoSessions.length === 0 ? <p className="border border-dashed border-slate-300 bg-white/5 px-4 py-5 text-sm text-slate-500">No demo drafts yet.</p> : null}
            {demoSessions.map((session) => (
              <article key={session.id} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{session.name}</h3><Badge>{session.status}</Badge></div><p className="mt-1 text-sm text-slate-600">{session.selectionCount}/{session.turnCount} picks · {session.pickSeconds}s clock</p></div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/draft/${session.id}`} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white">Open demo</Link>
                    {session.status === 'SCHEDULED' ? <ActionButton disabled={busy !== null} onClick={() => control(session.id, 'START')}>Start</ActionButton> : null}
                    {session.status === 'LIVE' ? <ActionButton disabled={busy !== null} onClick={() => control(session.id, 'PAUSE')}>Pause</ActionButton> : null}
                    {session.status === 'PAUSED' ? <ActionButton disabled={busy !== null} onClick={() => control(session.id, 'RESUME')}>Resume</ActionButton> : null}
                    {session.status !== 'COMPLETED' && session.turnCount - session.selectionCount > 1 ? (
                      <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => fastForwardDemo(session)}>
                        {busy === `${session.id}-fast-forward` ? 'Fast-forwarding…' : 'Jump to final pick'}
                      </button>
                    ) : null}
                    {(session.status === 'PAUSED' || session.status === 'COMPLETED') && session.selectionCount > 0 ? <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busy !== null} onClick={() => undoLastPick(session)}>Undo last pick</button> : null}
                    {session.status !== 'LIVE' ? (
                      <button
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        disabled={busy !== null}
                        onClick={() => removeRehearsal(session)}
                      >
                        Delete demo
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function localDateTimeValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function ScheduleEditor({ session }: { session: SessionSummary }) {
  const router = useRouter()
  const [startsAt, setStartsAt] = useState(localDateTimeValue(session.startsAt))
  const [meetingUrl, setMeetingUrl] = useState(session.meetingUrl ?? '')
  const [pickSeconds, setPickSeconds] = useState(session.pickSeconds)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    const response = await fetch(`/api/draft-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        meetingUrl,
        pickSeconds,
      }),
    })
    if (!response.ok) setMessage(await responseMessage(response))
    else {
      setMessage('Draft logistics saved. The preseason dashboard now shows this schedule.')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[1fr_1fr_130px_auto] md:items-end">
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Start time<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-100" type="datetime-local" value={startsAt} onInput={(event) => setStartsAt(event.currentTarget.value)} /></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Video call URL<input autoCapitalize="none" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-100" inputMode="url" placeholder="https://..." spellCheck={false} type="url" value={meetingUrl} onChange={(event) => setMeetingUrl(event.target.value)} onBlur={(event) => setMeetingUrl(normalizeMeetingUrl(event.target.value) ?? '')} /><span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-slate-500">https:// is added automatically.</span></label>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Pick seconds<input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-100" max={900} min={10} type="number" value={pickSeconds} onChange={(event) => setPickSeconds(Number(event.target.value))} /></label>
      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !startsAt} onClick={save}>{saving ? 'Saving…' : 'Save logistics'}</button>
      {message ? <p className="text-sm text-slate-600 md:col-span-4">{message}</p> : null}
    </div>
  )
}

function Readiness({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><span className={`h-2 w-2 rounded-full ${ok ? 'bg-blue-500' : 'bg-amber-300'}`} /></div>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-300">{children}</span>
}

function ActionButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" {...props}>
      {children}
    </button>
  )
}
