const BASE_URL = 'https://api.sportsdata.io/v3'

function asInteger(value) {
  return Number.isInteger(value) ? value : 0
}

function combineNflRecords(regular, postseason) {
  const records = new Map()

  for (const standing of regular) {
    records.set(standing.TeamID, {
      wins: asInteger(standing.Wins),
      losses: asInteger(standing.Losses),
      ties: asInteger(standing.Ties),
      regularWins: asInteger(standing.Wins),
      regularLosses: asInteger(standing.Losses),
      postseasonWins: 0,
      postseasonLosses: 0,
    })
  }

  for (const standing of postseason) {
    const existing = records.get(standing.TeamID) ?? {
      wins: 0,
      losses: 0,
      ties: 0,
      regularWins: 0,
      regularLosses: 0,
      postseasonWins: 0,
      postseasonLosses: 0,
    }
    existing.wins += asInteger(standing.Wins)
    existing.losses += asInteger(standing.Losses)
    existing.ties += asInteger(standing.Ties)
    existing.postseasonWins += asInteger(standing.Wins)
    existing.postseasonLosses += asInteger(standing.Losses)
    records.set(standing.TeamID, existing)
  }

  return records
}

export function buildDevelopmentSportsDataset({
  nflTeams,
  nflRegular,
  nflPostseason,
  collegeHierarchy,
}) {
  const activeNfl = nflTeams.filter((team) => team.Active !== false)
  const collegeTeams = collegeHierarchy.flatMap((conference) => conference.Teams ?? [])
    .filter((team) => team.Active !== false && team.Conference)

  if (activeNfl.length !== 32) {
    throw new Error(`Expected 32 active NFL teams from SportsDataIO; received ${activeNfl.length}`)
  }
  if (collegeTeams.length < 120 || collegeTeams.length > 160) {
    throw new Error(`Expected a plausible FBS field (120-160 teams); received ${collegeTeams.length}`)
  }

  const nflRecords = combineNflRecords(nflRegular, nflPostseason)
  const fixtures = [
    ...activeNfl.map((team) => ({
      name: team.FullName,
      abbreviation: team.Key,
      league: 'NFL',
      conference: team.Conference ?? null,
      division: team.Division ?? null,
      externalId: team.GlobalTeamID?.toString() ?? null,
      sportsDataTeamId: team.TeamID?.toString() ?? null,
      sportsDataGlobalTeamId: team.GlobalTeamID?.toString() ?? null,
      logoUrl: team.WikipediaLogoURL ?? null,
      record: nflRecords.get(team.TeamID),
    })),
    ...collegeTeams.map((team) => ({
      name: `${team.School} ${team.Name}`,
      abbreviation: team.ShortDisplayName || team.Key,
      league: 'COLLEGE',
      conference: team.Conference,
      division: null,
      externalId: team.GlobalTeamID?.toString() ?? null,
      sportsDataTeamId: team.TeamID?.toString() ?? null,
      sportsDataGlobalTeamId: team.GlobalTeamID?.toString() ?? null,
      logoUrl: team.TeamLogoUrl ?? null,
      record: {
        wins: asInteger(team.Wins),
        losses: asInteger(team.Losses),
        ties: asInteger(team.Ties),
        // LeagueHierarchy exposes the completed aggregate record on this plan,
        // but not a trustworthy regular/postseason split.
        regularWins: 0,
        regularLosses: 0,
        postseasonWins: 0,
        postseasonLosses: 0,
      },
    })),
  ].sort((left, right) => left.league.localeCompare(right.league) || left.name.localeCompare(right.name))

  const missingRecords = fixtures.filter((team) => !team.record)
  if (missingRecords.length > 0) {
    throw new Error(`SportsDataIO returned ${missingRecords.length} teams without 2025 records`)
  }

  return fixtures
}

async function fetchJson(apiKey, path, fetchImpl) {
  const response = await fetchImpl(`${BASE_URL}${path}`, {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey },
  })
  if (!response.ok) {
    throw new Error(`SportsDataIO ${path} failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export async function fetchDevelopmentSportsDataset(apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error('SPORTSDATA_API_KEY is required for the real-data seed')

  const [nflTeams, nflRegular, nflPostseason, collegeHierarchy] = await Promise.all([
    fetchJson(apiKey, '/nfl/scores/json/TeamsBasic', fetchImpl),
    fetchJson(apiKey, '/nfl/scores/json/Standings/2025', fetchImpl),
    fetchJson(apiKey, '/nfl/scores/json/Standings/2025POST', fetchImpl),
    fetchJson(apiKey, '/cfb/scores/json/LeagueHierarchy', fetchImpl),
  ])

  return buildDevelopmentSportsDataset({ nflTeams, nflRegular, nflPostseason, collegeHierarchy })
}
