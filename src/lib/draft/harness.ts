import { createHash } from 'node:crypto'

import { prisma } from '@/lib/db'
import {
  canSelectLeague,
  type League,
  type RosterSlot as EngineRosterSlot,
} from '@/lib/draft/engine'
import {
  autopickExpiredTurn,
  createDraftSession,
  DraftRuleError,
  fastForwardRehearsalToFinalPick,
  getDraftRoomState,
  makeDraftSelection,
  setDraftPaused,
  startDraftSession,
  undoLastDraftSelection,
} from '@/lib/draft/service'

import { evaluateConcurrentPick, validateHarnessRosters } from './harness-rules'

const HARNESS_POOL_SLUG = 'the-10s-development'
const HARNESS_NAME_PREFIX = 'Harness run'

export type HarnessCheck = { label: string; passed: boolean; detail?: string }
export type HarnessResult = {
  scenario: string
  passed: boolean
  checks: HarnessCheck[]
  sessionId: string
}
export type HarnessProgress = {
  inProgress: true
  sessionId: string
  remainingTurns: number
  selectionCount: number
}

async function rosterFingerprint(seasonId: string) {
  const slots = await prisma.rosterSlot.findMany({
    where: { seasonId },
    orderBy: { id: 'asc' },
    select: { id: true, seasonParticipantId: true, number: true, teamId: true, source: true },
  })
  return createHash('sha256').update(JSON.stringify(slots)).digest('hex')
}

async function requireDevelopmentSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { pool: { select: { id: true, slug: true } } },
  })
  if (!season?.pool || season.pool.slug !== HARNESS_POOL_SLUG) {
    throw new DraftRuleError('The draft harness is restricted to the synthetic development pool', 'HARNESS_FORBIDDEN', 403)
  }
  return season
}

async function requireHarnessSession(sessionId: string) {
  const session = await prisma.draftSession.findUnique({
    where: { id: sessionId },
    include: { season: { include: { pool: { select: { id: true, slug: true } } } } },
  })
  if (
    !session?.season.pool ||
    session.season.pool.slug !== HARNESS_POOL_SLUG ||
    session.mode !== 'REHEARSAL' ||
    !session.name.startsWith(HARNESS_NAME_PREFIX)
  ) {
    throw new DraftRuleError('Only synthetic harness rehearsals can run this scenario', 'HARNESS_FORBIDDEN', 403)
  }
  return session
}

async function recordHarnessResult(input: {
  sessionId: string
  seasonId: string
  poolId: string
  actorUserId: string
  scenario: string
  checks: HarnessCheck[]
}) {
  await prisma.auditEvent.create({
    data: {
      poolId: input.poolId,
      seasonId: input.seasonId,
      draftSessionId: input.sessionId,
      actorUserId: input.actorUserId,
      action: 'DRAFT_HARNESS_SCENARIO_COMPLETED',
      entityType: 'DraftSession',
      entityId: input.sessionId,
      data: {
        scenario: input.scenario,
        passed: input.checks.every((check) => check.passed),
        checks: input.checks,
      },
    },
  })
}

export async function createDraftHarnessRun(seasonId: string, actorUserId: string) {
  const season = await requireDevelopmentSeason(seasonId)
  const session = await createDraftSession({
    seasonId,
    name: `${HARNESS_NAME_PREFIX} — ${new Date().toISOString()}`,
    mode: 'REHEARSAL',
    pickSeconds: 10,
    actorUserId,
  })
  const fingerprint = await rosterFingerprint(seasonId)
  await prisma.auditEvent.create({
    data: {
      poolId: season.pool!.id,
      seasonId,
      draftSessionId: session.id,
      actorUserId,
      action: 'DRAFT_HARNESS_CREATED',
      entityType: 'DraftSession',
      entityId: session.id,
      data: { rosterFingerprint: fingerprint },
    },
  })
  return session
}

async function ensureLive(sessionId: string, actorUserId: string) {
  const session = await requireHarnessSession(sessionId)
  if (session.status === 'SCHEDULED') await startDraftSession(sessionId, actorUserId)
  else if (session.status === 'PAUSED') await setDraftPaused(sessionId, false, actorUserId)
  else if (session.status !== 'LIVE') {
    throw new DraftRuleError('This harness run is no longer active', 'INVALID_STATUS', 409)
  }
}

export async function runConcurrentPickHarness(sessionId: string, actorUserId: string): Promise<HarnessResult> {
  await ensureLive(sessionId, actorUserId)
  const session = await requireHarnessSession(sessionId)
  const activeTurn = await prisma.draftTurn.findFirst({
    where: { draftSessionId: sessionId, status: 'ACTIVE' },
    include: { seasonParticipant: true },
  })
  if (!activeTurn) throw new DraftRuleError('Harness has no active turn', 'NO_ACTIVE_TURN', 409)

  const state = await getDraftRoomState(sessionId, activeTurn.seasonParticipant.userId)
  const participant = state.participants.find((entry) => entry.id === activeTurn.seasonParticipantId)
  if (!participant) throw new DraftRuleError('Current participant could not be resolved', 'INVALID_TURN', 409)
  const selectedBySlot = new Map(
    state.turns.flatMap((turn) => turn.selection ? [[turn.rosterSlot.id, turn.selection.team] as const] : []),
  )
  const effectiveSlots: EngineRosterSlot[] = participant.rosterSlots.map((slot) => {
    const team = slot.team ?? selectedBySlot.get(slot.id) ?? null
    return {
      number: slot.number,
      state: team ? (slot.retentionChoice === 'KEEP' ? 'KEEPER' : 'PICKED') : 'OPEN',
      team: team ? { id: team.id, name: team.name, league: team.league as League, priorRecord: null } : null,
    }
  })
  const team = state.availableTeams.find((candidate) => canSelectLeague(effectiveSlots, candidate.league as League))
  if (!team) throw new DraftRuleError('No valid team is available for the concurrency scenario', 'NO_AUTOPICK_TEAM', 409)

  const beforeSelections = state.turns.filter((turn) => turn.selection).length
  const attempts = await Promise.allSettled([
    makeDraftSelection({
      draftSessionId: sessionId,
      teamId: team.id,
      actorUserId: activeTurn.seasonParticipant.userId,
      actorIsCommissioner: false,
      expectedRevision: state.session.revision,
    }),
    makeDraftSelection({
      draftSessionId: sessionId,
      teamId: team.id,
      actorUserId,
      actorIsCommissioner: true,
      expectedRevision: state.session.revision,
    }),
  ])
  const after = await getDraftRoomState(sessionId, actorUserId)
  const checks = evaluateConcurrentPick({
    beforeSelections,
    afterSelections: after.turns.filter((turn) => turn.selection).length,
    beforeRevision: state.session.revision,
    afterRevision: after.session.revision,
    fulfilled: attempts.filter((attempt) => attempt.status === 'fulfilled').length,
    rejected: attempts.filter((attempt) => attempt.status === 'rejected').length,
  })
  const result = { scenario: 'Concurrent pick collision', passed: checks.every((check) => check.passed), checks, sessionId }
  await recordHarnessResult({ sessionId, seasonId: session.seasonId, poolId: session.season.pool!.id, actorUserId, scenario: result.scenario, checks })
  return result
}

export async function runLifecycleHarness(sessionId: string, actorUserId: string): Promise<HarnessResult> {
  await ensureLive(sessionId, actorUserId)
  const session = await requireHarnessSession(sessionId)
  const beforeSelections = await prisma.draftSelection.count({ where: { draftSessionId: sessionId } })

  await setDraftPaused(sessionId, true, actorUserId)
  const paused = await prisma.draftSession.findUniqueOrThrow({ where: { id: sessionId } })
  await setDraftPaused(sessionId, false, actorUserId)
  const activeTurn = await prisma.draftTurn.findFirstOrThrow({ where: { draftSessionId: sessionId, status: 'ACTIVE' } })
  await prisma.draftTurn.update({
    where: { id: activeTurn.id },
    data: { deadlineAt: new Date(Date.now() - 1_000) },
  })
  const autopickAttempts = await Promise.allSettled([
    autopickExpiredTurn(sessionId),
    autopickExpiredTurn(sessionId),
  ])
  const autopickWinners = autopickAttempts.filter((attempt) => attempt.status === 'fulfilled')
  const harmlessAutopickLosers = autopickAttempts.filter(
    (attempt) => attempt.status === 'rejected'
      && attempt.reason instanceof DraftRuleError
      && ['CLOCK_NOT_EXPIRED', 'STALE_DRAFT'].includes(attempt.reason.code),
  )

  const reconnectOne = await getDraftRoomState(sessionId, actorUserId)
  const reconnectTwo = await getDraftRoomState(sessionId, actorUserId)
  await setDraftPaused(sessionId, true, actorUserId)
  await undoLastDraftSelection(sessionId, actorUserId)
  const afterUndo = await getDraftRoomState(sessionId, actorUserId)

  const checks: HarnessCheck[] = [
    { label: 'Pause persisted on the canonical session', passed: paused.status === 'PAUSED' },
    { label: 'Expired clock produced one autopick', passed: reconnectOne.turns.filter((turn) => turn.selection).length === beforeSelections + 1 },
    { label: 'Competing autopick requests committed exactly one pick', passed: autopickWinners.length === 1 },
    { label: 'The losing autopick resolved as a harmless stale request', passed: harmlessAutopickLosers.length === 1 },
    {
      label: 'Two reconnects reconstructed the same state',
      passed: reconnectOne.session.revision === reconnectTwo.session.revision && reconnectOne.currentTurnId === reconnectTwo.currentTurnId,
    },
    { label: 'Undo removed the autopick', passed: afterUndo.turns.filter((turn) => turn.selection).length === beforeSelections },
    { label: 'Undo left the draft paused for correction', passed: afterUndo.session.status === 'PAUSED' },
  ]
  const result = { scenario: 'Pause, reconnect, autopick, and undo', passed: checks.every((check) => check.passed), checks, sessionId }
  await recordHarnessResult({ sessionId, seasonId: session.seasonId, poolId: session.season.pool!.id, actorUserId, scenario: result.scenario, checks })
  return result
}

export async function runCompleteDraftHarness(
  sessionId: string,
  actorUserId: string,
): Promise<HarnessResult | HarnessProgress> {
  const session = await requireHarnessSession(sessionId)
  if (session.status !== 'COMPLETED') {
    const progress = await fastForwardRehearsalToFinalPick(sessionId, actorUserId, 5)
    if (progress.remainingTurns > 1) {
      return {
        inProgress: true,
        sessionId,
        remainingTurns: progress.remainingTurns,
        selectionCount: progress.selectionCount,
      }
    }
    await setDraftPaused(sessionId, false, actorUserId)
    const finalTurn = await prisma.draftTurn.findFirstOrThrow({ where: { draftSessionId: sessionId, status: 'ACTIVE' } })
    await prisma.draftTurn.update({ where: { id: finalTurn.id }, data: { deadlineAt: new Date(Date.now() - 1_000) } })
    await autopickExpiredTurn(sessionId)
  }

  const [completed, participants, selections, createdEvent, currentFingerprint] = await Promise.all([
    prisma.draftSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { _count: { select: { turns: true, selections: true } } },
    }),
    prisma.seasonParticipant.findMany({
      where: { seasonId: session.seasonId },
      include: { user: { select: { name: true } }, rosterSlots: { include: { team: { select: { league: true } } } } },
    }),
    prisma.draftSelection.findMany({
      where: { draftSessionId: sessionId },
      include: { team: { select: { league: true } } },
    }),
    prisma.auditEvent.findFirst({
      where: { draftSessionId: sessionId, action: 'DRAFT_HARNESS_CREATED' },
      orderBy: { createdAt: 'asc' },
    }),
    rosterFingerprint(session.seasonId),
  ])
  const selectionsByParticipant = new Map<string, string[]>()
  for (const selection of selections) {
    const leagues = selectionsByParticipant.get(selection.seasonParticipantId) ?? []
    leagues.push(selection.team.league)
    selectionsByParticipant.set(selection.seasonParticipantId, leagues)
  }
  const rosterIssues = validateHarnessRosters(participants.map((participant) => ({
    participantId: participant.id,
    participantName: participant.user.name,
    keptLeagues: participant.rosterSlots.flatMap((slot) => slot.team ? [slot.team.league] : []),
    selectedLeagues: selectionsByParticipant.get(participant.id) ?? [],
  })))
  const createdData = createdEvent?.data as { rosterFingerprint?: string } | null
  const checks: HarnessCheck[] = [
    { label: 'Draft reached completed status', passed: completed.status === 'COMPLETED' },
    { label: 'Every generated turn has exactly one selection', passed: completed._count.turns === completed._count.selections },
    { label: 'Every final roster has 2 NFL and 8 college teams', passed: rosterIssues.length === 0, detail: rosterIssues.join('; ') || undefined },
    {
      label: 'Official roster assignments were not changed',
      passed: Boolean(createdData?.rosterFingerprint) && createdData?.rosterFingerprint === currentFingerprint,
    },
  ]
  const result = { scenario: 'Complete 15-seat rehearsal', passed: checks.every((check) => check.passed), checks, sessionId }
  await recordHarnessResult({ sessionId, seasonId: session.seasonId, poolId: session.season.pool!.id, actorUserId, scenario: result.scenario, checks })
  return result
}
