import { PrismaClient } from '@prisma/client'
import { fetchDevelopmentSportsDataset } from './lib/development-sportsdata.mjs'

const prisma = new PrismaClient()
const developmentPoolSlug = 'the-10s-development'
const participantCount = 15

function requireDevelopmentConfirmation() {
  if (!process.argv.includes('--reset-development-pool')) {
    throw new Error('Refusing to seed without --reset-development-pool')
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed cannot run with NODE_ENV=production')
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }
  const commissionerEmail = process.env.DEVELOPMENT_COMMISSIONER_EMAIL?.trim().toLowerCase()
  if (!commissionerEmail || !commissionerEmail.includes('@')) {
    throw new Error('DEVELOPMENT_COMMISSIONER_EMAIL is required')
  }
  return commissionerEmail
}

function demoTeams() {
  const nfl = Array.from({ length: 32 }, (_, index) => ({
    name: `Demo NFL ${String(index + 1).padStart(2, '0')}`,
    abbreviation: `N${String(index + 1).padStart(2, '0')}`,
    league: 'NFL',
    conference: index < 16 ? 'AFC' : 'NFC',
    division: ['North', 'South', 'East', 'West'][index % 4],
  }))
  const college = Array.from({ length: 130 }, (_, index) => ({
    name: `Demo College ${String(index + 1).padStart(3, '0')}`,
    abbreviation: `C${String(index + 1).padStart(3, '0')}`,
    league: 'COLLEGE',
    conference: ['ACC', 'Big Ten', 'Big 12', 'SEC', 'Independent'][index % 5],
    division: null,
  }))
  return [...nfl, ...college]
}

async function seed() {
  const commissionerEmail = requireDevelopmentConfirmation()
  const useSportsData = process.argv.includes('--sportsdata')
  const teamFixtures = useSportsData
    ? await fetchDevelopmentSportsDataset(process.env.SPORTSDATA_API_KEY)
    : demoTeams()
  const source = useSportsData ? 'SPORTSDATAIO' : 'DEVELOPMENT_FIXTURE'

  const result = await prisma.$transaction(
    async (tx) => {
      const existingPool = await tx.pool.findUnique({ where: { slug: developmentPoolSlug } })
      if (existingPool) {
        await tx.season.deleteMany({ where: { poolId: existingPool.id } })
        await tx.pool.delete({ where: { id: existingPool.id } })
      }

      const pool = await tx.pool.create({
        data: { name: "The 10's Development", slug: developmentPoolSlug },
      })
      const teams = []
      for (const fixture of teamFixtures) {
        teams.push(
          await tx.team.upsert({
            where: { name_league: { name: fixture.name, league: fixture.league } },
            update: {
              name: fixture.name,
              abbreviation: fixture.abbreviation,
              league: fixture.league,
              conference: fixture.conference,
              division: fixture.division,
              externalId: fixture.externalId,
              sportsDataTeamId: fixture.sportsDataTeamId,
              sportsDataGlobalTeamId: fixture.sportsDataGlobalTeamId,
              logoUrl: fixture.logoUrl,
              active: true,
            },
            create: {
              name: fixture.name,
              abbreviation: fixture.abbreviation,
              league: fixture.league,
              conference: fixture.conference,
              division: fixture.division,
              externalId: fixture.externalId,
              sportsDataTeamId: fixture.sportsDataTeamId,
              sportsDataGlobalTeamId: fixture.sportsDataGlobalTeamId,
              logoUrl: fixture.logoUrl,
              active: true,
            },
          }),
        )
      }
      const nflTeams = teams.filter((team) => team.league === 'NFL')
      const collegeTeams = teams.filter((team) => team.league === 'COLLEGE')
      const recordByTeamId = new Map(
        teams.map((team, index) => [team.id, teamFixtures[index].record ?? null]),
      )
      const participantPlans = Array.from({ length: participantCount }, (_, index) => {
        const nflRoster = [nflTeams[index * 2], nflTeams[index * 2 + 1]]
        const collegeRoster = collegeTeams.slice(index * 8, index * 8 + 8)
        const winsFor = (team) => recordByTeamId.get(team.id)?.wins ?? 0
        const nflWins = nflRoster.reduce((total, team) => total + winsFor(team), 0)
        const collegeWins = collegeRoster.reduce((total, team) => total + winsFor(team), 0)
        return { index, nflRoster, collegeRoster, nflWins, collegeWins, totalWins: nflWins + collegeWins }
      })
      const rankedPlans = [...participantPlans].sort((left, right) =>
        right.totalWins - left.totalWins ||
        right.nflWins - left.nflWins ||
        right.collegeWins - left.collegeWins ||
        left.index - right.index,
      )
      const finalRankByIndex = new Map(rankedPlans.map((plan, rank) => [plan.index, rank + 1]))

      const previousSeason = await tx.season.create({
        data: {
          poolId: pool.id,
          year: 2025,
          name: '2025 Development Season',
          status: 'FINALIZED',
          finalizedAt: new Date('2026-02-15T12:00:00.000Z'),
        },
      })
      const currentSeason = await tx.season.create({
        data: {
          poolId: pool.id,
          previousSeasonId: previousSeason.id,
          year: 2026,
          name: '2026 Development Season',
          status: 'SETUP',
        },
      })

      await tx.seasonTeamEligibility.createMany({
        data: teams.flatMap((team) => [previousSeason, currentSeason].map((season) => ({
          seasonId: season.id,
          teamId: team.id,
          status: 'APPROVED',
          source,
          reviewReason: null,
          nameSnapshot: team.name,
          abbreviationSnapshot: team.abbreviation,
          conferenceSnapshot: team.conference,
          divisionSnapshot: team.division,
          leagueSnapshot: team.league,
          approvedAt: new Date(),
        }))),
      })
      await tx.teamSeasonRecord.createMany({
        data: teams.map((team, index) => {
          const record = teamFixtures[index].record
          const wins = record?.wins ?? (team.league === 'NFL' ? 5 + (index % 11) : 3 + (index % 12))
          const losses = record?.losses ?? Math.max(0, (team.league === 'NFL' ? 17 : 13) - wins)
          return {
            seasonId: previousSeason.id,
            teamId: team.id,
            wins,
            losses,
            ties: record?.ties ?? 0,
            regularWins: record?.regularWins ?? wins,
            regularLosses: record?.regularLosses ?? losses,
            postseasonWins: record?.postseasonWins ?? 0,
            postseasonLosses: record?.postseasonLosses ?? 0,
            source,
            sourceUpdatedAt: useSportsData ? new Date() : null,
            finalizedAt: previousSeason.finalizedAt,
          }
        }),
      })

      let commissionerUserId = ''
      for (let index = 0; index < participantCount; index += 1) {
        const plan = participantPlans[index]
        const email = index === 0
          ? commissionerEmail
          : `player${String(index + 1).padStart(2, '0')}@example.test`
        const user = await tx.user.upsert({
          where: { email },
          update: { name: `Demo Player ${index + 1}` },
          create: { name: `Demo Player ${index + 1}`, email },
        })
        if (index === 0) commissionerUserId = user.id
        await tx.poolMembership.create({
          data: {
            poolId: pool.id,
            userId: user.id,
            role: index === 0 ? 'COMMISSIONER' : 'MEMBER',
            status: 'ACTIVE',
          },
        })
        const seat = await tx.poolSeat.create({
          data: { poolId: pool.id, label: `Seat ${index + 1}` },
        })
        const roster = [...plan.nflRoster, ...plan.collegeRoster]
        const finalRank = finalRankByIndex.get(index)
        const previousParticipant = await tx.seasonParticipant.create({
          data: {
            seasonId: previousSeason.id,
            poolSeatId: seat.id,
            userId: user.id,
            baseDraftOrder: index + 1,
            finalRank,
            nflWins: plan.nflWins,
            collegeWins: plan.collegeWins,
            totalWins: plan.totalWins,
            decisionsSubmittedAt: new Date('2025-08-20T12:00:00.000Z'),
            decisionsLockedAt: new Date('2025-08-25T12:00:00.000Z'),
          },
        })
        await tx.rosterSlot.createMany({
          data: roster.map((team, slotIndex) => ({
            seasonId: previousSeason.id,
            seasonParticipantId: previousParticipant.id,
            number: slotIndex + 1,
            teamId: team.id,
            source: 'DRAFT',
            retentionChoice: 'KEEP',
          })),
        })

        const currentParticipant = await tx.seasonParticipant.create({
          data: {
            seasonId: currentSeason.id,
            poolSeatId: seat.id,
            userId: user.id,
            baseDraftOrder: participantCount - finalRank + 1,
            decisionsSubmittedAt: new Date(),
          },
        })
        await tx.rosterSlot.createMany({
          data: roster.map((team, slotIndex) => {
            const number = slotIndex + 1
            const released = number === 1 || number === 3 || number === 4
            return {
              seasonId: currentSeason.id,
              seasonParticipantId: currentParticipant.id,
              number,
              teamId: released ? null : team.id,
              inheritedTeamId: team.id,
              retentionChoice: released ? 'RELEASE' : 'KEEP',
              source: released ? 'DRAFT' : 'KEEPER',
              decisionAt: new Date(),
              decisionByUserId: user.id,
            }
          }),
        })
      }

      await tx.auditEvent.create({
        data: {
          poolId: pool.id,
          seasonId: currentSeason.id,
          actorUserId: commissionerUserId,
          action: 'DEVELOPMENT_POOL_SEEDED',
          entityType: 'Pool',
          entityId: pool.id,
          data: { participantCount, teamCount: teams.length, source },
        },
      })

      return { pool: pool.name, previousSeason: previousSeason.name, currentSeason: currentSeason.name, participantCount, teamCount: teams.length }
    },
    { timeout: 120_000 },
  )

  console.log(`Seeded ${result.pool}`)
  console.log(`${result.participantCount} participants, ${result.teamCount} teams`)
  console.log(`${result.previousSeason} -> ${result.currentSeason}`)
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Development seed failed')
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
