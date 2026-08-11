import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isPrismaWriteConflict,
  retryPrismaWriteConflict,
} from './write-conflict-retry.ts'

function prismaError(code: string) {
  return Object.assign(new Error(`Prisma ${code}`), { code })
}

test('recognizes only Prisma serializable write conflicts', () => {
  assert.equal(isPrismaWriteConflict(prismaError('P2034')), true)
  assert.equal(isPrismaWriteConflict(prismaError('P2002')), false)
  assert.equal(isPrismaWriteConflict(new Error('P2034')), false)
  assert.equal(isPrismaWriteConflict(null), false)
})

test('retries a write conflict and returns the winning attempt', async () => {
  const attempts: number[] = []
  const result = await retryPrismaWriteConflict(async (attempt) => {
    attempts.push(attempt)
    if (attempt < 3) throw prismaError('P2034')
    return 'committed'
  })

  assert.equal(result, 'committed')
  assert.deepEqual(attempts, [1, 2, 3])
})

test('does not retry rule errors or unrelated database failures', async () => {
  let attempts = 0
  const failure = prismaError('P2002')

  await assert.rejects(
    retryPrismaWriteConflict(async () => {
      attempts += 1
      throw failure
    }),
    failure,
  )
  assert.equal(attempts, 1)
})

test('preserves the final write conflict after the retry budget is exhausted', async () => {
  let attempts = 0

  await assert.rejects(
    retryPrismaWriteConflict(async () => {
      attempts += 1
      throw prismaError('P2034')
    }, 2),
    (error) => isPrismaWriteConflict(error),
  )
  assert.equal(attempts, 2)
})

test('rejects an invalid retry budget', async () => {
  await assert.rejects(
    retryPrismaWriteConflict(async () => 'unused', 0),
    /positive integer/,
  )
})
