export const SEASON_SCOPED_COLLEGE_SOURCE = 'SPORTSDATAIO_TEAM_SEASON'
export const VERIFIED_HIERARCHY_COLLEGE_SOURCE = 'SPORTSDATAIO_HIERARCHY_VERIFIED'
export const UNSCOPED_COLLEGE_SOURCE = 'SPORTSDATAIO_STANDINGS'

/**
 * Mutable college seasons must not display records written by the former
 * unversioned LeagueHierarchy integration. Finalized historical records remain
 * visible because they are immutable preserved evidence.
 */
export function isQuarantinedCollegeRecord(
  league: string,
  source: string,
  seasonFinalized: boolean,
) {
  return league === 'COLLEGE'
    && !seasonFinalized
    && source === UNSCOPED_COLLEGE_SOURCE
}
