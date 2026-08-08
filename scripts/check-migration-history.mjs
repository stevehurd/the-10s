#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const migrationsRoot = fileURLToPath(new URL('../prisma/migrations/', import.meta.url))
const manifestPath = fileURLToPath(new URL('../prisma/migrations/migration-manifest.json', import.meta.url))
const lockPath = fileURLToPath(new URL('../prisma/migrations/migration_lock.toml', import.meta.url))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

function fail(message) {
  throw new Error(`Migration history check failed: ${message}`)
}

const directories = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
const expected = manifest.migrations.map((migration) => migration.id)
if (JSON.stringify(directories) !== JSON.stringify(expected)) {
  fail(`manifest lists [${expected.join(', ')}] but disk contains [${directories.join(', ')}]`)
}
if (manifest.provider !== 'postgresql' || !readFileSync(lockPath, 'utf8').includes('provider = "postgresql"')) {
  fail('manifest and Prisma migration lock must both use postgresql')
}

const destructivePattern = /\b(DROP\s+(TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i
for (const migration of manifest.migrations) {
  if (!/^\d{14}_[a-z0-9_]+$/.test(migration.id)) fail(`invalid migration ID ${migration.id}`)
  const relativePath = `prisma/migrations/${migration.id}/migration.sql`
  const absolutePath = `${repoRoot}${relativePath}`
  const sql = readFileSync(absolutePath, 'utf8')
  if (!sql.trim()) fail(`${relativePath} is empty`)
  const sha256 = createHash('sha256').update(sql).digest('hex')
  if (sha256 !== migration.sha256) fail(`${relativePath} differs from its reviewed SHA-256 manifest entry`)
  if (destructivePattern.test(sql) && !sql.includes('-- destructive-migration-reviewed')) {
    fail(`${relativePath} contains a destructive statement without an explicit review marker`)
  }
  try {
    execFileSync('git', ['check-ignore', '-q', relativePath], { cwd: repoRoot, stdio: 'ignore' })
    fail(`${relativePath} is ignored by Git`)
  } catch (error) {
    if (error?.status !== 1) throw error
  }
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relativePath], { cwd: repoRoot, stdio: 'ignore' })
  } catch {
    fail(`${relativePath} is not staged or committed`)
  }
}

for (const relativePath of [
  'prisma/migrations/migration_lock.toml',
  'prisma/migrations/migration-manifest.json',
]) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relativePath], { cwd: repoRoot, stdio: 'ignore' })
  } catch {
    fail(`${relativePath} is not staged or committed`)
  }
}

console.log(`✓ ${manifest.migrations.length} reviewed Prisma migrations are tracked and checksum-verified`)
