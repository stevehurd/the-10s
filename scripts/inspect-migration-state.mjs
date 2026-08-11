#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

import {
  INVENTORY_TABLES,
  buildProductionInventoryReport,
  inventoryCount,
  inventoryTableName,
} from './lib/production-inventory.mjs'

if (!process.env.DIRECT_URL) {
  console.error('Migration state inspection failed: DIRECT_URL is not configured')
  process.exitCode = 1
} else {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    const tableNames = new Set(tables.map((table) => table.table_name))
    const tableCounts = {}
    for (const name of INVENTORY_TABLES) {
      if (!tableNames.has(name)) continue
      const safeName = inventoryTableName(name)
      const [row] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "${safeName}"`)
      tableCounts[name] = inventoryCount(row.count)
    }

    const columns = await prisma.$queryRaw`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `
    const columnNames = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`))
    const migrationHistoryPresent = tableNames.has('_prisma_migrations')
    const migrations = migrationHistoryPresent
      ? await prisma.$queryRaw`
          SELECT migration_name, finished_at IS NOT NULL AS finished
          FROM "_prisma_migrations"
          ORDER BY started_at
        `
      : []

    const report = buildProductionInventoryReport({
      inspectedAt: new Date(),
      schema: {
        legacyTablesPresent: ['users', 'teams', 'seasons', 'drafts'].every((name) => tableNames.has(name)),
        expansionTablesPresent: ['pools', 'season_participants', 'roster_slots'].every((name) => tableNames.has(name)),
        meetingUrlColumnExists: columnNames.has('draft_sessions.meeting_url'),
        authUserIdColumnExists: columnNames.has('users.auth_user_id'),
      },
      tableCounts,
      migrationHistoryPresent,
      migrations,
    })
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? ` (${error.code})` : ''
    console.error(`Migration state inspection failed${code}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
