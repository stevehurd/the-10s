import { prisma } from '@/lib/db'
import {
  fetchCollegeStandings,
  fetchNFLPostseasonStandings,
  fetchNFLStandings,
} from '@/lib/sportsdata'
import {
  combineRegularAndPostseasonStandings,
  type CombinedStanding,
} from '@/lib/standings-calculation'

async function syncStandings(
  seasonId: string,
  standings: CombinedStanding[],
  league: 'NFL' | 'COLLEGE',
) {
  const mapped = await Promise.all(standings.map(async (standing) => {
    const team = await prisma.team.findFirst({
      where: {
        league,
        OR: [
          { sportsDataTeamId: standing.TeamID.toString() },
          { abbreviation: standing.Key },
          { name: standing.Name },
          { name: standing.Team },
          // Legacy data stored one SportsData identifier in external_id.
          { externalId: standing.TeamID.toString() },
        ],
      },
    })
    if (!team) throw new Error(`Team not found: ${standing.Team} (${standing.Key})`)
    return { standing, team }
  }))

  await prisma.$transaction(async (tx) => {
    const season = await tx.season.findUnique({
      where: { id: seasonId },
      select: { status: true, finalizedAt: true },
    })
    if (!season) throw new Error('Season not found')
    if (season.finalizedAt) throw new Error('Completed season standings are frozen')

    const source = league === 'COLLEGE' ? 'SPORTSDATAIO_SCHEDULE' : 'SPORTSDATAIO_STANDINGS'
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
}

export async function syncSeasonStandings(
  seasonId: string,
  league: 'NFL' | 'COLLEGE' | 'BOTH',
) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } })
  if (!season) throw new Error('Season not found')
  if (season.finalizedAt) throw new Error('Completed season standings are frozen')

  const results: string[] = []
  const errors: string[] = []
  let updatedTeams = 0

  if (league === 'NFL' || league === 'BOTH') {
    try {
      const [regular, postseason] = await Promise.all([
        fetchNFLStandings(season.year),
        fetchNFLPostseasonStandings(season.year),
      ])
      const combined = combineRegularAndPostseasonStandings(regular, postseason)
      await syncStandings(season.id, combined, 'NFL')
      updatedTeams += combined.length
      results.push(`NFL: ${combined.length} records (${postseason.length} postseason records)`)
    } catch (error) {
      errors.push(`NFL feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (league === 'COLLEGE' || league === 'BOTH') {
    try {
      const calculated = await fetchCollegeStandings(season.year)
      await syncStandings(season.id, calculated, 'COLLEGE')
      updatedTeams += calculated.length
      const postseasonTeams = calculated.filter((standing) => standing.postseasonWins + standing.postseasonLosses + standing.postseasonTies > 0).length
      results.push(`College: ${calculated.length} game-derived records (${postseasonTeams} teams with postseason results)`)
    } catch (error) {
      errors.push(`College feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { updatedTeams, results, errors }
}
