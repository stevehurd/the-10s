import assert from 'node:assert/strict'
import test from 'node:test'

import { validateCompleteDraftOrder } from './seasons/participant-rules.ts'

test('accepts a complete reordered participant list', () => {
  assert.equal(validateCompleteDraftOrder(['a', 'b', 'c'], ['c', 'a', 'b']), null)
})

test('rejects omitted, duplicate, and unknown participants', () => {
  assert.match(validateCompleteDraftOrder(['a', 'b'], ['a']) ?? '', /every participant/)
  assert.match(validateCompleteDraftOrder(['a', 'b'], ['a', 'a']) ?? '', /duplicate/)
  assert.match(validateCompleteDraftOrder(['a', 'b'], ['a', 'c']) ?? '', /unknown/)
})
