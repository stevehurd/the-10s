export type RehearsalKeeperCandidate = {
  participantId: string
  rosterSlotId: string
  teamId: string
  league: 'NFL' | 'COLLEGE'
}

export type RehearsalKeeper = Omit<RehearsalKeeperCandidate, 'league'>

function randomReleaseCount(total: number, minimum: number, random: () => number) {
  if (total === 0) return 0
  const floor = Math.min(minimum, total)
  return floor + Math.floor(random() * (total - floor + 1))
}

function shuffled<T>(values: readonly T[], random: () => number) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function randomlySeedRehearsalKeepers(
  candidates: readonly RehearsalKeeperCandidate[],
  random: () => number = Math.random,
): RehearsalKeeper[] {
  const participantIds = [...new Set(candidates.map((candidate) => candidate.participantId))]
  return participantIds.flatMap((participantId) => {
    const participantCandidates = candidates.filter(
      (candidate) => candidate.participantId === participantId,
    )
    return (['NFL', 'COLLEGE'] as const).flatMap((league) => {
      const leagueCandidates = shuffled(
        participantCandidates.filter((candidate) => candidate.league === league),
        random,
      )
      const released = randomReleaseCount(
        leagueCandidates.length,
        league === 'NFL' ? 1 : 2,
        random,
      )
      return leagueCandidates.slice(released).map((keeper) => ({
        participantId: keeper.participantId,
        rosterSlotId: keeper.rosterSlotId,
        teamId: keeper.teamId,
      }))
    })
  })
}

export function parseRehearsalKeepers(data: unknown): RehearsalKeeper[] {
  if (!data || typeof data !== 'object' || !('keepers' in data) || !Array.isArray(data.keepers)) {
    return []
  }
  return data.keepers.flatMap((keeper) =>
    keeper &&
    typeof keeper === 'object' &&
    'participantId' in keeper && typeof keeper.participantId === 'string' &&
    'rosterSlotId' in keeper && typeof keeper.rosterSlotId === 'string' &&
    'teamId' in keeper && typeof keeper.teamId === 'string'
      ? [{
          participantId: keeper.participantId,
          rosterSlotId: keeper.rosterSlotId,
          teamId: keeper.teamId,
        }]
      : [],
  )
}
