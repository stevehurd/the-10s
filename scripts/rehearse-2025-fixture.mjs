#!/usr/bin/env node

import {
  createPreflightReport,
  reconcileMigrationSnapshot,
} from './lib/legacy-2025-rehearsal.mjs'
import {
  buildLegacy2025Fixture,
  buildMigratedSnapshot,
} from './fixtures/legacy-2025.fixture.mjs'

const legacy = buildLegacy2025Fixture()
const preflight = createPreflightReport(legacy)
const reconciliationErrors = reconcileMigrationSnapshot(
  legacy,
  buildMigratedSnapshot(legacy),
  { commissionerEmail: 'player1@example.test' },
)
const result = {
  rehearsal: 'synthetic-legacy-2025',
  passed: preflight.passed && reconciliationErrors.length === 0,
  preflight,
  reconciliation: {
    passed: reconciliationErrors.length === 0,
    errors: reconciliationErrors,
  },
  productionAccessed: false,
  dataChanged: false,
}

console.log(JSON.stringify(result, null, 2))
if (!result.passed) process.exitCode = 1
