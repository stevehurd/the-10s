import assert from 'node:assert/strict'
import test from 'node:test'

import { editableRosterNickname, normalizeEmail, playerDisplayName, validateEmail, validatePlayerProfile } from './player-settings-rules.ts'

test('profile values are trimmed and an empty nickname is cleared', () => {
  assert.deepEqual(validatePlayerProfile({ name: '  Steve  ', rosterNickname: '  ' }), {
    name: 'Steve',
    rosterNickname: null,
  })
})

test('profile rules reject invalid lengths', () => {
  assert.throws(() => validatePlayerProfile({ name: 'S' }), /between 2 and 60/)
  assert.throws(() => validatePlayerProfile({ name: 'Steve', rosterNickname: 'x'.repeat(41) }), /40 characters/)
})

test('emails are normalized and validated', () => {
  assert.equal(normalizeEmail('  PLAYER@EXAMPLE.COM '), 'player@example.com')
  assert.equal(validateEmail(' Player@example.com '), 'player@example.com')
  assert.throws(() => validateEmail('not-an-email'), /valid email/)
})

test('a roster nickname becomes the public player label', () => {
  assert.equal(playerDisplayName('Steve', ' Fourth & Long '), 'Fourth & Long')
  assert.equal(playerDisplayName('Steve', null), 'Steve')
  assert.equal(playerDisplayName('Steve', 'Seat 1'), 'Steve')
  assert.equal(editableRosterNickname('Seat 12'), null)
})
