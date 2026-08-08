import { validateEmail } from './player-settings-rules.ts'

export type LegacyInvitationState =
  | 'NEEDS_EMAIL'
  | 'READY_TO_INVITE'
  | 'INVITATION_SENT'
  | 'SEND_FAILED'
  | 'JOINED'

interface InvitationProfile {
  email: string | null
  authUserId: string | null
  invitationSentAt?: Date | string | null
  invitationFailedAt?: Date | string | null
}

export class LegacyInvitationError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyInvitationError'
    this.status = status
  }
}

export function legacyInvitationState(profile: InvitationProfile): LegacyInvitationState {
  if (profile.authUserId) return 'JOINED'
  if (!profile.email) return 'NEEDS_EMAIL'
  if (profile.invitationFailedAt) return 'SEND_FAILED'
  if (profile.invitationSentAt) return 'INVITATION_SENT'
  return 'READY_TO_INVITE'
}

export function planLegacyInvitationChange(input: {
  profile: { id: string; email: string | null; authUserId: string | null }
  requestedEmail: unknown
  conflictingUserId?: string | null
}) {
  if (legacyInvitationState(input.profile) === 'JOINED') {
    throw new LegacyInvitationError(
      'This player has already claimed their account. Use the account recovery workflow to change it.',
      409,
    )
  }

  const email = input.requestedEmail === null
    ? null
    : validateEmail(typeof input.requestedEmail === 'string' ? input.requestedEmail : '')

  if (input.conflictingUserId && input.conflictingUserId !== input.profile.id) {
    throw new LegacyInvitationError('That email is already assigned to another player.', 409)
  }

  const previousEmail = input.profile.email?.trim().toLowerCase() || null
  if (previousEmail === email) {
    throw new LegacyInvitationError(
      email ? 'That is already this player’s invitation email.' : 'This player does not have an invitation email.',
      400,
    )
  }

  return {
    email,
    action: email
      ? previousEmail
        ? 'LEGACY_PLAYER_INVITATION_CORRECTED'
        : 'LEGACY_PLAYER_INVITATION_ASSIGNED'
      : 'LEGACY_PLAYER_INVITATION_REMOVED',
    previousState: legacyInvitationState(input.profile),
    nextState: email ? 'READY_TO_INVITE' : 'NEEDS_EMAIL',
  } as const
}

export function assertInvitationCanSend(profile: InvitationProfile) {
  const state = legacyInvitationState(profile)
  if (state === 'JOINED') {
    throw new LegacyInvitationError('This player has already joined.', 409)
  }
  if (state === 'NEEDS_EMAIL') {
    throw new LegacyInvitationError('Assign a sign-in email before sending an invitation.', 409)
  }
  return { email: profile.email as string, state }
}
