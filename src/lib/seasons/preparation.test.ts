import assert from 'node:assert/strict'
import test from 'node:test'

import { getPreparationTeamState, shouldShowPreparationTeam } from './preparation.ts'

test('pending college teams stay visible for preparation without becoming draftable', () => {
  const state = getPreparationTeamState('PENDING', null)

  assert.equal(state.available, false)
  assert.equal(state.held, false)
  assert.match(state.unavailableReason ?? '', /eligibility review pending/)
  assert.equal(shouldShowPreparationTeam(state, false), true)
})

test('kept teams are revealed by the kept-team toggle regardless of eligibility status', () => {
  const state = getPreparationTeamState('PENDING', { name: 'Steve', retentionChoice: 'KEEP' })

  assert.equal(state.available, false)
  assert.equal(state.held, true)
  assert.match(state.unavailableReason ?? '', /Kept by Steve/)
  assert.equal(shouldShowPreparationTeam(state, false), false)
  assert.equal(shouldShowPreparationTeam(state, true), true)
})

test('only approved and unkept teams are available to draft', () => {
  assert.equal(getPreparationTeamState('APPROVED', null).available, true)
  assert.equal(getPreparationTeamState('APPROVED', { name: 'Steve', retentionChoice: 'KEEP' }).available, false)
  assert.equal(getPreparationTeamState('INACTIVE', null).available, false)
})

test('undecided inherited teams remain held without being described as kept', () => {
  const state = getPreparationTeamState('APPROVED', {
    name: 'Alex',
    retentionChoice: 'PENDING',
  })

  assert.equal(state.available, false)
  assert.equal(state.held, true)
  assert.equal(state.unavailableReason, 'Keeper decision pending for Alex')
})

test('private keeper decisions hold inherited teams without revealing the choice or owner', () => {
  const state = getPreparationTeamState('APPROVED', {
    name: 'Alex',
    retentionChoice: 'HIDDEN',
  })

  assert.equal(state.available, false)
  assert.equal(state.held, true)
  assert.equal(state.unavailableReason, 'Keeper status hidden until every player locks selections')
})
