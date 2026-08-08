export type RankedStanding = {
  totalWins: number
  bestNflTeamWins: number
  bestCollegeTeamWins: number
  rankingName: string
}

/**
 * League standings rank by total wins, then the strongest single NFL team,
 * then the strongest single college team. The name fallback only makes exact
 * ties deterministic; it is not a competitive tiebreaker.
 */
export function compareStandings(left: RankedStanding, right: RankedStanding) {
  return (
    right.totalWins - left.totalWins ||
    right.bestNflTeamWins - left.bestNflTeamWins ||
    right.bestCollegeTeamWins - left.bestCollegeTeamWins ||
    left.rankingName.localeCompare(right.rankingName)
  )
}
