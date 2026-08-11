'use client'

import { useEffect, useMemo, useState } from 'react'

import TeamMark from '@/components/team-mark'
import {
  shouldShowPreparationTeam,
  type PreparationEligibilityStatus,
} from '@/lib/seasons/preparation'

interface PrepTeam {
  id: string
  name: string
  abbreviation: string
  league: 'NFL' | 'COLLEGE'
  conference: string | null
  division: string | null
  logoUrl: string | null
  wins: number
  losses: number
  ties: number
  eligibilityStatus: PreparationEligibilityStatus
  available: boolean
  held: boolean
  unavailableReason: string | null
}

export default function PreparationBoard({ seasonId, teams }: { seasonId: string; teams: PrepTeam[] }) {
  const [query, setQuery] = useState('')
  const [league, setLeague] = useState<'ALL' | 'NFL' | 'COLLEGE'>('ALL')
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [shortlist, setShortlist] = useState<Set<string>>(new Set())
  const storageKey = `football-pool:${seasonId}:draft-shortlist`

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return
    try {
      const ids = JSON.parse(stored)
      if (!Array.isArray(ids)) return
      const timer = window.setTimeout(() => {
        setShortlist(new Set(ids.filter((id): id is string => typeof id === 'string')))
      }, 0)
      return () => window.clearTimeout(timer)
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [storageKey])

  function toggleShortlist(teamId: string) {
    setShortlist((current) => {
      const next = new Set(current)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      window.localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }

  const displayed = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return teams
      .filter((team) => shouldShowPreparationTeam(team, showUnavailable))
      .filter((team) => league === 'ALL' || team.league === league)
      .filter((team) => !normalizedQuery || `${team.name} ${team.abbreviation} ${team.conference ?? ''} ${team.division ?? ''}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) =>
        Number(shortlist.has(right.id)) - Number(shortlist.has(left.id)) ||
        right.wins - left.wins ||
        left.losses - right.losses ||
        right.ties - left.ties ||
        left.name.localeCompare(right.name),
      )
  }, [league, query, shortlist, showUnavailable, teams])

  const available = teams.filter((team) => team.available)
  const pendingReview = teams.filter((team) =>
    team.eligibilityStatus === 'PENDING' || team.eligibilityStatus === 'REVIEW',
  )
  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Available teams" value={available.length} />
        <Metric label="Available NFL" value={available.filter((team) => team.league === 'NFL').length} />
        <Metric label="Available college" value={available.filter((team) => team.league === 'COLLEGE').length} />
        <Metric label="Awaiting review" value={pendingReview.length} />
      </section>

      {pendingReview.length > 0 ? (
        <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          College teams awaiting annual FBS review are visible for draft preparation, but they are not draftable until a commissioner approves them.
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <input className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3" onChange={(event) => setQuery(event.target.value)} placeholder="Search teams or conferences" type="search" value={query} />
          <div className="flex gap-2">
            {(['ALL', 'NFL', 'COLLEGE'] as const).map((value) => <button className={`rounded-lg px-3 py-2 text-sm font-bold ${league === value ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300'}`} key={value} onClick={() => setLeague(value)} type="button">{value === 'COLLEGE' ? 'College' : value === 'ALL' ? 'All' : 'NFL'}</button>)}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} type="checkbox" /> Show kept/pending teams</label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Your ★ shortlist is private and stored only in this browser. Shortlisted teams sort first.</p>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {displayed.map((team) => (
          <article className={`rounded-2xl border p-4 ${team.available ? 'border-white/10 bg-white/5' : 'border-amber-300/20 bg-white/5'}`} key={team.id}>
            <div className="flex items-start gap-3">
              <button aria-label={`${shortlist.has(team.id) ? 'Remove' : 'Add'} ${team.name} ${shortlist.has(team.id) ? 'from' : 'to'} shortlist`} className={`text-2xl ${shortlist.has(team.id) ? 'text-blue-300' : 'text-slate-600 hover:text-blue-200'}`} onClick={() => toggleShortlist(team.id)} type="button">★</button>
              <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="lg" />
              <div className="min-w-0 flex-1"><h2 className="truncate font-bold">{team.name}</h2><p className="text-xs text-slate-500">{team.league === 'NFL' ? 'NFL' : 'College'} · {team.conference ?? team.division ?? team.abbreviation}</p></div>
              <div className="text-right"><p className="text-xl font-black text-blue-300">{team.wins}-{team.losses}{team.ties ? `-${team.ties}` : ''}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Prior W-L-T</p></div>
            </div>
            {!team.available ? <p className="mt-3 rounded-lg bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200">{team.unavailableReason}</p> : null}
          </article>
        ))}
        {displayed.length === 0 ? <p className="text-slate-400">No teams match these filters.</p> : null}
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}
