import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  emailOtpErrorMessage,
  normalizeEmailOtp,
  requestEmailOtp,
  verifyEmailOtp,
  type EmailOtpClient,
} from './email-otp.ts'

test('email OTP requests preserve first-time invitation claiming', async () => {
  let request: Parameters<EmailOtpClient['auth']['signInWithOtp']>[0] | undefined
  const client: EmailOtpClient = {
    auth: {
      async signInWithOtp(input) {
        request = input
        return { error: null }
      },
      async verifyOtp() {
        return { error: null }
      },
    },
  }

  await requestEmailOtp(client, ' Player@Example.COM ')
  assert.deepEqual(request, {
    email: 'player@example.com',
    options: { shouldCreateUser: true },
  })
})

test('email OTP verification uses a normalized six-digit email token', async () => {
  let verification: Parameters<EmailOtpClient['auth']['verifyOtp']>[0] | undefined
  const client: EmailOtpClient = {
    auth: {
      async signInWithOtp() {
        return { error: null }
      },
      async verifyOtp(input) {
        verification = input
        return { error: null }
      },
    },
  }

  assert.equal(normalizeEmailOtp('12 34-567'), '123456')
  await verifyEmailOtp(client, ' Player@Example.COM ', '12 34-56')
  assert.deepEqual(verification, {
    email: 'player@example.com',
    token: '123456',
    type: 'email',
  })
})

test('email OTP errors do not expose provider details', () => {
  assert.equal(
    emailOtpErrorMessage({ message: 'Token has expired or is invalid' }, 'verify'),
    'That code is invalid or has expired. Check the code or request a new one.',
  )
  assert.equal(
    emailOtpErrorMessage({ message: 'Email rate limit exceeded' }, 'request'),
    'Too many attempts. Wait a moment, then try again.',
  )
})

test('local passwordless email contains a code instead of a sign-in link', () => {
  const template = readFileSync(
    new URL('../../../supabase/templates/magic-link.html', import.meta.url),
    'utf8',
  )
  assert.match(template, /{{ \.Token }}/)
  assert.doesNotMatch(template, /{{ \.ConfirmationURL }}/)
})
