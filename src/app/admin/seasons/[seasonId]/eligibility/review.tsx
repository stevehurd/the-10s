'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import TeamMark from '@/components/team-mark'

interface Eligibility {
  id: string
  status: 'PENDING' | 'REVIEW' | 'APPROVED' | 'INACTIVE'
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

export default function EligibilityReview({ seasonId }: { seasonId: string }) {
  const [state, setState] = useState<State | null>(null)
  const [filter, setFilter] = useState('NEEDS_REVIEW')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/seasons/${seasonId}/eligibility`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load eligibility')
    setState(payload)
  }, [seasonId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Unable to load eligibility'),
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const counts = useMemo(() => {
    const entries = state?.eligibility ?? []
    return {
      approved: entries.filter((entry) => entry.status === 'APPROVED').length,
      pending: entries.filter((entry) => entry.status === 'PENDING').length,
      review: entries.filter((entry) => entry.status === 'REVIEW').length,
      inactive: entries.filter((entry) => entry.status === 'INACTIVE').length,
      college: entries.filter((entry) => entry.leagueSnapshot === 'COLLEGE').length,
    }
  }, [state])

  const displayed = useMemo(() => {
    const entries = state?.eligibility ?? []
    if (filter === 'ALL') return entries
    if (filter === 'NEEDS_REVIEW') {
      return entries.filter((entry) => entry.status === 'PENDING' || entry.status === 'REVIEW')
    }
    return entries.filter((entry) => entry.status === filter)
  }, [filter, state])

  async function sync() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to sync SportsDataIO')
      await load()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync SportsDataIO')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(id: string, status: 'APPROVED' | 'INACTIVE') {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to update eligibility')
      await load()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update eligibility')
    } finally {
      setBusy(false)
    }
  }

  async function approvePending() {
    if (!state) return
    const eligibilityIds = state.eligibility
      .filter((entry) => entry.status === 'PENDING')
      .map((entry) => entry.id)
    if (eligibilityIds.length === 0) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/eligibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eligibilityIds }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to approve teams')
      await load()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve teams')
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-100">{error ?? 'Loading eligibility review…'}</main>
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <a className="text-sm text-slate-400 hover:text-white" href="/admin">← Admin</a>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">{state.season.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">Team eligibility review</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              SportsDataIO changes are staged here. College teams are not draftable until approved for this season.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold hover:bg-white/10 disabled:opacity-50" disabled={busy} onClick={() => void sync()} type="button">
              Sync SportsDataIO
            </button>
            <button className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50" disabled={busy || counts.pending === 0} onClick={() => void approvePending()} type="button">
              Approve {counts.pending} unchanged
            </button>
          </div>
        </header>

        {error ? <p className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3">{error}</p> : null}

        <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Count label="FBS candidates" value={counts.college} />
          <Count label="Approved" value={counts.approved} tone="green" />
          <Count label="Pending" value={counts.pending} />
          <Count label="Needs review" value={counts.review} tone="amber" />
          <Count label="Inactive" value={counts.inactive} />
        </section>

        <div className="mb-4 flex gap-2 overflow-x-auto">
          {['NEEDS_REVIEW', 'PENDING', 'REVIEW', 'APPROVED', 'INACTIVE', 'ALL'].map((value) => (
            <button className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${filter === value ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300'}`} key={value} onClick={() => setFilter(value)} type="button">
              {value.replace('_', ' ').toLowerCase()}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="divide-y divide-white/5">
            {displayed.map((entry) => (
              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_160px_minmax(240px,1fr)_auto] md:items-center" key={entry.id}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <TeamMark abbreviation={entry.abbreviationSnapshot} logoUrl={entry.team.logoUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{entry.nameSnapshot}</p>
                      <p className="text-xs text-slate-400">{entry.conferenceSnapshot ?? entry.divisionSnapshot ?? entry.leagueSnapshot}</p>
                    </div>
                  </div>
                </div>
                <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${entry.status === 'APPROVED' ? 'bg-emerald-300/15 text-emerald-200' : entry.status === 'REVIEW' ? 'bg-amber-300/15 text-amber-200' : 'bg-white/5 text-slate-300'}`}>
                  {entry.status}
                </span>
                <p className="text-sm text-slate-400">{entry.reviewReason ?? 'No changes detected'}</p>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40" disabled={busy || entry.status === 'APPROVED'} onClick={() => void setStatus(entry.id, 'APPROVED')} type="button">Approve</button>
                  <button className="rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40" disabled={busy || entry.status === 'INACTIVE'} onClick={() => void setStatus(entry.id, 'INACTIVE')} type="button">Inactive</button>
                </div>
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
