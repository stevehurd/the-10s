export const INVENTORY_TABLES = Object.freeze([
  'users',
  'teams',
  'seasons',
  'drafts',
  'games',
  'pools',
  'pool_memberships',
  'season_participants',
  'roster_slots',
  'team_season_records',
  'season_team_eligibility',
  'draft_sessions',
])

export function inventoryTableName(name) {
  if (!INVENTORY_TABLES.includes(name)) {
    throw new Error(`Table ${name} is not approved for production inventory`)
  }
  return name
}

export function inventoryCount(value) {
  const count = Number(value)
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Inventory count must be a non-negative safe integer')
  }
  return count
}

export function buildProductionInventoryReport(input) {
  return {
    version: 1,
    access: 'READ_ONLY',
    containsCredentials: false,
    containsMemberContactData: false,
    inspectedAt: input.inspectedAt.toISOString(),
    schema: input.schema,
    tableCounts: Object.fromEntries(
      INVENTORY_TABLES.map((name) => [name, input.tableCounts[name] ?? null]),
    ),
    migrationHistory: {
      present: input.migrationHistoryPresent,
      entries: input.migrations.map((migration) => ({
        name: migration.migration_name,
        finished: Boolean(migration.finished),
      })),
    },
  }
}
