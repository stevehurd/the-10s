import { prisma } from '@/lib/db'
import { loadValidatedStandings } from '@/lib/standings-sync'
import { mapStandingsToTeams } from '@/lib/standings-team-mapping'
import {
  compareSeasonRecords,
  type ComparableTeamRecord,
  type StandingDiscrepancy,
  validationRunStatus,
} from '@/lib/standings-validation'

export async function validateHistoricalStandings(
  seasonId: string,
  actorUserId: string,
) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      teamRecords: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              league: true,
              sportsDataTeamId: true,
              externalId: true,
            },
          },
        },
      },
    },
  })
  if (!season?.poolId) throw new Error('Season not found')
  const catalogTeams = await prisma.team.findMany({
    where: { league: { in: ['NFL', 'COLLEGE'] } },
    select: {
      id: true,
      name: true,
      abbreviation: true,
      league: true,
      sportsDataTeamId: true,
      externalId: true,
    },
  })

  const run = await prisma.standingsSyncRun.create({
    data: {
      seasonId,
      requestedByUserId: actorUserId,
      requestedLeague: 'BOTH',
      trigger: 'VALIDATION',
    },
  })
  const messages: string[] = []
  const errors: string[] = []
  const discrepancies: StandingDiscrepancy[] = []
  let matchedTeams = 0
  let nflRecords = 0
  let collegeRecords = 0

  for (const league of ['NFL', 'COLLEGE'] as const) {
    try {
      const loaded = await loadValidatedStandings(season.year, league)
      const teams = catalogTeams.filter((team) => team.league === league)
      const mapped = mapStandingsToTeams(loaded.standings, teams)
      const calculated: ComparableTeamRecord[] = mapped.map(({ standing, team }) => ({
        teamId: team.id,
        teamName: team.name,
        league,
        wins: standing.Wins,
        losses: standing.Losses,
        ties: standing.Ties ?? 0,
      }))
      const stored: ComparableTeamRecord[] = season.teamRecords
        .filter((record) => record.team.league === league)
        .map((record) => ({
          teamId: record.team.id,
          teamName: record.team.name,
          league,
          wins: record.wins,
          losses: record.losses,
          ties: record.ties,
        }))
      const comparison = compareSeasonRecords(calculated, stored)
      matchedTeams += comparison.matchedTeams
      discrepancies.push(...comparison.discrepancies)
      if (league === 'NFL') nflRecords = calculated.length
      else collegeRecords = calculated.length
      messages.push(loaded.summary)
    } catch (error) {
      errors.push(`${league === 'NFL' ? 'NFL' : 'College'} validation: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const comparedTeams = matchedTeams + discrepancies.filter((entry) => entry.kind === 'MISMATCH').length
  const status = validationRunStatus({
    comparedTeams,
    errorCount: errors.length,
    discrepancyCount: discrepancies.length,
  })
  messages.push(`${matchedTeams} teams match the preserved ${season.year} totals`)
  messages.push('Read-only comparison: 0 standings records changed')
  if (discrepancies.length > 0) messages.push(`${discrepancies.length} differences require review`)
  const retainedDetails = discrepancies.slice(0, 30).map(formatDiscrepancy)
  if (discrepancies.length > retainedDetails.length) {
    retainedDetails.push(`${discrepancies.length - retainedDetails.length} additional differences omitted from history`)
  }
  const completedAt = new Date()

  await prisma.$transaction([
    prisma.standingsSyncRun.update({
      where: { id: run.id },
      data: {
        status,
        updatedTeams: 0,
        nflRecords,
        collegeRecords,
        messages: [...messages, ...retainedDetails],
        errors,
        completedAt,
      },
    }),
    prisma.auditEvent.create({
      data: {
        poolId: season.poolId,
        seasonId,
        actorUserId,
        action: 'STANDINGS_VALIDATION_FINISHED',
        entityType: 'StandingsSyncRun',
        entityId: run.id,
        data: {
          status,
          matchedTeams,
          discrepancyCount: discrepancies.length,
          errorCount: errors.length,
          nflRecords,
          collegeRecords,
          recordsChanged: 0,
        },
      },
    }),
  ])

  return {
    runId: run.id,
    status,
    year: season.year,
    matchedTeams,
    comparedTeams,
    nflRecords,
    collegeRecords,
    discrepancies,
    results: messages,
    errors,
    completedAt,
    recordsChanged: 0,
  }
}

function formatDiscrepancy(discrepancy: StandingDiscrepancy) {
  if (discrepancy.kind === 'MISSING_STORED') return `${discrepancy.teamName}: missing preserved record`
  if (discrepancy.kind === 'MISSING_PROVIDER') return `${discrepancy.teamName}: missing from SportsDataIO result`
  return `${discrepancy.teamName}: SportsDataIO ${recordLabel(discrepancy.calculated)} · preserved ${recordLabel(discrepancy.stored)}`
}

function recordLabel(record: StandingDiscrepancy['stored']) {
  return record ? `${record.wins}-${record.losses}-${record.ties}` : '—'
}
