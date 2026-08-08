import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LegacyInvitationError,
  legacyInvitationState,
  planLegacyInvitationChange,
} from './legacy-invitation-rules.ts'

const unclaimed = { id: 'legacy-1', email: null, authUserId: null }

test('legacy invitation states distinguish unclaimed, invited, and claimed profiles', () => {
  assert.equal(legacyInvitationState(unclaimed), 'UNCLAIMED')
  assert.equal(legacyInvitationState({ ...unclaimed, email: 'player@example.com' }), 'INVITED')
  assert.equal(legacyInvitationState({ ...unclaimed, authUserId: 'auth-1' }), 'CLAIMED')
})

test('a commissioner can assign, normalize, correct, or remove an unclaimed invitation email', () => {
  const assigned = planLegacyInvitationChange({
    profile: unclaimed,
    requestedEmail: ' PLAYER@Example.com ',
  })
  assert.deepEqual(assigned, {
    email: 'player@example.com',
    action: 'LEGACY_PLAYER_INVITATION_ASSIGNED',
    previousState: 'UNCLAIMED',
    nextState: 'INVITED',
  })

  const corrected = planLegacyInvitationChange({
    profile: { ...unclaimed, email: 'old@example.com' },
    requestedEmail: 'new@example.com',
  })
  assert.equal(corrected.action, 'LEGACY_PLAYER_INVITATION_CORRECTED')

  const removed = planLegacyInvitationChange({
    profile: { ...unclaimed, email: 'old@example.com' },
    requestedEmail: null,
  })
  assert.equal(removed.action, 'LEGACY_PLAYER_INVITATION_REMOVED')
  assert.equal(removed.email, null)
})

test('invitation rules reject claimed profiles, collisions, and no-op changes', () => {
  assert.throws(
    () => planLegacyInvitationChange({
      profile: { ...unclaimed, email: 'player@example.com', authUserId: 'auth-1' },
      requestedEmail: 'new@example.com',
    }),
    (error) => error instanceof LegacyInvitationError && error.status === 409,
  )
  assert.throws(
    () => planLegacyInvitationChange({
      profile: unclaimed,
      requestedEmail: 'used@example.com',
      conflictingUserId: 'legacy-2',
    }),
    /already assigned to another player/,
  )
  assert.throws(
    () => planLegacyInvitationChange({
      profile: { ...unclaimed, email: 'same@example.com' },
      requestedEmail: 'SAME@example.com',
    }),
    /already this player’s invitation email/,
  )
})
