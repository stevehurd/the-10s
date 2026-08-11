export interface ComparableTeamRecord {
  teamId: string
  teamName: string
  league: 'NFL' | 'COLLEGE'
  wins: number
  losses: number
  ties: number
}

export interface StandingDiscrepancy {
  teamId: string
  teamName: string
  league: 'NFL' | 'COLLEGE'
  kind: 'MISMATCH' | 'MISSING_STORED' | 'MISSING_PROVIDER'
  calculated: { wins: number; losses: number; ties: number } | null
  stored: { wins: number; losses: number; ties: number } | null
}

export function compareSeasonRecords(
  calculated: ComparableTeamRecord[],
  stored: ComparableTeamRecord[],
) {
  const calculatedByTeam = new Map(calculated.map((record) => [record.teamId, record]))
  const storedByTeam = new Map(stored.map((record) => [record.teamId, record]))
  const discrepancies: StandingDiscrepancy[] = []
  let matchedTeams = 0

  for (const record of calculated) {
    const storedRecord = storedByTeam.get(record.teamId)
    if (!storedRecord) {
      discrepancies.push({
        teamId: record.teamId,
        teamName: record.teamName,
        league: record.league,
        kind: 'MISSING_STORED',
        calculated: totals(record),
        stored: null,
      })
      continue
    }
    if (
      record.wins !== storedRecord.wins
      || record.losses !== storedRecord.losses
      || record.ties !== storedRecord.ties
    ) {
      discrepancies.push({
        teamId: record.teamId,
        teamName: record.teamName,
        league: record.league,
        kind: 'MISMATCH',
        calculated: totals(record),
        stored: totals(storedRecord),
      })
      continue
    }
    matchedTeams += 1
  }

  for (const record of stored) {
    if (calculatedByTeam.has(record.teamId)) continue
    discrepancies.push({
      teamId: record.teamId,
      teamName: record.teamName,
      league: record.league,
      kind: 'MISSING_PROVIDER',
      calculated: null,
      stored: totals(record),
    })
  }

  return { matchedTeams, discrepancies }
}

function totals(record: ComparableTeamRecord) {
  return { wins: record.wins, losses: record.losses, ties: record.ties }
}

export function validationRunStatus(input: {
  comparedTeams: number
  errorCount: number
  discrepancyCount: number
}) {
  if (input.comparedTeams === 0 && input.errorCount > 0) return 'FAILED' as const
  if (input.errorCount > 0) return 'PARTIAL' as const
  if (input.discrepancyCount > 0) return 'MISMATCH' as const
  return 'SUCCEEDED' as const
}
