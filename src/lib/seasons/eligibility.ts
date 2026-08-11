import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { fetchCollegeTeams, fetchNFLTeams, type TeamSyncData } from '@/lib/team-data'
import { DraftRuleError } from '@/lib/draft/service'
import { normalizeEligibilityOverride, resolveCollegeEligibilitySync } from '@/lib/seasons/eligibility-rules'

function teamUpdateData(teamData: TeamSyncData) {
  return {
    name: teamData.name,
    abbreviation: teamData.abbreviation,
    conference: teamData.conference,
    division: teamData.division,
    league: teamData.league,
    externalId: teamData.externalId,
    sportsDataTeamId: teamData.sportsDataTeamId,
    sportsDataGlobalTeamId: teamData.sportsDataGlobalTeamId,
    logoUrl: teamData.logoUrl,
    active: true,
  }
}

function teamNeedsUpdate(
  team: Awaited<ReturnType<typeof prisma.team.findMany>>[number],
  teamData: TeamSyncData,
) {
  const data = {
    ...teamUpdateData(teamData),
  }
  return Object.entries(data).some(([key, value]) => team[key as keyof typeof team] !== value)
}

async function reconcileTeams(teamDataList: TeamSyncData[]) {
  const existingTeams = await prisma.team.findMany({
    where: { league: { in: ['NFL', 'COLLEGE'] } },
  })
  const byGlobalId = new Map(
    existingTeams.flatMap((team) => {
      const ids = [team.sportsDataGlobalTeamId, team.externalId].filter(Boolean) as string[]
      return ids.map((id) => [`${team.league}:${id}`, team] as const)
    }),
  )
  const byTeamId = new Map(
    existingTeams
      .filter((team) => team.sportsDataTeamId)
      .map((team) => [`${team.league}:${team.sportsDataTeamId}`, team] as const),
  )
  const byName = new Map(existingTeams.map((team) => [`${team.league}:${team.name}`, team] as const))

  const reconciled = await Promise.all(teamDataList.map(async (teamData) => {
    const existing =
      (teamData.sportsDataGlobalTeamId
        ? byGlobalId.get(`${teamData.league}:${teamData.sportsDataGlobalTeamId}`)
        : null) ??
      (teamData.sportsDataTeamId
        ? byTeamId.get(`${teamData.league}:${teamData.sportsDataTeamId}`)
        : null) ??
      byName.get(`${teamData.league}:${teamData.name}`)

    const team = existing
      ? teamNeedsUpdate(existing, teamData)
        ? await prisma.team.update({ where: { id: existing.id }, data: teamUpdateData(teamData) })
        : existing
      : await prisma.team.create({ data: teamUpdateData(teamData) })

    return { team, teamData }
  }))

  return reconciled
}

export async function syncSeasonEligibility(seasonId: string, actorUserId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { previousSeason: true },
  })
  if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
  if (season.status === 'FINALIZED') {
    throw new DraftRuleError(
      'Reopen the finalized season before changing its team pool',
      'SEASON_FINALIZED',
      409,
    )
  }
  const poolId = season.poolId

  const [collegeTeams, nflTeams] = await Promise.all([fetchCollegeTeams(), fetchNFLTeams()])
  if (collegeTeams.length === 0 || nflTeams.length === 0) {
    throw new DraftRuleError(
      'SportsDataIO returned an incomplete team list; existing eligibility was not changed',
      'INCOMPLETE_TEAM_SOURCE',
      502,
    )
  }

  const previousEligibility = season.previousSeasonId
    ? await prisma.seasonTeamEligibility.findMany({ where: { seasonId: season.previousSeasonId } })
    : []
  const previousByTeamId = new Map(previousEligibility.map((entry) => [entry.teamId, entry]))
  const existingEligibility = await prisma.seasonTeamEligibility.findMany({ where: { seasonId } })
  const existingByTeamId = new Map(existingEligibility.map((entry) => [entry.teamId, entry]))

  const syncedTeams = await reconcileTeams([...nflTeams, ...collegeTeams])

  const returnedTeamIds = new Set(syncedTeams.map(({ team }) => team.id))

  return prisma.$transaction(async (tx) => {
    let approved = 0
    let review = 0
    let unchanged = 0
    let changed = 0
    let added = 0
    let removed = 0
    let overridden = 0

    const now = new Date()
    const unchangedEligibilityIds: string[] = []
    const changedEligibilityUpdates: Array<ReturnType<typeof tx.seasonTeamEligibility.update>> = []
    const newEligibilityRows: Prisma.SeasonTeamEligibilityCreateManyInput[] = []

    for (const { team, teamData } of syncedTeams) {
      const existing = existingByTeamId.get(team.id)
      const decision = teamData.league === 'NFL'
        ? {
            kind: 'UNCHANGED' as const,
            status: 'APPROVED' as const,
            source: 'SPORTSDATAIO',
            reviewReason: null,
            nameSnapshot: teamData.name,
            abbreviationSnapshot: teamData.abbreviation,
            conferenceSnapshot: teamData.conference,
            divisionSnapshot: teamData.division,
          }
        : resolveCollegeEligibilitySync({
            previous: previousByTeamId.get(team.id) ?? null,
            existing: existing ?? null,
            current: teamData,
          })

      if (decision.kind === 'OVERRIDDEN') overridden += 1
      else if (teamData.league === 'COLLEGE' && decision.kind === 'UNCHANGED') unchanged += 1
      else if (teamData.league === 'COLLEGE' && decision.kind === 'CHANGED') changed += 1
      else if (teamData.league === 'COLLEGE' && decision.kind === 'ADDED') added += 1

      const status = decision.status

      if (!existing) {
        newEligibilityRows.push({
          seasonId,
          teamId: team.id,
          status,
          source: decision.source,
          reviewReason: decision.reviewReason,
          nameSnapshot: decision.nameSnapshot,
          abbreviationSnapshot: decision.abbreviationSnapshot,
          conferenceSnapshot: decision.conferenceSnapshot,
          divisionSnapshot: decision.divisionSnapshot,
          leagueSnapshot: teamData.league,
          approvedAt: status === 'APPROVED' ? now : null,
        })
      } else if (decision.kind !== 'OVERRIDDEN') {
        const snapshotsChanged =
          existing.nameSnapshot !== decision.nameSnapshot ||
          existing.abbreviationSnapshot !== decision.abbreviationSnapshot ||
          existing.conferenceSnapshot !== decision.conferenceSnapshot ||
          existing.divisionSnapshot !== decision.divisionSnapshot ||
          existing.leagueSnapshot !== teamData.league

        if (!snapshotsChanged && decision.kind === 'UNCHANGED') {
          unchangedEligibilityIds.push(existing.id)
        } else {
          changedEligibilityUpdates.push(tx.seasonTeamEligibility.update({
            where: { id: existing.id },
            data: {
              status,
              source: decision.source,
              reviewReason: decision.reviewReason,
              nameSnapshot: decision.nameSnapshot,
              abbreviationSnapshot: decision.abbreviationSnapshot,
              conferenceSnapshot: decision.conferenceSnapshot,
              divisionSnapshot: decision.divisionSnapshot,
              leagueSnapshot: teamData.league,
              approvedAt: status === 'APPROVED' ? existing.approvedAt ?? now : null,
              approvedById: status === 'APPROVED' ? existing.approvedById : null,
            },
          }))
        }
      }

      if (status === 'APPROVED') approved += 1
      else if (status === 'REVIEW') review += 1
    }

    if (unchangedEligibilityIds.length > 0) {
      await tx.seasonTeamEligibility.updateMany({
        where: { id: { in: unchangedEligibilityIds } },
        data: {
          status: 'APPROVED',
          source: 'SPORTSDATAIO',
          reviewReason: null,
          approvedAt: now,
          approvedById: null,
        },
      })
    }
    if (newEligibilityRows.length > 0) {
      await tx.seasonTeamEligibility.createMany({ data: newEligibilityRows })
    }
    if (changedEligibilityUpdates.length > 0) {
      await Promise.all(changedEligibilityUpdates)
    }

    const removedEligibilityIds: string[] = []
    for (const existing of existingEligibility) {
      if (returnedTeamIds.has(existing.teamId)) continue
      if (existing.source === 'COMMISSIONER_OVERRIDE') {
        overridden += 1
        if (existing.status === 'APPROVED') approved += 1
        continue
      }
      removedEligibilityIds.push(existing.id)
      removed += 1
      review += 1
    }
    if (removedEligibilityIds.length > 0) {
      await tx.seasonTeamEligibility.updateMany({
        where: { id: { in: removedEligibilityIds } },
        data: {
          status: 'REVIEW',
          approvedAt: null,
          approvedById: null,
          reviewReason: 'Removed from the current SportsDataIO FBS hierarchy',
        },
      })
    }

    await tx.auditEvent.create({
      data: {
        poolId,
        seasonId,
        actorUserId,
        action: 'SEASON_ELIGIBILITY_SYNCED',
        entityType: 'Season',
        entityId: seasonId,
        data: {
          nflCount: nflTeams.length,
          collegeCount: collegeTeams.length,
          approved,
          review,
          unchanged,
          changed,
          added,
          removed,
          overridden,
        },
      },
    })

    return {
      nflCount: nflTeams.length,
      collegeCount: collegeTeams.length,
      approved,
      review,
      unchanged,
      changed,
      added,
      removed,
      overridden,
    }
  }, { maxWait: 10_000, timeout: 20_000 })
}

export async function setEligibilityStatus(input: {
  seasonId: string
  eligibilityId: string
  status: 'APPROVED' | 'INACTIVE'
  actorUserId: string
}) {
  const eligibility = await prisma.seasonTeamEligibility.findUnique({
    where: { id: input.eligibilityId },
    include: { season: true },
  })
  if (!eligibility || eligibility.seasonId !== input.seasonId || !eligibility.season.poolId) {
    throw new DraftRuleError('Eligibility record not found', 'NOT_FOUND', 404)
  }
  if (eligibility.season.status === 'FINALIZED') {
    throw new DraftRuleError(
      'Reopen the finalized season before changing its team pool',
      'SEASON_FINALIZED',
      409,
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.seasonTeamEligibility.update({
      where: { id: eligibility.id },
      data: {
        status: input.status,
        approvedAt: input.status === 'APPROVED' ? new Date() : null,
        approvedById: input.actorUserId,
      },
    })
    await tx.auditEvent.create({
      data: {
        poolId: eligibility.season.poolId!,
        seasonId: input.seasonId,
        actorUserId: input.actorUserId,
        action: `TEAM_ELIGIBILITY_${input.status}`,
        entityType: 'SeasonTeamEligibility',
        entityId: eligibility.id,
        data: { teamId: eligibility.teamId },
      },
    })
    return updated
  })
}

export async function overrideSeasonEligibility(input: {
  seasonId: string
  eligibilityId: string
  status: unknown
  conference: unknown
  note: unknown
  actorUserId: string
}) {
  let correction: ReturnType<typeof normalizeEligibilityOverride>
  try {
    correction = normalizeEligibilityOverride(input)
  } catch (error) {
    throw new DraftRuleError(
      error instanceof Error ? error.message : 'Invalid correction',
      'INVALID_ELIGIBILITY_OVERRIDE',
      400,
    )
  }

  const eligibility = await prisma.seasonTeamEligibility.findUnique({
    where: { id: input.eligibilityId },
    include: { season: true },
  })
  if (!eligibility || eligibility.seasonId !== input.seasonId || !eligibility.season.poolId) {
    throw new DraftRuleError('Eligibility record not found', 'NOT_FOUND', 404)
  }
  if (eligibility.season.status === 'FINALIZED') {
    throw new DraftRuleError(
      'Reopen the finalized season before changing its team pool',
      'SEASON_FINALIZED',
      409,
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.seasonTeamEligibility.update({
      where: { id: eligibility.id },
      data: {
        status: correction.status,
        source: 'COMMISSIONER_OVERRIDE',
        conferenceSnapshot: correction.conference,
        reviewReason: `Commissioner correction: ${correction.note}`,
        approvedAt: correction.status === 'APPROVED' ? new Date() : null,
        approvedById: input.actorUserId,
      },
    })
    await tx.auditEvent.create({
      data: {
        poolId: eligibility.season.poolId!,
        seasonId: input.seasonId,
        actorUserId: input.actorUserId,
        action: 'TEAM_ELIGIBILITY_OVERRIDDEN',
        entityType: 'SeasonTeamEligibility',
        entityId: eligibility.id,
        data: {
          teamId: eligibility.teamId,
          previous: {
            status: eligibility.status,
            conference: eligibility.conferenceSnapshot,
            source: eligibility.source,
          },
          next: { status: correction.status, conference: correction.conference },
          reason: correction.note,
        },
      },
    })
    return updated
  })
}
