import assert from 'node:assert/strict'
import test from 'node:test'

import {
  areKeeperSelectionsRevealed,
  canSeeParticipantKeeperSelections,
} from './keeper-visibility.ts'

test('keeper selections stay private until every participant locks', () => {
  assert.equal(
    areKeeperSelectionsRevealed([
      { decisionsLockedAt: new Date() },
      { decisionsLockedAt: null },
    ]),
    false,
  )
  assert.equal(
    areKeeperSelectionsRevealed([
      { decisionsLockedAt: new Date() },
      { decisionsLockedAt: new Date() },
    ]),
    true,
  )
  assert.equal(areKeeperSelectionsRevealed([]), false)
})

test('a participant can see their own selections before the league-wide reveal', () => {
  assert.equal(
    canSeeParticipantKeeperSelections({
      allSelectionsRevealed: false,
      participantUserId: 'viewer',
      viewerUserId: 'viewer',
    }),
    true,
  )
  assert.equal(
    canSeeParticipantKeeperSelections({
      allSelectionsRevealed: false,
      participantUserId: 'other',
      viewerUserId: 'viewer',
    }),
    false,
  )
  assert.equal(
    canSeeParticipantKeeperSelections({
      allSelectionsRevealed: true,
      participantUserId: 'other',
      viewerUserId: 'viewer',
    }),
    true,
  )
})
