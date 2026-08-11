import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { compareStandings } from '@/lib/standings-ranking'

const STRESS_SEASONS = [2022, 2023, 2024] as const

function recordFor(team: { league: string }, index: number, offset: number) {
  if (team.league === 'NFL') {
    const wins = 2 + ((index * 3 + offset) % 14)
    const ties = index % 17 === 0 ? 1 : 0
    return { wins, losses: Math.max(0, 17 - wins - ties), ties }
  }
  const wins = 2 + ((index * 5 + offset) % 12)
  return { wins, losses: Math.max(0, 13 - wins), ties: 0 }
}

export async function seedDashboardStressTestSeasons(input: {
  poolId: string
  actorUserId: string
}) {
  return prisma.$transaction(async (tx) => {
    const pool = await tx.pool.findUnique({ where: { id: input.poolId } })
    if (!pool || pool.slug !== 'the-10s-development') {
      throw new Error('Dashboard stress-test data is restricted to the synthetic development pool')
    }

    const existing = await tx.season.findMany({
      where: { poolId: pool.id, year: { in: [...STRESS_SEASONS] } },
      select: { id: true, name: true, year: true },
    })
    const unexpected = existing.find((season) => !season.name.includes('UI Stress Test'))
    if (unexpected) {
      throw new Error(`Refusing to replace non-test season ${unexpected.year}: ${unexpected.name}`)
    }
    if (existing.length > 0) {
      await tx.season.deleteMany({ where: { id: { in: existing.map((season) => season.id) } } })
    }

    const templateSeason = await tx.season.findFirst({
      where: { poolId: pool.id, year: 2026 },
      select: { id: true },
    })
    if (!templateSeason) throw new Error('Seed the 2026 development season first')

    const participants = await tx.seasonParticipant.findMany({
      where: { seasonId: templateSeason.id },
      orderBy: [{ baseDraftOrder: 'asc' }, { createdAt: 'asc' }],
      select: { poolSeatId: true, userId: true },
    })
    if (participants.length !== 15) {
      throw new Error(`Expected 15 development participants; found ${participants.length}`)
    }

    const teams = await tx.team.findMany({ where: { active: true }, orderBy: [{ league: 'asc' }, { name: 'asc' }] })
    const nflTeams = teams.filter((team) => team.league === 'NFL').slice(0, 30)
    const collegeTeams = teams.filter((team) => team.league === 'COLLEGE').slice(0, 120)
    if (nflTeams.length !== 30 || collegeTeams.length !== 120) {
      throw new Error('Stress-test seasons require at least 30 NFL and 120 college teams')
    }
    const rosterTeams = [...nflTeams, ...collegeTeams]

    const completed = await tx.season.create({
      data: {
        poolId: pool.id,
        year: 2022,
        name: '2022 UI Stress Test — Complete',
        status: 'FINALIZED',
        finalizedAt: new Date('2023-02-15T12:00:00.000Z'),
      },
    })
    const active = await tx.season.create({
      data: {
        poolId: pool.id,
        previousSeasonId: completed.id,
        year: 2023,
        name: '2023 UI Stress Test — In Season',
        status: 'ACTIVE',
      },
    })
    const preseason = await tx.season.create({
      data: {
        poolId: pool.id,
        previousSeasonId: active.id,
        year: 2024,
        name: '2024 UI Stress Test — Preseason',
        status: 'SETUP',
      },
    })
    const seasons = [completed, active, preseason]

    await tx.seasonTeamEligibility.createMany({
      data: seasons.flatMap((season) => teams.map((team) => ({
        seasonId: season.id,
        teamId: team.id,
        status: 'APPROVED',
        source: 'DASHBOARD_STRESS_TEST',
        nameSnapshot: team.name,
        abbreviationSnapshot: team.abbreviation,
        conferenceSnapshot: team.conference,
        divisionSnapshot: team.division,
        leagueSnapshot: team.league,
        approvedAt: new Date(),
      }))),
    })

    const recordsBySeason = new Map<string, Map<string, ReturnType<typeof recordFor>>>()
    for (const [seasonIndex, season] of seasons.entries()) {
      const records = new Map(
        teams.map((team, teamIndex) => [team.id, recordFor(team, teamIndex, seasonIndex * 4)]),
      )
      recordsBySeason.set(season.id, records)
      await tx.teamSeasonRecord.createMany({
        data: teams.map((team) => {
          const record = records.get(team.id)!
          return {
            seasonId: season.id,
            teamId: team.id,
            ...record,
            regularWins: record.wins,
            regularLosses: record.losses,
            source: 'DASHBOARD_STRESS_TEST',
            sourceUpdatedAt: new Date(),
            finalizedAt: season.status === 'FINALIZED' ? season.finalizedAt : null,
          }
        }),
      })
    }

    for (const season of seasons) {
      const records = recordsBySeason.get(season.id)!
      const participantTotals: Array<{
        participantId: string
        totalWins: number
        bestNflTeamWins: number
        bestCollegeTeamWins: number
        rankingName: string
      }> = []

      for (const [index, template] of participants.entries()) {
        const roster = [
          nflTeams[index * 2],
          nflTeams[index * 2 + 1],
          ...collegeTeams.slice(index * 8, index * 8 + 8),
        ]
        const submitted = season.id !== preseason.id || index % 3 !== 0
        const nflWins = roster.slice(0, 2).reduce((total, team) => total + records.get(team.id)!.wins, 0)
        const collegeWins = roster.slice(2).reduce((total, team) => total + records.get(team.id)!.wins, 0)
        const seasonParticipant = await tx.seasonParticipant.create({
          data: {
            seasonId: season.id,
            poolSeatId: template.poolSeatId,
            userId: template.userId,
            baseDraftOrder: index + 1,
            totalWins: season.id === preseason.id ? 0 : nflWins + collegeWins,
            nflWins: season.id === preseason.id ? 0 : nflWins,
            collegeWins: season.id === preseason.id ? 0 : collegeWins,
            decisionsSubmittedAt: submitted ? new Date(`${season.year}-08-20T12:00:00.000Z`) : null,
            decisionsLockedAt: season.id === preseason.id ? null : new Date(`${season.year}-08-25T12:00:00.000Z`),
          },
        })
        participantTotals.push({
          participantId: seasonParticipant.id,
          totalWins: nflWins + collegeWins,
          bestNflTeamWins: Math.max(...roster.slice(0, 2).map((team) => records.get(team.id)!.wins)),
          bestCollegeTeamWins: Math.max(...roster.slice(2).map((team) => records.get(team.id)!.wins)),
          rankingName: seasonParticipant.id,
        })

        await tx.rosterSlot.createMany({
          data: roster.map((team, slotIndex) => {
            const number = slotIndex + 1
            const released = season.id === preseason.id && submitted && [1, 3, 4].includes(number)
            return {
              seasonId: season.id,
              seasonParticipantId: seasonParticipant.id,
              number,
              teamId: released ? null : team.id,
              inheritedTeamId: season.id === preseason.id ? team.id : null,
              retentionChoice: season.id === preseason.id
                ? submitted
                  ? released ? 'RELEASE' : 'KEEP'
                  : 'PENDING'
                : 'KEEP',
              source: season.id === preseason.id ? released ? 'DRAFT' : 'KEEPER' : 'DRAFT',
              decisionAt: submitted ? new Date(`${season.year}-08-20T12:00:00.000Z`) : null,
              decisionByUserId: submitted ? template.userId : null,
            }
          }),
        })
      }

      if (season.id === completed.id) {
        const ranked = [...participantTotals].sort(compareStandings)
        for (const [rankIndex, result] of ranked.entries()) {
          await tx.seasonParticipant.update({
            where: { id: result.participantId },
            data: { finalRank: rankIndex + 1 },
          })
        }
      }
    }

    await tx.auditEvent.create({
      data: {
        poolId: pool.id,
        actorUserId: input.actorUserId,
        action: 'DASHBOARD_STRESS_TEST_SEASONS_SEEDED',
        entityType: 'Pool',
        entityId: pool.id,
        data: { years: [...STRESS_SEASONS], participantCount: participants.length, teamCount: rosterTeams.length },
      },
    })

    return { preseasonId: preseason.id, activeId: active.id, completedId: completed.id }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120_000 })
}
