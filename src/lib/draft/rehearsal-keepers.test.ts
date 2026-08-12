import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRehearsalKeepers, randomlySeedRehearsalKeepers } from './rehearsal-keepers.ts'

const candidates = [
  ...Array.from({ length: 2 }, (_, index) => ({
    participantId: 'participant', rosterSlotId: `nfl-${index}`, teamId: `nfl-team-${index}`, league: 'NFL' as const,
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    participantId: 'participant', rosterSlotId: `college-${index}`, teamId: `college-team-${index}`, league: 'COLLEGE' as const,
  })),
]

test('random rehearsal keepers always release at least one NFL and two college teams', () => {
  for (const randomValue of [0, 0.25, 0.5, 0.999]) {
    const keepers = randomlySeedRehearsalKeepers(candidates, () => randomValue)
    const keptIds = new Set(keepers.map((keeper) => keeper.teamId))
    const keptNFL = candidates.filter((candidate) => candidate.league === 'NFL' && keptIds.has(candidate.teamId)).length
    const keptCollege = candidates.filter((candidate) => candidate.league === 'COLLEGE' && keptIds.has(candidate.teamId)).length
    assert.ok(keptNFL <= 1)
    assert.ok(keptCollege <= 6)
  }
})

test('rehearsal keeper snapshots parse defensively', () => {
  const keepers = randomlySeedRehearsalKeepers(candidates, () => 0)
  assert.deepEqual(parseRehearsalKeepers({ keepers }), keepers)
  assert.deepEqual(parseRehearsalKeepers({ keepers: [{ teamId: 'missing-fields' }] }), [])
  assert.deepEqual(parseRehearsalKeepers(null), [])
})
