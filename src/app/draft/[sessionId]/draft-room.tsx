'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import TeamMark from '@/components/team-mark'
import { displayedDraftSeconds, localDraftDeadline } from '@/lib/draft/clock'
import { startSequentialPoller } from '@/lib/draft/sequential-poller'

export interface TeamRecord {
  wins: number
  losses: number
  ties: number
}

export interface Team {
  id: string
  name: string
  abbreviation: string
  league: string
  conference: string | null
  division: string | null
  logoUrl: string | null
  priorRecord: TeamRecord | null
  unavailableReason?: string
}

export interface RosterSlot {
  id: string
  number: number
  retentionChoice: string
  source: string
  team: Team | null
  inheritedTeam: Team | null
}

export interface Participant {
  id: string
  baseDraftOrder: number | null
  user: { id: string; name: string }
  rosterSlots: RosterSlot[]
}

export interface Turn {
  id: string
  round: number
  overallIndex: number
  status: string
  deadlineAt: string | null
  seasonParticipantId: string
  seasonParticipant: { user: { id: string; name: string } }
  rosterSlot: RosterSlot
  selection: { selectionType: string; team: Team } | null
}

export interface DraftState {
  session: {
    id: string
    name: string
    mode: string
    status: string
    pickSeconds: number
    meetingUrl: string | null
    currentTurnIndex: number
    revision: number
    season: { id: string; year: number; name: string }
  }
  viewerParticipantId: string | null
  viewerIsCommissioner: boolean
  currentTurnId: string | null
  participants: Participant[]
  turns: Turn[]
  availableTeams: Team[]
  unavailableTeams: Team[]
}

type DraftTab = 'PICK' | 'ROSTERS' | 'BOARD' | 'ACTIVITY'

function recordLabel(record: TeamRecord | null) {
  if (!record) return 'No prior record'
  return record.ties > 0
    ? `${record.wins}-${record.losses}-${record.ties}`
    : `${record.wins}-${record.losses}`
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function DraftRoom({
  sessionId,
  initialState = null,
  demo = false,
}: {
  sessionId: string
  initialState?: DraftState | null
  demo?: boolean
}) {
  const [state, setState] = useState<DraftState | null>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [league, setLeague] = useState('ALL')
  const [conference, setConference] = useState('ALL')
  const [includeUnavailable, setIncludeUnavailable] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [starredTeamIds, setStarredTeamIds] = useState<Set<string>>(() => new Set())
  const [draftPrepStorageReady, setDraftPrepStorageReady] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [controlPending, setControlPending] = useState(false)
  const [activeTab, setActiveTab] = useState<DraftTab>('PICK')
  const [now, setNow] = useState(() => Date.now())
  const [canonicalDeadline, setCanonicalDeadline] = useState<{
    turnId: string
    deadlineAt: string
    revision: number
  } | null>(null)
  const autopickRequestedForTurn = useRef<string | null>(null)
  const draftPrepStorageReadyRef = useRef<string | null>(null)
  const draftLoadInFlight = useRef<Promise<void> | null>(null)

  const loadDraft = useCallback(async (quiet = false, refreshAfterInFlight = false) => {
    if (demo) return
    if (draftLoadInFlight.current) {
      await draftLoadInFlight.current
      if (!refreshAfterInFlight) return
    }

    const request = (async () => {
      try {
        const response = await fetch(`/api/draft-sessions/${sessionId}`, { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to load the draft')
        const incomingDraftPrepStorageKey = payload.viewerParticipantId
          ? `draft-prep:${sessionId}:${payload.viewerParticipantId}`
          : null
        if (
          incomingDraftPrepStorageKey &&
          draftPrepStorageReadyRef.current !== incomingDraftPrepStorageKey
        ) {
          try {
            const stored = window.localStorage.getItem(incomingDraftPrepStorageKey)
            if (stored) {
              const parsed = JSON.parse(stored) as { starredTeamIds?: unknown; queuedTeamId?: unknown }
              if (Array.isArray(parsed.starredTeamIds)) {
                setStarredTeamIds(new Set(
                  parsed.starredTeamIds.filter((id): id is string => typeof id === 'string'),
                ))
              }
              if (typeof parsed.queuedTeamId === 'string') {
                const queuedTeam = [...payload.availableTeams, ...payload.unavailableTeams]
                  .find((team: Team) => team.id === parsed.queuedTeamId)
                if (queuedTeam) setSelectedTeam(queuedTeam)
              }
            }
          } catch {
            // Private draft prep should never prevent someone from using the room.
          } finally {
            draftPrepStorageReadyRef.current = incomingDraftPrepStorageKey
            setDraftPrepStorageReady(incomingDraftPrepStorageKey)
          }
        }
        const incomingCurrentTurn = payload.turns.find(
          (turn: Turn) => turn.id === payload.currentTurnId,
        )
        if (incomingCurrentTurn?.deadlineAt) {
          setCanonicalDeadline((current) =>
            !current || payload.session.revision >= current.revision
              ? {
                  turnId: incomingCurrentTurn.id,
                  deadlineAt: incomingCurrentTurn.deadlineAt,
                  revision: payload.session.revision,
                }
              : current,
          )
        }
        setState((current) => {
          if (current && payload.session.revision < current.session.revision) return current
          if (
            current &&
            payload.session.revision === current.session.revision &&
            payload.currentTurnId === current.currentTurnId
          ) {
            const localTurn = current.turns.find((turn) => turn.id === current.currentTurnId)
            const incomingTurn = payload.turns.find((turn: Turn) => turn.id === payload.currentTurnId)
            if (
              localTurn?.deadlineAt &&
              incomingTurn?.deadlineAt &&
              new Date(localTurn.deadlineAt).getTime() < new Date(incomingTurn.deadlineAt).getTime()
            ) {
              incomingTurn.deadlineAt = localTurn.deadlineAt
            }
          }
          return payload
        })
        setError(null)
      } catch (loadError) {
        if (!quiet) setError(loadError instanceof Error ? loadError.message : 'Unable to load the draft')
      }
    })()
    draftLoadInFlight.current = request
    try {
      await request
    } finally {
      if (draftLoadInFlight.current === request) draftLoadInFlight.current = null
    }
  }, [demo, sessionId])

  useEffect(() => {
    if (demo) return
    let firstLoad = true
    return startSequentialPoller({
      intervalMs: 2_000,
      task: async () => {
        await loadDraft(!firstLoad)
        firstLoad = false
      },
      scheduler: {
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: (handle) => window.clearTimeout(handle as number),
      },
    })
  }, [demo, loadDraft])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  const currentTurn = state?.turns.find((turn) => turn.id === state.currentTurnId) ?? null
  const viewerParticipant = state?.participants.find(
    (participant) => participant.id === state.viewerParticipantId,
  )
  const participantsWithSelections = useMemo(() => {
    if (!state) return []
    return state.participants.map((participant) => ({
      ...participant,
      rosterSlots: participant.rosterSlots.map((slot) => {
        const selectedTurn = state.turns.find(
          (turn) => turn.rosterSlot.id === slot.id && turn.selection,
        )
        return selectedTurn?.selection
          ? {
              ...slot,
              team: selectedTurn.selection.team,
              source: selectedTurn.selection.selectionType,
            }
          : slot
      }),
    }))
  }, [state])
  const displayedRosterParticipant =
    participantsWithSelections.find((participant) => participant.id === state?.viewerParticipantId) ??
    participantsWithSelections[0] ??
    null
  const canPick = Boolean(
    state &&
      currentTurn &&
      state.session.status === 'LIVE' &&
      (currentTurn.seasonParticipantId === state.viewerParticipantId || state.viewerIsCommissioner),
  )
  const draftPrepStorageKey = state?.viewerParticipantId
    ? `draft-prep:${sessionId}:${state.viewerParticipantId}`
    : null

  useEffect(() => {
    if (!draftPrepStorageKey || draftPrepStorageReady !== draftPrepStorageKey) return
    try {
      window.localStorage.setItem(draftPrepStorageKey, JSON.stringify({
        starredTeamIds: [...starredTeamIds],
        queuedTeamId: selectedTeam?.id ?? null,
      }))
    } catch {
      // Draft prep remains usable even when browser storage is unavailable.
    }
  }, [draftPrepStorageKey, draftPrepStorageReady, selectedTeam?.id, starredTeamIds])

  const remainingSeconds = displayedDraftSeconds(
    currentTurn?.deadlineAt ?? null,
    state?.session.pickSeconds ?? 0,
    now,
  )
  const canonicalDeadlineAt = currentTurn
    ? canonicalDeadline?.turnId === currentTurn.id
      ? canonicalDeadline.deadlineAt
      : currentTurn.deadlineAt
    : null
  const canonicalRemainingSeconds = canonicalDeadlineAt
    ? Math.max(0, Math.ceil((new Date(canonicalDeadlineAt).getTime() - now) / 1_000))
    : null
  const sessionStatus = state?.session.status
  const draftComplete = sessionStatus === 'COMPLETED'
  const displayedTab: DraftTab = draftComplete && activeTab === 'PICK'
    ? 'ROSTERS'
    : !draftComplete && activeTab === 'ROSTERS'
      ? 'PICK'
      : activeTab

  useEffect(() => {
    if (
      !currentTurn ||
      demo ||
      canonicalRemainingSeconds !== 0 ||
      sessionStatus !== 'LIVE' ||
      autopickRequestedForTurn.current === currentTurn.id
    ) {
      return
    }

    autopickRequestedForTurn.current = currentTurn.id
    void fetch(`/api/draft-sessions/${sessionId}/autopick`, { method: 'POST' })
      .then(() => loadDraft(true))
      .catch(() => undefined)
  }, [canonicalRemainingSeconds, currentTurn, demo, loadDraft, sessionId, sessionStatus])

  const conferences = useMemo(() => {
    if (!state) return []
    return [...new Set(state.availableTeams.map((team) => team.conference).filter(Boolean))].sort()
  }, [state])

  const displayedTeams = useMemo(() => {
    if (!state) return []
    const teams = includeUnavailable
      ? [...state.availableTeams, ...state.unavailableTeams]
      : state.availableTeams
    const query = search.trim().toLowerCase()
    return teams.filter((team) => {
      const matchesSearch =
        !query ||
        team.name.toLowerCase().includes(query) ||
        team.abbreviation.toLowerCase().includes(query)
      const matchesLeague = league === 'ALL' || team.league === league
      const matchesConference = conference === 'ALL' || team.conference === conference
      return matchesSearch && matchesLeague && matchesConference
    }).sort((left, right) => Number(starredTeamIds.has(right.id)) - Number(starredTeamIds.has(left.id)))
  }, [conference, includeUnavailable, league, search, starredTeamIds, state])

  function toggleStarredTeam(teamId: string) {
    setStarredTeamIds((current) => {
      const next = new Set(current)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  async function submitSelection() {
    if (!selectedTeam || !state || !canPick) return
    if (demo) {
      const activeTurnIndex = state.turns.findIndex((turn) => turn.id === state.currentTurnId)
      const activeTurn = state.turns[activeTurnIndex]
      if (!activeTurn) return
      const nextTurn = state.turns.slice(activeTurnIndex + 1).find((turn) => turn.status === 'PENDING')
      const deadlineAt = nextTurn
        ? new Date(Date.now() + state.session.pickSeconds * 1000).toISOString()
        : null
      setState({
        ...state,
        session: {
          ...state.session,
          currentTurnIndex: nextTurn?.overallIndex ?? activeTurn.overallIndex + 1,
          revision: state.session.revision + 1,
          status: nextTurn ? 'LIVE' : 'COMPLETED',
        },
        currentTurnId: nextTurn?.id ?? null,
        availableTeams: state.availableTeams.filter((team) => team.id !== selectedTeam.id),
        unavailableTeams: [
          ...state.unavailableTeams,
          { ...selectedTeam, unavailableReason: `Selected by ${activeTurn.seasonParticipant.user.name}` },
        ],
        turns: state.turns.map((turn) =>
          turn.id === activeTurn.id
            ? {
                ...turn,
                status: 'COMPLETED',
                deadlineAt: null,
                selection: { selectionType: 'MANUAL', team: selectedTeam },
              }
            : turn.id === nextTurn?.id
              ? { ...turn, status: 'ACTIVE', deadlineAt }
              : turn,
        ),
      })
      setSelectedTeam(null)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/draft-sessions/${sessionId}/selections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          expectedRevision: state.session.revision,
          forParticipant: state.viewerIsCommissioner,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit the pick')
      const pickedTeam = selectedTeam
      if (payload.nextTurnId && payload.nextTurnDeadlineAt) {
        setCanonicalDeadline({
          turnId: payload.nextTurnId,
          deadlineAt: payload.nextTurnDeadlineAt,
          revision: payload.sessionRevision,
        })
      } else {
        setCanonicalDeadline(null)
      }
      setSelectedTeam(null)
      setNow(Date.now())
      setState((current) => {
        if (!current) return current
        const pickedTurn = current.turns.find((turn) => turn.id === current.currentTurnId)
        if (!pickedTurn) return current

        return {
          ...current,
          session: {
            ...current.session,
            currentTurnIndex: payload.nextTurnIndex,
            revision: payload.sessionRevision,
            status: payload.sessionStatus,
          },
          currentTurnId: payload.nextTurnId,
          availableTeams: current.availableTeams.filter((team) => team.id !== pickedTeam.id),
          unavailableTeams: [
            ...current.unavailableTeams,
            {
              ...pickedTeam,
              unavailableReason: `Selected by ${pickedTurn.seasonParticipant.user.name}`,
            },
          ],
          turns: current.turns.map((turn) => turn.id === pickedTurn.id
            ? {
                ...turn,
                status: 'COMPLETED',
                deadlineAt: null,
                selection: { selectionType: payload.selectionType, team: pickedTeam },
              }
            : turn.id === payload.nextTurnId
              ? {
                  ...turn,
                  status: 'ACTIVE',
                  deadlineAt: localDraftDeadline(current.session.pickSeconds).toISOString(),
                }
              : turn),
        }
      })
      void loadDraft(true, true)
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'Unable to submit the pick')
    } finally {
      setSubmitting(false)
    }
  }

  async function commissionerControl(action: 'START' | 'PAUSE' | 'RESUME' | 'UNDO') {
    if (action === 'START' && !window.confirm('Start the draft now? Keeper choices will lock and the first pick clock will begin.')) return
    if (action === 'UNDO' && !window.confirm('Undo the last pick? The team will become available and the draft will remain paused.')) return
    setControlPending(true)
    setError(null)
    try {
      const response = await fetch(
        action === 'UNDO'
          ? `/api/draft-sessions/${sessionId}/undo`
          : `/api/draft-sessions/${sessionId}/control`,
        action === 'UNDO'
          ? { method: 'POST' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action }),
            },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Unable to update the draft')
      if (action !== 'UNDO' && payload) {
        if (state?.currentTurnId && payload.currentTurnDeadlineAt) {
          setCanonicalDeadline({
            turnId: state.currentTurnId,
            deadlineAt: payload.currentTurnDeadlineAt,
            revision: payload.revision,
          })
        } else {
          setCanonicalDeadline(null)
        }
        setNow(Date.now())
        setState((current) => current ? {
          ...current,
          session: {
            ...current.session,
            status: payload.status,
            revision: payload.revision,
          },
          turns: current.turns.map((turn) => turn.id === current.currentTurnId
            ? {
                ...turn,
                status: payload.status === 'LIVE' ? 'ACTIVE' : turn.status,
                deadlineAt: payload.status === 'LIVE'
                  ? localDraftDeadline(current.session.pickSeconds).toISOString()
                  : null,
              }
            : turn),
        } : current)
      }
      await loadDraft(false, true)
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : 'Unable to update the draft')
    } finally {
      setControlPending(false)
    }
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/5 p-8">
          {error ?? 'Loading draft room…'}
        </div>
      </main>
    )
  }

  const round = currentTurn?.round ?? Math.min(10, Math.floor(state.session.currentTurnIndex / 15) + 1)
  const visibleTabs: DraftTab[] = draftComplete
    ? ['ROSTERS', 'BOARD', 'ACTIVITY']
    : ['PICK', 'BOARD', 'ACTIVITY']

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {state.session.mode === 'REHEARSAL' ? (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-300 px-4 py-2 text-center text-sm font-bold uppercase tracking-[0.2em] text-amber-950">
          <span>Rehearsal draft — picks do not affect official rosters</span>
          {demo ? (
            <span className="flex gap-2">
              <a className="rounded bg-amber-950 px-2 py-1 text-[10px] text-amber-100" href="/demo/dashboard">Dashboard</a>
              <a className="rounded bg-amber-950 px-2 py-1 text-[10px] text-amber-100" href="/demo/setup">Season setup</a>
            </span>
          ) : null}
        </div>
      ) : null}

      <header className="relative z-30 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto grid max-w-[1600px] gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="flex items-center gap-3">
            <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
              {state.session.season.name} · Round {round}
            </p>
            <h1 className="mt-1 text-xl font-semibold">{state.session.name}</h1>
            </div>
            {state.session.meetingUrl ? (
              <a
                aria-label="Join video call"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:border-orange-300/40 hover:bg-orange-300/10 hover:text-orange-300"
                href={state.session.meetingUrl}
                rel="noreferrer"
                target="_blank"
                title="Join video call"
              >
                <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
                  <path d="M15 10.5 20.3 7a.45.45 0 0 1 .7.38v9.24a.45.45 0 0 1-.7.38L15 13.5v2A2.5 2.5 0 0 1 12.5 18h-7A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6h7A2.5 2.5 0 0 1 15 8.5v2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
                <span className="sr-only">Join video call</span>
              </a>
            ) : null}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-slate-400">On the clock</span>
            <p className="font-semibold text-white">
              {currentTurn?.seasonParticipant.user.name ?? statusLabel(state.session.status)}
            </p>
          </div>
          <div
            className={`min-w-24 rounded-xl px-4 py-2 text-center ${
              remainingSeconds !== null && remainingSeconds <= 15
                ? 'bg-rose-500 text-white'
                : 'bg-orange-500 text-white'
            }`}
          >
            <span className="block text-xs font-bold uppercase tracking-wider">Clock</span>
            <span className="text-2xl font-black tabular-nums">
              {remainingSeconds === null ? '—' : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`}
            </span>
          </div>
        </div>
      </header>

      {state.viewerIsCommissioner && !demo ? (
        <div className="border-b border-white/10 bg-slate-900 px-4 py-2">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
            <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500">Commissioner controls</span>
            {state.session.status === 'SCHEDULED' ? (
              <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" disabled={controlPending} onClick={() => commissionerControl('START')}>Start Draft</button>
            ) : null}
            {state.session.status === 'LIVE' ? (
              <button className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-200 disabled:opacity-50" disabled={controlPending} onClick={() => commissionerControl('PAUSE')}>Pause Draft</button>
            ) : null}
            {state.session.status === 'PAUSED' ? (
              <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50" disabled={controlPending} onClick={() => commissionerControl('RESUME')}>Resume Draft</button>
            ) : null}
            {(state.session.status === 'PAUSED' || state.session.status === 'COMPLETED') && state.turns.some((turn) => turn.selection) ? (
              <button className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-200 disabled:opacity-50" disabled={controlPending} onClick={() => commissionerControl('UNDO')}>Undo last pick</button>
            ) : null}
            <a className="ml-auto text-sm font-semibold text-slate-400 hover:text-white" href="/admin/draft">Draft control center</a>
          </div>
        </div>
      ) : null}

      {currentTurn?.seasonParticipantId === state.viewerParticipantId ? (
        <div className="border-b border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-center font-semibold text-emerald-200">
          You&apos;re on the clock. Select an available team below.
        </div>
      ) : null}

      {viewerParticipant && currentTurn?.seasonParticipantId !== state.viewerParticipantId && state.session.status === 'LIVE' ? (
        <div className="border-b border-blue-300/20 bg-blue-300/10 px-4 py-3 text-center text-sm font-semibold text-blue-100">
          Waiting for your turn. Star teams to build a shortlist, or queue one team for your next pick.
        </div>
      ) : null}

      {error ? (
        <div className="mx-auto mt-4 max-w-[1600px] px-4">
          <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        </div>
      ) : null}

      {draftComplete ? (
        <section className="border-b border-blue-500/20 bg-blue-500/10 px-4 py-10 text-center sm:py-14">
          <div className="mx-auto max-w-3xl">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-500 text-3xl">🏈</div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-orange-300">
              {state.session.mode === 'OFFICIAL' ? 'Official draft complete' : 'Demo draft complete'}
            </p>
            <h2 className="mt-3 text-4xl font-black sm:text-5xl">Every pick is in!</h2>
            {state.session.mode === 'OFFICIAL' ? (
              <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-300">
                All {state.participants.length} rosters are set. The {state.session.season.year} season is now live.
              </p>
            ) : null}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a className="rounded-xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-500" href={demo ? '/demo/dashboard' : `/?season=${state.session.season.id}`}>
                {state.session.mode === 'OFFICIAL' ? 'View Season Dashboard' : 'Back to Demo Dashboard'} <span aria-hidden="true">→</span>
              </a>
              {state.session.mode === 'OFFICIAL' ? (
                <button className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10" onClick={() => setActiveTab('BOARD')} type="button">Review Final Draft Board</button>
              ) : null}
            </div>
            <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3">
              <CompletionStat label="Players" value={state.participants.length} />
              <CompletionStat label="Picks made" value={state.turns.filter((turn) => turn.selection).length} />
              <CompletionStat label="Roster spots" value={state.participants.length * 10} />
            </div>
          </div>
        </section>
      ) : null}

      <nav aria-label="Draft views" className="relative z-20 border-b border-white/10 bg-slate-900/95 px-4 backdrop-blur md:sticky md:top-[89px]">
        <div className="mx-auto grid max-w-[1600px] grid-cols-3">
        {visibleTabs.map((tab) => (
          <button
            aria-current={displayedTab === tab ? 'page' : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${displayedTab === tab ? 'border-orange-400 text-orange-300' : 'border-transparent text-slate-400 hover:text-white'}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === 'PICK' ? 'Make a Pick' : tab === 'ROSTERS' ? 'Final Rosters' : tab === 'BOARD' ? 'Draft Board' : 'Activity'}
          </button>
        ))}
        </div>
      </nav>

      <div className={`mx-auto max-w-[1600px] p-4 lg:p-6 ${selectedTeam ? 'pb-48 sm:pb-32' : ''}`}>
        {displayedTab === 'PICK' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
          <section className="order-2 lg:order-1">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Available teams</h2>
                  <p className="text-sm text-slate-400">
                    {state.availableTeams.length} teams · {state.availableTeams.filter((team) => starredTeamIds.has(team.id)).length} starred · starred teams appear first
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    checked={includeUnavailable}
                    onChange={(event) => setIncludeUnavailable(event.target.checked)}
                    type="checkbox"
                  />
                  Show unavailable
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 outline-none focus:border-blue-400"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search teams"
                  value={search}
                />
                <select
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
                  onChange={(event) => setLeague(event.target.value)}
                  value={league}
                >
                  <option value="ALL">NFL and College</option>
                  <option value="NFL">NFL</option>
                  <option value="COLLEGE">College</option>
                </select>
                <select
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2"
                  onChange={(event) => setConference(event.target.value)}
                  value={conference}
                >
                  <option value="ALL">All conferences</option>
                  {conferences.map((name) => (
                    <option key={name} value={name!}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {displayedTeams.map((team) => {
                const unavailable = Boolean(team.unavailableReason)
                const starred = starredTeamIds.has(team.id)
                const queued = selectedTeam?.id === team.id
                return (
                  <article
                    className={`relative flex items-center rounded-2xl border transition ${
                      unavailable
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-55'
                        : queued
                          ? 'border-blue-400 bg-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                    }`}
                    key={team.id}
                  >
                    <button
                      aria-label={`${queued ? 'Queued' : 'Queue'} ${team.name}`}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 pr-1 text-left disabled:cursor-not-allowed"
                      disabled={unavailable}
                      onClick={() => setSelectedTeam(team)}
                      type="button"
                    >
                      <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{team.name}</span>
                        <span className="block truncate text-xs text-slate-400">
                          {team.conference ?? team.division ?? team.league}
                        </span>
                        {team.unavailableReason ? (
                          <span className="mt-1 block text-xs text-amber-200">{team.unavailableReason}</span>
                        ) : queued ? (
                          <span className="mt-1 block text-xs font-bold text-blue-300">Queued for your next pick</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-black tabular-nums">{recordLabel(team.priorRecord)}</span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Prior W-L-T</span>
                      </span>
                    </button>
                    <button
                      aria-label={`${starred ? 'Unstar' : 'Star'} ${team.name}`}
                      aria-pressed={starred}
                      className={`m-2 grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xl transition ${
                        starred
                          ? 'border-yellow-300/50 bg-yellow-300/15 text-yellow-300'
                          : 'border-white/10 bg-slate-950/50 text-slate-500 hover:border-yellow-300/40 hover:text-yellow-300'
                      }`}
                      disabled={unavailable}
                      onClick={() => toggleStarredTeam(team.id)}
                      title={starred ? 'Remove from shortlist' : 'Add to shortlist'}
                      type="button"
                    >
                      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="order-1 lg:order-2">
            {displayedRosterParticipant ? (
              <RosterCard participant={displayedRosterParticipant} title={viewerParticipant ? 'My roster' : 'Roster'} />
            ) : null}
          </aside>
        </div>
        ) : null}

        {displayedTab === 'ROSTERS' ? (
          <section>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">Final rosters</h2>
              <p className="mt-1 text-sm text-slate-400">Every keeper and draft selection, organized by player.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {participantsWithSelections.map((participant) => (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={participant.id}>
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <h3 className="font-bold">{participant.user.name}</h3>
                    <span className="text-xs font-semibold text-slate-500">10 teams</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {participant.rosterSlots.map((slot) => (
                      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-950/60 px-2.5 py-2" key={slot.id}>
                        <span className="text-xs font-bold text-slate-600">{slot.number}</span>
                        {slot.team ? <TeamMark abbreviation={slot.team.abbreviation} logoUrl={slot.team.logoUrl} size="sm" /> : null}
                        <span className="truncate text-sm font-semibold">{slot.team?.abbreviation ?? 'Open'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {displayedTab === 'BOARD' ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Draft board</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="min-w-[1100px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="sticky left-0 bg-slate-900 px-3 py-3">Round</th>
                  {state.participants.map((participant) => (
                    <th className="min-w-32 px-3 py-3" key={participant.id}>{participant.user.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((roundNumber) => (
                  <tr className="border-b border-white/5 last:border-0" key={roundNumber}>
                    <th className="sticky left-0 bg-slate-900 px-3 py-3 text-slate-400">{roundNumber}</th>
                    {state.participants.map((participant) => {
                      const slot = participant.rosterSlots.find((candidate) => candidate.number === roundNumber)
                      const turn = state.turns.find((candidate) => candidate.rosterSlot.id === slot?.id)
                      const team = turn?.selection?.team ?? slot?.team
                      const isCurrent = turn?.id === state.currentTurnId
                      return (
                        <td className={`px-3 py-3 ${isCurrent ? 'bg-orange-500/15 ring-1 ring-inset ring-orange-400' : ''}`} key={participant.id}>
                          {team ? (
                            <div className="flex items-center gap-2">
                              <TeamMark abbreviation={team.abbreviation} logoUrl={team.logoUrl} size="sm" />
                              <div>
                              <p className="font-semibold">{team.abbreviation}</p>
                              <p className="text-[11px] text-slate-400">
                                {turn?.selection ? statusLabel(turn.selection.selectionType) : 'Keeper'}
                              </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600">Open</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        ) : null}

        {displayedTab === 'ACTIVITY' ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Activity</h2>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            {state.turns.filter((turn) => turn.selection).reverse().slice(0, 20).map((turn) => (
              <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 last:border-0" key={turn.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <TeamMark abbreviation={turn.selection!.team.abbreviation} logoUrl={turn.selection!.team.logoUrl} size="sm" />
                  <p className="truncate">
                    <span className="font-semibold">{turn.seasonParticipant.user.name}</span>{' '}
                    selected <span className="font-semibold text-blue-300">{turn.selection!.team.name}</span>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">Round {turn.round}</span>
              </div>
            ))}
            {state.turns.every((turn) => !turn.selection) ? (
              <p className="text-sm text-slate-400">No selections yet.</p>
            ) : null}
          </div>
        </section>
        ) : null}
      </div>

      {selectedTeam ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-400/40 bg-slate-900 px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-2xl sm:p-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <TeamMark abbreviation={selectedTeam.abbreviation} logoUrl={selectedTeam.logoUrl} size="lg" />
              <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-orange-300">
                {canPick ? 'Ready to draft' : 'Queued for your next pick'}
              </p>
              <p className="truncate text-lg font-semibold">{selectedTeam.name}</p>
              <p className="text-sm text-slate-400">
                {state.availableTeams.some((team) => team.id === selectedTeam.id)
                  ? `Prior record: ${recordLabel(selectedTeam.priorRecord)}`
                  : 'This team is no longer available. Choose another team.'}
              </p>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 sm:flex">
              <button className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 sm:px-4 sm:py-3" onClick={() => setSelectedTeam(null)} type="button">
                Clear queue
              </button>
              <button
                className="min-h-11 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:py-3 sm:text-base"
                disabled={submitting || !canPick || !state.availableTeams.some((team) => team.id === selectedTeam.id)}
                onClick={submitSelection}
                type="button"
              >
                {submitting ? 'Submitting…' : canPick ? 'Draft this team' : 'Waiting for your turn'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function RosterCard({ participant, title }: { participant: Participant; title: string }) {
  const nflCount = participant.rosterSlots.filter((slot) => slot.team?.league === 'NFL').length
  const collegeCount = participant.rosterSlots.filter((slot) => slot.team?.league === 'COLLEGE').length
  const openCount = participant.rosterSlots.filter((slot) => !slot.team).length

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:sticky lg:top-28">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">{title}</p>
          <h2 className="text-xl font-semibold">{participant.user.name}</h2>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>NFL {nflCount}/2</p>
          <p>College {collegeCount}/8</p>
          <p>{openCount} open</p>
        </div>
      </div>
      <div className="space-y-2">
        {participant.rosterSlots.map((slot) => (
          <div className="flex min-h-14 items-center gap-3 rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2" key={slot.id}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-slate-400">{slot.number}</span>
            {slot.team ? (
              <>
              <TeamMark abbreviation={slot.team.abbreviation} logoUrl={slot.team.logoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{slot.team.name}</p>
                <p className="text-xs text-slate-400">
                  {slot.retentionChoice === 'KEEP' ? 'Keeper' : statusLabel(slot.source)} · {slot.team.league}
                </p>
              </div>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-400">Open slot</p>
                <p className="text-xs text-slate-600">Picks in round {slot.number}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CompletionStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
      <p className="text-2xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  )
}
