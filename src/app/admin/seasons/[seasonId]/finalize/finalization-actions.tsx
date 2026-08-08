'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function FinalizationActions({
  seasonId,
  seasonYear,
  status,
  ready,
  successorYear,
}: {
  seasonId: string
  seasonYear: number
  status: string
  ready: boolean
  successorYear: number | null
}) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [reopenText, setReopenText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(action: 'finalize' | 'reopen') {
    setSubmitting(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/finalization`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || `Unable to ${action} season`)
      setMessage(action === 'finalize' ? 'Season finalized and standings frozen.' : 'Season reopened for corrections.')
      setConfirmed(false)
      setReopenText('')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to ${action} season`)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'FINALIZED') {
    return (
      <section className="border-t border-orange-500/30 bg-orange-500/5 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Correction control</p>
        <h2 className="mt-2 text-xl font-black">Reopen finalized season</h2>
        {successorYear ? (
          <p className="mt-2 text-sm text-slate-500">
            Reopening is blocked because the {successorYear} season already depends on this final order.
          </p>
        ) : (
          <>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              This unfreezes team records and clears final ranks. The action is recorded in the audit trail.
            </p>
            <label className="mt-4 block max-w-sm text-sm font-bold">
              Type {seasonYear} to confirm
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                inputMode="numeric"
                onChange={(event) => setReopenText(event.target.value)}
                value={reopenText}
              />
            </label>
            <button
              className="mt-4 rounded-lg border border-orange-500 px-4 py-2.5 text-sm font-black text-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={submitting || reopenText !== String(seasonYear)}
              onClick={() => void submit('reopen')}
              type="button"
            >
              {submitting ? 'Reopening…' : 'Reopen for corrections'}
            </button>
          </>
        )}
        {message ? <p className="mt-3 text-sm font-semibold">{message}</p> : null}
      </section>
    )
  }

  return (
    <section className="border-t border-blue-500/30 bg-blue-500/5 p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Final confirmation</p>
      <h2 className="mt-2 text-xl font-black">Freeze the season</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Finalizing stores every rank and win total, freezes team records, and publishes the champion view.
      </p>
      <label className="mt-4 flex max-w-2xl items-start gap-3 text-sm font-semibold">
        <input
          checked={confirmed}
          className="mt-1 h-4 w-4"
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        I reviewed the standings and understand that corrections require an audited reopen.
      </label>
      <button
        className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={submitting || !ready || !confirmed}
        onClick={() => void submit('finalize')}
        type="button"
      >
        {submitting ? 'Finalizing…' : `Finalize ${seasonYear} season`}
      </button>
      {message ? <p className="mt-3 text-sm font-semibold">{message}</p> : null}
    </section>
  )
}
