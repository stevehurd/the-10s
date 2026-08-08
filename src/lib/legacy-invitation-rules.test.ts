import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LegacyInvitationError,
  assertInvitationCanSend,
  legacyInvitationState,
  planLegacyInvitationChange,
} from './legacy-invitation-rules.ts'

const unclaimed = { id: 'legacy-1', email: null, authUserId: null }

test('legacy invitation states cover assignment, delivery, failure, and joining', () => {
  assert.equal(legacyInvitationState(unclaimed), 'NEEDS_EMAIL')
  assert.equal(legacyInvitationState({ ...unclaimed, email: 'player@example.com' }), 'READY_TO_INVITE')
  assert.equal(legacyInvitationState({ ...unclaimed, email: 'player@example.com', invitationSentAt: new Date() }), 'INVITATION_SENT')
  assert.equal(legacyInvitationState({ ...unclaimed, email: 'player@example.com', invitationFailedAt: new Date() }), 'SEND_FAILED')
  assert.equal(legacyInvitationState({ ...unclaimed, authUserId: 'auth-1' }), 'JOINED')
})

test('a commissioner can assign, normalize, correct, or remove an unclaimed invitation email', () => {
  const assigned = planLegacyInvitationChange({
    profile: unclaimed,
    requestedEmail: ' PLAYER@Example.com ',
  })
  assert.deepEqual(assigned, {
    email: 'player@example.com',
    action: 'LEGACY_PLAYER_INVITATION_ASSIGNED',
    previousState: 'NEEDS_EMAIL',
    nextState: 'READY_TO_INVITE',
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

test('only an assigned, unclaimed profile can receive an invitation', () => {
  assert.deepEqual(
    assertInvitationCanSend({ ...unclaimed, email: 'player@example.com' }),
    { email: 'player@example.com', state: 'READY_TO_INVITE' },
  )
  assert.throws(() => assertInvitationCanSend(unclaimed), /Assign a sign-in email/)
  assert.throws(
    () => assertInvitationCanSend({ ...unclaimed, email: 'player@example.com', authUserId: 'auth-1' }),
    /already joined/,
  )
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
