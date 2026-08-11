import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildProductionInventoryReport,
  inventoryCount,
  inventoryTableName,
} from './production-inventory.mjs'

test('production inventory permits only the fixed aggregate table allowlist', () => {
  assert.equal(inventoryTableName('users'), 'users')
  assert.throws(() => inventoryTableName('auth.users'), /not approved/)
  assert.throws(() => inventoryTableName('users; DROP TABLE users'), /not approved/)
})

test('production inventory normalizes database counts safely', () => {
  assert.equal(inventoryCount(15n), 15)
  assert.throws(() => inventoryCount(-1), /non-negative/)
  assert.throws(() => inventoryCount(Number.MAX_SAFE_INTEGER + 1), /safe integer/)
})

test('production inventory report contains aggregates but no contact or credential fields', () => {
  const report = buildProductionInventoryReport({
    inspectedAt: new Date('2026-08-11T15:00:00.000Z'),
    schema: { legacyTablesPresent: true, expansionTablesPresent: false },
    tableCounts: { users: 15, teams: 168 },
    migrationHistoryPresent: false,
    migrations: [],
  })

  assert.equal(report.access, 'READ_ONLY')
  assert.equal(report.tableCounts.users, 15)
  assert.equal(report.tableCounts.drafts, null)
  assert.equal(report.containsCredentials, false)
  assert.equal(report.containsMemberContactData, false)
  assert.doesNotMatch(JSON.stringify(report), /email|password|database_url|direct_url/i)
})
