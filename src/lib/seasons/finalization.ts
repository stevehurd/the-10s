import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DraftRuleError } from '@/lib/draft/service'
import { buildFinalizationReview } from './finalization-rules'

const seasonReviewInclude = {
  participants: {
    include: {
      user: { select: { name: true } },
      rosterSlots: {
        include: { team: { select: { league: true } } },
        orderBy: { number: 'asc' as const },
      },
    },
  },
  teamRecords: { select: { teamId: true, wins: true } },
  draftSessions: {
    where: { mode: 'OFFICIAL' },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { status: true },
  },
  nextSeasons: { select: { id: true, year: true } },
} satisfies Prisma.SeasonInclude

export async function getSeasonFinalizationReview(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, include: seasonReviewInclude })
  if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
  const review = buildFinalizationReview({
    seasonStatus: season.status,
    participants: season.participants,
    records: season.teamRecords,
    officialDraftStatus: season.draftSessions[0]?.status,
  })
  return {
    season: {
      id: season.id,
      poolId: season.poolId,
      year: season.year,
      name: season.name,
      status: season.status,
      finalizedAt: season.finalizedAt,
      successorYear: season.nextSeasons[0]?.year ?? null,
    },
    ...review,
  }
}

export async function finalizeSeason(seasonId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const season = await tx.season.findUnique({ where: { id: seasonId }, include: seasonReviewInclude })
    if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
    if (season.finalizedAt || season.status === 'FINALIZED') {
      throw new DraftRuleError('This season is already finalized', 'ALREADY_FINALIZED', 409)
    }

    const review = buildFinalizationReview({
      seasonStatus: season.status,
      participants: season.participants,
      records: season.teamRecords,
      officialDraftStatus: season.draftSessions[0]?.status,
    })
    if (review.issues.length > 0) {
      throw new DraftRuleError(review.issues.join('. '), 'SEASON_NOT_READY', 409)
    }

    const finalizedAt = new Date()
    for (const standing of review.standings) {
      await tx.seasonParticipant.update({
        where: { id: standing.participantId },
        data: {
          finalRank: standing.rank,
          totalWins: standing.totalWins,
          nflWins: standing.nflWins,
          collegeWins: standing.collegeWins,
        },
      })
    }
    await tx.teamSeasonRecord.updateMany({
      where: { seasonId: season.id },
      data: { finalizedAt },
    })
    const claimed = await tx.season.updateMany({
      where: { id: season.id, status: 'ACTIVE', finalizedAt: null },
      data: { status: 'FINALIZED', finalizedAt },
    })
    if (claimed.count !== 1) {
      throw new DraftRuleError('The season changed before it could be finalized', 'STALE_SEASON', 409)
    }

    const champion = review.standings[0]
    await tx.auditEvent.create({
      data: {
        poolId: season.poolId,
        seasonId: season.id,
        actorUserId,
        action: 'SEASON_FINALIZED',
        entityType: 'Season',
        entityId: season.id,
        data: {
          finalizedAt: finalizedAt.toISOString(),
          participantCount: review.standings.length,
          championParticipantId: champion?.participantId ?? null,
          championWins: champion?.totalWins ?? null,
        },
      },
    })

    return { finalizedAt, standings: review.standings }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function reopenSeason(seasonId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const season = await tx.season.findUnique({
      where: { id: seasonId },
      include: {
        nextSeasons: { select: { id: true, year: true } },
        participants: { orderBy: { finalRank: 'asc' }, select: { id: true, finalRank: true } },
      },
    })
    if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
    if (!season.finalizedAt || season.status !== 'FINALIZED') {
      throw new DraftRuleError('Only a finalized season can be reopened', 'NOT_FINALIZED', 409)
    }
    if (season.nextSeasons.length > 0) {
      throw new DraftRuleError(
        `This season cannot be reopened because ${season.nextSeasons[0].year} already depends on its final order`,
        'SUCCESSOR_EXISTS',
        409,
      )
    }

    const previousFinalizedAt = season.finalizedAt
    const previousChampionParticipantId = season.participants.find((participant) => participant.finalRank === 1)?.id ?? null
    await tx.seasonParticipant.updateMany({ where: { seasonId }, data: { finalRank: null } })
    await tx.teamSeasonRecord.updateMany({ where: { seasonId }, data: { finalizedAt: null } })
    await tx.season.update({
      where: { id: seasonId },
      data: { status: 'ACTIVE', finalizedAt: null },
    })
    await tx.auditEvent.create({
      data: {
        poolId: season.poolId,
        seasonId,
        actorUserId,
        action: 'SEASON_REOPENED',
        entityType: 'Season',
        entityId: seasonId,
        data: {
          previousFinalizedAt: previousFinalizedAt.toISOString(),
          previousChampionParticipantId,
        },
      },
    })

    return { status: 'ACTIVE' as const }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
