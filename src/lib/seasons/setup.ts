import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { retryPrismaWriteConflict } from '@/lib/db/write-conflict-retry'
import {
  LEAGUES,
  validateReleaseMinimums,
  type League,
  type RosterSlot as EngineRosterSlot,
} from '@/lib/draft/engine'
import { DraftRuleError } from '@/lib/draft/service'

interface CreateSeasonInput {
  previousSeasonId: string
  year: number
  name: string
  actorUserId: string
}

export async function createSeasonFromPrevious(input: CreateSeasonInput) {
  const previous = await prisma.season.findUnique({
    where: { id: input.previousSeasonId },
    include: {
      participants: {
        include: {
          rosterSlots: { orderBy: { number: 'asc' } },
        },
      },
    },
  })
  if (!previous?.poolId) throw new DraftRuleError('Previous season not found', 'NOT_FOUND', 404)
  const poolId = previous.poolId
  if (!Number.isInteger(input.year) || input.year <= previous.year) {
    throw new DraftRuleError('New season year must follow the previous season', 'INVALID_YEAR')
  }

  const missingRank = previous.participants.find((participant) => participant.finalRank === null)
  if (missingRank) {
    throw new DraftRuleError('Every prior participant needs a final rank', 'MISSING_FINAL_RANK')
  }

  const activeTeams = await prisma.team.findMany({ where: { active: true } })
  const participantCount = previous.participants.length

  return prisma.$transaction(async (tx) => {
    const season = await tx.season.create({
      data: {
        poolId,
        previousSeasonId: previous.id,
        year: input.year,
        name: input.name.trim() || `${input.year} Season`,
        status: 'SETUP',
      },
    })

    for (const previousParticipant of previous.participants) {
      const participant = await tx.seasonParticipant.create({
        data: {
          seasonId: season.id,
          poolSeatId: previousParticipant.poolSeatId,
          userId: previousParticipant.userId,
          baseDraftOrder: participantCount - previousParticipant.finalRank! + 1,
        },
      })

      const previousSlotsByNumber = new Map(
        previousParticipant.rosterSlots.map((slot) => [slot.number, slot]),
      )
      await tx.rosterSlot.createMany({
        data: Array.from({ length: 10 }, (_, index) => {
          const number = index + 1
          const previousSlot = previousSlotsByNumber.get(number)
          return {
            seasonId: season.id,
            seasonParticipantId: participant.id,
            number,
            teamId: previousSlot?.teamId ?? null,
            inheritedTeamId: previousSlot?.teamId ?? null,
            retentionChoice: previousSlot?.teamId ? 'PENDING' : 'OPEN',
            source: previousSlot?.teamId ? 'INHERITED' : 'DRAFT',
          }
        }),
      })
    }

    if (activeTeams.length > 0) {
      await tx.seasonTeamEligibility.createMany({
        data: activeTeams.map((team) => ({
          seasonId: season.id,
          teamId: team.id,
          status: team.league === LEAGUES.NFL ? 'APPROVED' : 'PENDING',
          source: 'SPORTSDATAIO',
          reviewReason:
            team.league === LEAGUES.NFL ? null : 'Annual FBS eligibility review required',
          nameSnapshot: team.name,
          abbreviationSnapshot: team.abbreviation,
          conferenceSnapshot: team.conference,
          divisionSnapshot: team.division,
          leagueSnapshot: team.league,
        })),
      })
    }

    await tx.auditEvent.create({
      data: {
        poolId,
        seasonId: season.id,
        actorUserId: input.actorUserId,
        action: 'SEASON_CREATED_FROM_PREVIOUS',
        entityType: 'Season',
        entityId: season.id,
        data: { previousSeasonId: previous.id, participantCount },
      },
    })

    return season
  })
}

export async function setRetentionChoice(input: {
  seasonId: string
  rosterSlotId: string
  choice: 'KEEP' | 'RELEASE'
  actorUserId: string
  actorIsCommissioner: boolean
}) {
  return retryPrismaWriteConflict(() => prisma.$transaction(async (tx) => {
    const slot = await tx.rosterSlot.findUnique({
      where: { id: input.rosterSlotId },
      include: { seasonParticipant: true, season: true },
    })
    if (!slot || slot.seasonId !== input.seasonId) {
      throw new DraftRuleError('Roster slot not found', 'NOT_FOUND', 404)
    }
    if (slot.seasonParticipant.decisionsLockedAt) {
      throw new DraftRuleError('Keep and Release decisions are locked', 'DECISIONS_LOCKED', 409)
    }
    if (!slot.inheritedTeamId) {
      throw new DraftRuleError('A new open slot has no inherited team to keep or release', 'NOT_INHERITED')
    }
    if (!input.actorIsCommissioner && slot.seasonParticipant.userId !== input.actorUserId) {
      throw new DraftRuleError('You cannot change another participant’s roster', 'FORBIDDEN', 403)
    }
    if (!slot.season.poolId) throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')

    const updated = await tx.rosterSlot.update({
      where: { id: slot.id },
      data: {
        retentionChoice: input.choice,
        teamId: input.choice === 'KEEP' ? slot.inheritedTeamId : null,
        source: input.choice === 'KEEP' ? 'KEEPER' : 'DRAFT',
        decisionAt: new Date(),
        decisionByUserId: input.actorUserId,
      },
    })

    await tx.seasonParticipant.update({
      where: { id: slot.seasonParticipantId },
      data: { decisionsSubmittedAt: null },
    })

    await tx.auditEvent.create({
      data: {
        poolId: slot.season.poolId,
        seasonId: slot.seasonId,
        actorUserId: input.actorUserId,
        action: `ROSTER_TEAM_${input.choice}`,
        entityType: 'RosterSlot',
        entityId: slot.id,
        data: { number: slot.number, inheritedTeamId: slot.inheritedTeamId },
      },
    })

    return updated
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }))
}

export async function submitRetentionDecisions(input: {
  seasonId: string
  participantId: string
  actorUserId: string
  actorIsCommissioner: boolean
}) {
  return retryPrismaWriteConflict(() => prisma.$transaction(async (tx) => {
    const participant = await tx.seasonParticipant.findUnique({
      where: { id: input.participantId },
      include: {
        season: true,
        rosterSlots: { include: { inheritedTeam: true }, orderBy: { number: 'asc' } },
      },
    })
    if (!participant || participant.seasonId !== input.seasonId) {
      throw new DraftRuleError('Participant not found', 'NOT_FOUND', 404)
    }
    if (!input.actorIsCommissioner && participant.userId !== input.actorUserId) {
      throw new DraftRuleError('You cannot lock another participant’s decisions', 'FORBIDDEN', 403)
    }
    if (participant.decisionsLockedAt) {
      throw new DraftRuleError('Keep and Release decisions are locked', 'DECISIONS_LOCKED', 409)
    }
    if (!participant.season.poolId) {
      throw new DraftRuleError('Season is not assigned to a pool', 'MISSING_POOL')
    }

    const pending = participant.rosterSlots.find(
      (slot) => slot.inheritedTeamId && slot.retentionChoice === 'PENDING',
    )
    if (pending) {
      throw new DraftRuleError(`Choose Keep or Release for slot ${pending.number}`, 'PENDING_DECISION')
    }

    const inheritedSlots: EngineRosterSlot[] = participant.rosterSlots.map((slot) => ({
      number: slot.number,
      state: 'KEEPER',
      team: slot.inheritedTeam
        ? {
            id: slot.inheritedTeam.id,
            name: slot.inheritedTeam.name,
            league: slot.inheritedTeam.league as League,
            priorRecord: null,
          }
        : null,
    }))
    const released = new Set(
      participant.rosterSlots
        .filter((slot) => slot.retentionChoice === 'RELEASE')
        .map((slot) => slot.number),
    )
    const inheritedCount = participant.rosterSlots.filter((slot) => slot.inheritedTeamId).length
    const validation =
      inheritedCount === 0
        ? { valid: true, releasedNFL: 0, releasedCollege: 0, errors: [] }
        : validateReleaseMinimums(inheritedSlots, released, participant.releaseOverride)
    if (!validation.valid) {
      throw new DraftRuleError(validation.errors.join('. '), 'RELEASE_MINIMUM')
    }

    const submittedAt = new Date()
    const updated = await tx.seasonParticipant.update({
      where: { id: participant.id },
      data: { decisionsSubmittedAt: submittedAt, decisionsLockedAt: submittedAt },
    })
    await tx.auditEvent.create({
      data: {
        poolId: participant.season.poolId!,
        seasonId: participant.seasonId,
        actorUserId: input.actorUserId,
        action: 'RETENTION_DECISIONS_LOCKED',
        entityType: 'SeasonParticipant',
        entityId: participant.id,
        data: {
          releasedNFL: validation.releasedNFL,
          releasedCollege: validation.releasedCollege,
          commissionerOverride: participant.releaseOverride,
        },
      },
    })
    return updated
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }))
}
