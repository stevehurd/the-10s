import assert from 'node:assert/strict'
import test from 'node:test'

import {
  backupFileStem,
  parsePostgresConnection,
  requiredMetadataLabel,
} from './postgres-backup.mjs'

test('parses a PostgreSQL URL without exposing the original URL', () => {
  assert.deepEqual(
    parsePostgresConnection('postgresql://pool%20user:secret%21@db.example.test:5432/football_pool?sslmode=verify-full'),
    {
      PGHOST: 'db.example.test',
      PGPORT: '5432',
      PGDATABASE: 'football_pool',
      PGUSER: 'pool user',
      PGPASSWORD: 'secret!',
      PGSSLMODE: 'verify-full',
    },
  )
})

test('requires a complete PostgreSQL connection URL', () => {
  assert.throws(
    () => parsePostgresConnection('https://example.test/database'),
    /postgres or postgresql protocol/,
  )
  assert.throws(
    () => parsePostgresConnection('postgresql://user@example.test/database'),
    /missing PGPASSWORD/,
  )
})

test('creates a filesystem-safe UTC backup name', () => {
  assert.equal(
    backupFileStem(new Date('2026-08-08T19:42:01.123Z')),
    'football-pool-production-2026-08-08T19-42-01-123Z',
  )
})

test('requires safe operator-supplied backup metadata labels', () => {
  assert.equal(requiredMetadataLabel(' Supabase ', '--source-provider'), 'Supabase')
  assert.throws(() => requiredMetadataLabel('', '--source-provider'), /is required/)
  assert.throws(
    () => requiredMetadataLabel('Supabase\nsecret', '--source-provider'),
    /single-line label/,
  )
})
