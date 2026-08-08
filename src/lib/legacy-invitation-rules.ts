import { validateEmail } from './player-settings-rules.ts'

export type LegacyInvitationState = 'UNCLAIMED' | 'INVITED' | 'CLAIMED'

export class LegacyInvitationError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LegacyInvitationError'
    this.status = status
  }
}

export function legacyInvitationState(profile: { email: string | null; authUserId: string | null }): LegacyInvitationState {
  if (profile.authUserId) return 'CLAIMED'
  if (profile.email) return 'INVITED'
  return 'UNCLAIMED'
}

export function planLegacyInvitationChange(input: {
  profile: { id: string; email: string | null; authUserId: string | null }
  requestedEmail: unknown
  conflictingUserId?: string | null
}) {
  if (legacyInvitationState(input.profile) === 'CLAIMED') {
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
    previousState: previousEmail ? 'INVITED' : 'UNCLAIMED',
    nextState: email ? 'INVITED' : 'UNCLAIMED',
  } as const
}
