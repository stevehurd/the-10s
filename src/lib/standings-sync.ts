import { prisma } from '@/lib/db'
import {
  fetchCollegePostseasonStandings,
  fetchCollegeStandings,
  fetchNFLPostseasonStandings,
  fetchNFLStandings,
} from '@/lib/sportsdata'
import {
  combineRegularAndPostseasonStandings,
  type CombinedStanding,
} from '@/lib/standings-calculation'

async function syncStanding(
  seasonId: string,
  standing: CombinedStanding,
  league: 'NFL' | 'COLLEGE',
) {
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

  await prisma.$transaction(async (tx) => {
    const season = await tx.season.findUnique({
      where: { id: seasonId },
      select: { status: true, finalizedAt: true },
    })
    if (!season) throw new Error('Season not found')
    if (season.finalizedAt) throw new Error('Completed season standings are frozen')

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
        sourceUpdatedAt: new Date(),
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
        source: 'SPORTSDATAIO',
        sourceUpdatedAt: new Date(),
      },
    })
    if (season.status === 'ACTIVE') {
      await tx.team.update({
        where: { id: team.id },
        data: { wins: standing.Wins, losses: standing.Losses, ties: standing.Ties ?? 0 },
      })
    }
  })
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
      for (const standing of combined) {
        try {
          await syncStanding(season.id, standing, 'NFL')
          updatedTeams += 1
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
        }
      }
      results.push(`NFL: ${combined.length} records (${postseason.length} postseason records)`)
    } catch (error) {
      errors.push(`NFL feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (league === 'COLLEGE' || league === 'BOTH') {
    try {
      const [regular, postseason] = await Promise.all([
        fetchCollegeStandings(season.year),
        fetchCollegePostseasonStandings(season.year),
      ])
      const combined = combineRegularAndPostseasonStandings(regular, postseason)
      for (const standing of combined) {
        try {
          await syncStanding(season.id, standing, 'COLLEGE')
          updatedTeams += 1
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error))
        }
      }
      results.push(`College: ${combined.length} records (${postseason.length} postseason records)`)
    } catch (error) {
      errors.push(`College feed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { updatedTeams, results, errors }
}
