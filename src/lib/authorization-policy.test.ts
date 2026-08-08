import assert from 'node:assert/strict'
import test from 'node:test'

import { selectAuthorizedMembership } from './auth/policy.ts'

const member = { id: 'member', poolId: 'pool-a', role: 'MEMBER', status: 'ACTIVE' }
const commissioner = {
  id: 'commissioner',
  poolId: 'pool-a',
  role: 'COMMISSIONER',
  status: 'ACTIVE',
}

test('anonymous users have no authorized membership', () => {
  assert.equal(selectAuthorizedMembership([], 'MEMBER', 'pool-a'), null)
})

test('members can read their pool but cannot perform commissioner actions', () => {
  assert.equal(selectAuthorizedMembership([member], 'MEMBER', 'pool-a')?.id, 'member')
  assert.equal(selectAuthorizedMembership([member], 'COMMISSIONER', 'pool-a'), null)
})

test('commissioners can perform member and commissioner actions', () => {
  assert.equal(
    selectAuthorizedMembership([commissioner], 'COMMISSIONER', 'pool-a')?.id,
    'commissioner',
  )
  assert.equal(selectAuthorizedMembership([commissioner], 'MEMBER', 'pool-a')?.id, 'commissioner')
})

test('membership never grants access to a different pool', () => {
  assert.equal(selectAuthorizedMembership([commissioner], 'MEMBER', 'pool-b'), null)
})
