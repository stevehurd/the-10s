import type { SportsDataGame, SportsDataStanding } from './sportsdata.ts'

export interface CombinedStanding extends SportsDataStanding {
  regularWins: number
  regularLosses: number
  regularTies: number
  postseasonWins: number
  postseasonLosses: number
  postseasonTies: number
}

export interface CollegeStandingTeam {
  TeamID: number
  GlobalTeamID?: number
  Key: string
  School?: string | null
  Name?: string | null
  Active?: boolean
}

export function standingsSyncStatus(updatedTeams: number, errorCount: number) {
  if (errorCount === 0) return 'SUCCEEDED' as const
  return updatedTeams > 0 ? 'PARTIAL' as const : 'FAILED' as const
}

export function standingsMatchPreviousSeason(
  current: Array<{ teamId: string; wins: number; losses: number; ties: number }>,
  previous: Array<{ teamId: string; wins: number; losses: number; ties: number }>,
) {
  if (current.length === 0 || current.length !== previous.length) return false
  const previousByTeam = new Map(previous.map((record) => [record.teamId, record]))
  return current.every((record) => {
    const prior = previousByTeam.get(record.teamId)
    return prior != null
      && prior.wins === record.wins
      && prior.losses === record.losses
      && prior.ties === record.ties
  })
}

function validateStandingRows(
  label: string,
  season: number,
  rows: SportsDataStanding[],
) {
  const seenTeamIds = new Set<number>()
  for (const row of rows) {
    if (row.Season !== season) {
      throw new Error(`${label} contained ${row.Team || row.Key} from season ${row.Season}`)
    }
    if (!Number.isInteger(row.TeamID) || row.TeamID <= 0) {
      throw new Error(`${label} contained an invalid team ID`)
    }
    if (seenTeamIds.has(row.TeamID)) {
      throw new Error(`${label} contained duplicate team ID ${row.TeamID}`)
    }
    seenTeamIds.add(row.TeamID)
    for (const [field, value] of [
      ['wins', row.Wins],
      ['losses', row.Losses],
      ['ties', row.Ties ?? 0],
    ] as const) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label} contained invalid ${field} for ${row.Team || row.Key}`)
      }
    }
  }
}

/**
 * Validates the season-scoped NFL feeds before any database write. The regular
 * feed must contain the complete 32-team league; postseason rows may be empty
 * or contain only teams already present in the regular feed.
 */
export function validateAndCombineNFLStandings(
  season: number,
  regular: SportsDataStanding[],
  postseason: SportsDataStanding[],
  expectedTeamCount = 32,
): CombinedStanding[] {
  validateStandingRows('NFL regular-season standings', season, regular)
  validateStandingRows('NFL postseason standings', season, postseason)
  if (regular.length === 0) {
    throw new Error(`NFL regular-season standings are not available yet for ${season}`)
  }
  if (regular.length !== expectedTeamCount) {
    throw new Error(`NFL regular-season standings returned ${regular.length} teams; expected ${expectedTeamCount}`)
  }

  const regularTeamIds = new Set(regular.map((standing) => standing.TeamID))
  const unknownPostseason = postseason.find((standing) => (
    !regularTeamIds.has(standing.TeamID)
    && standing.Wins + standing.Losses + (standing.Ties ?? 0) > 0
  ))
  if (unknownPostseason) {
    throw new Error(`NFL postseason standings contained unknown team ${unknownPostseason.Team || unknownPostseason.Key}`)
  }

  const combined = combineRegularAndPostseasonStandings(regular, postseason)
  const implausible = combined.find((standing) => (
    standing.Wins + standing.Losses + (standing.Ties ?? 0) > 25
  ))
  if (implausible) {
    throw new Error(`NFL standings contained an implausible record for ${implausible.Team || implausible.Key}`)
  }
  return combined
}

/**
 * College records are published as separate regular-season and postseason
 * TeamSeason feeds. Validate both snapshots before combining them so a partial
 * or malformed provider response can never overwrite a season.
 */
export function validateAndCombineCollegeStandings(
  season: number,
  regular: SportsDataStanding[],
  postseason: SportsDataStanding[],
  expectedTeamRange: readonly [number, number] = [120, 160],
): CombinedStanding[] {
  validateStandingRows('College regular-season standings', season, regular)
  validateStandingRows('College postseason standings', season, postseason)
  const [minimumTeams, maximumTeams] = expectedTeamRange
  if (regular.length < minimumTeams || regular.length > maximumTeams) {
    throw new Error(
      `College regular-season standings returned ${regular.length} teams; expected ${minimumTeams}-${maximumTeams}`,
    )
  }

  const regularTeamIds = new Set(regular.map((standing) => standing.TeamID))
  const unknownPostseason = postseason.find((standing) => !regularTeamIds.has(standing.TeamID))
  if (unknownPostseason) {
    throw new Error(
      `College postseason standings contained unknown team ${unknownPostseason.Team || unknownPostseason.Key}`,
    )
  }

  const combined = combineRegularAndPostseasonStandings(regular, postseason)
  const implausible = combined.find((standing) => (
    standing.Wins + standing.Losses + (standing.Ties ?? 0) > 25
  ))
  if (implausible) {
    throw new Error(`College standings contained an implausible record for ${implausible.Team || implausible.Key}`)
  }
  return combined
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
      regularTies: standing.Ties ?? 0,
      postseasonWins: 0,
      postseasonLosses: 0,
      postseasonTies: 0,
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
      existing.postseasonTies += standing.Ties ?? 0
    } else {
      combined.set(standing.TeamID, {
        ...standing,
        Ties: standing.Ties ?? 0,
        regularWins: 0,
        regularLosses: 0,
        regularTies: 0,
        postseasonWins: standing.Wins,
        postseasonLosses: standing.Losses,
        postseasonTies: standing.Ties ?? 0,
      })
    }
  }

  return [...combined.values()]
}

const COUNTED_SEASON_TYPES = new Set([1, 3])
const FINAL_STATUSES = new Set(['Final', 'F/OT', 'Forfeit'])

/**
 * Builds a season record from final games instead of the unversioned hierarchy
 * totals. SportsDataIO uses SeasonType 1 for regular season and 3 for
 * postseason. Conference championships are counted wherever the feed places
 * them; bowls and CFP games are postseason.
 */
export function calculateCollegeStandingsFromGames(
  season: number,
  teams: CollegeStandingTeam[],
  games: SportsDataGame[],
): CombinedStanding[] {
  const records = new Map<number, CombinedStanding>()

  for (const team of teams) {
    if (team.Active === false) continue
    if (records.has(team.TeamID)) throw new Error(`Duplicate college team ID ${team.TeamID}`)
    const displayName = [team.School, team.Name].filter(Boolean).join(' ') || team.Key
    records.set(team.TeamID, {
      Season: season,
      SeasonType: 1,
      TeamID: team.TeamID,
      GlobalTeamID: team.GlobalTeamID ?? team.TeamID,
      Key: team.Key,
      Name: team.Name || team.School || team.Key,
      Team: displayName,
      Wins: 0,
      Losses: 0,
      Ties: 0,
      ConferenceWins: 0,
      ConferenceLosses: 0,
      regularWins: 0,
      regularLosses: 0,
      regularTies: 0,
      postseasonWins: 0,
      postseasonLosses: 0,
      postseasonTies: 0,
    })
  }

  const seenGames = new Set<number>()
  for (const game of games) {
    if (game.Season !== season) {
      throw new Error(`SportsDataIO schedule for ${season} contained game ${game.GameID} from ${game.Season}`)
    }
    if (seenGames.has(game.GameID)) throw new Error(`Duplicate SportsDataIO game ${game.GameID}`)
    seenGames.add(game.GameID)
    if (!COUNTED_SEASON_TYPES.has(game.SeasonType) || !FINAL_STATUSES.has(game.Status)) continue

    const away = records.get(game.AwayTeamID)
    const home = records.get(game.HomeTeamID)
    if (!away && !home) continue
    if (game.AwayTeamID === game.HomeTeamID) throw new Error(`Game ${game.GameID} has the same home and away team`)

    const awayScore = game.AwayTeamScore ?? game.AwayScore
    const homeScore = game.HomeTeamScore ?? game.HomeScore
    const split = game.SeasonType === 3 ? 'postseason' : 'regular'

    if (awayScore == null || homeScore == null) {
      const winnerId = game.Winner === game.AwayTeam ? game.AwayTeamID : game.Winner === game.HomeTeam ? game.HomeTeamID : null
      if (game.Status !== 'Forfeit' || winnerId == null) {
        throw new Error(`Final college game ${game.GameID} is missing a usable score`)
      }
      applyResult(away, home, winnerId, split)
      continue
    }
    if (!Number.isInteger(awayScore) || !Number.isInteger(homeScore) || awayScore < 0 || homeScore < 0) {
      throw new Error(`Final college game ${game.GameID} has an invalid score`)
    }
    if (awayScore === homeScore) {
      applyTie(away, split)
      applyTie(home, split)
    } else {
      applyResult(away, home, awayScore > homeScore ? game.AwayTeamID : game.HomeTeamID, split)
    }
  }

  return [...records.values()]
}

function applyTie(record: CombinedStanding | undefined, split: 'regular' | 'postseason') {
  if (!record) return
  record.Ties = (record.Ties ?? 0) + 1
  if (split === 'postseason') record.postseasonTies += 1
  else record.regularTies += 1
}

function applyResult(
  away: CombinedStanding | undefined,
  home: CombinedStanding | undefined,
  winnerId: number,
  split: 'regular' | 'postseason',
) {
  for (const record of [away, home]) {
    if (!record) continue
    const won = record.TeamID === winnerId
    if (won) record.Wins += 1
    else record.Losses += 1
    if (split === 'postseason') {
      if (won) record.postseasonWins += 1
      else record.postseasonLosses += 1
    } else if (won) record.regularWins += 1
    else record.regularLosses += 1
  }
}
