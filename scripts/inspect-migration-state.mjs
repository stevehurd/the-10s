#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

if (!process.env.DIRECT_URL) {
  console.error('Migration state inspection failed: DIRECT_URL is not configured')
  process.exitCode = 1
} else {
  const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })
  try {
    const [column] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'draft_sessions'
          AND column_name = 'meeting_url'
      ) AS meeting_url_exists
    `
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at IS NOT NULL AS finished
      FROM "_prisma_migrations"
      ORDER BY started_at
    `
    console.log(JSON.stringify({
      meetingUrlColumnExists: Boolean(column?.meeting_url_exists),
      migrations,
    }, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Migration state inspection failed')
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}
