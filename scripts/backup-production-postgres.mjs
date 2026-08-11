#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import {
  backupFileStem,
  parsePostgresConnection,
  requiredMetadataLabel,
} from './lib/postgres-backup.mjs'

function flagValue(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

const outputDir = flagValue('--output-dir')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  assert(process.env.DIRECT_URL, 'DIRECT_URL is required')
  assert(outputDir, '--output-dir is required')
  const sourceProvider = requiredMetadataLabel(flagValue('--source-provider'), '--source-provider')
  const sourceDeployment = requiredMetadataLabel(
    flagValue('--source-deployment'),
    '--source-deployment',
  )

  const destination = resolve(outputDir)
  const workspace = resolve(process.cwd())
  assert(
    destination !== workspace && !destination.startsWith(`${workspace}/`),
    'Production backups must be stored outside the repository',
  )

  const postgres = parsePostgresConnection(process.env.DIRECT_URL)
  const createdAt = new Date()
  const stem = backupFileStem(createdAt)
  const dumpName = `${stem}.dump`
  const dumpPath = resolve(destination, dumpName)
  const metadataPath = resolve(destination, `${stem}.json`)

  await mkdir(destination, { recursive: true, mode: 0o700 })
  await chmod(destination, 0o700)

  console.log('Creating a read-only logical backup with pg_dump...')
  const result = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--env', 'PGHOST',
      '--env', 'PGPORT',
      '--env', 'PGDATABASE',
      '--env', 'PGUSER',
      '--env', 'PGPASSWORD',
      '--env', 'PGSSLMODE',
      '--volume', `${destination}:/backup`,
      'postgres:17-alpine',
      'pg_dump',
      '--format=custom',
      '--compress=9',
      '--no-owner',
      '--no-privileges',
      '--schema=public',
      `--file=/backup/${dumpName}`,
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DOCKER_HOST: process.env.DOCKER_HOST,
        DOCKER_CONTEXT: process.env.DOCKER_CONTEXT,
        ...postgres,
      },
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  )

  assert(!result.error, `Could not start Docker: ${result.error?.message}`)
  assert(result.status === 0, `pg_dump failed with exit code ${result.status}; no credentials were logged`)

  const dump = await readFile(dumpPath)
  assert(dump.length > 0, 'pg_dump created an empty backup')
  await chmod(dumpPath, 0o600)

  const metadata = {
    version: 1,
    sourceDeployment,
    sourceProvider,
    createdAt: createdAt.toISOString(),
    format: 'PostgreSQL custom archive',
    includedSchemas: ['public'],
    fileName: dumpName,
    bytes: (await stat(dumpPath)).size,
    sha256: createHash('sha256').update(dump).digest('hex'),
    ownerOnlyPermissions: true,
  }
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 })
  await chmod(metadataPath, 0o600)

  console.log(`Backup: ${dumpPath}`)
  console.log(`Metadata: ${metadataPath}`)
  console.log(`Bytes: ${metadata.bytes}`)
  console.log(`SHA-256: ${metadata.sha256}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Production backup failed')
  process.exitCode = 1
})
