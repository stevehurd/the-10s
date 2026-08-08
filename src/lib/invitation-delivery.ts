interface InvitationDeliveryEnvironment {
  INVITATION_EMAIL_ENABLED?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  APP_URL?: string
}

export interface InvitationDeliveryAvailability {
  enabled: boolean
  message: string
}

export class InvitationDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvitationDeliveryError'
  }
}

export function invitationDeliveryAvailability(
  environment: InvitationDeliveryEnvironment = process.env as InvitationDeliveryEnvironment,
): InvitationDeliveryAvailability {
  if (environment.INVITATION_EMAIL_ENABLED !== 'true') {
    return {
      enabled: false,
      message: 'Invitation email will unlock after a domain and Resend are configured.',
    }
  }

  if (!environment.RESEND_API_KEY || !environment.RESEND_FROM_EMAIL || !validAppUrl(environment.APP_URL)) {
    return {
      enabled: false,
      message: 'Invitation email is enabled, but its server configuration is incomplete.',
    }
  }

  return { enabled: true, message: 'Invitation email is ready.' }
}

export function buildInvitationEmail(input: { playerName: string; appUrl: string; email: string }) {
  const loginUrl = new URL('/login', input.appUrl)
  loginUrl.searchParams.set('email', input.email)
  loginUrl.searchParams.set('invited', 'true')

  const safeName = escapeHtml(input.playerName)
  const safeUrl = escapeHtml(loginUrl.toString())
  return {
    subject: `You’re invited to The 10’s Football Pool`,
    text: `Hi ${input.playerName},\n\nYour football pool profile is ready. Join the pool and sign in with ${input.email}:\n${loginUrl.toString()}\n\nNo password is required. We’ll email you a one-time code.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17211b"><h1 style="font-size:24px">Your football pool profile is ready</h1><p>Hi ${safeName},</p><p>You’ve been invited to join The 10’s Football Pool. Your historical teams and results are already connected to this sign-in email.</p><p><a href="${safeUrl}" style="display:inline-block;border-radius:12px;background:#c7f000;color:#17211b;font-weight:700;padding:12px 18px;text-decoration:none">Join the pool</a></p><p>No password is required. We’ll email you a one-time code.</p></div>`,
    loginUrl: loginUrl.toString(),
  }
}

export async function sendPlayerInvitation(input: {
  playerName: string
  email: string
  userId: string
  attempt: number
  environment?: InvitationDeliveryEnvironment
  fetcher?: typeof fetch
}) {
  const environment: InvitationDeliveryEnvironment = input.environment
    ?? process.env as InvitationDeliveryEnvironment
  const availability = invitationDeliveryAvailability(environment)
  if (!availability.enabled) throw new InvitationDeliveryError(availability.message)

  const message = buildInvitationEmail({
    playerName: input.playerName,
    appUrl: environment.APP_URL!,
    email: input.email,
  })
  const response = await (input.fetcher ?? fetch)('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${environment.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `player-invitation/${input.userId}/${input.attempt}`,
    },
    body: JSON.stringify({
      from: environment.RESEND_FROM_EMAIL,
      to: [input.email],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (!response.ok) {
    throw new InvitationDeliveryError('The email provider did not accept this invitation.')
  }
}

function validAppUrl(value: string | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}
