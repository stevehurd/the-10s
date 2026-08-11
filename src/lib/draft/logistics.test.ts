import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMeetingUrl } from './logistics.ts'

test('adds HTTPS to a pasted meeting link without a protocol', () => {
  assert.equal(normalizeMeetingUrl('meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij')
  assert.equal(normalizeMeetingUrl('  zoom.us/j/12345  '), 'https://zoom.us/j/12345')
})

test('keeps HTTPS links and upgrades HTTP links', () => {
  assert.equal(normalizeMeetingUrl('https://example.com/call'), 'https://example.com/call')
  assert.equal(normalizeMeetingUrl('http://example.com/call'), 'https://example.com/call')
  assert.equal(normalizeMeetingUrl('//example.com/call'), 'https://example.com/call')
})

test('preserves unsupported explicit schemes for validation to reject', () => {
  assert.equal(normalizeMeetingUrl('javascript:alert(1)'), 'javascript:alert(1)')
  assert.equal(normalizeMeetingUrl(''), null)
  assert.equal(normalizeMeetingUrl('   '), null)
})
