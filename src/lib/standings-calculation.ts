import type { SportsDataStanding } from './sportsdata.ts'

export interface CombinedStanding extends SportsDataStanding {
  regularWins: number
  regularLosses: number
  postseasonWins: number
  postseasonLosses: number
}

export function combineRegularAndPostseasonStandings(
  regular: SportsDataStanding[],
  postseason: SportsDataStanding[],
): CombinedStanding[] {
  const combined = new Map<number, CombinedStanding>()

  for (const standing of regular) {
    combined.set(standing.TeamID, {
      ...standing,
      Ties: standing.Ties ?? 0,
      regularWins: standing.Wins,
      regularLosses: standing.Losses,
      postseasonWins: 0,
      postseasonLosses: 0,
    })
  }

  for (const standing of postseason) {
    const existing = combined.get(standing.TeamID)
    if (existing) {
      existing.Wins += standing.Wins
      existing.Losses += standing.Losses
      existing.Ties = (existing.Ties ?? 0) + (standing.Ties ?? 0)
      existing.postseasonWins += standing.Wins
      existing.postseasonLosses += standing.Losses
    } else {
      combined.set(standing.TeamID, {
        ...standing,
        Ties: standing.Ties ?? 0,
        regularWins: 0,
        regularLosses: 0,
        postseasonWins: standing.Wins,
        postseasonLosses: standing.Losses,
      })
    }
  }

  return [...combined.values()]
}
