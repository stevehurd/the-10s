import { prisma } from '@/lib/db'
import {
  fetchCollegeStandings,
  fetchNFLPostseasonStandings,
  fetchNFLStandings,
} from '@/lib/sportsdata'
import {
  type CombinedStanding,
  standingsMatchPreviousSeason,
  standingsSyncStatus,
  validateAndCombineNFLStandings,
} from '@/lib/standings-calculation'
import { mapStandingsToTeams } from '@/lib/standings-team-mapping'

export type StandingsLeague = 'NFL' | 'COLLEGE' | 'BOTH'
export type StandingsSyncTrigger = 'MANUAL' | 'CRON'


export async function loadValidatedStandings(
  year: number,
  league: 'NFL' | 'COLLEGE',
) {
  if (league === 'NFL') {
    const [regular, postseason] = await Promise.all([
      fetchNFLStandings(year),
      fetchNFLPostseasonStandings(year),
    ])
    const standings = validateAndCombineNFLStandings(year, regular, postseason)
    return {
      standings,
      summary: `NFL: ${standings.length} records (${postseason.length} postseason records)`,
    }
  }

  const standings = await fetchCollegeStandings(year)
  return {
    standings,
    summary: `College: ${standings.length} official aggregate standings records`,
  }
}

async function syncStandings(
  seasonId: string,
  standings: CombinedStanding[],
  league: 'NFL' | 'COLLEGE',
) {
  const teams = await prisma.team.findMany({
    where: { league },
    select: {
      id: true,
      name: true,
      abbreviation: true,
      sportsDataTeamId: true,
      externalId: true,
    },
  })
  const mapped = mapStandingsToTeams(standings, teams)

  await prisma.$transaction(async (tx) => {
    const season = await tx.season.findUnique({
      where: { id: seasonId },
      select: { status: true, finalizedAt: true, year: true, poolId: true },
    })
    if (!season) throw new Error('Season not found')
    if (season.finalizedAt) throw new Error('Completed season standings are frozen')

    if (league === 'COLLEGE') {
      const previousSeason = await tx.season.findFirst({
        where: { poolId: season.poolId, year: { lt: season.year } },
        orderBy: { year: 'desc' },
        select: {
          year: true,
          teamRecords: {
            where: { team: { league: 'COLLEGE' } },
            select: { teamId: true, wins: true, losses: true, ties: true },
          },
        },
      })
      const currentRecords = mapped.map(({ standing, team }) => ({
        teamId: team.id,
        wins: standing.Wins,
        losses: standing.Losses,
        ties: standing.Ties ?? 0,
      }))
      if (previousSeason && standingsMatchPreviousSeason(currentRecords, previousSeason.teamRecords)) {
        throw new Error(
          `SportsDataIO college standings still match ${previousSeason.year}; wait for the provider to roll over before syncing ${season.year}`,
        )
      }
    }

    const source = 'SPORTSDATAIO_STANDINGS'
    const sourceUpdatedAt = new Date()
    for (const { standing, team } of mapped) {
      await tx.teamSeasonRecord.upsert({
        where: { seasonId_teamId: { seasonId, teamId: team.id } },
        update: {
          wins: standing.Wins,
          losses: standing.Losses,
          ties: standing.Ties ?? 0,
          regularWins: standing.regularWins,
          regularLosses: standing.regularLosses,
          postseasonWins: standing.postseasonWins,
          postseasonLosses: standing.postseasonLosses,
          source,
          sourceUpdatedAt,
        },
        create: {
          seasonId,
          teamId: team.id,
          wins: standing.Wins,
          losses: standing.Losses,
          ties: standing.Ties ?? 0,
          regularWins: standing.regularWins,
          regularLosses: standing.regularLosses,
          postseasonWins: standing.postseasonWins,
          postseasonLosses: standing.postseasonLosses,
          source,
          sourceUpdatedAt,
        },
      })
      if (season.status === 'ACTIVE') {
        await tx.team.update({
          where: { id: team.id },
          data: { wins: standing.Wins, losses: standing.Losses, ties: standing.Ties ?? 0 },
        })
      }
    }
  }, { timeout: 30_000 })

  return mapped.length
}

export async function syncSeasonStandings(
  seasonId: string,
  league: StandingsLeague,
  options: {
    actorUserId?: string | null
    trigger?: StandingsSyncTrigger
  } = {},
) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  if (!season?.poolId) throw new Error('Season not found')
  if (season.finalizedAt) throw new Error('Completed season standings are frozen')

  const run = await prisma.standingsSyncRun.create({
    data: {
      seasonId,
      requestedByUserId: options.actorUserId ?? null,
      requestedLeague: league,
      trigger: options.trigger ?? 'MANUAL',
    },
  })
  const results: string[] = []
  const errors: string[] = []
  let updatedTeams = 0
  let nflRecords = 0
  let collegeRecords = 0

  if (league === 'NFL' || league === 'BOTH') {
    try {
      const loaded = await loadValidatedStandings(season.year, 'NFL')
      nflRecords = await syncStandings(season.id, loaded.standings, 'NFL')
      updatedTeams += nflRecords
      results.push(loaded.summary)
    } catch (error) {
      errors.push(`NFL feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (league === 'COLLEGE' || league === 'BOTH') {
    try {
      const loaded = await loadValidatedStandings(season.year, 'COLLEGE')
      collegeRecords = await syncStandings(season.id, loaded.standings, 'COLLEGE')
      updatedTeams += collegeRecords
      results.push(loaded.summary)
    } catch (error) {
      errors.push(`College feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const status = standingsSyncStatus(updatedTeams, errors.length)
  const completedAt = new Date()
  await prisma.$transaction([
    prisma.standingsSyncRun.update({
      where: { id: run.id },
      data: {
        status,
        updatedTeams,
        nflRecords,
        collegeRecords,
        messages: results,
        errors,
        completedAt,
      },
    }),
    prisma.auditEvent.create({
      data: {
        poolId: season.poolId,
        seasonId,
        actorUserId: options.actorUserId ?? null,
        action: 'STANDINGS_SYNC_FINISHED',
        entityType: 'StandingsSyncRun',
        entityId: run.id,
        data: {
          requestedLeague: league,
          trigger: options.trigger ?? 'MANUAL',
          status,
          updatedTeams,
          nflRecords,
          collegeRecords,
          errorCount: errors.length,
        },
      },
    }),
  ])

  return {
    runId: run.id,
    status,
    updatedTeams,
    nflRecords,
    collegeRecords,
    results,
    errors,
    completedAt,
  }
}
