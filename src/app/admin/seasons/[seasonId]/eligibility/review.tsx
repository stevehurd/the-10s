'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TeamMark from '@/components/team-mark'

interface Eligibility {
  id: string
  status: 'PENDING' | 'REVIEW' | 'APPROVED' | 'INACTIVE'
  source: string
  reviewReason: string | null
  nameSnapshot: string
  abbreviationSnapshot: string
  conferenceSnapshot: string | null
  divisionSnapshot: string | null
  leagueSnapshot: 'NFL' | 'COLLEGE'
  team: { logoUrl: string | null }
}

interface State {
  season: { name: string; year: number }
  eligibility: Eligibility[]
}

interface SyncSummary {
  collegeCount: number
  unchanged: number
  changed: number
  added: number
  removed: number
  overridden: number
  review: number
}

export default function EligibilityReview({ seasonId }: { seasonId: string }) {
  const [state, setState] = useState<State | null>(null)
  const [filter, setFilter] = useState('EXCEPTIONS')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<SyncSummary | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editConference, setEditConference] = useState('')
  const [editStatus, setEditStatus] = useState<'APPROVED' | 'INACTIVE'>('APPROVED')
  const [editNote, setEditNote] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`/api/seasons/${seasonId}/eligibility`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load team pool')
    setState(payload)
  }, [seasonId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Unable to load team pool'),
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const collegeEntries = useMemo(
    () => (state?.eligibility ?? []).filter((entry) => entry.leagueSnapshot === 'COLLEGE'),
    [state],
  )
  const counts = useMemo(() => ({
    total: collegeEntries.length,
    approved: collegeEntries.filter((entry) => entry.status === 'APPROVED').length,
    exceptions: collegeEntries.filter((entry) =>
      entry.status === 'PENDING' || entry.status === 'REVIEW',
    ).length,
    inactive: collegeEntries.filter((entry) => entry.status === 'INACTIVE').length,
    overrides: collegeEntries.filter((entry) => entry.source === 'COMMISSIONER_OVERRIDE').length,
  }), [collegeEntries])

  const displayed = useMemo(() => {
    if (filter === 'ALL') return collegeEntries
    if (filter === 'EXCEPTIONS') {
      return collegeEntries.filter((entry) =>
        entry.status === 'PENDING' || entry.status === 'REVIEW',
      )
    }
    if (filter === 'OVERRIDES') {
      return collegeEntries.filter((entry) => entry.source === 'COMMISSIONER_OVERRIDE')
    }
    return collegeEntries.filter((entry) => entry.status === filter)
  }, [collegeEntries, filter])

  async function sync() {
    setBusyAction('sync')
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to sync SportsDataIO')
      setLastSync(payload)
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync SportsDataIO')
    } finally {
      setBusyAction(null)
    }
  }

  async function setStatus(entry: Eligibility, status: 'APPROVED' | 'INACTIVE') {
    setBusyAction(`${entry.id}:${status}`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to update team eligibility')
      await load()
      setNotice(
        status === 'APPROVED'
          ? `${entry.nameSnapshot} is now eligible.`
          : `${entry.nameSnapshot} is now inactive.`,
      )
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update team eligibility')
    } finally {
      setBusyAction(null)
    }
  }

  function beginCorrection(entry: Eligibility) {
    setEditingId(entry.id)
    setEditConference(entry.conferenceSnapshot ?? '')
    setEditStatus(entry.status === 'INACTIVE' ? 'INACTIVE' : 'APPROVED')
    setEditNote('')
  }

  async function saveCorrection(entry: Eligibility) {
    setBusyAction(`${entry.id}:OVERRIDE`)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'OVERRIDE',
          status: editStatus,
          conference: editConference,
          note: editNote,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save correction')
      setEditingId(null)
      await load()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to save correction')
    } finally {
      setBusyAction(null)
    }
  }

  if (!state) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">{error ?? 'Loading college team pool…'}</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <a className="text-sm text-slate-400 hover:text-white" href="/admin">← Admin</a>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">{state.season.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">College team pool</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Sync the current SportsDataIO FBS hierarchy. Unchanged teams are approved automatically; only additions, removals, and changed details need attention.
            </p>
          </div>
          <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busyAction !== null} onClick={() => void sync()} type="button">
            {busyAction === 'sync' ? 'Syncing…' : 'Sync current FBS teams'}
          </button>
        </header>

        {error ? <p className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">{error}</p> : null}
        {notice ? <p className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-emerald-100">{notice}</p> : null}
        {lastSync ? (
          <section className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Sync complete</p>
            <p className="mt-2 text-lg font-semibold">
              {lastSync.unchanged} unchanged · {lastSync.changed} changed · {lastSync.added} new · {lastSync.removed} removed
            </p>
            <p className="mt-1 text-sm text-emerald-100/80">
              {lastSync.collegeCount} active FBS teams found. {lastSync.review} exception{lastSync.review === 1 ? '' : 's'} need review; {lastSync.overridden} commissioner override{lastSync.overridden === 1 ? '' : 's'} preserved.
            </p>
          </section>
        ) : counts.exceptions > 0 ? (
          <p className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Run the current FBS sync first. Existing pending teams will be approved automatically when unchanged.
          </p>
        ) : null}

        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Count label="FBS teams" value={counts.total} />
          <Count label="Ready" value={counts.approved} tone="green" />
          <Count label="Exceptions" value={counts.exceptions} tone="amber" />
          <Count label="Overrides" value={counts.overrides} />
          <Count label="Inactive" value={counts.inactive} />
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto">
          {['EXCEPTIONS', 'OVERRIDES', 'APPROVED', 'INACTIVE', 'ALL'].map((value) => (
            <button className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${filter === value ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300'}`} key={value} onClick={() => setFilter(value)} type="button">
              {value.toLowerCase()}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="divide-y divide-white/5">
            {displayed.map((entry) => (
              <div className="p-4" key={entry.id}>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_minmax(220px,1fr)_auto] md:items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamMark abbreviation={entry.abbreviationSnapshot} logoUrl={entry.team.logoUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{entry.nameSnapshot}</p>
                      <p className="text-xs text-slate-400">{entry.conferenceSnapshot ?? 'No conference'}</p>
                    </div>
                  </div>
                  <div>
                    <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${entry.status === 'APPROVED' ? 'bg-emerald-300/15 text-emerald-200' : entry.status === 'REVIEW' || entry.status === 'PENDING' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/5 text-slate-300'}`}>
                      {entry.status === 'PENDING' ? 'NEEDS SYNC' : entry.status}
                    </span>
                    {entry.source === 'COMMISSIONER_OVERRIDE' ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-300">Commissioner override</p> : null}
                  </div>
                  <p className="text-sm text-slate-400">{entry.reviewReason ?? 'Unchanged from the previous season'}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    {(entry.status === 'REVIEW' || entry.status === 'INACTIVE') ? (
                      <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busyAction !== null} onClick={() => void setStatus(entry, 'APPROVED')} type="button">
                        {busyAction === `${entry.id}:APPROVED` ? 'Making eligible…' : 'Make eligible'}
                      </button>
                    ) : null}
                    {entry.status !== 'INACTIVE' ? (
                      <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40" disabled={busyAction !== null} onClick={() => void setStatus(entry, 'INACTIVE')} type="button">
                        {busyAction === `${entry.id}:INACTIVE` ? 'Updating…' : 'Inactive'}
                      </button>
                    ) : null}
                    <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40" disabled={busyAction !== null} onClick={() => beginCorrection(entry)} type="button">Correct details</button>
                  </div>
                </div>

                {editingId === entry.id ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-blue-400/20 bg-blue-400/5 p-4 md:grid-cols-[1fr_180px_2fr_auto] md:items-end">
                    <label className="text-sm font-semibold text-slate-300">
                      Conference
                      <input className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" maxLength={80} onChange={(event) => setEditConference(event.target.value)} value={editConference} />
                    </label>
                    <label className="text-sm font-semibold text-slate-300">
                      Eligibility
                      <select className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" onChange={(event) => setEditStatus(event.target.value as 'APPROVED' | 'INACTIVE')} value={editStatus}>
                        <option value="APPROVED">Eligible</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-300">
                      Reason for correction
                      <input className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" maxLength={300} onChange={(event) => setEditNote(event.target.value)} placeholder="Official 2026 conference alignment" value={editNote} />
                    </label>
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busyAction !== null} onClick={() => void saveCorrection(entry)} type="button">
                        {busyAction === `${entry.id}:OVERRIDE` ? 'Saving…' : 'Save'}
                      </button>
                      <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold" disabled={busyAction !== null} onClick={() => setEditingId(null)} type="button">Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {displayed.length === 0 ? <p className="p-8 text-center text-slate-400">No teams match this filter.</p> : null}
          </div>
        </section>
      </div>
    </main>
  )
}

function Count({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}
