import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
const vercelConfig = JSON.parse(readFileSync(`${repoRoot}vercel.json`, 'utf8'))

test('Vercel Hobby config contains no unsupported sub-daily cron', () => {
  assert.deepEqual(vercelConfig.crons, [
    { path: '/api/cron/sync-standings', schedule: '0 6 * * *' },
  ])
})

test('the protected draft autopick worker remains available for a future scheduler', () => {
  assert.equal(existsSync(`${repoRoot}src/app/api/cron/draft-autopicks/route.ts`), true)
})
