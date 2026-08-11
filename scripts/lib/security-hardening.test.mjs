import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const migrationPath = fileURLToPath(
  new URL('../../prisma/migrations/20260811000000_lock_down_supabase_data_api/migration.sql', import.meta.url),
)

test('the legacy global NFL reset endpoint is not shipped', () => {
  const routePath = `${repoRoot}src/app/api/teams/reset-nfl/route.ts`
  assert.equal(existsSync(routePath), false)
})

test('Supabase Data API roles cannot access Prisma application tables', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public\s+FROM anon, authenticated, service_role;/i,
  )
  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\s+REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES\s+FROM anon, authenticated, service_role;/i,
  )

  const expectedTables = [
    'users',
    'pools',
    'pool_memberships',
    'pool_seats',
    'teams',
    'seasons',
    'season_participants',
    'team_season_records',
    'standings_sync_runs',
    'season_team_eligibility',
    'roster_slots',
    'draft_sessions',
    'draft_turns',
    'draft_selections',
    'audit_events',
    'drafts',
    'games',
  ]

  for (const table of expectedTables) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i'))
  }
})
