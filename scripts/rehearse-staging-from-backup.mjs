#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import { PrismaClient } from '@prisma/client'

import { parsePostgresConnection } from './lib/postgres-backup.mjs'

function flagValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  })
  if (result.stdout && options.stdio !== 'inherit') process.stdout.write(result.stdout)
  if (result.stderr && options.stdio !== 'inherit') process.stderr.write(result.stderr)
  assert(!result.error, `Could not start ${command}: ${result.error?.message}`)
  assert(result.status === 0, `${command} failed with exit code ${result.status}`)
  return result
}

async function main() {
  assert(process.argv.includes('--apply'), '--apply is required')
  assert(
    process.argv.includes('--replace-synthetic-staging'),
    '--replace-synthetic-staging is required',
  )
  assert(process.env.DATABASE_URL && process.env.DIRECT_URL, 'Database URLs are required')

  const backupPath = resolve(flagValue('--backup') ?? '')
  const expectedSha256 = flagValue('--sha256')
  const legacyCommissionerName = flagValue('--legacy-commissioner-name')?.trim()
  assert(flagValue('--backup'), '--backup is required')
  assert(expectedSha256, '--sha256 is required')
  assert(legacyCommissionerName, '--legacy-commissioner-name is required')

  const directUrl = new URL(process.env.DIRECT_URL)
  assert(
    directUrl.hostname.endsWith('.supabase.com') || directUrl.hostname.endsWith('.supabase.co'),
    'Refusing to replace data: the target is not a Supabase staging database',
  )

  const archive = await readFile(backupPath)
  const actualSha256 = createHash('sha256').update(archive).digest('hex')
  assert(actualSha256 === expectedSha256, 'Backup SHA-256 does not match the approved archive')

  const current = new PrismaClient()
  const [developmentPool, linkedCommissioners] = await Promise.all([
    current.pool.findUnique({ where: { slug: 'the-10s-development' }, select: { id: true } }),
    current.user.findMany({
      where: {
        authUserId: { not: null },
        email: { not: null },
        memberships: { some: { role: 'COMMISSIONER', status: 'ACTIVE' } },
      },
      select: { authUserId: true, email: true },
    }),
  ])
  assert(developmentPool, 'Refusing to replace data: the synthetic development pool was not found')
  assert(
    linkedCommissioners.length === 1,
    `Expected exactly one linked staging commissioner; found ${linkedCommissioners.length}`,
  )
  const stagingIdentity = linkedCommissioners[0]
  await current.$disconnect()

  const postgres = parsePostgresConnection(process.env.DIRECT_URL)
  const dockerEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOCKER_HOST: process.env.DOCKER_HOST,
    DOCKER_CONTEXT: process.env.DOCKER_CONTEXT,
    ...postgres,
  }
  const postgresEnvArgs = Object.keys(postgres).flatMap((name) => ['--env', name])

  console.log('Replacing the staging public schema with the verified legacy archive...')
  run(
    'docker',
    [
      'run', '--rm', ...postgresEnvArgs, 'postgres:17-alpine',
      'psql', '--set=ON_ERROR_STOP=1', '--command=DROP SCHEMA public CASCADE',
    ],
    { env: dockerEnv, stdio: 'inherit' },
  )
  run(
    'docker',
    [
      'run', '--rm', ...postgresEnvArgs,
      '--volume', `${dirname(backupPath)}:/backup:ro`,
      'postgres:17-alpine', 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges',
      `--dbname=${postgres.PGDATABASE}`, `/backup/${basename(backupPath)}`,
    ],
    { env: dockerEnv, stdio: 'inherit' },
  )

  console.log('Applying the reviewed Prisma migration history...')
  run('npx', ['prisma', 'migrate', 'resolve', '--applied', '20250801000000_legacy_baseline'], {
    stdio: 'inherit',
  })
  run('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' })

  console.log('Running the read-only 2025 source preflight...')
  const preflight = run('node', ['scripts/migrate-2025-data.mjs'])
  const fingerprint = preflight.stdout.match(/Source fingerprint: ([a-f0-9]{64})/)?.[1]
  assert(fingerprint, 'Could not read the 2025 source fingerprint from preflight')

  let migrated = new PrismaClient()
  const legacyMatches = await migrated.user.findMany({
    where: { name: legacyCommissionerName },
    select: { id: true },
  })
  assert(
    legacyMatches.length === 1,
    `Expected exactly one legacy player named ${legacyCommissionerName}; found ${legacyMatches.length}`,
  )
  const legacyCommissionerId = legacyMatches[0].id
  await migrated.$disconnect()

  console.log('Migrating and reconciling the 2025 season...')
  run(
    'node',
    [
      'scripts/migrate-2025-data.mjs', '--apply', '--backup-confirmed',
      '--source-fingerprint', fingerprint, '--commissioner-user-id', legacyCommissionerId,
    ],
    { stdio: 'inherit' },
  )

  migrated = new PrismaClient()
  await migrated.$transaction(async (tx) => {
    await tx.user.updateMany({
      data: {
        authUserId: null,
        email: null,
        invitationSentAt: null,
        invitationFailedAt: null,
        invitationClaimedAt: null,
        invitationSendAttempts: 0,
      },
    })
    await tx.user.update({
      where: { id: legacyCommissionerId },
      data: {
        authUserId: stagingIdentity.authUserId,
        email: stagingIdentity.email,
        invitationClaimedAt: new Date(),
      },
    })
  })

  const season = await migrated.season.findFirst({
    where: { year: 2025, status: 'FINALIZED' },
    include: {
      participants: {
        include: { rosterSlots: { include: { team: true } } },
      },
    },
  })
  assert(season, 'The finalized 2025 season was not found after migration')
  assert(season.participants.length === 15, 'The migrated season does not contain 15 participants')
  for (const participant of season.participants) {
    assert(participant.rosterSlots.length === 10, 'A migrated roster does not contain ten slots')
    const nfl = participant.rosterSlots.filter((slot) => slot.team?.league === 'NFL').length
    const college = participant.rosterSlots.filter((slot) => slot.team?.league === 'COLLEGE').length
    assert(nfl === 2 && college === 8, 'A migrated roster does not contain 2 NFL and 8 college teams')
  }
  const [linkedUsers, usersWithEmail] = await Promise.all([
    migrated.user.count({ where: { authUserId: { not: null } } }),
    migrated.user.count({ where: { email: { not: null } } }),
  ])
  assert(linkedUsers === 1 && usersWithEmail === 1, 'Staging identity sanitization failed')
  await migrated.$disconnect()

  console.log(JSON.stringify({
    passed: true,
    target: 'staging Supabase',
    productionChanged: false,
    playerNamesRetained: true,
    participantCount: season.participants.length,
    rosterSlotCount: season.participants.reduce((total, participant) => total + participant.rosterSlots.length, 0),
    finalized2025: true,
    linkedStagingUsers: linkedUsers,
    nextStep: 'Create 2026 through the commissioner UI',
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Staging rehearsal failed')
  process.exitCode = 1
})
