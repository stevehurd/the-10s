import assert from 'node:assert/strict'
import test from 'node:test'

import { runtimeDatabaseUrl } from './database-url.ts'

test('runtime database URLs use a small pool by default', () => {
  const result = new URL(runtimeDatabaseUrl('postgresql://user:password@localhost:5432/pool')!)
  assert.equal(result.searchParams.get('connection_limit'), '5')
})

test('runtime database URLs respect explicit URL and environment limits', () => {
  const explicit = new URL(runtimeDatabaseUrl(
    'postgresql://user:password@localhost:5432/pool?connection_limit=3',
    '2',
  )!)
  assert.equal(explicit.searchParams.get('connection_limit'), '3')

  const configured = new URL(runtimeDatabaseUrl(
    'postgresql://user:password@localhost:5432/pool',
    '2',
  )!)
  assert.equal(configured.searchParams.get('connection_limit'), '2')
})
