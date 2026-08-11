import { prisma } from '@/lib/db'
import { DraftRuleError } from '@/lib/draft/service'
import { validateCompleteDraftOrder } from './participant-rules'

async function getMutableSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { draftSessions: { where: { status: { not: 'CANCELED' } }, select: { id: true } } },
  })
  if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
  if (!['SETUP', 'DRAFT'].includes(season.status)) {
    throw new DraftRuleError('Only a setup or draft season can be changed', 'SEASON_LOCKED', 409)
  }
  if (season.draftSessions.length > 0) {
    throw new DraftRuleError(
      'Delete rehearsal drafts and cancel the scheduled official draft before changing participants',
      'DRAFT_ALREADY_CONFIGURED',
      409,
    )
  }
  return season
}

export async function replaceSeasonParticipant(input: {
  seasonId: string
  participantId: string
  replacementUserId: string
  actorUserId: string
}) {
  const season = await getMutableSeason(input.seasonId)
  const [participant, replacementMembership, duplicate] = await Promise.all([
    prisma.seasonParticipant.findUnique({
      where: { id: input.participantId },
      include: { user: { select: { name: true } }, rosterSlots: true },
    }),
    prisma.poolMembership.findUnique({
      where: {
        poolId_userId: { poolId: season.poolId!, userId: input.replacementUserId },
      },
      include: { user: { select: { name: true } } },
    }),
    prisma.seasonParticipant.findUnique({
      where: {
        seasonId_userId: { seasonId: input.seasonId, userId: input.replacementUserId },
      },
    }),
  ])
  if (!participant || participant.seasonId !== input.seasonId) {
    throw new DraftRuleError('Participant not found', 'NOT_FOUND', 404)
  }
  if (!replacementMembership || replacementMembership.status !== 'ACTIVE') {
    throw new DraftRuleError('Replacement must be an active pool member', 'INVALID_REPLACEMENT')
  }
  if (duplicate && duplicate.id !== participant.id) {
    throw new DraftRuleError('Replacement already participates in this season', 'DUPLICATE_PARTICIPANT')
  }

  return prisma.$transaction(async (tx) => {
    for (const rosterSlot of participant.rosterSlots) {
      await tx.rosterSlot.update({
        where: { id: rosterSlot.id },
        data: {
          teamId: rosterSlot.inheritedTeamId,
          retentionChoice: rosterSlot.inheritedTeamId ? 'PENDING' : 'OPEN',
          source: rosterSlot.inheritedTeamId ? 'INHERITED' : 'DRAFT',
          decisionAt: null,
          decisionByUserId: null,
        },
      })
    }
    const updated = await tx.seasonParticipant.update({
      where: { id: participant.id },
      data: {
        userId: input.replacementUserId,
        isReplacement: true,
        releaseOverride: false,
        decisionsSubmittedAt: null,
      },
    })
    await tx.auditEvent.create({
      data: {
        poolId: season.poolId!,
        seasonId: season.id,
        actorUserId: input.actorUserId,
        action: 'SEASON_PARTICIPANT_REPLACED',
        entityType: 'SeasonParticipant',
        entityId: participant.id,
        data: {
          previousUserId: participant.userId,
          previousName: participant.user.name,
          replacementUserId: input.replacementUserId,
          replacementName: replacementMembership.user.name,
          poolSeatId: participant.poolSeatId,
          retainedDraftOrder: participant.baseDraftOrder,
        },
      },
    })
    return updated
  })
}

export async function addNewSeasonSeat(input: {
  seasonId: string
  userId: string
  baseDraftOrder: number
  actorUserId: string
}) {
  const season = await getMutableSeason(input.seasonId)
  const [membership, participants] = await Promise.all([
    prisma.poolMembership.findUnique({
      where: { poolId_userId: { poolId: season.poolId!, userId: input.userId } },
    }),
    prisma.seasonParticipant.findMany({
      where: { seasonId: season.id },
      orderBy: { baseDraftOrder: 'asc' },
    }),
  ])
  if (!membership || membership.status !== 'ACTIVE') {
    throw new DraftRuleError('New participant must be an active pool member', 'INVALID_PARTICIPANT')
  }
  if (participants.some((participant) => participant.userId === input.userId)) {
    throw new DraftRuleError('Member already participates in this season', 'DUPLICATE_PARTICIPANT')
  }
  if (
    !Number.isInteger(input.baseDraftOrder) ||
    input.baseDraftOrder < 1 ||
    input.baseDraftOrder > participants.length + 1
  ) {
    throw new DraftRuleError('Draft position is outside the available order', 'INVALID_DRAFT_ORDER')
  }

  return prisma.$transaction(async (tx) => {
    const seat = await tx.poolSeat.create({ data: { poolId: season.poolId! } })
    const participant = await tx.seasonParticipant.create({
      data: {
        seasonId: season.id,
        poolSeatId: seat.id,
        userId: input.userId,
        baseDraftOrder: null,
      },
    })
    await tx.rosterSlot.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        seasonId: season.id,
        seasonParticipantId: participant.id,
        number: index + 1,
        retentionChoice: 'OPEN',
        source: 'DRAFT',
      })),
    })

    const orderedIds = participants.map((candidate) => candidate.id)
    orderedIds.splice(input.baseDraftOrder - 1, 0, participant.id)
    for (let index = 0; index < participants.length; index += 1) {
      await tx.seasonParticipant.update({
        where: { id: participants[index].id },
        data: { baseDraftOrder: -1000 - index },
      })
    }
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx.seasonParticipant.update({
        where: { id: orderedIds[index] },
        data: { baseDraftOrder: index + 1 },
      })
    }

    await tx.auditEvent.create({
      data: {
        poolId: season.poolId!,
        seasonId: season.id,
        actorUserId: input.actorUserId,
        action: 'NEW_POOL_SEAT_ADDED_TO_SEASON',
        entityType: 'SeasonParticipant',
        entityId: participant.id,
        data: { userId: input.userId, poolSeatId: seat.id, baseDraftOrder: input.baseDraftOrder },
      },
    })
    return participant
  })
}

export async function setParticipantReleaseOverride(input: {
  seasonId: string
  participantId: string
  releaseOverride: boolean
  actorUserId: string
}) {
  const season = await getMutableSeason(input.seasonId)
  const participant = await prisma.seasonParticipant.findUnique({ where: { id: input.participantId } })
  if (!participant || participant.seasonId !== season.id) {
    throw new DraftRuleError('Participant not found', 'NOT_FOUND', 404)
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.seasonParticipant.update({
      where: { id: participant.id },
      data: { releaseOverride: input.releaseOverride, decisionsSubmittedAt: null },
    })
    await tx.auditEvent.create({
      data: {
        poolId: season.poolId!,
        seasonId: season.id,
        actorUserId: input.actorUserId,
        action: 'RELEASE_MINIMUM_OVERRIDE_CHANGED',
        entityType: 'SeasonParticipant',
        entityId: participant.id,
        data: { releaseOverride: input.releaseOverride },
      },
    })
    return updated
  })
}

export async function setSeasonDraftOrder(input: {
  seasonId: string
  participantIds: string[]
  actorUserId: string
}) {
  const season = await getMutableSeason(input.seasonId)
  const participants = await prisma.seasonParticipant.findMany({
    where: { seasonId: season.id },
    orderBy: { baseDraftOrder: 'asc' },
  })
  const validationError = validateCompleteDraftOrder(
    participants.map((participant) => participant.id),
    input.participantIds,
  )
  if (validationError) throw new DraftRuleError(validationError, 'INVALID_DRAFT_ORDER')

  return prisma.$transaction(async (tx) => {
    for (let index = 0; index < participants.length; index += 1) {
      await tx.seasonParticipant.update({
        where: { id: participants[index].id },
        data: { baseDraftOrder: -1000 - index },
      })
    }
    for (let index = 0; index < input.participantIds.length; index += 1) {
      await tx.seasonParticipant.update({
        where: { id: input.participantIds[index] },
        data: { baseDraftOrder: index + 1 },
      })
    }
    await tx.auditEvent.create({
      data: {
        poolId: season.poolId!,
        seasonId: season.id,
        actorUserId: input.actorUserId,
        action: 'SEASON_DRAFT_ORDER_CHANGED',
        entityType: 'Season',
        entityId: season.id,
        data: { participantIds: input.participantIds },
      },
    })
    return { participantIds: input.participantIds }
  })
}
