#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const requiredVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
]

function fail(message) {
  console.error(`Supabase setup check failed: ${message}`)
  process.exitCode = 1
}

const missing = requiredVariables.filter((name) => !process.env[name])
if (missing.length > 0) {
  fail(`missing ${missing.join(', ')}`)
} else {
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!['http:', 'https:'].includes(supabaseUrl.protocol)) {
    fail('NEXT_PUBLIC_SUPABASE_URL must use HTTP or HTTPS')
  } else {
    // Settings requires a valid publishable/anon key, so this checks both the
    // Auth endpoint and the configured browser credential without printing it.
    const settingsUrl = new URL('/auth/v1/settings', supabaseUrl)
    try {
      const response = await fetch(settingsUrl, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      })
      if (!response.ok) throw new Error(`Auth settings returned HTTP ${response.status}`)
      console.log('✓ Supabase Auth and publishable key are valid')
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Supabase Auth is unreachable')
    }
  }

  const prisma = new PrismaClient()
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('✓ Supabase Postgres is reachable through Prisma')
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Supabase Postgres is unreachable')
  } finally {
    await prisma.$disconnect()
  }
}

if (!process.exitCode) console.log('Supabase development configuration is ready.')
