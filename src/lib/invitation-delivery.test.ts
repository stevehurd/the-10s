import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InvitationDeliveryError,
  buildInvitationEmail,
  invitationDeliveryAvailability,
  sendPlayerInvitation,
} from './invitation-delivery.ts'

const configuredEnvironment = {
  INVITATION_EMAIL_ENABLED: 'true',
  RESEND_API_KEY: 'test-key',
  RESEND_FROM_EMAIL: 'The 10s <invite@example.com>',
  APP_URL: 'https://pool.example.com',
}

test('invitation delivery stays disabled until every server setting is ready', () => {
  assert.equal(invitationDeliveryAvailability({}).enabled, false)
  assert.equal(invitationDeliveryAvailability({ INVITATION_EMAIL_ENABLED: 'true' }).enabled, false)
  assert.equal(invitationDeliveryAvailability(configuredEnvironment).enabled, true)
})

test('invitation email links to a prefilled OTP login and escapes player names', () => {
  const message = buildInvitationEmail({
    playerName: '<Demo & Player>',
    appUrl: configuredEnvironment.APP_URL,
    email: 'player+invite@example.com',
  })
  const url = new URL(message.loginUrl)
  assert.equal(url.pathname, '/login')
  assert.equal(url.searchParams.get('email'), 'player+invite@example.com')
  assert.equal(url.searchParams.get('invited'), 'true')
  assert.match(message.html, /&lt;Demo &amp; Player&gt;/)
  assert.doesNotMatch(message.html, /<Demo & Player>/)
})

test('email sends are idempotent per player attempt and never expose provider errors', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  await sendPlayerInvitation({
    playerName: 'Demo Player',
    email: 'player@example.com',
    userId: 'player-1',
    attempt: 2,
    environment: configuredEnvironment,
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(null, { status: 202 })
    },
  })
  assert.equal(requests[0]?.url, 'https://api.resend.com/emails')
  assert.equal(new Headers(requests[0]?.init?.headers).get('Idempotency-Key'), 'player-invitation/player-1/2')

  await assert.rejects(
    () => sendPlayerInvitation({
      playerName: 'Demo Player',
      email: 'player@example.com',
      userId: 'player-1',
      attempt: 3,
      environment: configuredEnvironment,
      fetcher: async () => new Response('sensitive provider detail', { status: 500 }),
    }),
    (error) => error instanceof InvitationDeliveryError
      && error.message === 'The email provider did not accept this invitation.',
  )
})
