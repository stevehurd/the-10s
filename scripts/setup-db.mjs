#!/usr/bin/env node

import { execSync } from 'node:child_process'

/**
 * Database setup helper for an isolated development database.
 * Prisma is the application schema owner in every environment, so even local
 * setup uses the checked-in migration history rather than `db push`.
 */
async function setupDatabase() {
  try {
    if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
      throw new Error('DATABASE_URL and DIRECT_URL are required')
    }

    console.log('Applying reviewed Prisma migrations to the development database...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    console.log('Development database schema is current.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Local database setup failed:', message)
    process.exit(1)
  }
}

setupDatabase()
