export type HarnessRoster = {
  participantId: string
  participantName: string
  keptLeagues: string[]
  selectedLeagues: string[]
}

export function validateHarnessRosters(rosters: HarnessRoster[]) {
  const issues: string[] = []
  for (const roster of rosters) {
    const leagues = [...roster.keptLeagues, ...roster.selectedLeagues]
    const nflCount = leagues.filter((league) => league === 'NFL').length
    const collegeCount = leagues.filter((league) => league === 'COLLEGE').length
    if (leagues.length !== 10) {
      issues.push(`${roster.participantName} has ${leagues.length} teams instead of 10`)
    }
    if (nflCount !== 2 || collegeCount !== 8) {
      issues.push(`${roster.participantName} has ${nflCount} NFL and ${collegeCount} college teams`)
    }
  }
  return issues
}

export function evaluateConcurrentPick(input: {
  beforeSelections: number
  afterSelections: number
  beforeRevision: number
  afterRevision: number
  fulfilled: number
  rejected: number
}) {
  return [
    { label: 'Exactly one competing request committed', passed: input.fulfilled === 1 && input.rejected === 1 },
    { label: 'Exactly one selection was added', passed: input.afterSelections === input.beforeSelections + 1 },
    { label: 'Draft revision advanced exactly once', passed: input.afterRevision === input.beforeRevision + 1 },
  ]
}
