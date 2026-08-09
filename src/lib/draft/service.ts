import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { serverDraftDeadline } from './clock'
import {
  canActorMakeDraftSelection,
  canSelectLeague,
  generateDraftTurns,
  planLastPickUndo,
  seasonStatusForDraftSession,
  selectAutopick,
  shouldRunServerAutopick,
  type DraftSeat,
  type DraftTeam,
  type League,
  type RosterSlot as EngineRosterSlot,
} from './engine'
import { normalizeMeetingUrl } from './logistics'

export class DraftRuleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'DraftRuleError'
  }
}

interface CreateDraftSessionInput {
  seasonId: string
  name: string
  mode: 'OFFICIAL' | 'REHEARSAL'
  pickSeconds: number
  startsAt?: Date | null
  meetingUrl?: string | null
  actorUserId: string
}

interface MakeSelectionInput {
  draftSessionId: string
  teamId: string
  actorUserId: string | null
  actorIsCommissioner: boolean
  expectedRevision: number
  selectionType?: 'MANUAL' | 'COMMISSIONER' | 'AUTOPICK'
}

function validateDraftLogistics(startsAt: Date | null, meetingUrl: string | null) {
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    throw new DraftRuleError('Draft start time is invalid', 'INVALID_START_TIME')
  }
  if (!meetingUrl) return
  let url: URL
  try {
    url = new URL(meetingUrl)
  } catch {
    throw new DraftRuleError('Video call URL is invalid', 'INVALID_MEETING_URL')
  }
  if (url.protocol !== 'https:') {
    throw new DraftRuleError('Video call URL must use HTTPS', 'INVALID_MEETING_URL')
  }
}

function toLeague(value: string): League {
  if (value === 'NFL' || value === 'COLLEGE') return value
  throw new DraftRuleError(`Unsupported team league: ${value}`, 'INVALID_LEAGUE')
}

function toEngineSlot(slot: {
  number: number
  team: { id: string; name: string; league: string } | null
  retentionChoice: string
}): EngineRosterSlot {
  return {
    number: slot.number,
    state: slot.team
      ? slot.retentionChoice === 'KEEP'
        ? 'KEEPER'
        : 'PICKED'
      : 'OPEN',
    team: slot.team
      ? {
          id: slot.team.id,
          name: slot.team.name,
          league: toLeague(slot.team.league),
          priorRecord: null,
        }
      : null,
  }
}

export async function createDraftSession(input: CreateDraftSessionInput) {
  if (!Number.isInteger(input.pickSeconds) || input.pickSeconds < 10 || input.pickSeconds > 900) {
    throw new DraftRuleError('Pick clock must be between 10 and 900 seconds', 'INVALID_CLOCK')
  }
  const meetingUrl = normalizeMeetingUrl(input.meetingUrl)
  validateDraftLogistics(input.startsAt ?? null, meetingUrl)

  const season = await prisma.season.findUnique({ where: { id: input.seasonId } })
  if (!season) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
  if (!season.poolId) throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
  const poolId = season.poolId

  const participants = await prisma.seasonParticipant.findMany({
    where: { seasonId: input.seasonId },
    include: {
      user: { select: { name: true } },
      rosterSlots: { include: { team: true }, orderBy: { number: 'asc' } },
    },
  })

  if (participants.length === 0) {
    throw new DraftRuleError('Add season participants before creating a draft', 'NO_PARTICIPANTS')
  }

  if (input.mode === 'OFFICIAL') {
    const existingOfficial = await prisma.draftSession.findFirst({
      where: {
        seasonId: input.seasonId,
        mode: 'OFFICIAL',
        status: { not: 'CANCELED' },
      },
    })
    if (existingOfficial) {
      throw new DraftRuleError('This season already has an official draft', 'OFFICIAL_DRAFT_EXISTS')
    }
  }

  const unresolvedEligibility = await prisma.seasonTeamEligibility.count({
    where: {
      seasonId: input.seasonId,
      leagueSnapshot: 'COLLEGE',
      status: { in: ['PENDING', 'REVIEW'] },
    },
  })
  if (unresolvedEligibility > 0) {
    throw new DraftRuleError(
      `${unresolvedEligibility} college teams still need eligibility review`,
      'ELIGIBILITY_REVIEW_INCOMPLETE',
    )
  }

  const seats: DraftSeat[] = participants.map((participant) => {
    if (participant.baseDraftOrder === null) {
      throw new DraftRuleError(
        `${participant.user.name} does not have a draft order`,
        'MISSING_DRAFT_ORDER',
      )
    }

    if (participant.rosterSlots.length !== 10) {
      throw new DraftRuleError(
        `${participant.user.name} must have exactly 10 roster slots`,
        'INVALID_ROSTER_SLOTS',
      )
    }

    const undecided = participant.rosterSlots.find(
      (slot) => slot.inheritedTeamId && slot.retentionChoice === 'PENDING',
    )
    if (undecided) {
      throw new DraftRuleError(
        `${participant.user.name} has not decided slot ${undecided.number}`,
        'PENDING_KEEPER_DECISION',
      )
    }


    const hasInheritedRoster = participant.rosterSlots.some((slot) => slot.inheritedTeamId)
    if (hasInheritedRoster && !participant.decisionsSubmittedAt) {
      throw new DraftRuleError(
        `${participant.user.name} has not submitted Keep and Release choices`,
        'RETENTION_NOT_SUBMITTED',
      )
    }

    return {
      id: participant.id,
      name: participant.user.name,
      baseOrder: participant.baseDraftOrder,
      slots: participant.rosterSlots.map(toEngineSlot),
    }
  })

  const generatedTurns = generateDraftTurns(seats)

  return prisma.$transaction(async (tx) => {
    const session = await tx.draftSession.create({
      data: {
        seasonId: input.seasonId,
        name: input.name.trim(),
        mode: input.mode,
        pickSeconds: input.pickSeconds,
        startsAt: input.startsAt ?? null,
        meetingUrl,
      },
    })

    if (generatedTurns.length > 0) {
      await tx.draftTurn.createMany({
        data: generatedTurns.map((turn) => {
          const participant = participants.find((candidate) => candidate.id === turn.seatId)
          const rosterSlot = participant?.rosterSlots.find(
            (candidate) => candidate.number === turn.slotNumber,
          )
          if (!participant || !rosterSlot) {
            throw new DraftRuleError('Generated turn references a missing slot', 'INVALID_TURN')
          }

          return {
            draftSessionId: session.id,
            seasonParticipantId: participant.id,
            rosterSlotId: rosterSlot.id,
            round: turn.round,
            orderInRound: turn.orderInRound,
            overallIndex: turn.index,
          }
        }),
      })
    }

    await tx.auditEvent.create({
      data: {
        poolId,
        seasonId: input.seasonId,
        draftSessionId: session.id,
        actorUserId: input.actorUserId,
        action: 'DRAFT_SESSION_CREATED',
        entityType: 'DraftSession',
        entityId: session.id,
        data: {
          mode: input.mode,
          pickSeconds: input.pickSeconds,
          startsAt: input.startsAt?.toISOString() ?? null,
          hasMeetingUrl: Boolean(meetingUrl),
          turnCount: generatedTurns.length,
        },
      },
    })

    return session
  })
}

export async function updateDraftLogistics(input: {
  sessionId: string
  startsAt: Date | null
  meetingUrl: string | null
  pickSeconds: number
  actorUserId: string
}) {
  if (!Number.isInteger(input.pickSeconds) || input.pickSeconds < 10 || input.pickSeconds > 900) {
    throw new DraftRuleError('Pick clock must be between 10 and 900 seconds', 'INVALID_CLOCK')
  }
  const meetingUrl = normalizeMeetingUrl(input.meetingUrl)
  validateDraftLogistics(input.startsAt, meetingUrl)

  const session = await prisma.draftSession.findUnique({
    where: { id: input.sessionId },
    include: { season: true },
  })
  if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
  if (session.status !== 'SCHEDULED') {
    throw new DraftRuleError('Draft logistics lock when the draft starts', 'INVALID_STATUS', 409)
  }
  if (!session.season.poolId) {
    throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.draftSession.update({
      where: { id: session.id },
      data: {
        startsAt: input.startsAt,
        meetingUrl,
        pickSeconds: input.pickSeconds,
      },
    })
    await tx.auditEvent.create({
      data: {
        poolId: session.season.poolId!,
        seasonId: session.seasonId,
        draftSessionId: session.id,
        actorUserId: input.actorUserId,
        action: 'DRAFT_LOGISTICS_UPDATED',
        entityType: 'DraftSession',
        entityId: session.id,
        data: {
          startsAt: input.startsAt?.toISOString() ?? null,
          hasMeetingUrl: Boolean(meetingUrl),
          pickSeconds: input.pickSeconds,
        },
      },
    })
    return updated
  })
}

export async function startDraftSession(sessionId: string, actorUserId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: true, turns: { orderBy: { overallIndex: 'asc' }, take: 1 } },
    })
    if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
    if (session.status !== 'SCHEDULED') {
      throw new DraftRuleError('Only a scheduled draft can start', 'INVALID_STATUS')
    }

    const now = new Date()
    const firstTurn = session.turns[0]
    const status = firstTurn ? 'LIVE' : 'COMPLETED'

    await tx.seasonParticipant.updateMany({
      where: { seasonId: session.seasonId, decisionsLockedAt: null },
      data: { decisionsLockedAt: now },
    })

    const updated = await tx.draftSession.update({
      where: { id: session.id },
      data: {
        status,
        startedAt: session.startedAt ?? now,
        completedAt: firstTurn ? null : now,
        revision: { increment: 1 },
      },
    })

    const nextSeasonStatus = seasonStatusForDraftSession(session.mode, status)
    if (nextSeasonStatus) {
      await tx.season.update({ where: { id: session.seasonId }, data: { status: nextSeasonStatus } })
    }

    if (!session.season.poolId) throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
    await tx.auditEvent.create({
      data: {
        poolId: session.season.poolId,
        seasonId: session.seasonId,
        draftSessionId: session.id,
        actorUserId,
        action: status === 'LIVE' ? 'DRAFT_STARTED' : 'DRAFT_COMPLETED',
        entityType: 'DraftSession',
        entityId: session.id,
      },
    })

    if (firstTurn) {
      await tx.draftTurn.update({
        where: { id: firstTurn.id },
        data: { status: 'ACTIVE', deadlineAt: null },
      })
    }

    return { updated, firstTurnId: firstTurn?.id ?? null, pickSeconds: session.pickSeconds }
  })

  // Arm the clock after the main transaction commits. Remote transaction latency
  // must never consume time that belongs to the player on the clock.
  let currentTurnDeadlineAt = result.firstTurnId
    ? serverDraftDeadline(result.pickSeconds)
    : null
  if (result.firstTurnId && currentTurnDeadlineAt) {
    const armed = await prisma.draftTurn.updateMany({
      where: {
        id: result.firstTurnId,
        status: 'ACTIVE',
        draftSession: { status: 'LIVE' },
      },
      data: { deadlineAt: currentTurnDeadlineAt },
    })
    if (armed.count !== 1) currentTurnDeadlineAt = null
  }

  return { ...result.updated, currentTurnDeadlineAt }
}

export async function setDraftPaused(sessionId: string, paused: boolean, actorUserId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.draftSession.findUnique({
      where: { id: sessionId },
      include: { season: true },
    })
    if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)

    const expectedStatus = paused ? 'LIVE' : 'PAUSED'
    if (session.status !== expectedStatus) {
      throw new DraftRuleError(
        paused ? 'Only a live draft can be paused' : 'Only a paused draft can resume',
        'INVALID_STATUS',
      )
    }

    const updated = await tx.draftSession.update({
      where: { id: session.id },
      data: { status: paused ? 'PAUSED' : 'LIVE', revision: { increment: 1 } },
    })

    if (!session.season.poolId) throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
    await tx.auditEvent.create({
      data: {
        poolId: session.season.poolId,
        seasonId: session.seasonId,
        draftSessionId: session.id,
        actorUserId,
        action: paused ? 'DRAFT_PAUSED' : 'DRAFT_RESUMED',
        entityType: 'DraftSession',
        entityId: session.id,
      },
    })

    if (paused) {
      await tx.draftTurn.updateMany({
        where: { draftSessionId: session.id, overallIndex: session.currentTurnIndex },
        data: { deadlineAt: null },
      })
    }

    return { updated, pickSeconds: session.pickSeconds, currentTurnIndex: session.currentTurnIndex }
  })

  let currentTurnDeadlineAt = paused ? null : serverDraftDeadline(result.pickSeconds)
  if (currentTurnDeadlineAt) {
    const armed = await prisma.draftTurn.updateMany({
      where: {
        draftSessionId: sessionId,
        overallIndex: result.currentTurnIndex,
        status: 'ACTIVE',
        draftSession: { status: 'LIVE' },
      },
      data: { deadlineAt: currentTurnDeadlineAt },
    })
    if (armed.count !== 1) currentTurnDeadlineAt = null
  }

  return { ...result.updated, currentTurnDeadlineAt }
}

export async function undoLastDraftSelection(sessionId: string, actorUserId: string) {
  return prisma.$transaction(
    async (tx) => {
      const session = await tx.draftSession.findUnique({
        where: { id: sessionId },
        include: {
          season: true,
          turns: {
            orderBy: { overallIndex: 'asc' },
            include: { selection: true },
          },
        },
      })
      if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
      if (session.status === 'LIVE') {
        throw new DraftRuleError('Pause the draft before undoing a pick', 'DRAFT_MUST_BE_PAUSED', 409)
      }
      if (!['PAUSED', 'COMPLETED'].includes(session.status)) {
        throw new DraftRuleError('Only a paused or completed draft can be rewound', 'INVALID_STATUS', 409)
      }
      if (!session.season.poolId) {
        throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
      }
      if (session.season.finalizedAt) {
        throw new DraftRuleError('Reopen the finalized season before correcting its draft', 'SEASON_FINALIZED', 409)
      }

      const undoPlan = planLastPickUndo(
        session.turns.map((turn) => ({
          index: turn.overallIndex,
          status: turn.status,
          selected: Boolean(turn.selection),
        })),
      )
      if (!undoPlan) throw new DraftRuleError('This draft has no pick to undo', 'NO_SELECTION', 409)
      const reopenedTurn = session.turns.find(
        (turn) => turn.overallIndex === undoPlan.reopenedTurnIndex,
      )
      if (!reopenedTurn?.selection) {
        throw new DraftRuleError('The last pick could not be resolved', 'INVALID_TURN', 409)
      }

      const claimed = await tx.draftSession.updateMany({
        where: { id: session.id, revision: session.revision, status: session.status },
        data: { revision: { increment: 1 } },
      })
      if (claimed.count !== 1) {
        throw new DraftRuleError('The draft changed. Refresh before undoing.', 'STALE_DRAFT', 409)
      }

      if (undoPlan.demotedActiveTurnIndex !== null) {
        await tx.draftTurn.update({
          where: {
            draftSessionId_overallIndex: {
              draftSessionId: session.id,
              overallIndex: undoPlan.demotedActiveTurnIndex,
            },
          },
          data: { status: 'PENDING', deadlineAt: null },
        })
      }
      await tx.draftTurn.update({
        where: { id: reopenedTurn.id },
        data: { status: 'ACTIVE', deadlineAt: null },
      })
      if (session.mode === 'OFFICIAL') {
        await tx.rosterSlot.updateMany({
          where: { id: reopenedTurn.rosterSlotId, teamId: reopenedTurn.selection.teamId },
          data: { teamId: null, source: 'DRAFT' },
        })
      }
      await tx.draftSelection.delete({ where: { id: reopenedTurn.selection.id } })
      const updated = await tx.draftSession.update({
        where: { id: session.id },
        data: {
          status: 'PAUSED',
          currentTurnIndex: reopenedTurn.overallIndex,
          completedAt: null,
        },
      })
      const reopenedSeasonStatus = seasonStatusForDraftSession(session.mode, 'PAUSED')
      if (reopenedSeasonStatus) {
        await tx.season.update({ where: { id: session.seasonId }, data: { status: reopenedSeasonStatus } })
      }
      await tx.auditEvent.create({
        data: {
          poolId: session.season.poolId,
          seasonId: session.seasonId,
          draftSessionId: session.id,
          actorUserId,
          action: 'DRAFT_LAST_SELECTION_UNDONE',
          entityType: 'DraftSelection',
          entityId: reopenedTurn.selection.id,
          data: {
            teamId: reopenedTurn.selection.teamId,
            seasonParticipantId: reopenedTurn.seasonParticipantId,
            rosterSlotId: reopenedTurn.rosterSlotId,
            turnIndex: reopenedTurn.overallIndex,
            previousSelectionType: reopenedTurn.selection.selectionType,
          },
        },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function makeDraftSelection(input: MakeSelectionInput) {
  const result = await prisma.$transaction(
    async (tx) => {
      const session = await tx.draftSession.findUnique({
        where: { id: input.draftSessionId },
        include: { season: true },
      })
      if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
      if (session.season.finalizedAt) {
        throw new DraftRuleError('Finalized season rosters are frozen', 'SEASON_FINALIZED', 409)
      }
      if (session.status !== 'LIVE') {
        throw new DraftRuleError('The draft is not accepting picks', 'DRAFT_NOT_LIVE', 409)
      }

      const turn = await tx.draftTurn.findUnique({
        where: {
          draftSessionId_overallIndex: {
            draftSessionId: session.id,
            overallIndex: session.currentTurnIndex,
          },
        },
        include: {
          seasonParticipant: true,
          rosterSlot: true,
        },
      })
      if (!turn) throw new DraftRuleError('Current draft turn not found', 'INVALID_TURN', 409)
      const requestedSelectionType = input.selectionType ?? 'MANUAL'
      if (!canActorMakeDraftSelection({
        actorUserId: input.actorUserId,
        onClockUserId: turn.seasonParticipant.userId,
        actorIsCommissioner: input.actorIsCommissioner,
        selectionType: requestedSelectionType,
      })) {
        throw new DraftRuleError('It is not your turn', 'NOT_YOUR_TURN', 403)
      }

      const claimed = await tx.draftSession.updateMany({
        where: {
          id: session.id,
          status: 'LIVE',
          revision: input.expectedRevision,
          currentTurnIndex: session.currentTurnIndex,
        },
        data: { revision: { increment: 1 } },
      })
      if (claimed.count !== 1) {
        throw new DraftRuleError('The draft advanced. Refresh before picking.', 'STALE_DRAFT', 409)
      }

      const team = await tx.team.findUnique({ where: { id: input.teamId } })
      if (!team) throw new DraftRuleError('Team not found', 'TEAM_NOT_FOUND', 404)

      const eligibility = await tx.seasonTeamEligibility.findUnique({
        where: { seasonId_teamId: { seasonId: session.seasonId, teamId: team.id } },
      })
      if (!eligibility || eligibility.status !== 'APPROVED') {
        throw new DraftRuleError('Team is not eligible for this season', 'TEAM_NOT_ELIGIBLE')
      }

      const heldTeam = await tx.rosterSlot.findFirst({
        where: { seasonId: session.seasonId, teamId: team.id },
      })
      const selectedTeam = await tx.draftSelection.findFirst({
        where: { draftSessionId: session.id, teamId: team.id },
      })
      if (heldTeam || selectedTeam) {
        throw new DraftRuleError('Team is no longer available', 'TEAM_UNAVAILABLE', 409)
      }

      const [participantSlots, participantSelections] = await Promise.all([
        tx.rosterSlot.findMany({
          where: { seasonParticipantId: turn.seasonParticipantId },
          include: { team: true },
          orderBy: { number: 'asc' },
        }),
        tx.draftSelection.findMany({
          where: {
            draftSessionId: session.id,
            seasonParticipantId: turn.seasonParticipantId,
          },
          include: { team: true },
        }),
      ])
      const selectedTeamBySlot = new Map(
        participantSelections.map((selection) => [selection.rosterSlotId, selection.team]),
      )
      const engineSlots = participantSlots.map((slot) =>
        toEngineSlot({
          ...slot,
          team: slot.team ?? selectedTeamBySlot.get(slot.id) ?? null,
        }),
      )
      if (!canSelectLeague(engineSlots, toLeague(team.league))) {
        throw new DraftRuleError(
          'This pick would make the required 2 NFL / 8 college roster impossible',
          'ROSTER_QUOTA',
        )
      }

      const priorRecord = session.season.previousSeasonId
        ? await tx.teamSeasonRecord.findUnique({
            where: {
              seasonId_teamId: {
                seasonId: session.season.previousSeasonId,
                teamId: team.id,
              },
            },
          })
        : null

      const selectionType =
        requestedSelectionType === 'AUTOPICK'
          ? 'AUTOPICK'
          : input.selectionType ?? (input.actorIsCommissioner ? 'COMMISSIONER' : 'MANUAL')
      const selection = await tx.draftSelection.create({
        data: {
          draftSessionId: session.id,
          draftTurnId: turn.id,
          seasonParticipantId: turn.seasonParticipantId,
          rosterSlotId: turn.rosterSlotId,
          teamId: team.id,
          selectionType,
          pickedByUserId: input.actorUserId,
          priorWins: priorRecord?.wins ?? 0,
          priorLosses: priorRecord?.losses ?? 0,
          priorTies: priorRecord?.ties ?? 0,
        },
      })

      if (session.mode === 'OFFICIAL') {
        await tx.rosterSlot.update({
          where: { id: turn.rosterSlotId },
          data: {
            teamId: team.id,
            source: selectionType === 'AUTOPICK' ? 'AUTOPICK' : 'DRAFT',
          },
        })
      }

      await tx.draftTurn.update({
        where: { id: turn.id },
        data: { status: 'COMPLETED', deadlineAt: null },
      })

      const nextTurn = await tx.draftTurn.findFirst({
        where: { draftSessionId: session.id, overallIndex: { gt: turn.overallIndex } },
        orderBy: { overallIndex: 'asc' },
      })
      const now = new Date()

      if (!nextTurn && session.mode === 'OFFICIAL') {
        const openRosterSlots = await tx.rosterSlot.count({
          where: { seasonId: session.seasonId, teamId: null },
        })
        if (openRosterSlots > 0) {
          throw new DraftRuleError(
            `The official draft cannot complete with ${openRosterSlots} open roster slot${openRosterSlots === 1 ? '' : 's'}`,
            'INCOMPLETE_OFFICIAL_ROSTERS',
            409,
          )
        }
      }

      await tx.draftSession.update({
        where: { id: session.id },
        data: {
          currentTurnIndex: nextTurn?.overallIndex ?? turn.overallIndex + 1,
          status: nextTurn ? 'LIVE' : 'COMPLETED',
          completedAt: nextTurn ? null : now,
        },
      })

      const completedSeasonStatus = nextTurn
        ? null
        : seasonStatusForDraftSession(session.mode, 'COMPLETED')
      if (completedSeasonStatus) {
        await tx.season.update({ where: { id: session.seasonId }, data: { status: completedSeasonStatus } })
      }

      if (!session.season.poolId) throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
      await tx.auditEvent.create({
        data: {
          poolId: session.season.poolId,
          seasonId: session.seasonId,
          draftSessionId: session.id,
          actorUserId: input.actorUserId,
          action: 'DRAFT_SELECTION_MADE',
          entityType: 'DraftSelection',
          entityId: selection.id,
          data: {
            teamId: team.id,
            turnIndex: turn.overallIndex,
            selectionType,
          },
        },
      })

      if (nextTurn) {
        await tx.draftTurn.update({
          where: { id: nextTurn.id },
          data: { status: 'ACTIVE', deadlineAt: null },
        })
      }

      return {
        selection,
        nextTurnId: nextTurn?.id ?? null,
        nextTurnIndex: nextTurn?.overallIndex ?? turn.overallIndex + 1,
        sessionStatus: nextTurn ? 'LIVE' : 'COMPLETED',
        sessionRevision: session.revision + 1,
        pickSeconds: session.pickSeconds,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )

  let nextTurnDeadlineAt: Date | null = null
  if (result.nextTurnId) {
    const proposedDeadline = serverDraftDeadline(result.pickSeconds)
    const armed = await prisma.draftTurn.updateMany({
      where: {
        id: result.nextTurnId,
        status: 'ACTIVE',
        draftSession: { status: 'LIVE' },
      },
      data: { deadlineAt: proposedDeadline },
    })
    if (armed.count === 1) nextTurnDeadlineAt = proposedDeadline
  }

  return {
    ...result.selection,
    nextTurnId: result.nextTurnId,
    nextTurnIndex: result.nextTurnIndex,
    nextTurnDeadlineAt,
    sessionStatus: result.sessionStatus,
    sessionRevision: result.sessionRevision,
  }
}

async function autopickCurrentTurn(draftSessionId: string, requireExpiredClock: boolean) {
  const session = await prisma.draftSession.findUnique({
    where: { id: draftSessionId },
    include: {
      season: true,
      turns: {
        where: { status: 'ACTIVE' },
        take: 1,
        include: {
          seasonParticipant: {
            include: {
              rosterSlots: { include: { team: true }, orderBy: { number: 'asc' } },
            },
          },
        },
      },
    },
  })
  if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
  if (session.status !== 'LIVE') throw new DraftRuleError('Draft is not live', 'DRAFT_NOT_LIVE', 409)

  const turn = session.turns.find((candidate) => candidate.overallIndex === session.currentTurnIndex)
  if (!turn) {
    throw new DraftRuleError('The draft does not have an active turn', 'NO_ACTIVE_TURN', 409)
  }
  if (requireExpiredClock && (!turn.deadlineAt || turn.deadlineAt.getTime() > Date.now())) {
    throw new DraftRuleError('The current pick clock has not expired', 'CLOCK_NOT_EXPIRED', 409)
  }

  const [eligibility, heldSlots, selections, priorRecords, participantSelections] = await Promise.all([
    prisma.seasonTeamEligibility.findMany({
      where: { seasonId: session.seasonId, status: 'APPROVED' },
      include: { team: true },
    }),
    prisma.rosterSlot.findMany({
      where: { seasonId: session.seasonId, teamId: { not: null } },
      select: { teamId: true },
    }),
    prisma.draftSelection.findMany({
      where: { draftSessionId: session.id },
      select: { teamId: true },
    }),
    session.season.previousSeasonId
      ? prisma.teamSeasonRecord.findMany({ where: { seasonId: session.season.previousSeasonId } })
      : Promise.resolve([]),
    prisma.draftSelection.findMany({
      where: {
        draftSessionId: session.id,
        seasonParticipantId: turn.seasonParticipantId,
      },
      include: { team: true },
    }),
  ])

  const unavailable = new Set([
    ...heldSlots.flatMap((slot) => (slot.teamId ? [slot.teamId] : [])),
    ...selections.map((selection) => selection.teamId),
  ])
  const recordByTeam = new Map(priorRecords.map((record) => [record.teamId, record]))
  const availableTeams: DraftTeam[] = eligibility
    .filter(({ team }) => !unavailable.has(team.id))
    .map(({ team }) => {
      const record = recordByTeam.get(team.id)
      return {
        id: team.id,
        name: team.name,
        league: toLeague(team.league),
        priorRecord: record
          ? { wins: record.wins, losses: record.losses, ties: record.ties }
          : null,
      }
    })

  const selectedTeamBySlot = new Map(
    participantSelections.map((selection) => [selection.rosterSlotId, selection.team]),
  )
  const team = selectAutopick(
    turn.seasonParticipant.rosterSlots.map((slot) =>
      toEngineSlot({
        ...slot,
        team: slot.team ?? selectedTeamBySlot.get(slot.id) ?? null,
      }),
    ),
    availableTeams,
  )
  if (!team) throw new DraftRuleError('No eligible team is available for autopick', 'NO_AUTOPICK_TEAM', 409)

  return makeDraftSelection({
    draftSessionId: session.id,
    teamId: team.id,
    actorUserId: null,
    actorIsCommissioner: true,
    expectedRevision: session.revision,
    selectionType: 'AUTOPICK',
  })
}

export async function autopickExpiredTurn(draftSessionId: string) {
  return autopickCurrentTurn(draftSessionId, true)
}

export async function autopickExpiredOfficialDrafts(now = new Date()) {
  const candidates = await prisma.draftSession.findMany({
    where: {
      mode: 'OFFICIAL',
      status: 'LIVE',
      turns: {
        some: {
          status: 'ACTIVE',
          deadlineAt: { lte: now },
        },
      },
    },
    select: {
      id: true,
      mode: true,
      status: true,
      turns: {
        where: { status: 'ACTIVE' },
        orderBy: { overallIndex: 'asc' },
        take: 1,
        select: { status: true, deadlineAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 25,
  })

  const completed: string[] = []
  const skipped: Array<{ sessionId: string; reason: string }> = []

  for (const session of candidates) {
    const turn = session.turns[0]
    if (!turn || !shouldRunServerAutopick({
      sessionMode: session.mode,
      sessionStatus: session.status,
      turnStatus: turn.status,
      deadlineAt: turn.deadlineAt,
      now,
    })) {
      continue
    }

    try {
      await autopickExpiredTurn(session.id)
      completed.push(session.id)
    } catch (error) {
      // A member's browser may have advanced the draft after this worker read
      // the candidate. Treat that expected race as a harmless skip.
      if (error instanceof DraftRuleError && [
        'CLOCK_NOT_EXPIRED',
        'DRAFT_NOT_LIVE',
        'NO_ACTIVE_TURN',
        'STALE_DRAFT',
      ].includes(error.code)) {
        skipped.push({ sessionId: session.id, reason: error.code })
        continue
      }
      throw error
    }
  }

  return { inspected: candidates.length, completed, skipped }
}

export async function fastForwardRehearsalToFinalPick(
  draftSessionId: string,
  actorUserId: string,
  maxSelections = Number.MAX_SAFE_INTEGER,
) {
  const session = await prisma.draftSession.findUnique({ where: { id: draftSessionId } })
  if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)
  if (session.mode !== 'REHEARSAL') {
    throw new DraftRuleError('Only demo drafts can be fast-forwarded', 'OFFICIAL_DRAFT_PROTECTED', 409)
  }
  if (session.status === 'COMPLETED' || session.status === 'CANCELED') {
    throw new DraftRuleError('This demo draft cannot be fast-forwarded', 'INVALID_STATUS', 409)
  }

  if (session.status === 'SCHEDULED') {
    await startDraftSession(draftSessionId, actorUserId)
  } else if (session.status === 'PAUSED') {
    await setDraftPaused(draftSessionId, false, actorUserId)
  } else if (session.status !== 'LIVE') {
    throw new DraftRuleError('This demo draft cannot be fast-forwarded', 'INVALID_STATUS', 409)
  }

  let remainingTurns = await prisma.draftTurn.count({
    where: { draftSessionId, status: { in: ['ACTIVE', 'PENDING'] } },
  })
  let selectionsMade = 0
  while (remainingTurns > 1 && selectionsMade < maxSelections) {
    await autopickCurrentTurn(draftSessionId, false)
    remainingTurns -= 1
    selectionsMade += 1
  }

  const updated = await prisma.draftSession.findUniqueOrThrow({ where: { id: draftSessionId } })
  if (updated.status === 'LIVE') await setDraftPaused(draftSessionId, true, actorUserId)

  return {
    draftSessionId,
    remainingTurns,
    selectionsMade,
    selectionCount: await prisma.draftSelection.count({ where: { draftSessionId } }),
  }
}

export async function getDraftRoomState(draftSessionId: string, viewerUserId: string) {
  const session = await prisma.draftSession.findUnique({
    where: { id: draftSessionId },
    include: {
      season: true,
      turns: {
        orderBy: { overallIndex: 'asc' },
        include: {
          seasonParticipant: { include: { user: { select: { id: true, name: true } } } },
          rosterSlot: { include: { team: true, inheritedTeam: true } },
          selection: { include: { team: true } },
        },
      },
    },
  })
  if (!session) throw new DraftRuleError('Draft session not found', 'NOT_FOUND', 404)

  const [participants, eligibility, priorRecords, sessionSelections] = await Promise.all([
    prisma.seasonParticipant.findMany({
      where: { seasonId: session.seasonId },
      orderBy: { baseDraftOrder: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
        rosterSlots: {
          orderBy: { number: 'asc' },
          include: { team: true, inheritedTeam: true },
        },
      },
    }),
    prisma.seasonTeamEligibility.findMany({
      where: { seasonId: session.seasonId, status: 'APPROVED' },
      include: { team: true },
    }),
    session.season.previousSeasonId
      ? prisma.teamSeasonRecord.findMany({ where: { seasonId: session.season.previousSeasonId } })
      : Promise.resolve([]),
    prisma.draftSelection.findMany({ where: { draftSessionId }, select: { teamId: true } }),
  ])

  const priorRecordByTeam = new Map(priorRecords.map((record) => [record.teamId, record]))
  const unavailableTeamIds = new Set([
    ...participants.flatMap((participant) =>
      participant.rosterSlots.flatMap((slot) => (slot.teamId ? [slot.teamId] : [])),
    ),
    ...sessionSelections.map((selection) => selection.teamId),
  ])

  const eligibleTeams = eligibility.map(({ team }) => ({
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      league: team.league,
      conference: team.conference,
      division: team.division,
      logoUrl: team.logoUrl,
      priorRecord: priorRecordByTeam.has(team.id)
        ? {
            wins: priorRecordByTeam.get(team.id)!.wins,
            losses: priorRecordByTeam.get(team.id)!.losses,
            ties: priorRecordByTeam.get(team.id)!.ties,
          }
        : null,
    }))

  const sortTeamsByPriorRecord = <T extends (typeof eligibleTeams)[number]>(left: T, right: T) => {
    const leftRecord = left.priorRecord ?? { wins: 0, losses: Number.MAX_SAFE_INTEGER, ties: 0 }
    const rightRecord = right.priorRecord ?? {
      wins: 0,
      losses: Number.MAX_SAFE_INTEGER,
      ties: 0,
    }
    return (
      rightRecord.wins - leftRecord.wins ||
      leftRecord.losses - rightRecord.losses ||
      rightRecord.ties - leftRecord.ties ||
      left.name.localeCompare(right.name)
    )
  }

  const availableTeams = eligibleTeams
    .filter((team) => !unavailableTeamIds.has(team.id))
    .sort((left, right) => {
      return sortTeamsByPriorRecord(left, right)
    })

  const unavailableTeams = eligibleTeams
    .filter((team) => unavailableTeamIds.has(team.id))
    .map((team) => {
      const selectedTurn = session.turns.find((turn) => turn.selection?.teamId === team.id)
      if (selectedTurn) {
        return {
          ...team,
          unavailableReason: `Drafted by ${selectedTurn.seasonParticipant.user.name} in round ${selectedTurn.round}`,
        }
      }

      const holder = participants.find((participant) =>
        participant.rosterSlots.some((slot) => slot.teamId === team.id),
      )
      return {
        ...team,
        unavailableReason: holder ? `Kept by ${holder.user.name}` : 'Unavailable',
      }
    })
    .sort(sortTeamsByPriorRecord)

  const currentTurn = session.turns.find((turn) => turn.overallIndex === session.currentTurnIndex) ?? null

  return {
    session: {
      id: session.id,
      name: session.name,
      mode: session.mode,
      status: session.status,
      pickSeconds: session.pickSeconds,
      meetingUrl: session.meetingUrl,
      currentTurnIndex: session.currentTurnIndex,
      revision: session.revision,
      season: { id: session.season.id, year: session.season.year, name: session.season.name },
    },
    viewerParticipantId:
      participants.find((participant) => participant.userId === viewerUserId)?.id ?? null,
    currentTurnId: currentTurn?.id ?? null,
    participants,
    turns: session.turns,
    availableTeams,
    unavailableTeams,
  }
}
