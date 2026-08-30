'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type League = 'NFL' | 'COLLEGE' | 'BOTH'

interface Discrepancy {
  teamId: string
  teamName: string
  league: 'NFL' | 'COLLEGE'
  kind: 'MISMATCH' | 'MISSING_STORED' | 'MISSING_PROVIDER'
  calculated: { wins: number; losses: number; ties: number } | null
  stored: { wins: number; losses: number; ties: number } | null
}

interface SyncResult {
  success: boolean
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'MISMATCH'
  updatedTeams?: number
  recordsChanged?: number
  matchedTeams?: number
  discrepancies?: Discrepancy[]
  results: string[]
  errors: string[]
}

export default function StandingsSyncControls({
  seasonId,
  seasonYear,
  disabledReason,
  allowHistoricalValidation,
}: {
  seasonId: string
  seasonYear: number
  disabledReason: string | null
  allowHistoricalValidation: boolean
}) {
  const router = useRouter()
  const [running, setRunning] = useState<League | 'VALIDATION' | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function sync(league: League) {
    setRunning(league)
    setResult(null)
    setError(null)
    try {
      const response = await fetch('/api/sync/standings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId, league }),
      })
      const payload = await response.json() as SyncResult & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to sync standings')
      setResult(payload)
      router.refresh()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync standings')
    } finally {
      setRunning(null)
    }
  }

  async function validateHistorical() {
    setRunning('VALIDATION')
    setResult(null)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/standings/validate`, { method: 'POST' })
      const payload = await response.json() as SyncResult & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to validate historical standings')
      setResult(payload)
      router.refresh()
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Unable to validate historical standings')
    } finally {
      setRunning(null)
    }
  }

  const disabled = Boolean(disabledReason || running)
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Manual update</p>
          <h2 className="mt-2 text-xl font-black">Pull current records</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            NFL totals combine regular and postseason standings. College totals prefer season-scoped feeds and safely fall back to the current hierarchy only after rollover validation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => void sync('BOTH')} type="button">
            {running === 'BOTH' ? 'Syncing all…' : 'Sync all standings'}
          </button>
          <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => void sync('NFL')} type="button">
            {running === 'NFL' ? 'Syncing NFL…' : 'NFL only'}
          </button>
          <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => void sync('COLLEGE')} type="button">
            {running === 'COLLEGE' ? 'Syncing college…' : 'College only'}
          </button>
        </div>
      </div>

      {disabledReason ? <p className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">{disabledReason}</p> : null}
      {allowHistoricalValidation ? (
        <div className="mt-5 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-black">Validate the preserved {seasonYear} totals</p>
            <p className="mt-1 text-sm text-slate-400">Compare the available provider snapshot with every preserved team record without changing finalized records.</p>
          </div>
          <button className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(running)} onClick={() => void validateHistorical()} type="button">
            {running === 'VALIDATION' ? 'Validating…' : 'Validate against SportsDataIO'}
          </button>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p> : null}
      {result ? (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${result.status === 'SUCCEEDED' ? 'bg-emerald-400/10 text-emerald-100' : result.status === 'PARTIAL' ? 'bg-amber-400/10 text-amber-100' : 'bg-red-500/10 text-red-100'}`}>
          <p className="font-black">{result.recordsChanged === 0 ? validationHeading(result) : result.status === 'SUCCEEDED' ? 'Standings updated' : result.status === 'PARTIAL' ? 'Partially updated' : 'No records were updated'}</p>
          {[...result.results, ...result.errors].map((message) => <p className="mt-1" key={message}>{message}</p>)}
          {result.recordsChanged === 0 ? <p className="mt-2 font-black">✓ Finalized standings were not changed.</p> : null}
          {result.discrepancies?.slice(0, 20).map((discrepancy) => (
            <p className="mt-2 border-t border-current/15 pt-2" key={`${discrepancy.teamId}-${discrepancy.kind}`}>
              <span className="font-bold">{discrepancy.teamName}:</span> {discrepancyLabel(discrepancy)}
            </p>
          ))}
          {(result.discrepancies?.length ?? 0) > 20 ? <p className="mt-2 font-semibold">Showing the first 20 differences. The complete count is retained in the report.</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function validationHeading(result: SyncResult) {
  if (result.status === 'SUCCEEDED') return 'Historical totals match'
  if (result.status === 'MISMATCH') return 'Historical differences found'
  if (result.status === 'PARTIAL') return 'Historical validation partially completed'
  return 'Historical validation could not run'
}

function discrepancyLabel(discrepancy: Discrepancy) {
  if (discrepancy.kind === 'MISSING_STORED') return 'SportsDataIO returned this team, but no preserved record exists.'
  if (discrepancy.kind === 'MISSING_PROVIDER') return 'A preserved record exists, but SportsDataIO did not return this team.'
  return `SportsDataIO ${recordLabel(discrepancy.calculated)} · preserved ${recordLabel(discrepancy.stored)}`
}

function recordLabel(record: Discrepancy['stored']) {
  return record ? `${record.wins}-${record.losses}-${record.ties}` : '—'
}
