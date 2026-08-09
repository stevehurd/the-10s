import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEmailAuthCallbackUrl, normalizeNextPath } from './auth/redirect.ts'

test('auth redirects retain local destinations and reject external paths', () => {
  assert.equal(normalizeNextPath('/admin/users?filter=pending'), '/admin/users?filter=pending')
  assert.equal(normalizeNextPath('https://example.com'), '/')
  assert.equal(normalizeNextPath('//example.com'), '/')
  assert.equal(normalizeNextPath('/\\example.com'), '/')
})

test('email auth callback carries a safely encoded return path', () => {
  const callback = new URL(buildEmailAuthCallbackUrl(
    'http://localhost:3000',
    '/admin/users?filter=ready',
  ))
  assert.equal(callback.pathname, '/auth/confirm')
  assert.equal(callback.searchParams.get('next'), '/admin/users?filter=ready')
})
