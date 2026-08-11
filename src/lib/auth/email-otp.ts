export const EMAIL_OTP_LENGTH = 6

type AuthError = { message: string } | null

export interface EmailOtpClient {
  auth: {
    signInWithOtp(input: {
      email: string
      options: { shouldCreateUser: boolean }
    }): Promise<{ error: AuthError }>
    verifyOtp(input: {
      email: string
      token: string
      type: 'email'
    }): Promise<{ error: AuthError }>
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeEmailOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)
}

export async function requestEmailOtp(client: EmailOtpClient, email: string) {
  return client.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  })
}

export async function verifyEmailOtp(client: EmailOtpClient, email: string, token: string) {
  return client.auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeEmailOtp(token),
    type: 'email',
  })
}

export function emailOtpErrorMessage(error: AuthError, operation: 'request' | 'verify') {
  if (!error) return null

  const message = error.message.toLowerCase()
  if (message.includes('rate') || message.includes('too many')) {
    return 'Too many attempts. Wait a moment, then try again.'
  }

  if (operation === 'verify') {
    return 'That code is invalid or has expired. Check the code or request a new one.'
  }

  return 'We couldn\'t send a sign-in code. Check the email address and try again.'
}
