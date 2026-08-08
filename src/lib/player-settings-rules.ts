export const PLAYER_NAME_MAX_LENGTH = 60
export const ROSTER_NICKNAME_MAX_LENGTH = 40

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function validateEmail(value: string) {
  const email = normalizeEmail(value)
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new Error('Enter a valid email address')
  }
  return email
}

export function validatePlayerProfile(input: { name: string; rosterNickname?: string | null }) {
  const name = input.name.trim()
  const rosterNickname = input.rosterNickname?.trim() || null

  if (name.length < 2 || name.length > PLAYER_NAME_MAX_LENGTH) {
    throw new Error(`Name must be between 2 and ${PLAYER_NAME_MAX_LENGTH} characters`)
  }
  if (rosterNickname && rosterNickname.length > ROSTER_NICKNAME_MAX_LENGTH) {
    throw new Error(`Roster nickname must be ${ROSTER_NICKNAME_MAX_LENGTH} characters or fewer`)
  }

  return { name, rosterNickname }
}

export function playerDisplayName(name: string, rosterNickname?: string | null) {
  return editableRosterNickname(rosterNickname) || name
}

export function editableRosterNickname(value?: string | null) {
  const nickname = value?.trim() || null
  return nickname && !/^seat \d+$/i.test(nickname) ? nickname : null
}
