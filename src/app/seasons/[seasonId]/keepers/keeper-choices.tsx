'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import TeamMark from '@/components/team-mark'

interface Team {
  id: string
  name: string
  abbreviation: string
  league: 'NFL' | 'COLLEGE'
  conference: string | null
  division: string | null
  logoUrl: string | null
}

interface Slot {
  id: string
  number: number
  retentionChoice: 'PENDING' | 'KEEP' | 'RELEASE' | 'OPEN'
  inheritedTeam: Team | null
  priorRecord: { wins: number; losses: number; ties: number } | null
}

interface Participant {
  id: string
  decisionsSubmittedAt: string | null
  decisionsLockedAt: string | null
  releaseOverride: boolean
  user: { id: string; name: string }
  rosterSlots: Slot[]
}

interface KeeperState {
  season: { id: string; name: string; year: number }
  viewerParticipantId: string | null
  viewerIsCommissioner: boolean
  participants: Participant[]
}

function recordLabel(slot: Slot) {
  if (!slot.priorRecord) return 'No prior record'
  const { wins, losses, ties } = slot.priorRecord
  return ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`
}

export default function KeeperChoices({ seasonId }: { seasonId: string }) {
  const router = useRouter()
  const [state, setState] = useState<KeeperState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/seasons/${seasonId}/keepers`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Unable to load Keep and Release choices')
    setState(payload)
  }, [seasonId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : 'Unable to load choices'),
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const participant = state?.participants.find(
    (candidate) => candidate.id === state.viewerParticipantId,
  )
  const releasedNFL = useMemo(
    () => participant?.rosterSlots.filter((slot) => slot.retentionChoice === 'RELEASE' && slot.inheritedTeam?.league === 'NFL').length ?? 0,
    [participant],
  )
  const releasedCollege = useMemo(
    () => participant?.rosterSlots.filter((slot) => slot.retentionChoice === 'RELEASE' && slot.inheritedTeam?.league === 'COLLEGE').length ?? 0,
    [participant],
  )
  const pendingCount =
    participant?.rosterSlots.filter((slot) => slot.inheritedTeam && slot.retentionChoice === 'PENDING').length ?? 0
  const ready = Boolean(
    participant &&
      pendingCount === 0 &&
      (participant.releaseOverride || (releasedNFL >= 1 && releasedCollege >= 2)),
  )

  async function choose(slotId: string, choice: 'KEEP' | 'RELEASE') {
    setPendingSlotId(slotId)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/keepers/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save the choice')
      await load()
    } catch (choiceError) {
      setError(choiceError instanceof Error ? choiceError.message : 'Unable to save the choice')
    } finally {
      setPendingSlotId(null)
    }
  }

  async function submit() {
    if (!participant) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/seasons/${seasonId}/keepers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit choices')
      router.push(`/?season=${encodeURIComponent(seasonId)}`)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit choices')
    } finally {
      setSubmitting(false)
    }
  }

  if (!state || !participant) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-white/5 p-8">
          {error ?? 'Loading your roster…'}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">
              {state.season.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Keep or Release</h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              A kept team stays in the same numbered slot. Releasing it opens that round in the draft.
              You can change choices until the draft starts.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
            <p className="text-xs uppercase tracking-wider text-slate-400">Roster owner</p>
            <p className="font-semibold">{participant.user.name}</p>
          </div>
        </header>

        {error ? (
          <p className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-rose-100">
            {error}
          </p>
        ) : null}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Requirement label="NFL teams released" current={releasedNFL} required={1} overridden={participant.releaseOverride} />
          <Requirement label="College teams released" current={releasedCollege} required={2} overridden={participant.releaseOverride} />
          <Requirement label="Choices remaining" current={pendingCount} required={0} inverse />
        </section>

        {participant.decisionsSubmittedAt ? (
          <div className="mb-5 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-emerald-100">
            Choices submitted. You may still revise them until the draft starts.
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2">
          {participant.rosterSlots.map((slot) => {
            const team = slot.inheritedTeam
            const busy = pendingSlotId === slot.id
            return (
              <article className="rounded-2xl border border-white/10 bg-white/5 p-4" key={slot.id}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 font-black text-slate-300">
                    {slot.number}
                  </span>
                  {team ? (
                    <>
                      <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold">{team.name}</h2>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${team.league === 'NFL' ? 'bg-blue-400/15 text-blue-200' : 'bg-orange-400/15 text-orange-200'}`}>
                            {team.league === 'NFL' ? 'NFL' : 'College'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {team.conference ?? team.division} · Prior record {recordLabel(slot)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1">
                      <h2 className="font-semibold text-slate-300">New open slot</h2>
                      <p className="text-sm text-slate-500">You will pick in round {slot.number}.</p>
                    </div>
                  )}
                </div>

                {team ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-xl border px-4 py-2.5 font-semibold transition ${slot.retentionChoice === 'KEEP' ? 'border-blue-600 bg-blue-600 text-white' : 'border-white/10 bg-slate-900 text-slate-300 hover:border-blue-400/50'}`}
                      disabled={busy || Boolean(participant.decisionsLockedAt)}
                      onClick={() => void choose(slot.id, 'KEEP')}
                      type="button"
                    >
                      Keep
                    </button>
                    <button
                      className={`rounded-xl border px-4 py-2.5 font-semibold transition ${slot.retentionChoice === 'RELEASE' ? 'border-amber-300 bg-amber-300 text-amber-950' : 'border-white/10 bg-slate-900 text-slate-300 hover:border-amber-300/50'}`}
                      disabled={busy || Boolean(participant.decisionsLockedAt)}
                      onClick={() => void choose(slot.id, 'RELEASE')}
                      type="button"
                    >
                      Release
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>

        <div className="sticky bottom-0 mt-8 border-t border-white/10 bg-slate-950/95 py-4 backdrop-blur">
          <button
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!ready || submitting || Boolean(participant.decisionsLockedAt)}
            onClick={() => void submit()}
            type="button"
          >
            {submitting ? 'Submitting…' : participant.decisionsSubmittedAt ? 'Confirm updated choices' : 'Submit choices'}
          </button>
        </div>
      </div>
    </main>
  )
}

function Requirement({
  label,
  current,
  required,
  inverse = false,
  overridden = false,
}: {
  label: string
  current: number
  required: number
  inverse?: boolean
  overridden?: boolean
}) {
  const complete = overridden || (inverse ? current === required : current >= required)
  return (
    <div className={`rounded-2xl border px-4 py-3 ${complete ? 'border-emerald-300/30 bg-emerald-300/10' : 'border-white/10 bg-white/5'}`}>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${complete ? 'text-emerald-300' : 'text-white'}`}>
        {overridden ? 'Overridden' : inverse ? current : `${current} / ${required}`}
      </p>
    </div>
  )
}
