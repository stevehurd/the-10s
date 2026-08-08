import { prisma } from '@/lib/db'
import { fetchCollegeTeams, fetchNFLTeams, type TeamSyncData } from '@/lib/team-data'
import { DraftRuleError } from '@/lib/draft/service'

function changeReason(
  previous: {
    nameSnapshot: string
    abbreviationSnapshot: string
    conferenceSnapshot: string | null
    divisionSnapshot: string | null
  } | null,
  current: TeamSyncData,
) {
  if (!previous) return 'New team compared with the previous season'

  const changes: string[] = []
  if (previous.nameSnapshot !== current.name) changes.push('name changed')
  if (previous.abbreviationSnapshot !== current.abbreviation) changes.push('abbreviation changed')
  if (previous.conferenceSnapshot !== current.conference) changes.push('conference changed')
  if (previous.divisionSnapshot !== current.division) changes.push('division changed')
  return changes.length > 0 ? changes.join(', ') : 'Annual eligibility review required'
}

async function upsertTeam(teamData: TeamSyncData) {
  const existing = await prisma.team.findFirst({
    where: {
      OR: [
        ...(teamData.sportsDataGlobalTeamId
          ? [
              { sportsDataGlobalTeamId: teamData.sportsDataGlobalTeamId },
              { externalId: teamData.sportsDataGlobalTeamId },
            ]
          : []),
        ...(teamData.sportsDataTeamId
          ? [{ sportsDataTeamId: teamData.sportsDataTeamId, league: teamData.league }]
          : []),
        { name: teamData.name, league: teamData.league },
      ],
    },
  })

  const data = {
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

  return existing
    ? prisma.team.update({ where: { id: existing.id }, data })
    : prisma.team.create({ data })
}

export async function syncSeasonEligibility(seasonId: string, actorUserId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { previousSeason: true },
  })
  if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
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

  const syncedTeams: Array<{
    team: Awaited<ReturnType<typeof upsertTeam>>
    teamData: TeamSyncData
  }> = []
  for (const teamData of [...nflTeams, ...collegeTeams]) {
    const team = await upsertTeam(teamData)
    syncedTeams.push({ team, teamData })
  }

  const returnedTeamIds = new Set(syncedTeams.map(({ team }) => team.id))

  return prisma.$transaction(async (tx) => {
    let pending = 0
    let approved = 0
    let review = 0

    for (const { team, teamData } of syncedTeams) {
      const existing = existingByTeamId.get(team.id)
      const reason = changeReason(previousByTeamId.get(team.id) ?? null, teamData)
      const hasMaterialChange = reason !== 'Annual eligibility review required'
      let status =
        teamData.league === 'NFL' ? 'APPROVED' : hasMaterialChange ? 'REVIEW' : 'PENDING'
      if (existing?.status === 'APPROVED' && !hasMaterialChange) status = 'APPROVED'

      await tx.seasonTeamEligibility.upsert({
        where: { seasonId_teamId: { seasonId, teamId: team.id } },
        update: {
          status,
          reviewReason: teamData.league === 'NFL' ? null : reason,
          nameSnapshot: teamData.name,
          abbreviationSnapshot: teamData.abbreviation,
          conferenceSnapshot: teamData.conference,
          divisionSnapshot: teamData.division,
          leagueSnapshot: teamData.league,
          approvedAt: status === 'APPROVED' ? (existing?.approvedAt ?? new Date()) : null,
          approvedById: status === 'APPROVED' ? existing?.approvedById : null,
        },
        create: {
          seasonId,
          teamId: team.id,
          status,
          source: 'SPORTSDATAIO',
          reviewReason: teamData.league === 'NFL' ? null : reason,
          nameSnapshot: teamData.name,
          abbreviationSnapshot: teamData.abbreviation,
          conferenceSnapshot: teamData.conference,
          divisionSnapshot: teamData.division,
          leagueSnapshot: teamData.league,
          approvedAt: teamData.league === 'NFL' ? new Date() : null,
        },
      })

      if (status === 'APPROVED') approved += 1
      else if (status === 'REVIEW') review += 1
      else pending += 1
    }

    for (const existing of existingEligibility) {
      if (returnedTeamIds.has(existing.teamId)) continue
      await tx.seasonTeamEligibility.update({
        where: { id: existing.id },
        data: {
          status: 'REVIEW',
          reviewReason: 'Team was not returned by the current SportsDataIO team feed',
        },
      })
      review += 1
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
          pending,
          review,
        },
      },
    })

    return { nflCount: nflTeams.length, collegeCount: collegeTeams.length, approved, pending, review }
  })
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

export async function approveEligibilityBatch(input: {
  seasonId: string
  eligibilityIds: string[]
  actorUserId: string
}) {
  if (input.eligibilityIds.length === 0) {
    throw new DraftRuleError('Choose at least one eligibility record', 'EMPTY_SELECTION')
  }

  const season = await prisma.season.findUnique({ where: { id: input.seasonId } })
  if (!season?.poolId) throw new DraftRuleError('Season not found', 'NOT_FOUND', 404)
  const poolId = season.poolId

  const matching = await prisma.seasonTeamEligibility.count({
    where: { seasonId: input.seasonId, id: { in: input.eligibilityIds } },
  })
  if (matching !== input.eligibilityIds.length) {
    throw new DraftRuleError('One or more eligibility records are invalid', 'INVALID_SELECTION')
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.seasonTeamEligibility.updateMany({
      where: { seasonId: input.seasonId, id: { in: input.eligibilityIds } },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedById: input.actorUserId },
    })
    await tx.auditEvent.create({
      data: {
        poolId,
        seasonId: input.seasonId,
        actorUserId: input.actorUserId,
        action: 'TEAM_ELIGIBILITY_BATCH_APPROVED',
        entityType: 'SeasonTeamEligibility',
        data: { ids: input.eligibilityIds, count: result.count },
      },
    })
    return result
  })
}
